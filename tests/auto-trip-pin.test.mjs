import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { handleTrips } from '../server/notion-trips.js';
import { cityEnv, citySource, cityFixtures, cityList, relation, text } from './fixtures/cities.mjs';

function fixture() {
  const id = randomUUID();
  const sources = Object.fromEntries(['trips', 'schedule', 'bookings', 'budgets', 'expenses', 'receipts', 'checklist'].map(key => [key, randomUUID()]));
  const env = {
    ...cityEnv, SESSION_SECRET: randomBytes(48).toString('base64url'),
    TRAVEL_REDIS_REST_URL: 'https://test.upstash.io/', TRAVEL_REDIS_REST_TOKEN: 'fixture',
    ...Object.fromEntries(Object.entries(sources).map(([key, value]) => [`NOTION_TRAVEL_${key.toUpperCase()}_SOURCE_ID`, value])),
    NOTION_TRAVEL_INFO_SOURCE_ID: randomUUID(),
  };
  const page = { object: 'page', id, parent: { type: 'data_source_id', data_source_id: sources.trips }, properties: {
    여행명: { type: 'title', title: [{ plain_text: '새 여행' }] },
    'PIN 방식': { type: 'select', select: { name: '시작일 자동' } },
    여행기간: { type: 'date', date: { start: '2027-03-09', end: '2027-03-12' } },
    도시: relation(cityFixtures[0].id), 메모: text('private-note'),
  } };
  const state = { quota: 0, notionReads: 0, failure: false };
  const fetcher = async url => {
    if (String(url).startsWith('https://test.upstash.io/')) return Response.json({ result: state.quota });
    state.notionReads++;
    if (state.failure) return new Response(null, { status: 503, headers: { 'Retry-After': '0' } });
    if (String(url).endsWith(`/pages/${id}`)) return Response.json(page);
    if (String(url).endsWith(`/data_sources/${sources.trips}/query`)) return cityList([page]);
    if (String(url).endsWith(`/data_sources/${citySource}/query`)) return cityList(cityFixtures);
    if (String(url).includes('/pages/')) return new Response(null, { status: 404 });
    return cityList([]);
  };
  const request = async (suffix = '', { cookie, pin, method = pin === undefined ? 'GET' : 'POST', config = env, origin = 'http://localhost', contentType = 'application/json' } = {}) => {
    const res = { headers: {}, setHeader(name, value) { this.headers[name] = value; }, end(body) { this.body = JSON.parse(body); } };
    await handleTrips({ url: `/api/trips/${id}${suffix}`, method,
      headers: { host: 'localhost', origin, 'content-type': contentType, ...(cookie && { cookie }) },
      body: pin === undefined ? undefined : { pin },
    }, res, config, fetcher);
    return res;
  };
  return { id, env, sources, page, state, fetcher, request };
}

const cookieOf = response => response.headers['Set-Cookie']?.split(';')[0];
const routes = ['', '?section=info&city=KR_MOKPO', '?section=packing', '?section=photos', `?section=checklist&itemId=${randomUUID()}`];

test('participants unlock automatic trips without admin login and all detail routes still require a PIN cookie', async () => {
  const f = fixture();
  assert.equal(f.env.ADMIN_PASSWORD_HASH, undefined);
  for (const route of routes) assert.equal((await f.request(route)).statusCode, 401);
  assert.equal(f.state.notionReads, 0);
  const unlocked = await f.request('', { pin: '0309' });
  assert.equal(unlocked.statusCode, 200);
  const cookie = cookieOf(unlocked);
  assert.match(cookie, /^travel_trip_access=v2\./);
  assert.doesNotMatch(cookie, /2027-03-09|0309/);
  assert.match(unlocked.headers['Set-Cookie'], /HttpOnly; SameSite=Strict; Max-Age=1800/);
  assert.equal((await f.request('', { cookie })).statusCode, 200);
  assert.equal((await f.request('?section=info&city=KR_MOKPO', { cookie })).statusCode, 200);
  assert.equal((await f.request('?section=photos', { cookie })).statusCode, 200);
  assert.equal((await f.request('', { pin: '0310' })).statusCode, 401);
  assert.equal((await f.request('', { cookie: cookie + 'x' })).statusCode, 401);
});

test('start date and year changes invalidate automatic sessions on every protected route', async () => {
  const f = fixture();
  const cookie = cookieOf(await f.request('', { pin: '0309' }));
  f.page.properties.여행기간.date.start = '2027-03-10';
  for (const route of routes) assert.equal((await f.request(route, { cookie })).statusCode, 401);
  assert.equal((await f.request('', { pin: '0309' })).statusCode, 401);
  assert.equal((await f.request('', { pin: '0310' })).statusCode, 200);
  f.page.properties.여행기간.date = { start: '2028-03-09', end: null };
  assert.equal((await f.request('', { cookie })).statusCode, 401);
  assert.equal((await f.request('', { pin: '0309' })).statusCode, 200);
});

test('blocked and manual policies revoke automatic sessions; explicit PINs are preserved and not silently replaced', async () => {
  const f = fixture();
  const cookie = cookieOf(await f.request('', { pin: '0309' }));
  f.page.properties['PIN 방식'].select.name = '접근 차단';
  for (const route of routes) assert.equal((await f.request(route, { cookie })).body.error, 'trip_access_blocked');
  const explicit = { ...f.env, TRAVEL_DETAIL_PINS: JSON.stringify({ [f.id]: '5827' }) };
  assert.equal((await f.request('', { pin: '5827', config: explicit })).statusCode, 403);
  f.page.properties['PIN 방식'].select.name = '기존 PIN';
  assert.equal((await f.request('', { cookie })).statusCode, 403);
  assert.equal((await f.request('', { pin: '5827', config: explicit })).statusCode, 200);
  f.page.properties['PIN 방식'].select.name = '시작일 자동';
  assert.equal((await f.request('', { pin: '0309', config: explicit })).statusCode, 401);
  assert.equal((await f.request('', { pin: '0309', config: { ...f.env, TRAVEL_DETAIL_PINS: JSON.stringify({ [f.id]: null }) } })).statusCode, 403);
});

test('missing policy, invalid dates, unknown policy and source pages stay locked', async () => {
  const f = fixture();
  delete f.page.properties['PIN 방식'];
  assert.equal((await f.request('', { pin: '0309' })).statusCode, 403);
  f.page.properties['PIN 방식'] = { type: 'select', select: { name: '시작일 자동' } };
  f.page.properties['PIN 방식'].select.name = 'unknown';
  assert.equal((await f.request('', { pin: '0309' })).statusCode, 403);
  f.page.properties['PIN 방식'].select.name = '시작일 자동';
  f.page.properties.여행기간.date.start = '2027-02-30';
  assert.equal((await f.request('', { pin: '0230' })).statusCode, 403);
  f.page.properties.여행기간.date = { start: '2027-03-09', end: '2027-03-08' };
  assert.equal((await f.request('', { pin: '0309' })).statusCode, 403);
  f.page.properties.여행기간.date = { start: '2027-03-09', end: null };
  f.page.parent.data_source_id = randomUUID();
  assert.equal((await f.request('', { pin: '0309' })).statusCode, 404);
  f.page.parent.data_source_id = f.sources.trips;
  f.page.archived = true;
  assert.equal((await f.request('', { pin: '0309' })).statusCode, 404);
  f.page.archived = false;
  const publicResult = { setHeader() {}, end(body) { this.body = JSON.parse(body); } };
  await handleTrips({ url: '/api/trips', method: 'GET', headers: {} }, publicResult, f.env, f.fetcher);
  assert.equal(publicResult.statusCode, 200);
  assert.equal(publicResult.body.trips[0].fields.여행기간, '2027-03-09');
  assert.equal(publicResult.body.trips[0].fields['PIN 방식'], undefined);
  assert.equal(publicResult.body.trips[0].fields.메모, undefined);
  f.page.properties['PIN 방식'].select.name = 'unknown';
  assert.equal((await f.request('', { pin: '0309' })).statusCode, 403);
  f.page.properties['PIN 방식'].select.name = '시작일 자동';
  f.page.parent.data_source_id = randomUUID();
  assert.equal((await f.request('', { pin: '0309' })).statusCode, 404);
});

test('Redis quota, origin validation and Notion outages fail closed without issuing cookies', async () => {
  const f = fixture();
  assert.equal((await f.request('', { pin: '0309', origin: 'https://evil.example' })).statusCode, 403);
  assert.equal((await f.request('', { pin: '0309', contentType: 'text/plain' })).statusCode, 415);
  assert.equal(f.state.notionReads, 0);
  f.state.quota = 120;
  const limited = await f.request('', { pin: '0309' });
  assert.equal(limited.statusCode, 429);
  assert.equal(limited.headers['Retry-After'], '120');
  assert.equal(f.state.notionReads, 0);
  f.state.quota = 0;
  const cookie = cookieOf(await f.request('', { pin: '0309' }));
  f.state.failure = true;
  const unavailable = await f.request('', { cookie });
  assert.equal(unavailable.statusCode, 502);
  assert.equal(unavailable.body.trip, undefined);
  assert.equal(unavailable.headers['Set-Cookie'], undefined);
});

test('automatic cookies expire and cannot open another trip sharing the same date', async t => {
  const f = fixture();
  const cookie = cookieOf(await f.request('', { pin: '0309' }));
  const other = fixture();
  other.env.SESSION_SECRET = f.env.SESSION_SECRET;
  assert.equal((await other.request('', { cookie })).statusCode, 401);
  assert.equal(other.state.notionReads, 0);
  const now = Date.now();
  t.mock.method(Date, 'now', () => now + 1800 * 1000 + 1000);
  assert.equal((await f.request('', { cookie })).statusCode, 401);
});
