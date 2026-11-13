import test from 'node:test';
import assert from 'node:assert/strict';
import { citiesForTrip } from '../src/destinationCities.js';
import { loadWeather, normalizeWeather, weatherCondition } from '../src/destinationWeather.js';
import { handleWeather } from '../api/weather.js';

const [city] = citiesForTrip('4136d8c5-8de1-81f4-a070-e07878964af0');

test('forecast uses destination midnight, preserves zeros and rejects malformed upstream data', () => {
  // At this instant Seoul is already on Nov 14, but the destination is not.
  const now = Date.parse('2026-11-13T15:30:00Z');
  const payload = {
    utc_offset_seconds: 28800,
    current: { time: '2026-11-13T23:30', temperature_2m: 0, weather_code: 0 },
    hourly: { time: ['2026-11-13T23:00', '2026-11-14T00:00'], precipitation_probability: [90, 0] },
    daily: { time: ['2026-11-13', '2026-11-14'], temperature_2m_min: [-2, null], temperature_2m_max: [0, 2] },
  };
  const weather = normalizeWeather(payload, city, now);
  assert.equal(weather.current.temp, 0);
  assert.equal(weather.current.feels, null);
  assert.equal(weatherCondition(weather.current.code)[0], '맑음');
  assert.deepEqual(weather.hourly.map(({ time, rain }) => [time, rain]), [['2026-11-14T00:00', 0]]);
  assert.deepEqual(weather.daily.map(({ time }) => time), ['2026-11-13', '2026-11-14']);
  assert.throws(() => normalizeWeather({ ...payload, utc_offset_seconds: 32400 }, city, now), /timezone/);
  assert.throws(() => normalizeWeather({ ...payload, daily: { ...payload.daily, temperature_2m_max: [0] } }, city, now), /series/);
  assert.throws(() => normalizeWeather({ ...payload, current: { time: '2026-11-13T03:00' } }, city, now), /observation/);
});

test('browser weather fetch stays on the app origin and omits cookies', async () => {
  const signal = new AbortController().signal;
  await assert.rejects(loadWeather(city, signal, async (url, options) => {
    assert.equal(url, '/api/weather?city=MO_MACAU');
    assert.equal(options.signal, signal);
    assert.equal(options.credentials, 'omit');
    return new Response(null, { status: 502 });
  }), /weather_unavailable/);
});

test('weather endpoint accepts only configured cities and caches valid responses', async () => {
  async function request(url, fetcher) {
    const res = { headers: {}, setHeader(name, value) { this.headers[name] = value; },
      end(body) { this.body = JSON.parse(body); } };
    await handleWeather({ method: 'GET', url }, res, fetcher);
    return res;
  }

  for (const url of ['/api/weather?city=constructor', '/api/weather?city=MO_MACAU&latitude=1']) {
    const invalid = await request(url, () => assert.fail('invalid request reached Open-Meteo'));
    assert.equal(invalid.statusCode, 400);
    assert.equal(invalid.headers['Cache-Control'], 'no-store');
  }

  const forecast = { utc_offset_seconds: 28800 };
  const result = await request('/api/weather?city=MO_MACAU', async (url, options) => {
    assert.equal(url.origin, 'https://api.open-meteo.com');
    assert.equal(url.searchParams.get('forecast_days'), '7');
    assert.equal(url.searchParams.get('timezone'), 'Asia/Shanghai');
    assert.equal(url.searchParams.get('latitude'), '22.1987');
    assert.equal(options.redirect, 'error');
    return Response.json(forecast);
  });
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body, forecast);
  assert.match(result.headers['Vercel-CDN-Cache-Control'], /s-maxage=300/);
});
