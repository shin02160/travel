import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRouteModel, initialRouteDate, routeDisplayPositions } from '../src/routeMapModel.js';

const options = { zone: 'Asia/Seoul', start: '2026-11-21', end: '2026-11-22' };
const row = (id, time, coordinates = { lat: 35, lng: 129 }, fields = {}, date = {}) => ({
  id, title: id, fields: { 일시: time, 구분: '관광', 진행상태: '예정', ...fields }, coordinates,
  date: { start: time, ...date },
});

test('time-ordered visits preserve gaps and do not bridge missing coordinates', () => {
  const model = buildRouteModel([row('c', '2026-11-21T11:00'), row('b', '2026-11-21T10:00', null),
    row('a', '2026-11-21T09:00'), row('d', '2026-11-21T12:00')], options);
  assert.deepEqual(model.rows.map(r => [r.id, r.number]), [['a', 1], ['b', 2], ['c', 3], ['d', 4]]);
  assert.deepEqual(model.points.map(r => r.number), [1, 3, 4]);
  assert.deepEqual(model.segments.map(s => [s.fromId, s.toId]), [['c', 'd']]);
  assert.equal(model.counts.missing, 1);
});

test('whole-trip model resets numbers daily and never connects dates, even across countries', () => {
  const rows = [row('a', '2026-11-21T09:00', { lat: 22, lng: 113 }),
    row('b', '2026-11-21T13:00', { lat: 35, lng: 129 }), row('c', '2026-11-22T09:00')];
  const all = buildRouteModel(rows, options);
  assert.deepEqual(all.rows.map(r => r.number), [1, 2, 1]);
  assert.equal(all.segments.length, 1);
  assert.notEqual(all.points[0].color.fill, all.points[2].color.fill);
  const day = buildRouteModel(rows, { ...options, date: '2026-11-22' });
  assert.equal(day.points.length, 1);
  assert.equal(day.segments.length, 0);
});

test('same-time order is deterministic and suppresses uncertain incoming and outgoing legs', () => {
  const rows = [row('a', '2026-11-21T08:00'), row('c', '2026-11-21T09:00'),
    row('b', '2026-11-21T09:00'), row('d', '2026-11-21T10:00')];
  const all = buildRouteModel(rows, options);
  assert.deepEqual(all.rows.map(r => r.id), ['a', 'b', 'c', 'd']);
  assert.deepEqual(buildRouteModel(rows.toReversed(), options).rows.map(r => r.id), ['a', 'b', 'c', 'd']);
  assert.equal(all.segments.length, 0);
  assert.equal(all.rows.filter(r => r.collision).length, 2);
  assert.equal(all.points.length, 4); // Repeated coordinates are visits, not deduplication candidates.
});

test('canceled, untimed, all-day, undated, transfers and out-of-projection rows remain explainable', () => {
  const model = buildRouteModel([
    row('cancel', '2026-11-21T08:00', undefined, { 진행상태: '취소' }),
    row('done', '2026-11-21T09:00', undefined, { 진행상태: '완료' }),
    row('transfer → hotel', '2026-11-21T10:00', undefined, { 구분: '이동' }),
    row('later', '2026-11-21T11:00'), row('untimed', '2026-11-21'),
    row('all-day', '2026-11-21', undefined, {}, { allDay: true }), row('undated', null),
    row('polar', '2026-11-21T12:00', { lat: 89, lng: 0 }),
  ], options);
  assert.equal(model.points.some(r => r.id === 'cancel'), false);
  assert.equal(model.points.some(r => r.id === 'transfer → hotel'), false);
  assert.equal(model.points.find(r => r.id === 'untimed').number, null);
  assert.equal(model.points.find(r => r.id === 'all-day').number, null);
  assert.equal(model.rows.find(r => r.id === 'undated').mapped, false);
  assert.ok(model.rows.find(r => r.id === 'polar').reasons.includes('지도 투영 범위 밖'));
  assert.equal(model.segments.length, 0);
  const day = buildRouteModel(model.rows.map(r => r.row), { ...options, date: '2026-11-21' });
  assert.equal(day.rows.some(r => r.id === 'undated'), false);
});

test('dates are dynamic, include outside-period rows and fall back safely from missing periods', () => {
  const rows = [row('a', '2026-11-20T09:00'), row('b', '2026-11-22T10:00')];
  const model = buildRouteModel(rows, options);
  assert.deepEqual(model.dates, ['2026-11-20', '2026-11-21', '2026-11-22']);
  assert.equal(model.rows[0].outOfPeriod, true);
  assert.equal(initialRouteDate(model, { ...options, today: '2026-11-22' }), '2026-11-22');
  assert.equal(initialRouteDate(model, { ...options, today: '2026-11-25' }), '2026-11-21');
  const fallback = buildRouteModel(rows);
  assert.equal(initialRouteDate(fallback, {}), '2026-11-20');
  assert.deepEqual(buildRouteModel([], { date: '2026-11-21' }).points, []);
});

test('invalid dates/clocks/timezones cannot form routes; antimeridian positions keep true coordinates', () => {
  for (const start of ['2026-02-30T09:00', '2026-11-21T25:00']) {
    assert.equal(buildRouteModel([row('bad', start)], options).segments.length, 0);
    assert.equal(buildRouteModel([row('bad', start)], options).points.length, 0);
  }
  assert.equal(buildRouteModel([row('zone', '2026-11-21T09:00', undefined, {}, { timeZone: 'Mars/Invalid' })], options).points.length, 0);
  const points = [{ id: 'a', lat: 0, lng: 179 }, { id: 'b', lat: 0, lng: -179 }];
  const positions = routeDisplayPositions(points);
  assert.equal(Math.abs(positions.get('a')[1] - positions.get('b')[1]), 2);
  assert.equal(points[1].lng, -179);
  const nearby = Array.from({ length: 8 }, (_, i) => ({ id: String(i), lat: 51.51 + i * .001, lng: -.11 - i * .001 }));
  const display = [...routeDisplayPositions(nearby).values()].map(position => position[1]);
  assert.ok(Math.max(...display) - Math.min(...display) < .01, 'floating point cut must not wrap a nearby point around the world');
});

test('unresolved time blocks shortcuts for its day, invalid ranges stay listed, one point has no leg', () => {
  const unknown = row('unknown', '2026-11-21T10:00', undefined, {}, { timeZone: 'Mars/Invalid' });
  const model = buildRouteModel([row('a', '2026-11-21T09:00'), unknown, row('b', '2026-11-21T11:00')], options);
  assert.equal(model.points.length, 2);
  assert.equal(model.segments.length, 0);
  for (const end of ['2026-11-20T10:00', '2026-11-21T08:00', '2026-11-21T25:00']) {
    const invalid = buildRouteModel([row('bad', '2026-11-21T09:00', undefined, {}, { end })], options);
    assert.equal(invalid.points.length, 0);
    assert.ok(invalid.rows[0].reasons.includes('일정 기간 오류'));
  }
  const single = buildRouteModel([row('single', '2026-11-21T09:00')], options);
  assert.equal(single.points.length, 1);
  assert.equal(single.segments.length, 0);
});
