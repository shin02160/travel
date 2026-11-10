import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { handleTrips } from '../server/notion-trips.js';

const tripId = randomUUID();
const otherTripId = randomUUID();
const pin = '0427';
const redisUrl = 'https://fixture.upstash.io/';
const keys = ['trips', 'schedule', 'bookings', 'budgets', 'expenses', 'receipts', 'checklist', 'shopping'];
const sources = Object.fromEntries(keys.map(key => [key, randomUUID()]));
const env = {
  TRAVEL_DETAIL_PINS: JSON.stringify({ [tripId]: pin, [otherTripId]: pin }),
  TRAVEL_REDIS_REST_URL: redisUrl,
  TRAVEL_REDIS_REST_TOKEN: 'fixture-redis-token',
  SESSION_SECRET: randomBytes(48).toString('base64url'),
  NOTION_TRAVEL_TOKEN: 'fixture-notion-token',
  ...Object.fromEntries(keys.map(key => [`NOTION_TRAVEL_${key.toUpperCase()}_SOURCE_ID`, sources[key]])),
};
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

const pinHeaders = { host: 'localhost', origin: 'http://localhost', 'content-type': 'application/json' };
const path = `/api/trips/${tripId}`;
const allow = async () => Response.json({ result: 0 });

async function request(url, fetcher, { method = 'GET', headers = {}, config = env, body, behindVercel = false } = {}) {
  const res = response();
  await handleTrips({ method, url, headers, body }, res, config, fetcher, { behindVercel });
  return res;
}

const unlock = (fetcher, entered = pin, extra = {}) => request(path, fetcher, {
  method: 'POST', headers: pinHeaders, body: { pin: entered }, ...extra,
});

const auth = await unlock(allow);
assert.equal(auth.statusCode, 200);
const cookie = auth.headers['Set-Cookie'].split(';')[0];
const expiresAt = Number(cookie.split('=')[1].split('.')[0]);
const read = (url, fetcher) => request(url, fetcher, { headers: { cookie } });

test('public list needs no session, while detail and mutations fail closed', async () => {
  const neverFetch = () => assert.fail('unexpected upstream request');
  assert.equal((await request('/api/trips', async () => list([]))).statusCode, 200);
  assert.equal((await request(path, neverFetch)).statusCode, 401);
  assert.equal((await request(path, neverFetch, { headers: { cookie: cookie + 'x' } })).statusCode, 401);
  assert.equal((await read(`/api/trips/${otherTripId}`, neverFetch)).statusCode, 401);
  assert.equal((await read(`/api/trips/${randomUUID()}`, neverFetch)).statusCode, 403);
  assert.equal((await request(path, neverFetch, {
    headers: { cookie }, config: { ...env, TRAVEL_DETAIL_PINS: JSON.stringify({ [tripId]: '2020' }) },
  })).statusCode, 401);
  for (const method of ['PATCH', 'PUT', 'DELETE']) {
    const res = await request(path, neverFetch, { method });
    assert.equal(res.statusCode, 405);
    assert.equal(res.headers.Allow, 'GET, POST');
  }
  assert.equal((await request('/api/trips', neverFetch, { method: 'POST' })).statusCode, 405);
  assert.equal((await read('/api/trips/not-a-uuid', neverFetch)).statusCode, 400);
  assert.equal((await read(`/api/trips?tripId=${tripId}&tripId=${otherTripId}`, neverFetch)).statusCode, 400);
  assert.equal((await request('/api/trips', neverFetch, { config: { ...env, NOTION_TRAVEL_TOKEN: '' } })).statusCode, 503);
});

test('unlock uses atomic Redis quota, rejects invalid PINs and fails closed during Redis errors', async () => {
  const neverFetch = () => assert.fail('unexpected upstream request');
  assert.equal((await unlock(neverFetch, 427)).statusCode, 400);
  assert.equal((await unlock(neverFetch, '0427\n')).statusCode, 400);
  assert.equal((await unlock(neverFetch, pin, { headers: { ...pinHeaders, origin: 'http://evil.example' } })).statusCode, 403);
  assert.equal((await unlock(async () => new Response(null, { status: 503 }))).statusCode, 503);
  assert.equal((await unlock(async () => Response.json({ result: -1 }))).statusCode, 503);
  let calls = 0;
  const redis = async (url, init) => {
    assert.equal(url, redisUrl);
    assert.equal(init.headers.Authorization, 'Bearer fixture-redis-token');
    const [command, script, keys, key, limit, window] = JSON.parse(init.body);
    assert.equal(command, 'EVAL');
    assert.match(script, /redis.call\('INCR'/);
    assert.deepEqual([keys, key, limit, window], [1, `travel:pin:local:${tripId}`, 10, 3600]);
    return Response.json({ result: ++calls === 1 ? 0 : 1800 });
  };
  assert.equal((await unlock(redis, '7654')).statusCode, 401);
  const blocked = await unlock(redis);
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.headers['Retry-After'], '1800');
  assert.equal(blocked.headers['Set-Cookie'], undefined);
});

test('accepts the standard Upstash token variable when the app-specific key is absent', async () => {
  const config = { ...env, TRAVEL_REDIS_REST_TOKEN: undefined, UPSTASH_REDIS_REST_TOKEN: 'standard-token' };
  const result = await unlock(async (_url, init) => {
    assert.equal(init.headers.Authorization, 'Bearer standard-token');
    return Response.json({ result: 0 });
  }, pin, { config });
  assert.equal(result.statusCode, 200);
});

test('PIN cookie is short-lived, HttpOnly, scoped to its trip and Secure on Vercel', async t => {
  const result = await unlock(allow, pin, {
    headers: { ...pinHeaders, origin: 'https://localhost' }, behindVercel: true,
  });
  assert.equal(result.statusCode, 200);
  assert.match(result.headers['Set-Cookie'], /HttpOnly; SameSite=Strict; Secure; Max-Age=1800/);
  assert.ok(result.headers['Set-Cookie'].includes(`Path=${path};`));
  t.mock.method(Date, 'now', () => expiresAt * 1000);
  assert.equal((await read(path, () => assert.fail('expired PIN cookie reached upstream'))).statusCode, 401);
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
  assert.equal(res.body.expiresAt, undefined);
  assert.equal(res.body.trips[0].notionUrl, undefined);
  assert.deepEqual(res.body.trips.map(item => item.id), [tripId, otherTripId]);
  assert.equal(res.body.trips[1].fields.메모, undefined);
});

test('detail verifies each data source and scopes every section to exactly one trip', async () => {
  const expense = row('expenses', {
    지출명: title('교통비'), 여행: relation(tripId), '현지 금액': number(10),
    상태: { type: 'status', status: { name: '결제완료' } },
    유형: { type: 'select', select: { name: '지출' } },
    '적용 환율': number(200),
    결제자: { type: 'rich_text', rich_text: [{ plain_text: '테스트 결제자' }] },
    정산여부: { type: 'checkbox', checkbox: false },
  });
  const settledExpense = row('expenses', {
    지출명: title('숙박비'), 여행: relation(tripId), 정산여부: { type: 'checkbox', checkbox: true },
  });
  const olderExpense = row('expenses', { 지출명: title('식비'), 여행: relation(tripId) });
  const visibleBooking = row('bookings', {
    예약명: title('숙소'), 여행: relation(tripId), 예약번호: title('private'),
    예약유형: { type: 'select', select: { name: '숙소' } },
    장소: title('宜致酒店'), '숙소 주소': title('中国广东省广州市天河区天河路198号6层前台'),
    '장소 주소': title('일반 장소 주소'),
  });
  const flight = row('bookings', {
    예약명: title('항공편'), 여행: relation(tripId),
    예약유형: { type: 'select', select: { name: '항공' } },
    장소: title('인천 T1 → 마카오'), '장소 주소': title('private'),
  });
  const event = row('schedule', {
    일정명: title('숙소 방문'), 여행: relation(tripId),
    일시: { type: 'date', date: { start: '2026-12-05T14:00:00+08:00', end: null, time_zone: null } },
    메모: { type: 'rich_text', rich_text: [{ plain_text: '현지 메모' }] },
    '관련 예약': relation(visibleBooking.id, randomUUID()),
    '지도 URL': { type: 'url', url: 'https://www.google.com/maps/search/?api=1&query=Macau' },
  });
  event.url = 'https://www.notion.so/trip-event';
  const unsafeMap = row('schedule', { 일정명: title('다른 일정'), 여행: relation(tripId),
    '지도 URL': { type: 'url', url: 'https://maps.google.com.example.org/maps' } });
  const receipt = row('receipts', { 영수증명: title('교통 영수증'), 여행: relation(tripId),
    '관련 지출': relation(expense.id, randomUUID()), '증빙 이미지': title('private') });
  const checklistItem = row('checklist', { '할 일': title('여권 확인'), 여행: relation(tripId) });
  const shoppingItem = row('shopping', {
    품목: title('기념품'), 여행: relation(tripId), 분류: { type: 'select', select: { name: '캐릭터·굿즈' } },
    구매예정일: { type: 'date', date: { start: '2026-12-05' } },
    '관련 지출': relation(expense.id),
  });
  const rows = {
    bookings: [visibleBooking, flight,
      row('bookings', { 예약명: title('other'), 여행: relation(otherTripId) }),
      row('bookings', { 예약명: title('mixed'), 여행: relation(tripId, otherTripId) }),
      row('bookings', { 예약명: title('orphan') }),
      row('bookings', { 예약명: title('truncated'), 여행: { ...relation(tripId), has_more: true } }),
      row('schedule', { 예약명: title('wrong source'), 여행: relation(tripId) })],
    schedule: [event, unsafeMap], expenses: [expense, settledExpense, olderExpense], receipts: [receipt],
    checklist: [checklistItem, shoppingItem],
    shopping: [shoppingItem, checklistItem, row('shopping', { 품목: title('다른 여행 물건'), 여행: relation(otherTripId) })],
  };
  const calls = [];
  const res = await read(`/api/trips/${tripId}`, async (url, init) => {
    calls.push(url);
    if (calls.length === 1) {
      assert.equal(url, `https://api.notion.com/v1/pages/${tripId}`);
      assert.equal(init.method, 'GET');
      return Response.json(trip);
    }
    const { filter, sorts } = JSON.parse(init.body);
    assert.deepEqual(filter, { property: '여행', relation: { contains: tripId } });
    const key = keys.find(name => url.endsWith(`/${sources[name]}/query`));
    assert.ok(key);
    assert.deepEqual(sorts, key === 'expenses' ? [{ timestamp: 'created_time', direction: 'ascending' }] : undefined);
    return list(rows[key] ?? []);
  });
  assert.equal(calls.length, keys.length);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.trip.fields.총예산, 50000);
  assert.equal(res.body.expiresAt, expiresAt);
  assert.equal(res.body.trip.notionUrl, undefined);
  assert.deepEqual(Object.keys(res.body.sections), keys.slice(1));
  const [hotelBooking, flightBooking] = res.body.sections.bookings;
  assert.deepEqual(res.body.sections.bookings.map(item => item.title), ['숙소', '항공편']);
  assert.equal(hotelBooking.location, '宜致酒店');
  assert.equal(hotelBooking.address, '中国广东省广州市天河区天河路198号6层前台');
  assert.equal(flightBooking.location, '인천 T1 → 마카오');
  assert.equal(flightBooking.address, undefined);
  const [scheduled, otherEvent] = res.body.sections.schedule;
  assert.deepEqual(scheduled.bookingIds, [visibleBooking.id]);
  assert.equal(scheduled.date.start, '2026-12-05T14:00:00+08:00');
  assert.equal(scheduled.note, '현지 메모');
  assert.match(scheduled.sourceUrl, /^https:\/\/www\.notion\.so\/[a-f0-9]{32}$/);
  assert.match(scheduled.mapUrl, /^https:\/\/www\.google\.com\/maps\//);
  assert.equal(otherEvent.mapUrl, null);
  assert.equal(res.body.sections.expenses[0].fields.결제자, '테스트 결제자');
  assert.deepEqual(res.body.sections.expenses[0].posting, { status: '결제완료', type: '지출', rate: 200 });
  assert.deepEqual(res.body.sections.expenses.map(item => item.fields.정산여부), [false, true, null]);
  assert.equal(res.body.sections.receipts[0].fields['관련 지출'], '교통비');
  assert.deepEqual(res.body.sections.checklist.map(item => item.id), [checklistItem.id]);
  assert.deepEqual(res.body.sections.shopping.map(item => item.id), [shoppingItem.id]);
  assert.equal(res.body.sections.shopping[0].title, '기념품');
  assert.equal(res.body.sections.shopping[0].fields.분류, '캐릭터·굿즈');
  assert.equal(res.body.sections.shopping[0].fields.구매예정일, '2026-12-05');
  assert.equal(res.body.sections.shopping[0].fields['관련 지출'], undefined);
  assert.doesNotMatch(JSON.stringify(res.body), /private|예약번호|증빙 이미지/);

  const foreign = await read(`/api/trips?tripId=${tripId}`, async () => Response.json(row('schedule', {}, tripId)));
  assert.equal(foreign.statusCode, 404);
});

test('missing shopping configuration leaves existing trip sections available', async () => {
  const config = { ...env, NOTION_TRAVEL_SHOPPING_SOURCE_ID: '' };
  const calls = [];
  const res = await request(path, async url => {
    calls.push(url);
    return url.endsWith(`/pages/${tripId}`) ? Response.json(trip) : list([]);
  }, { config, headers: { cookie } });
  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, keys.length - 1);
  assert.ok(calls.every(url => !url.includes(sources.shopping)));
  assert.deepEqual(res.body.sections.checklist, []);
  assert.equal(res.body.sections.shopping, null);

  const duplicate = await request(path, () => assert.fail('duplicate data source reached upstream'), {
    headers: { cookie }, config: { ...env, NOTION_TRAVEL_SHOPPING_SOURCE_ID: sources.checklist },
  });
  assert.equal(duplicate.statusCode, 503);
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
