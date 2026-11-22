import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import { handleTrips } from '../server/notion-trips.js';
import { cityFixtures, citySource, cityList } from './fixtures/cities.mjs';

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
  const upstream = async (target, init) => {
    // Existing explicit-PIN unlock fixtures now also supply the authenticated source metadata.
    if (method === 'POST' && String(target).startsWith('https://api.notion.com/v1/pages/')) {
      return Response.json({ ...trip, id: String(target).split('/').at(-1) });
    }
    return fetcher(target, init);
  };
  await handleTrips({ method, url, headers, body }, res, config, upstream, { behindVercel });
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

test('protected details read dynamic cities, public summaries expose only calendar zone, and empty domestic guides succeed', async () => {
  const config = { ...env, NOTION_TRAVEL_CITIES_SOURCE_ID: citySource, NOTION_TRAVEL_INFO_SOURCE_ID: randomUUID() };
  const fixtureTrip = { ...trip, properties: { ...trip.properties, 도시: relation(cityFixtures[0].id) } };
  let pages = cityFixtures;
  const fetcher = async (url, init) => {
    if (url.endsWith(`/pages/${tripId}`)) return Response.json(fixtureTrip);
    if (url.endsWith(`/data_sources/${citySource}/query`)) return cityList(pages);
    if (url.endsWith(`/data_sources/${sources.trips}/query`)) return list([fixtureTrip]);
    assert.equal(JSON.parse(init.body).filter.property ?? JSON.parse(init.body).filter.and[0].property, '여행');
    return list([]);
  };
  const result = await request(path, fetcher, { config, headers: { cookie } });
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.trip.cities[0].id, 'KR_MOKPO');
  assert.equal(result.body.trip.cities[0].zone, 'Asia/Seoul');
  assert.equal(result.body.trip.cities[0].notionId, undefined);
  assert.equal(result.body.trip.citiesError, null);
  assert.ok(Array.isArray(result.body.sections.bookings));
  const publicList = await request('/api/trips', fetcher, { config });
  assert.equal(publicList.body.trips[0].calendarZone, 'Asia/Seoul');
  assert.equal(publicList.body.trips[0].cities, undefined);
  assert.equal(publicList.body.trips[0].fields.총예산, undefined);
  const empty = await request(path + '?section=info&city=KR_MOKPO', fetcher, { config, headers: { cookie } });
  assert.equal(empty.statusCode, 200);
  assert.deepEqual(empty.body.cards, []);
  assert.equal(empty.body.configured, true);
  assert.equal((await request(path + '?section=info&city=KR_BUSAN', fetcher, { config, headers: { cookie } })).statusCode, 403);
  // Incomplete relations never silently become a partial set of cities.
  fixtureTrip.properties.도시.has_more = true;
  const partial = await request(path, fetcher, { config, headers: { cookie } });
  assert.equal(partial.statusCode, 200);
  assert.equal(partial.body.trip.citiesError, 'city_relation_invalid');
  assert.ok(Array.isArray(partial.body.sections.expenses));
  assert.equal((await request(path + '?section=info&city=KR_MOKPO', fetcher, { config, headers: { cookie } })).statusCode, 502);
  fixtureTrip.properties.도시 = relation();
  const none = await request(path, fetcher, { config, headers: { cookie } });
  assert.deepEqual(none.body.trip.cities, []);
  assert.equal(none.body.trip.citiesError, null);
  pages = [];
  const missingConfig = await request(path, fetcher, { config: { ...config, NOTION_TRAVEL_CITIES_SOURCE_ID: '' }, headers: { cookie } });
  assert.equal(missingConfig.body.trip.citiesError, 'cities_not_configured');
  assert.ok(Array.isArray(missingConfig.body.sections.expenses));
});

test('gallery filters photos by trip, sorts attachments, and only proxies authenticated Notion images', async () => {
  const source = randomUUID();
  const config = { ...env, NOTION_TRAVEL_PHOTOS_SOURCE_ID: source };
  const headers = { cookie };
  const endpoint = `${path}?section=photos`;
  const never = () => assert.fail('unexpected upstream request');
  const signed = token => `https://s3.us-west-2.amazonaws.com/prod-files-secure/image.png?signature=${token}`;
  const file = (url, expiry = Date.now() + 60000) =>
    ({ type: 'file', file: { url, expiry_time: new Date(expiry).toISOString() } });
  const photo = (name, order, date, isCover, ids, files = [file(signed('secret'))]) => ({
    ...row('shopping', {
      사진명: title(name), 여행: relation(...ids), '표시 순서': number(order),
      촬영일: { type: 'date', date: { start: date } }, '대표 사진': { type: 'checkbox', checkbox: isCover },
      사진: { type: 'files', files },
    }),
    parent: { type: 'data_source_id', data_source_id: source },
  });
  const earlier = photo('earlier', 1, '2026-11-14', false, [tripId], [file(signed('one')), file(signed('two'))]);
  const cover = photo('cover', 1, '2026-11-15', true, [tripId]);
  const tied = { ...cover, id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', properties: { ...cover.properties, 사진명: title('tied') } };
  const unordered = photo('unordered', null, '2026-11-13', true, [tripId]);
  const other = photo('other', 0, '2026-11-13', true, [otherTripId], [file(signed('foreign'))]);
  const shared = photo('shared', 0, '2026-11-13', true, [tripId, otherTripId]);
  const external = photo('external', null, '2026-11-13', false, [tripId], [
    { type: 'external', external: { url: 'https://example.org/private.png' } },
  ]);
  const assetPath = id => `${endpoint}&photoId=${id}&file=0`;
  const readGallery = (url, fixture) => request(url, fixture, { headers, config });

  assert.equal((await request(endpoint, never, { config })).statusCode, 401);
  assert.equal((await request(assetPath(cover.id), never, { config })).statusCode, 401);
  assert.equal((await readGallery(assetPath(cover.id) + '&file=1', never)).statusCode, 400);
  assert.equal((await readGallery(endpoint.replace(tripId, otherTripId), never)).statusCode, 401);
  assert.equal((await request(endpoint, never, { headers, config, method: 'POST' })).statusCode, 405);

  const query = pages => async (url, init) => {
    if (url.endsWith(`/pages/${tripId}`)) return Response.json(trip);
    assert.ok(url.endsWith(`/data_sources/${source}/query`));
    assert.deepEqual(JSON.parse(init.body).filter, { property: '여행', relation: { contains: tripId } });
    return list(pages);
  };
  const result = await readGallery(endpoint, query([unordered, tied, shared, other, cover, earlier]));
  assert.equal(result.statusCode, 200);
  assert.equal(result.headers['Cache-Control'], 'private, no-store');
  assert.deepEqual(result.body.photos.map(photo => photo.title), ['earlier', 'earlier', 'cover', 'tied', 'unordered']);
  assert.equal(result.body.coverId, `${cover.id}:0`);
  assert.equal(result.body.photos[2].src, assetPath(cover.id));
  assert.doesNotMatch(JSON.stringify(result.body), /signature|amazonaws/);
  assert.equal((await readGallery(endpoint, query([earlier, external]))).body.coverId, `${earlier.id}:0`);
  assert.equal((await readGallery(endpoint, query([external]))).body.photos[0].src, null);
  assert.deepEqual((await readGallery(endpoint, query([]))).body, { expiresAt, photos: [], coverId: null, configured: true });

  const publicCoverPath = `${path}?section=cover`;
  assert.equal((await request(`${publicCoverPath}&photoId=${earlier.id}&file=0`, never, { config })).statusCode, 400);
  assert.equal((await request(publicCoverPath, never, { config, method: 'POST' })).statusCode, 405);
  assert.equal((await request(publicCoverPath, query([shared, other]), { config })).statusCode, 404);

  const { default: sharp } = await import('sharp');
  const original = await sharp({ create: { width: 1200, height: 600, channels: 3, background: '#168' } })
    .withExif({ IFD0: { Artist: 'Private test metadata' } }).jpeg().toBuffer();
  assert.ok((await sharp(original).metadata()).exif);
  const publicBytes = [];
  const publicHeaders = {};
  const output = new Writable({ write(chunk, _encoding, done) { publicBytes.push(chunk); done(); } });
  output.setHeader = (name, value) => { publicHeaders[name] = value; };
  const publicFixture = async (url, init) => {
    if (url.startsWith('https://api.notion.com/')) return query([other, earlier, cover])(url, init);
    assert.equal(url, signed('secret')); // The designated cover wins over the earlier and foreign photos.
    assert.equal(init.redirect, 'error');
    assert.equal(init.headers, undefined);
    return new Response(original, { headers: { 'Content-Type': 'image/jpeg' } });
  };
  await handleTrips({ method: 'GET', url: publicCoverPath, headers: {} }, output, config, publicFixture);
  assert.equal(output.statusCode, 200);
  assert.equal(publicHeaders['Content-Type'], 'image/jpeg');
  assert.equal(publicHeaders['Cache-Control'], 'private, no-store');
  assert.equal(publicHeaders.Location, undefined);
  const thumbnail = await sharp(Buffer.concat(publicBytes)).metadata();
  assert.deepEqual([thumbnail.width, thumbnail.height, thumbnail.exif], [800, 400, undefined]);

  const readPhotoPage = page => async url => {
    if (url.endsWith(`/pages/${tripId}`)) return Response.json(trip);
    assert.ok(url.endsWith(`/pages/${page.id}`));
    return Response.json(page);
  };
  assert.equal((await readGallery(assetPath(other.id), readPhotoPage(other))).statusCode, 404);
  assert.equal((await readGallery(assetPath(shared.id), readPhotoPage(shared))).statusCode, 404);
  assert.equal((await readGallery(assetPath(external.id), readPhotoPage(external))).statusCode, 404);

  for (const expiredBeforeRequest of [false, true]) {
    let pageReads = 0;
    const imageReads = [];
    const chunks = [];
    const output = new Writable({ write(chunk, _encoding, done) { chunks.push(chunk); done(); } });
    output.setHeader = (name, value) => { output.headers ??= {}; output.headers[name] = value; };
    const fixture = async (url, init) => {
      if (url.endsWith(`/pages/${tripId}`)) return Response.json(trip);
      if (url.endsWith(`/pages/${cover.id}`)) {
        const current = ++pageReads === 1
          ? file(signed('old'), expiredBeforeRequest ? Date.now() - 1000 : undefined)
          : file(signed('new'));
        return Response.json({ ...cover, properties: { ...cover.properties, 사진: { type: 'files', files: [current] } } });
      }
      imageReads.push(url);
      assert.equal(init.redirect, 'error');
      assert.equal(init.headers, undefined);
      if (url === signed('old')) return new Response(null, { status: 403 });
      assert.equal(url, signed('new'));
      return new Response('image bytes', { headers: { 'Content-Type': 'image/png' } });
    };
    await handleTrips({ method: 'GET', url: assetPath(cover.id), headers }, output, config, fixture);
    assert.equal(pageReads, 2);
    assert.deepEqual(imageReads, expiredBeforeRequest ? [signed('new')] : [signed('old'), signed('new')]);
    assert.equal(output.statusCode, 200);
    assert.equal(output.headers['Cache-Control'], 'private, no-store');
    assert.equal(output.headers.Location, undefined);
    assert.equal(Buffer.concat(chunks).toString(), 'image bytes');
  }
});

test('destination cards enforce PIN, trip and city boundaries and sanitize sources', async () => {
  const id = '4136d8c5-8de1-81f4-a070-e07878964af0';
  const source = randomUUID();
  const citySource = randomUUID();
  const cityId = randomUUID();
  const route = `/api/trips/${id}`;
  const endpoint = `${route}?section=info&city=MO_MACAU`;
  const config = {
    ...env, TRAVEL_DETAIL_PINS: JSON.stringify({ [id]: pin }), NOTION_TRAVEL_INFO_SOURCE_ID: source, NOTION_TRAVEL_CITIES_SOURCE_ID: citySource,
  };
  const never = () => assert.fail('unexpected upstream request');
  assert.equal((await request(endpoint, never, { config })).statusCode, 401);
  assert.equal((await request(`${route}?section=info&city=CN_SHANGHAI`, never, { config })).statusCode, 401);
  const result = await request(route, allow, { method: 'POST', headers: pinHeaders, body: { pin }, config });
  assert.equal(result.statusCode, 200);
  const headers = { cookie: result.headers['Set-Cookie'].split(';')[0] };
  assert.equal((await request(endpoint, never, { headers, config, method: 'POST' })).statusCode, 405);
  const select = name => ({ type: 'select', select: { name } });
  const regionRow = (city, relationIds, text, url, category = '주요 교통') => ({
    ...row('shopping', {
      도시: relation(city === 'MO_MACAU' ? cityId : otherTripId), 여행: relation(...relationIds), '도시 코드': select(city), 분류: select(category),
      내용: { type: 'rich_text', rich_text: [{ plain_text: text }] },
      '추천 옷차림': { type: 'rich_text', rich_text: [{ plain_text: `${text} 옷차림` }] },
      '정보 상태': select('공식 확인'),
      확인일: { type: 'date', date: { start: '2026-11-13' } },
      '출처 URL': { type: 'url', url },
    }),
    parent: { type: 'data_source_id', data_source_id: source },
  });
  const fixture = async (url, init) => {
    if (url.endsWith(`/pages/${id}`)) return Response.json({ ...trip, id, properties: { ...trip.properties, 도시: relation(cityId) } });
    if (url.endsWith(`/data_sources/${citySource}/query`)) return list([{
      object: 'page', id: cityId, parent: { type: 'data_source_id', data_source_id: citySource },
      properties: { 도시명: title('마카오'), '도시 코드': { type: 'rich_text', rich_text: [{ plain_text: 'MO_MACAU' }] },
        '국가 코드': { type: 'rich_text', rich_text: [{ plain_text: 'MO' }] },
        시간대: { type: 'rich_text', rich_text: [{ plain_text: 'Asia/Macau' }] },
        위도: number(22.1987), 경도: number(113.5439), 활성: { type: 'checkbox', checkbox: true } },
    }]);
    assert.ok(url.endsWith(`/data_sources/${source}/query`));
    assert.deepEqual(JSON.parse(init.body).filter, { and: [
      { property: '여행', relation: { contains: id } },
      { property: '도시', relation: { contains: cityId } },
    ] });
    return list([
      regionRow('MO_MACAU', [id], 'macau', 'javascript:alert(1)'),
      regionRow('CN_GUANGZHOU', [id], 'other city', null),
      regionRow('MO_MACAU', [otherTripId], 'other trip', null),
      regionRow('MO_MACAU', [id, otherTripId], 'multiple trips', null),
      regionRow('MO_MACAU', [id], 'source retained', 'https://example.org/', '여행 팁'),
      regionRow('MO_MACAU', [id], 'local features', null, '지역 특징'),
      regionRow('CN_GUANGZHOU', [id], 'other city features', null, '지역 특징'),
      regionRow('MO_MACAU', [otherTripId], 'other trip features', null, '지역 특징'),
    ]);
  };
  assert.equal((await request(`${route}?section=info&city=CN_SHANGHAI`, fixture, { headers, config })).statusCode, 403);
  const { body, statusCode } = await request(endpoint, fixture, { headers, config });
  assert.equal(statusCode, 200);
  assert.deepEqual(body.cards.map(({ text, date, status, url }) => [text, date, status, url]), [
    ['local features', '2026-11-13', '미확인', null],
    ['macau', '2026-11-13', '미확인', null],
    ['source retained', '2026-11-13', '공식 확인', 'https://example.org/'],
  ]);
  assert.deepEqual(body.cards.flatMap(card => card.clothing ? [card.clothing] : []), ['local features 옷차림']);
  const duplicate = await request(endpoint, async (url, init) => {
    const response = await fixture(url, init);
    if (!url.endsWith(`/data_sources/${source}/query`)) return response;
    const data = await response.json();
    data.results.push({ ...data.results[0], id: randomUUID() });
    return Response.json(data);
  }, { headers, config });
  assert.equal(duplicate.body.cards.find(card => card.category === '주요 교통').duplicate, true);
  const mismatch = await request(endpoint, async (url, init) => {
    const response = await fixture(url, init);
    if (!url.endsWith(`/data_sources/${source}/query`)) return response;
    const data = await response.json();
    data.results[0].properties['도시 코드'] = select('CN_SHANGHAI');
    return Response.json(data);
  }, { headers, config });
  assert.equal(mismatch.statusCode, 502);
  assert.equal(mismatch.body.cards, undefined);
  const unconfigured = await request(endpoint, fixture, { headers, config: { ...config, NOTION_TRAVEL_INFO_SOURCE_ID: '' } });
  assert.equal(unconfigured.body.configured, false);
  assert.deepEqual(unconfigured.body.cards, []);
});

test('public list needs no session, while detail and mutations fail closed', async () => {
  const neverFetch = () => assert.fail('unexpected upstream request');
  assert.equal((await request('/api/trips', async () => list([]))).statusCode, 200);
  assert.equal((await request(path, neverFetch)).statusCode, 401);
  assert.equal((await request(path, neverFetch, { headers: { cookie: cookie + 'x' } })).statusCode, 401);
  assert.equal((await read(`/api/trips/${otherTripId}`, neverFetch)).statusCode, 401);
  assert.equal((await read(`/api/trips/${randomUUID()}`, neverFetch)).statusCode, 401);
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
    '표시 순서': number(20),
    지출명: title('교통비'), 여행: relation(tripId), '현지 금액': number(10),
    상태: { type: 'status', status: { name: '결제완료' } },
    유형: { type: 'select', select: { name: '지출' } },
    '적용 환율': number(200),
    결제자: { type: 'rich_text', rich_text: [{ plain_text: '테스트 결제자' }] },
    결제수단: { type: 'select', select: { name: '카드' } },
    비용구분: { type: 'select', select: { name: '개인' } },
    정산여부: { type: 'checkbox', checkbox: false },
  });
  const settledExpense = row('expenses', {
    지출명: title('숙박비'), 여행: relation(tripId), 정산여부: { type: 'checkbox', checkbox: true },
    비용구분: { type: 'select', select: { name: '공동' } },
  });
  const olderExpense = row('expenses', { 지출명: title('식비'), 여행: relation(tripId) });
  const visibleBooking = row('bookings', {
    '표시 순서': number(0),
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
  const checklistShopping = row('checklist', {
    '할 일': title('택배 수령'), 여행: relation(tripId), 분류: { type: 'select', select: { name: '쇼핑' } },
    유형: { type: 'select', select: { name: '준비·배송' } },
    구매예정일: { type: 'date', date: { start: '2026-12-06' } },
  });
  const foreignChecklistShopping = row('checklist', { ...checklistShopping.properties, 여행: relation(otherTripId) });
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
    checklist: [checklistItem, shoppingItem, checklistShopping, foreignChecklistShopping],
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
  assert.equal(hotelBooking.displayOrder, 0);
  assert.equal(flightBooking.displayOrder, null);
  const [scheduled, otherEvent] = res.body.sections.schedule;
  assert.deepEqual(scheduled.bookingIds, [visibleBooking.id]);
  assert.equal(scheduled.date.start, '2026-12-05T14:00:00+08:00');
  assert.equal(scheduled.note, '현지 메모');
  assert.match(scheduled.sourceUrl, /^https:\/\/www\.notion\.so\/[a-f0-9]{32}$/);
  assert.match(scheduled.mapUrl, /^https:\/\/www\.google\.com\/maps\//);
  assert.equal(otherEvent.mapUrl, null);
  assert.equal(res.body.sections.expenses[0].fields.결제자, '테스트 결제자');
  assert.deepEqual(res.body.sections.expenses.map(item => item.fields.결제수단), ['카드', null, null]);
  assert.deepEqual(res.body.sections.expenses.map(item => item.fields.비용구분), ['개인', '공동', null]);
  assert.equal(res.body.sections.expenses[0].displayOrder, 20);
  assert.deepEqual(res.body.sections.expenses[0].posting, { status: '결제완료', type: '지출', rate: 200 });
  assert.deepEqual(res.body.sections.expenses.map(item => item.fields.정산여부), [false, true, null]);
  assert.equal(res.body.sections.receipts[0].fields['관련 지출'], '교통비');
  assert.deepEqual(res.body.sections.checklist.map(item => item.id), [checklistItem.id]);
  assert.deepEqual(res.body.sections.shopping.map(item => item.id), [shoppingItem.id, checklistShopping.id]);
  assert.equal(res.body.sections.shopping[0].title, '기념품');
  assert.equal(res.body.sections.shopping[0].fields.분류, '캐릭터·굿즈');
  assert.equal(res.body.sections.shopping[0].fields.구매예정일, '2026-12-05');
  assert.equal(res.body.sections.shopping[0].fields['관련 지출'], undefined);
  const movedShopping = res.body.sections.shopping[1];
  assert.equal(movedShopping.title, '택배 수령');
  assert.equal(movedShopping.sourceSection, 'checklist');
  assert.equal(movedShopping.fields.유형, '준비·배송');
  assert.equal(movedShopping.fields.구매예정일, '2026-12-06');
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

  const legacyItem = row('checklist', {
    '할 일': title('현지 쇼핑'), 여행: relation(tripId), 분류: { type: 'select', select: { name: '쇼핑' } },
  });
  const fallback = await request(path, async url => {
    if (url.endsWith(`/pages/${tripId}`)) return Response.json(trip);
    return list(url.endsWith(`/${sources.checklist}/query`) ? [legacyItem] : []);
  }, { config, headers: { cookie } });
  assert.equal(fallback.statusCode, 200);
  assert.deepEqual(fallback.body.sections.checklist, []);
  assert.deepEqual(fallback.body.sections.shopping.map(({ id, sourceSection }) => [id, sourceSection]), [
    [legacyItem.id, 'checklist'],
  ]);

  const duplicate = await request(path, () => assert.fail('duplicate data source reached upstream'), {
    headers: { cookie }, config: { ...env, NOTION_TRAVEL_SHOPPING_SOURCE_ID: sources.checklist },
  });
  assert.equal(duplicate.statusCode, 503);
});

test('item body requires the trip PIN and rejects items outside the exact travel and data source', async () => {
  const itemId = randomUUID();
  const endpoint = `${path}?section=checklist&itemId=${itemId}`;
  const neverFetch = () => assert.fail('unexpected upstream request');
  assert.equal((await request(endpoint, neverFetch)).statusCode, 401);
  assert.equal((await request(endpoint, neverFetch, { method: 'POST' })).statusCode, 405);
  assert.equal((await read(`${endpoint}&itemId=${itemId}`, neverFetch)).statusCode, 400);
  for (const item of [
    row('checklist', { 여행: relation(otherTripId) }, itemId),
    row('checklist', { 여행: relation(tripId, otherTripId) }, itemId),
    row('shopping', { 여행: relation(tripId) }, itemId),
  ]) {
    const result = await read(endpoint, async url => {
      if (url.endsWith(`/pages/${tripId}`)) return Response.json(trip);
      assert.ok(url.endsWith(`/pages/${itemId}`));
      return Response.json(item);
    });
    assert.equal(result.statusCode, 404);
  }
});

test('booking expansion returns selected details for the unlocked trip without private booking properties', async () => {
  const itemId = randomUUID();
  const endpoint = `${path}?section=bookings&itemId=${itemId}`;
  const neverFetch = () => assert.fail('unexpected upstream request');
  assert.equal((await request(endpoint, neverFetch)).statusCode, 401);
  assert.equal((await request(endpoint, neverFetch, { method: 'POST' })).statusCode, 405);
  const richText = plain_text => ({ type: 'rich_text', rich_text: [{ plain_text }] });
  const attrs = {
    여행: relation(tripId), 예약처: richText('호텔'), 장소: richText('현지 상호명'),
    '숙소 주소': richText('현지 주소'), '장소 주소': richText(' 현지 주소 '),
    예약금액: number(0), 통화: { type: 'select', select: { name: 'CNY' } },
    취소기한: { type: 'date', date: { start: '2026-12-03T18:00:00+08:00' } },
    '취소·환불 조건': richText('기한 전 무료 취소'),
    예약번호: richText('secret-booking-number'), 메모: richText('secret-memo'),
    '예약 URL': { type: 'url', url: 'https://example.org/secret-link' },
  };
  const fetchItem = item => async url => {
    if (url.endsWith(`/pages/${tripId}`)) return Response.json(trip);
    assert.ok(url.endsWith(`/pages/${itemId}`));
    return Response.json(item);
  };
  const res = await read(endpoint, fetchItem(row('bookings', attrs, itemId)));
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['Cache-Control'], 'private, no-store');
  assert.deepEqual(res.body, { expiresAt, sourceId: itemId, fields: {
    예약처: '호텔', 장소: '현지 상호명', '숙소 주소': '현지 주소', 통화: 'CNY', 예약금액: 0,
    취소기한: '2026-12-03T18:00:00+08:00', '취소·환불 조건': '기한 전 무료 취소',
  } });
  assert.equal((await read(endpoint, fetchItem(row('bookings', { 여행: relation(otherTripId) }, itemId)))).statusCode, 404);
  assert.equal((await read(endpoint, fetchItem(row('checklist', attrs, itemId)))).statusCode, 404);
});

test('item body reads nested Notion checkboxes and paginates without exposing embedded pages', async () => {
  const itemId = randomUUID();
  const headingId = randomUUID();
  const entry = row('shopping', { 여행: relation(tripId) }, itemId);
  const block = (type, text, extra = {}) => ({
    id: randomUUID(), type, [type]: { rich_text: [{ plain_text: text }], ...extra },
  });
  const result = await read(`${path}?section=shopping&itemId=${itemId}`, async value => {
    const url = new URL(value);
    if (url.pathname.endsWith(`/pages/${tripId}`)) return Response.json(trip);
    if (url.pathname.endsWith(`/pages/${itemId}`)) return Response.json(entry);
    if (url.pathname.endsWith(`/blocks/${headingId}/children`)) return list([block('to_do', '셀프 선반에서 수령', { checked: true })]);
    assert.ok(url.pathname.endsWith(`/blocks/${itemId}/children`));
    if (url.searchParams.get('start_cursor') === 'next') return list([block('paragraph', '호텔 안내')]);
    return list([
      { ...block('heading_2', '조건부 체크리스트'), id: headingId, has_children: true },
      { ...block('child_page', '외부 페이지'), has_children: true },
    ], 'next');
  });
  assert.equal(result.statusCode, 200);
  assert.equal(result.headers['Cache-Control'], 'private, no-store');
  assert.equal(result.body.partial, true);
  assert.deepEqual(result.body.blocks.map(item => item.text), ['조건부 체크리스트', '호텔 안내']);
  assert.equal(result.body.blocks[0].children[0].checked, true);
  assert.equal(result.body.blocks[0].children[0].text, '셀프 선반에서 수령');
});

test('packing reads only the named direct child page of the unlocked trip', async () => {
  const pageId = randomUUID();
  const endpoint = `${path}?section=packing`;
  const neverFetch = () => assert.fail('unauthorized request reached Notion');
  assert.equal((await request(endpoint, neverFetch)).statusCode, 401);
  assert.equal((await request(endpoint, neverFetch, { method: 'POST' })).statusCode, 405);
  assert.equal((await read(`${endpoint}&itemId=${pageId}`, neverFetch)).statusCode, 400);
  let bodyCalls = 0;
  const upstream = async (url, foreign = false) => {
    if (url.endsWith(`/pages/${tripId}`)) return Response.json(trip);
    if (url.includes(`/blocks/${tripId}/children`)) return list([{
      id: pageId, type: 'child_page', child_page: { title: '공통 준비물 간편 체크' },
    }]);
    if (url.endsWith(`/pages/${pageId}`)) return Response.json({
      object: 'page', id: pageId, parent: { type: 'page_id', page_id: foreign ? otherTripId : tripId },
    });
    assert.ok(url.includes(`/blocks/${pageId}/children`));
    bodyCalls++;
    return list([{
      id: randomUUID(), type: 'to_do', to_do: { checked: true, rich_text: [{ plain_text: '여권' }] },
    }]);
  };
  const res = await read(endpoint, url => upstream(url));
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.sourceId, pageId);
  assert.equal(res.body.blocks[0].text, '여권');
  assert.equal(res.body.blocks[0].checked, true);
  assert.equal((await read(endpoint, url => upstream(url, true))).statusCode, 404);
  assert.equal(bodyCalls, 1);
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
