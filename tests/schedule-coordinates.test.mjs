import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleCoordinates } from '../server/scheduleCoordinates.js';
import { safeScheduleMapUrl } from '../src/mapLinks.js';
import { routeTileConfig } from '../src/routeTileConfig.js';

const number = number => ({ type: 'number', number });
const link = url => ({ '지도 URL': { type: 'url', url } });

test('Notion WGS84 coordinates preserve zero, validate both numbers, and precede links', () => {
  assert.deepEqual(scheduleCoordinates({ 위도: number(0), 경도: number(0) }), { lat: 0, lng: 0, source: 'notion' });
  for (const pair of [[null, 0], ['', 0], [NaN, 0], [Infinity, 0], [91, 0], [0, 181]]) {
    assert.equal(scheduleCoordinates({ 위도: number(pair[0]), 경도: number(pair[1]) }), null);
  }
  assert.equal(scheduleCoordinates({}), null);
  assert.deepEqual(scheduleCoordinates({ 위도: number(1), 경도: number(2), ...link('https://www.google.com/maps/search/?api=1&query=3,4#WGS84') }), { lat: 1, lng: 2, source: 'notion' });
  assert.equal(scheduleCoordinates({ 위도: number(1), 경도: number(2), 좌표계: { type: 'select', select: { name: 'GCJ-02' } } }), null);
});

test('only explicitly confirmed WGS84 coordinate searches are parsed, never cameras, routes or redirects', () => {
  const prefix = 'https://www.google.com/maps/';
  assert.deepEqual(scheduleCoordinates(link(prefix + 'search/?api=1&query=35.1,129.1#WGS84')), { lat: 35.1, lng: 129.1, source: 'map-url' });
  for (const url of [prefix + 'search/?api=1&query=22,113', prefix + '@22,113,16z',
    prefix + 'dir/?api=1&origin=1,2&destination=3,4#WGS84', prefix + 'search/?api=1&query=Place#WGS84',
    prefix + 'search/?api=1&query=22,113&query=1,2#WGS84', prefix + 'search/?api=1&query=91,113#WGS84',
    'https://maps.app.goo.gl/example', 'https://map.baidu.com/?lat=22&lng=113',
    'https://www.google.com.evil.org/maps/search/?api=1&query=1,2#WGS84',
    'https://private@www.google.com/maps/search/?api=1&query=1,2#WGS84', 'javascript:alert(1)']) {
    assert.equal(scheduleCoordinates(link(url)), null, url);
  }
  assert.ok(safeScheduleMapUrl('https://maps.app.goo.gl/example'));
  assert.equal(safeScheduleMapUrl('http://www.google.com/maps'), null);
});

test('tile configuration defaults to actual OSM tiles and rejects insecure/custom invalid settings', () => {
  assert.equal(routeTileConfig().template, 'https://tile.openstreetmap.org/{z}/{x}/{y}.png');
  assert.equal(routeTileConfig({ VITE_ROUTE_TILE_URL: 'http://tiles.example/{z}/{x}/{y}.png' }), null);
  assert.equal(routeTileConfig({ VITE_ROUTE_TILE_URL: 'https://tiles.example/fake.png' }), null);
  assert.equal(routeTileConfig({ VITE_ROUTE_TILE_ATTRIBUTION_URL: 'javascript:alert(1)' }), null);
});
