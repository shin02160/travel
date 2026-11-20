import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { normalizeCities, citiesForPage, loadCities, CITY_TTL, publicCity } from '../server/notion-cities.js';
import { calendarZone } from '../src/destinationCities.js';
import { normalizeWeather } from '../src/destinationWeather.js';
import { handleWeather } from '../api/weather.js';
import { cityFixtures, cityPage, cityEnv, cityList, relation, text } from './fixtures/cities.mjs';

test('city master validates five destinations and exact trip relations, omitting disabled cities', () => {
  const cities = normalizeCities(cityFixtures);
  assert.deepEqual(cities.map(city => city.id), ['KR_MOKPO', 'KR_BUSAN', 'MO_MACAU', 'CN_GUANGZHOU', 'CN_SHANGHAI']);
  assert.equal(cities[0].latitude, 34.8118);
  assert.equal(cities[1].zone, 'Asia/Seoul');
  const trip = (...ids) => ({ properties: { 도시: relation(...ids) } });
  assert.deepEqual(citiesForPage(trip(cities[2].notionId, cities[3].notionId), cities), cities.slice(2, 4));
  assert.deepEqual(citiesForPage(trip(cities[4].notionId), cities), [cities[4]]);
  assert.deepEqual(citiesForPage(trip(), cities), []);
  assert.deepEqual(citiesForPage(trip(randomUUID()), cities), []);
  assert.throws(() => citiesForPage({ properties: { 도시: { ...relation(cities[0].notionId), has_more: true } } }, cities), /relation/);
  assert.throws(() => citiesForPage({ properties: {} }, cities), /relation/);
  assert.equal(publicCity(cities[0]).notionId, undefined);
  const disabled = structuredClone(cityFixtures);
  disabled[0].properties.활성.checkbox = false;
  assert.deepEqual(citiesForPage(trip(cities[0].notionId), normalizeCities(disabled)), []);
});

test('invalid coordinates, names, codes, timezones and duplicate codes fail closed', () => {
  for (const [field, value] of [
    ['위도', { type: 'number', number: NaN }], ['위도', { type: 'number', number: 91 }],
    ['경도', { type: 'number', number: 181 }], ['위도', { type: 'number', number: null }],
    ['시간대', text('UTC+9')], ['시간대', text('Asia/Missing')],
    ['도시 코드', text('constructor')], ['도시명', { type: 'title', title: [] }],
  ]) {
    const pages = structuredClone(cityFixtures);
    pages[0].properties[field] = value;
    assert.throws(() => normalizeCities(pages), /city_data_invalid/);
  }
  assert.throws(() => normalizeCities([...cityFixtures, { ...cityFixtures[0], id: randomUUID() }]), /city_data_invalid/);
});

test('city repository paginates, caches per credentials, and picks up new cities after expiry', async () => {
  let calls = 0;
  let rows = cityFixtures;
  const fetcher = async (_url, init) => {
    calls++;
    const cursor = JSON.parse(init.body).start_cursor;
    return cursor ? cityList(rows.slice(2)) : cityList(rows.slice(0, 2), 'next');
  };
  assert.equal((await loadCities(cityEnv, fetcher, undefined, 0)).length, 5);
  rows = [...cityFixtures, cityPage('JP_TOKYO', '도쿄', 'Asia/Tokyo', 35.6, 139.7, randomUUID())];
  assert.equal((await loadCities(cityEnv, fetcher, undefined, CITY_TTL - 1)).length, 5);
  assert.equal(calls, 2);
  assert.equal((await loadCities(cityEnv, fetcher, undefined, CITY_TTL)).length, 6);
  assert.equal(calls, 4);
  assert.equal((await loadCities({ ...cityEnv, NOTION_TRAVEL_TOKEN: 'other' }, fetcher, undefined, CITY_TTL)).length, 6);
  assert.equal(calls, 6);
});

test('city repository retries transient failures and does not cache permission or configuration errors', async () => {
  await assert.rejects(loadCities({}, () => assert.fail()), /cities_not_configured/);
  let calls = 0;
  assert.equal((await loadCities(cityEnv, async () => ++calls < 3
    ? new Response(null, { status: 429, headers: { 'Retry-After': '0' } }) : cityList(cityFixtures))).length, 5);
  assert.equal(calls, 3);
  for (const status of [403, 404, 503]) {
    let attempts = 0;
    const fetcher = async () => { attempts++; return new Response(null, { status, headers: { 'Retry-After': '0' } }); };
    await assert.rejects(loadCities(cityEnv, fetcher), status === 503 ? /cities_unavailable/ : /cities_access_denied/);
    await assert.rejects(loadCities(cityEnv, fetcher));
    assert.equal(attempts, status === 503 ? 6 : 2);
  }
});

test('weather validates Korea, China and DST offsets at fixed instants', () => {
  const now = Date.parse('2026-11-13T15:30:00Z');
  const cities = normalizeCities(cityFixtures);
  for (const city of cities) {
    const offset = city.countryCode === 'KR' ? 32400 : 28800;
    assert.doesNotThrow(() => normalizeWeather({ utc_offset_seconds: offset }, city, now));
    assert.throws(() => normalizeWeather({ utc_offset_seconds: 0 }, city, now), /timezone/);
  }
  const ny = { zone: 'America/New_York' };
  for (const [stamp, offset] of [['2026-07-01T12:00Z', -14400], ['2026-12-01T12:00Z', -18000]]) {
    assert.doesNotThrow(() => normalizeWeather({ utc_offset_seconds: offset }, ny, Date.parse(stamp)));
    assert.throws(() => normalizeWeather({ utc_offset_seconds: offset === -14400 ? -18000 : -14400 }, ny, Date.parse(stamp)), /timezone/);
  }
  assert.equal(calendarZone(cities.slice(2, 4), '2026-12-05', '2026-12-08'), 'Asia/Macau');
  assert.equal(calendarZone([cities[0], cities[2]], '2026-12-05'), null);
});

test('weather never calls upstream for unknown, disabled, duplicate or invalid city data', async () => {
  const request = async (url, rows, config = cityEnv) => {
    const res = { headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(body) { this.body = JSON.parse(body); } };
    await handleWeather({ method: 'GET', url }, res, async url => {
      assert.ok(String(url).startsWith('https://api.notion.com/'), 'invalid city reached Open-Meteo');
      return cityList(rows);
    }, config);
    return res;
  };
  const disabled = structuredClone(cityFixtures);
  disabled[0].properties.활성.checkbox = false;
  assert.equal((await request('/api/weather?city=KR_MOKPO', disabled)).statusCode, 404);
  assert.equal((await request('/api/weather?city=KR_UNKNOWN', cityFixtures)).statusCode, 404);
  assert.equal((await request('/api/weather?city=KR_MOKPO&longitude=1', cityFixtures)).statusCode, 400);
  assert.equal((await request('/api/weather?city=KR_MOKPO', [...cityFixtures, { ...cityFixtures[0], id: randomUUID() }])).statusCode, 502);
  assert.equal((await request('/api/weather?city=KR_MOKPO', cityFixtures, {})).statusCode, 503);
});
