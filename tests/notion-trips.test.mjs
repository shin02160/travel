import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, scryptSync } from 'node:crypto';
import { handleAuth } from '../server/auth-core.js';
import { handleTrips } from '../server/notion-trips.js';

const password = randomBytes(18).toString('base64url');
const salt = randomBytes(16);
const keys = ['trips', 'schedule', 'bookings', 'budgets', 'expenses', 'receipts', 'checklist'];
const sources = Object.fromEntries(keys.map(key => [key, randomUUID()]));
const env = {
  ADMIN_PASSWORD_HASH: `${salt.toString('base64url')}:${scryptSync(password, salt, 64).toString('base64url')}`,
  SESSION_SECRET: randomBytes(48).toString('base64url'),
  NOTION_TRAVEL_TOKEN: 'fixture-notion-token',
  ...Object.fromEntries(keys.map(key => [`NOTION_TRAVEL_${key.toUpperCase()}_SOURCE_ID`, sources[key]])),
};
const tripId = randomUUID();
const otherTripId = randomUUID();
const relation = (...ids) => ({ type: 'relation', has_more: false, relation: ids.map(id => ({ id })) });
const title = text => ({ type: 'title', title: [{ plain_text: text }] });
const number = value => ({ type: 'number', number: value });
const row = (source, properties, id = randomUUID()) => ({
  object: 'page', id, parent: { type: 'data_source_id', data_source_id: sources[source] }, properties,
});
const trip = row('trips', { 여행명: title('첫 여행'), 총예산: { type: 'rollup', rollup: { type: 'number', number: 50000 } } }, tripId);
const list = (results, cursor = null) => Response.json({
  results, has_more: cursor !== null, next_cursor: cursor,
});

function response() {
  return {
    headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    end(body) { this.body = JSON.parse(body); },
  };
}

const auth = response();
await handleAuth({
  method: 'POST', body: { password },
  headers: { host: 'localhost', origin: 'http://localhost', 'content-type': 'application/json' },
}, auth, env);
assert.equal(auth.statusCode, 200);
const cookie = auth.headers['Set-Cookie'].split(';')[0];

async function read(path, fetcher, { method = 'GET', headers = { cookie }, config = env } = {}) {
  const res = response();
  await handleTrips({ method, url: path, headers }, res, config, fetcher);
  return res;
}

test('read endpoints require a valid P0 session and reject writes before reaching Notion', async () => {
  const neverFetch = () => assert.fail('unexpected Notion request');
  assert.equal((await read('/api/trips', neverFetch, { headers: {} })).statusCode, 401);
  assert.equal((await read('/api/trips', neverFetch, { headers: { cookie: cookie + 'x' } })).statusCode, 401);
  for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
    const res = await read(`/api/trips/${tripId}`, neverFetch, { method });
    assert.equal(res.statusCode, 405);
    assert.equal(res.headers.Allow, 'GET');
  }
  assert.equal((await read('/api/trips/not-a-uuid', neverFetch)).statusCode, 400);
  assert.equal((await read(`/api/trips?tripId=${tripId}&tripId=${otherTripId}`, neverFetch)).statusCode, 400);
  assert.equal((await read('/api/trips', neverFetch, { config: { ...env, NOTION_TRAVEL_TOKEN: '' } })).statusCode, 503);
});

test('trip list follows Notion cursors, deduplicates rows and returns safe summaries', async () => {
  const other = row('trips', { 여행명: title('둘째 여행'), 메모: title('비공개 요약 제외') }, otherTripId);
  let calls = 0;
  const res = await read('/api/trips', async (url, init) => {
    assert.equal(url, `https://api.notion.com/v1/data_sources/${sources.trips}/query`);
    assert.equal(init.method, 'POST');
    assert.equal(init.headers.Authorization, 'Bearer fixture-notion-token');
    const { start_cursor: cursor } = JSON.parse(init.body);
    calls++;
    if (!cursor) return list([trip], 'next');
    assert.equal(cursor, 'next');
    return list([trip, other, { ...trip, id: randomUUID(), in_trash: true }]);
  });
  assert.equal(calls, 2);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['Cache-Control'], 'private, no-store');
  assert.equal(res.body.expiresAt, auth.body.expiresAt);
  assert.deepEqual(res.body.trips.map(item => item.id), [tripId, otherTripId]);
  assert.equal(res.body.trips[1].fields.메모, undefined);
});

test('detail verifies the parent data source and scopes all six sections to exactly one trip', async () => {
  const expense = row('expenses', { 지출명: title('교통비'), 여행: relation(tripId), '현지 금액': number(10), 결제자: title('private') });
  const visibleBooking = row('bookings', { 예약명: title('숙소'), 여행: relation(tripId), 예약번호: title('private') });
  const receipt = row('receipts', { 영수증명: title('교통 영수증'), 여행: relation(tripId),
    '관련 지출': relation(expense.id, randomUUID()), '증빙 이미지': title('private') });
  const rows = {
    bookings: [visibleBooking,
      row('bookings', { 예약명: title('other'), 여행: relation(otherTripId) }),
      row('bookings', { 예약명: title('mixed'), 여행: relation(tripId, otherTripId) }),
      row('bookings', { 예약명: title('orphan') }),
      row('bookings', { 예약명: title('truncated'), 여행: { ...relation(tripId), has_more: true } }),
      row('schedule', { 예약명: title('wrong source'), 여행: relation(tripId) })],
    expenses: [expense], receipts: [receipt],
  };
  const calls = [];
  const res = await read(`/api/trips/${tripId}`, async (url, init) => {
    calls.push(url);
    if (calls.length === 1) {
      assert.equal(url, `https://api.notion.com/v1/pages/${tripId}`);
      assert.equal(init.method, 'GET');
      return Response.json(trip);
    }
    assert.deepEqual(JSON.parse(init.body).filter, { property: '여행', relation: { contains: tripId } });
    const key = keys.find(name => url.endsWith(`/${sources[name]}/query`));
    assert.ok(key);
    return list(rows[key] ?? []);
  });
  assert.equal(calls.length, 7);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.trip.fields.총예산, 50000);
  assert.deepEqual(Object.keys(res.body.sections), keys.slice(1));
  assert.deepEqual(res.body.sections.bookings.map(item => item.title), ['숙소']);
  assert.equal(res.body.sections.receipts[0].fields['관련 지출'], '교통비');
  assert.doesNotMatch(JSON.stringify(res.body), /private|예약번호|결제자|증빙 이미지/);

  const foreign = await read(`/api/trips?tripId=${tripId}`, async () => Response.json(row('schedule', {}, tripId)));
  assert.equal(foreign.statusCode, 404);
});

test('429 honors Retry-After and upstream failures never look like empty data', async () => {
  let count = 0;
  const recovered = await read('/api/trips', async () => ++count === 1
    ? new Response(null, { status: 429, headers: { 'Retry-After': '0' } })
    : list([]));
  assert.equal(count, 2);
  assert.deepEqual(recovered.body.trips, []);
  const denied = await read('/api/trips', async () => Response.json({ message: 'secret' }, { status: 403 }));
  assert.equal(denied.statusCode, 502);
  assert.deepEqual(denied.body, { error: 'notion_unavailable' });
  const incomplete = await read('/api/trips', async () => Response.json({
    results: [], has_more: false, request_status: { type: 'incomplete' },
  }));
  assert.equal(incomplete.statusCode, 502);
  const loop = await read('/api/trips', async () => list([], 'same'));
  assert.equal(loop.statusCode, 502);
});
