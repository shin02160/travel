import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import { handleAuth, verifySession } from '../server/auth-core.js';

const password = randomBytes(18).toString('base64url');
const salt = randomBytes(16);
const env = {
  ADMIN_PASSWORD_HASH: `${salt.toString('base64url')}:${scryptSync(password, salt, 64).toString('base64url')}`,
  SESSION_SECRET: randomBytes(48).toString('base64url'),
};
let n = 0;
function request(method, body, extras = {}) {
  const id = ++n;
  const req = {
    method, body,
    headers: { host: 'localhost:5173', origin: 'http://localhost:5173', 'content-type': 'application/json', ...extras },
    socket: { encrypted: false, remoteAddress: `192.0.2.${id}` },
  };
  const res = {
    headers: {},
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(body) { this.body = JSON.parse(body); },
  };
  return { req, res };
}

test('not configured: fail closed', async () => {
  const { req, res } = request('POST', { password });
  await handleAuth(req, res, {});
  assert.equal(res.statusCode, 503);
  assert.equal(res.headers['set-cookie'], undefined);
});

test('wrong password rejected; no session issued', async () => {
  const { req, res } = request('POST', { password: 'not-the-password' });
  await handleAuth(req, res, env);
  assert.equal(res.statusCode, 401);
  assert.equal(res.headers['set-cookie'], undefined);
});

test('session cookie signed, HttpOnly, SameSite, and verified server-side', async () => {
  const { req, res } = request('POST', { password });
  await handleAuth(req, res, env);
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['set-cookie'], /HttpOnly/);
  assert.match(res.headers['set-cookie'], /SameSite=Strict/);
  const cookie = res.headers['set-cookie'].split(';')[0];
  assert.equal(verifySession({ headers: { cookie } }, env), true);
  assert.equal(verifySession({ headers: { cookie: cookie + 'x' } }, env), false);
  const { req: checkReq, res: checkRes } = request('GET', undefined, { cookie });
  await handleAuth(checkReq, checkRes, env);
  assert.equal(checkRes.body.authenticated, true);
});

test('cross-site POST rejected', async () => {
  const { req, res } = request('POST', { password }, { origin: 'https://attacker.example' });
  await handleAuth(req, res, env);
  assert.equal(res.statusCode, 403);
});

test('logout clears browser cookie', async () => {
  const { req, res } = request('DELETE');
  await handleAuth(req, res, env);
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['set-cookie'], /Max-Age=0/);
});

test('production requires HTTPS Origin and sets Secure cookie', async () => {
  const options = { behindVercel: true };
  const bad = request('POST', { password });
  await handleAuth(bad.req, bad.res, env, options);
  assert.equal(bad.res.statusCode, 403);
  const good = request('POST', { password }, { origin: 'https://localhost:5173' });
  await handleAuth(good.req, good.res, env, options);
  assert.equal(good.res.statusCode, 200);
  assert.match(good.res.headers['set-cookie'], /; Secure;/);
  assert.equal(good.res.headers['cache-control'], 'no-store');
});

test('parallel guesses cannot bypass the local limiter with forged forwarding headers', async () => {
  const results = await Promise.all(Array.from({ length: 8 }, async (_, index) => {
    const { req, res } = request('POST', { password: 'wrong' }, { 'x-forwarded-for': String(index) });
    req.socket.remoteAddress = '192.0.2.100';
    await handleAuth(req, res, env);
    return res.statusCode;
  }));
  assert.equal(results.filter(status => status === 401).length, 5);
  assert.equal(results.filter(status => status === 429).length, 3);
});

test('expired and cross-origin logout requests are rejected', async t => {
  const { req, res } = request('POST', { password });
  await handleAuth(req, res, env);
  const cookie = res.headers['set-cookie'].split(';')[0];
  t.mock.method(Date, 'now', () => res.body.expiresAt * 1000);
  assert.equal(verifySession({ headers: { cookie } }, env), false);
  const logout = request('DELETE', undefined, { origin: 'https://other.example' });
  await handleAuth(logout.req, logout.res, env);
  assert.equal(logout.res.statusCode, 403);
  assert.equal(logout.res.headers['set-cookie'], undefined);
});
