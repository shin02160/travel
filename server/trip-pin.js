import { createHmac, timingSafeEqual } from 'node:crypto';
import { readBody } from './auth-core.js';

const COOKIE = 'travel_trip_access';
const TTL = 30 * 60;
const LIMIT = 10;
const WINDOW = 60 * 60;
const PIN = /^[0-9]{4}$/;
const RESERVE_ATTEMPT = `
local count = tonumber(redis.call('GET', KEYS[1]) or '0')
if count >= tonumber(ARGV[1]) then
  local ttl = redis.call('TTL', KEYS[1])
  return ttl > 0 and ttl or tonumber(ARGV[2])
end
if count == 0 then redis.call('SET', KEYS[1], 1, 'EX', ARGV[2])
else redis.call('INCR', KEYS[1]) end
return 0
`;

export function tripPinConfig(tripId, env) {
  try {
    const pins = JSON.parse(env.TRAVEL_DETAIL_PINS ?? '{}');
    const pin = Object.hasOwn(pins, tripId) ? pins[tripId] : null;
    if (typeof pin !== 'string' || pin.length !== 4 || !PIN.test(pin) || (env.SESSION_SECRET?.length ?? 0) < 32) return null;
    return { pin, secret: env.SESSION_SECRET };
  } catch {
    return null;
  }
}

function sign(tripId, expiry, config) {
  return createHmac('sha256', config.secret)
    .update(`travel-trip-v1:${tripId}:${expiry}:${config.pin}`)
    .digest();
}

export function tripSessionExpiry(req, tripId, config) {
  if (!config) return 0;
  const cookie = req.headers.cookie?.split(';').map(part => part.trim())
    .find(part => part.startsWith(`${COOKIE}=`));
  const match = cookie?.match(/^travel_trip_access=([0-9]{10})\.([A-Za-z0-9_-]{43})$/);
  if (!match) return 0;
  const expiresAt = Number(match[1]);
  const actual = Buffer.from(match[2], 'base64url');
  if (expiresAt * 1000 <= Date.now() || actual.length !== 32 ||
      !timingSafeEqual(actual, sign(tripId, expiresAt, config))) return 0;
  return expiresAt;
}

async function reserveAttempt(tripId, env, fetcher) {
  const url = new URL(env.TRAVEL_REDIS_REST_URL);
  const token = env.TRAVEL_REDIS_REST_TOKEN?.trim() || env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.upstash.io') ||
      url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash ||
      !token) throw new Error('Invalid Redis configuration');
  const key = `travel:pin:${env.VERCEL_ENV ?? 'local'}:${tripId}`;
  const response = await fetcher(url.href, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(['EVAL', RESERVE_ATTEMPT, 1, key, LIMIT, WINDOW]),
    signal: AbortSignal.timeout(3000),
    redirect: 'error',
  });
  if (!response.ok) throw new Error('Redis request failed');
  const { result } = await response.json();
  if (!Number.isInteger(result) || result < 0 || result > WINDOW) throw new Error('Invalid Redis response');
  return result;
}

export async function unlockTrip(req, res, respond, tripId, config, env, fetcher, behindVercel) {
  const secure = behindVercel || !!req.socket?.encrypted;
  if (!req.headers.host || req.headers.origin !== `${secure ? 'https' : 'http'}://${req.headers.host}`) {
    return respond(res, 403, { error: 'origin_mismatch' });
  }
  if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') {
    return respond(res, 415, { error: 'expected_json' });
  }
  if (!config) return respond(res, 403, { error: 'trip_pin_not_configured' });

  const { pin } = await readBody(req) ?? {};
  if (typeof pin !== 'string' || pin.length !== 4 || !PIN.test(pin)) return respond(res, 400, { error: 'invalid_pin_format' });

  let retryAfter;
  try {
    retryAfter = await reserveAttempt(tripId, env, fetcher);
  } catch {
    return respond(res, 503, { error: 'pin_limiter_unavailable' });
  }
  if (retryAfter > 0) {
    res.setHeader('Retry-After', String(retryAfter));
    return respond(res, 429, { error: 'too_many_pin_attempts' });
  }
  if (!timingSafeEqual(Buffer.from(pin), Buffer.from(config.pin))) {
    return respond(res, 401, { error: 'invalid_pin' });
  }

  const expiresAt = Math.floor(Date.now() / 1000) + TTL;
  const value = `${expiresAt}.${sign(tripId, expiresAt, config).toString('base64url')}`;
  res.setHeader('Set-Cookie', `${COOKIE}=${value}; Path=/api/trips/${tripId}; HttpOnly; SameSite=Strict; ${secure ? 'Secure; ' : ''}Max-Age=${TTL}`);
  return respond(res, 200, { unlocked: true });
}
