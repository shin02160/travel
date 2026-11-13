import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const COOKIE_NAME = 'travel_admin_session';
const SESSION_TTL_SECONDS = 60 * 60; // 1 hour, short-lived and HttpOnly
const MAX_BODY_BYTES = 1024;
const MAX_FAILURES = 5;
const FAILURE_WINDOW_MS = 15 * 60_000;
// Best-effort only: in-memory counters do not cover all serverless instances.
const failures = new Map();

function send(res, status, obj, cookie) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (cookie) res.setHeader('Set-Cookie', cookie);
  res.end(JSON.stringify(obj));
}

function ready(env) {
  return /^[A-Za-z0-9_-]{22}:[A-Za-z0-9_-]{86}$/.test(env.ADMIN_PASSWORD_HASH ?? '') &&
    env.SESSION_SECRET?.length >= 32;
}

function sign(value, secret) {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function issueSession(secret, expiresAt) {
  const payload = Buffer.from(JSON.stringify({
    exp: expiresAt,
    nonce: randomBytes(16).toString('base64url'),
  })).toString('base64url');
  return `v1.${payload}.${sign(payload, secret)}`;
}

function sessionExpiry(req, env = process.env) {
  if (!ready(env)) return false;
  const cookie = (req.headers?.cookie || '').split(';').map(x => x.trim())
    .find(x => x.startsWith(`${COOKIE_NAME}=`));
  if (!cookie) return false;
  const value = cookie.slice(COOKIE_NAME.length + 1);
  const parts = value.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return false;
  const expected = Buffer.from(sign(parts[1], env.SESSION_SECRET));
  const actual = Buffer.from(parts[2]);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return Number.isInteger(payload.exp) && payload.exp > Date.now() / 1000 ? payload.exp : false;
  } catch {
    return false;
  }
}

export function verifySession(req, env = process.env) {
  return Boolean(sessionExpiry(req, env));
}

async function verifyPassword(password, hashSetting) {
  if (typeof password !== 'string' || !password || password.length > 256) return false;
  try {
    const [salt, encoded] = hashSetting.split(':');
    const expected = Buffer.from(encoded, 'base64url');
    if (expected.length !== 64) return false;
    const actual = await scrypt(password, Buffer.from(salt, 'base64url'), 64);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export async function readBody(req) {
  if (req.body !== undefined) {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      req.resume();
      return null;
    }
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return null; }
}

export async function handleAuth(req, res, env = process.env, { behindVercel = false } = {}) {
  if (!ready(env)) return send(res, 503, { error: 'Authentication is not configured' });

  if (req.method === 'GET') {
    return send(res, 200, { authenticated: verifySession(req, env) });
  }
  if (!['POST', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return send(res, 405, { error: 'Method not allowed' });
  }
  const secure = behindVercel || !!req.socket?.encrypted;
  const expectedOrigin = `${secure ? 'https' : 'http'}://${req.headers.host}`;
  if (!req.headers.host || req.headers.origin !== expectedOrigin) {
    return send(res, 403, { error: 'Origin mismatch' });
  }
  const attributes = `Path=/; HttpOnly; SameSite=Strict; ${secure ? 'Secure; ' : ''}`;
  if (req.method === 'DELETE') {
    return send(res, 200, { authenticated: false }, `${COOKIE_NAME}=; ${attributes}Max-Age=0`);
  }
  if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') {
    return send(res, 415, { error: 'Expected JSON' });
  }
  const forwarded = behindVercel ? req.headers['x-vercel-forwarded-for'] : null;
  const who = (forwarded || req.socket?.remoteAddress || 'unknown').slice(0, 120);
  const now = Date.now();
  for (const [source, entry] of failures) {
    if (entry.until <= now) failures.delete(source);
  }
  const previous = failures.get(who);
  if ((previous?.count ?? 0) >= MAX_FAILURES || (!previous && failures.size >= 2048)) {
    return send(res, 429, { error: 'Too many requests' });
  }
  // Reserve a slot before the first await so parallel guesses share the same limit.
  const attempt = previous ?? { count: 0, until: now + FAILURE_WINDOW_MS };
  attempt.count++;
  failures.set(who, attempt);
  const body = await readBody(req);
  if (!body) return send(res, 400, { error: 'Invalid request body' });
  const valid = await verifyPassword(body.password, env.ADMIN_PASSWORD_HASH);
  if (!valid) return send(res, 401, { error: 'Invalid credentials' });

  if (failures.get(who) === attempt) failures.delete(who);
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  return send(res, 200, { authenticated: true, expiresAt },
    `${COOKIE_NAME}=${issueSession(env.SESSION_SECRET, expiresAt)}; ${attributes}Max-Age=${SESSION_TTL_SECONDS}`);
}
