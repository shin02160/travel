import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRouteModel } from '../src/routeMapModel.js';
import { planDay, orderScheduleDay, scheduleTiming, tripCalendar } from '../src/todaySchedule.js';
import { sameFacility, scheduleActivity, scheduleKind, scheduleMatches, validRouteOrder } from '../src/scheduleIdentity.js';

const date = '2027-04-05', zone = 'Europe/London';
const visit = (id, title, time = '09:00', routeOrder = null, coordinates = { lat: 51.5, lng: -0.1 }) => ({
  id, title, activity: `활동 ${id}`, routeOrder, coordinates,
  fields: { 일시: time ? `${date}T${time}` : date, 장소: title, 진행상태: '예정', 구분: '관광' },
});
const model = rows => buildRouteModel(rows, { zone });
const legs = result => result.segments.map(leg => [leg.fromId, leg.toId]);

test('activity and search preserve legacy titles and never repeat an identical activity', () => {
  const row = visit('a', '시설 A');
  assert.equal(scheduleMatches(row, '활동'), true);
  assert.equal(scheduleMatches(row, '시설'), true);
  assert.equal(scheduleMatches(row, '없는말'), false);
  assert.equal(scheduleActivity({ ...row, activity: ' 시설 A ' }), null);
  assert.equal(scheduleActivity({ ...row, activity: null }), null);
  for (const value of [0, -1, 1.5, '', '10', NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.equal(validRouteOrder(value), null);
  assert.equal(validRouteOrder(10), 10);
});

test('eight untimed visits use explicit 10..80 plan order as 1..8, without invented clocks', () => {
  const rows = Array.from({ length: 8 }, (_, i) => visit(`p${i}`, `시설 ${i}`, null, (i + 1) * 10,
    { lat: 51.5 + i * .001, lng: -.1 }));
  const result = model(rows.toReversed());
  assert.deepEqual(result.visitGroups.map(group => group.number), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(result.segments.length, 7);
  assert.ok(result.visitGroups.every(group => !group.time && group.planned && group.reasons.includes('시간 미정')));
  const today = planDay(rows.toReversed(), date, zone, Date.parse(`${date}T00:00Z`));
  assert.deepEqual(today.events.map(event => event.row.id), rows.map(row => row.id));
  assert.equal(today.next, null);
});

test('all-day plan supports ordering; incomplete, duplicate and conflicting plans never invent links', () => {
  const first = visit('a', '시설 A', null, 10), second = visit('b', '시설 B', null, 20);
  const allDay = { ...first, date: { start: date, allDay: true } };
  assert.equal(model([second, allDay]).segments.length, 1);
  for (const rows of [
    [first, { ...second, routeOrder: null }], [first, { ...second, routeOrder: 10 }],
    [visit('a', '시설 A', '12:00', 10), visit('b', '시설 B', '09:00', 20)],
    [visit('a', '시설 A', '09:00'), second, visit('c', '시설 C', '10:00')],
  ]) {
    const result = model(rows);
    assert.equal(result.segments.length, 0);
    assert.ok(result.warnings.length > 0);
  }
});

test('pure transfer rows consume no visit number; confirmed adjacent endpoints keep the leg', () => {
  const a = visit('a', '시설 A', '09:00'), b = visit('b', '시설 B', '10:00');
  const transfer = visit('t', '시설 A → 시설 B', '09:30');
  const result = model([b, transfer, a]);
  assert.equal(scheduleKind(transfer), 'transfer');
  assert.deepEqual(result.visitGroups.map(group => group.number), [1, 2]);
  assert.equal(model([visit('a', '시설 A'), visit('home', '집', null, 20), visit('b', '시설 B', '10:00')]).segments.length, 0);
  assert.deepEqual(legs(result), [['a', 'b']]);
  assert.equal(result.transfers[0].resolved, true);
  assert.equal(result.rows.length, 3);
  assert.equal(result.points.some(point => point.id === 't'), false);
  assert.equal(model([a, { ...b, fields: { ...b.fields, 구분: '이동' } }]).points.length, 2);
  assert.equal(model([a, visit('t', '시설 A → 경유지 → 시설 B', '09:30'), b]).segments.length, 0);
  assert.equal(model([a, visit('missing', '미확인 방문', '09:20', null, null), transfer, b]).segments.length, 0);
});

test('untimed transfers connect explicitly ordered endpoints but unresolved transfers block shortcuts', () => {
  const a = visit('a', '시설 A', null, 10), b = visit('b', '시설 B', null, 20);
  assert.equal(model([a, b, visit('t', '시설 A → 시설 B', null)]).segments.length, 1);
  assert.equal(model([a, b, visit('t', '미확인 → 시설 B', null)]).segments.length, 0);
});

test('consecutive same-facility activities merge with every source retained; A B A remains three visits', () => {
  const a = visit('a', '시설 A', '09:00'), a2 = visit('a2', '시설 A', '09:30');
  const b = visit('b', '시설 B', '10:00');
  const result = model([a, a2, b]);
  assert.equal(result.visitGroups.length, 2);
  assert.deepEqual(result.visitGroups[0].eventIds, ['a', 'a2']);
  assert.deepEqual(result.visitGroups[0].activities.map(row => row.activity), ['활동 a', '활동 a2']);
  assert.equal(result.rows.length, 3);
  assert.deepEqual(legs(result), [['a', 'b']]);
  const revisit = model([a, b, visit('return', '시설 A', '11:00')]);
  assert.deepEqual(revisit.visitGroups.map(group => group.number), [1, 2, 3]);
  assert.equal(revisit.points.length, 3);
});

test('close coordinates alone, conflicting branch addresses and unknown order never merge facilities', () => {
  const a = visit('a', '시설 A'), b = visit('b', '시설 B', '09:30');
  assert.equal(sameFacility(a, b), false);
  assert.equal(model([a, b]).visitGroups.length, 2);
  assert.equal(sameFacility(a, { ...a, fields: { ...a.fields, 장소: '다른 지점 주소' } }), false);
  assert.equal(model([visit('a', '시설 A', null), visit('b', '시설 A', null)]).visitGroups.length, 2);
  const facility = row => ({ ...row, fields: { ...row.fields, 장소: '시설 A' } });
  assert.equal(sameFacility(facility(visit('a', '시설 A · 카페')), facility(visit('b', '시설 A · 전망대'))), true);
});

test('simultaneous different facilities keep overlap selection and suppress uncertain legs', () => {
  const result = model([visit('a', '시설 A'), visit('b', '시설 B'), visit('c', '시설 C', '10:00')]);
  assert.equal(result.points.length, 3);
  assert.equal(result.visitGroups.filter(group => group.collision).length, 2);
  assert.equal(result.segments.length, 0);
});

test('private home is retained only as an excluded source and breaks the intervening leg', () => {
  const home = visit('home', '집 도착', '09:30');
  const result = model([visit('a', '시설 A'), home, visit('b', '시설 B', '10:00')]);
  assert.equal(result.points.some(point => point.id === 'home'), false);
  assert.equal(result.counts.private, 1);
  assert.equal(result.rows.length, 3);
  assert.equal(result.segments.length, 0);
  assert.deepEqual(result.visitGroups.map(group => group.number), [1, 2]);
});

test('new trip IDs use city configuration and dates remain their original local day', () => {
  const trip = { id: 'arbitrary-new-trip', cities: [{ zone: 'Europe/London' }], fields: { 여행기간: date } };
  assert.equal(tripCalendar(trip, Date.parse(`${date}T12:00Z`)).zone, zone);
  const result = model([visit('a', '시설 A', '00:30'), { ...visit('b', '시설 B'), date: { start: `${date}T23:00:00-05:00` } }]);
  assert.equal(result.visitGroups[1].date, date);
  assert.equal(orderScheduleDay([scheduleTiming(visit('a', '시설 A', null, 10), null)]).plan, true);
});
