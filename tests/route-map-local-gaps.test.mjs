import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRouteModel, routeMarkerGroups } from '../src/routeMapModel.js';
import { buildScheduleTimeline } from '../src/scheduleTimelineModel.js';
import { sameFacility } from '../src/scheduleIdentity.js';

const day = '2027-04-05';
const visit = (id, routeOrder, extra = {}) => ({ id, title: `시설 ${id}`, routeOrder,
  coordinates: { lat: 51.5, lng: -.1 + (routeOrder ?? 0) / 10000 },
  date: { start: day }, activity: `활동 ${id}`, fields: { 장소: `시설 ${id}`, 진행상태: '예정' }, ...extra });
const model = rows => buildRouteModel(rows, { zone: 'Europe/London' });
const links = value => value.segments.map(s => `${s.fromId}>${s.toId}`);

test('a multi-stop untimed transfer cannot cancel a six-stop explicit plan', () => {
  const visits = Array.from({ length: 6 }, (_, i) => visit(String(i), (i + 1) * 10));
  const transfer = visit('transfer', null, { title: '숙소 → 로비 → 국경 → 역', coordinates: null });
  const result = model([transfer, ...visits.toReversed()]);
  assert.deepEqual(links(result), ['0>1', '1>2', '2>3', '3>4', '4>5']);
  assert.equal(result.transfers[0].resolved, false);
  assert.deepEqual(result.visitGroups.map(g => g.number), [1, 2, 3, 4, 5, 6]);
  const timeline = buildScheduleTimeline([transfer, ...visits], { zone: 'Europe/London' });
  assert.deepEqual(timeline.days[0].entries.filter(e => e.type === 'visit').map(e => e.group.id), result.visitGroups.map(g => g.id));
});

test('missing coordinates cut only incident legs, preserving numbers and reasons', () => {
  const rows = ['a', 'b', 'c', 'd', 'e'].map((id, i) => visit(id, (i + 1) * 10));
  rows[2].coordinates = null;
  const result = model(rows);
  assert.deepEqual(links(result), ['a>b', 'd>e']);
  assert.deepEqual(result.omittedSegments.map(s => `${s.fromId}>${s.toId}`), ['b>c', 'c>d']);
  assert.ok(result.unmapped[0].reasons.includes('위치 미확인'));
  assert.deepEqual(result.points.map(g => g.number), [1, 2, 4, 5]);
});

test('duplicate orders isolate adjacent legs without blocking later or earlier valid pairs', () => {
  const result = model([visit('a', 10), visit('b', 20), visit('x', 30), visit('y', 30), visit('c', 40), visit('d', 50)]);
  assert.deepEqual(links(result), ['a>b', 'c>d']);
  assert.ok(result.visitGroups.filter(g => ['x', 'y'].includes(g.id)).every(g => g.number === null && g.reasons.includes('동선 순서 중복')));
});

test('unknown relative position remains auxiliary, while a timed missing point only cuts its neighbors', () => {
  const known = [visit('a', 10), visit('b', 20), visit('c', 30)];
  const result = model([...known, visit('unknown', null)]);
  assert.deepEqual(links(result), ['a>b', 'b>c']);
  assert.equal(result.unordered.length, 1);
  assert.ok(result.unordered[0].reasons.some(reason => reason.includes('상대 순서')));
  const timed = ['a', 'b', 'c', 'd'].map((id, i) => visit(id, null, { date: { start: `${day}T${String(i + 9).padStart(2, '0')}:00` } }));
  timed[1].coordinates = null;
  assert.deepEqual(links(model(timed)), ['c>d']);
});

test('explicit order resolves equal clocks and survives a local clock error', () => {
  const a = visit('a', 10, { date: { start: `${day}T09:00` } });
  const b = visit('b', 20, { date: { start: `${day}T09:00` } });
  const c = visit('c', 30, { date: { start: `${day}T25:00` } });
  const result = model([c, b, a]);
  assert.deepEqual(links(result), ['a>b', 'b>c']);
  assert.ok(result.visitGroups.every(group => !group.collision));
  assert.ok(result.visitGroups[2].reasons.includes('시간 오류'));
});

test('transfer title matching is independent of localized address strings', () => {
  const a = visit('a', 10), b = visit('b', 20);
  const transfer = visit('t', null, { title: '시설 a → 시설 b', fields: { 장소: 'Location A → Localized B' } });
  const result = model([a, b, transfer]);
  assert.equal(result.transfers[0].resolved, true);
  assert.deepEqual(links(result), ['a>b']);
});

test('clock-only ties in a partial plan stay local and do not poison its explicitly ordered stops', () => {
  const timed = (id, order, time) => visit(id, order, { date: { start: `${day}T${time}` } });
  const result = model([timed('a', 10, '09:00'), timed('b', 20, '10:00'), timed('x', null, '10:30'),
    timed('y', null, '10:30'), timed('c', 30, '11:00'), timed('d', 40, '12:00')]);
  assert.deepEqual(links(result), ['a>b', 'c>d']);
  assert.deepEqual(result.visitGroups.filter(g => g.collision).map(g => g.id), ['x', 'y']);
});

test('facility punctuation and coordinate rounding merge activities; shared marker retains distinct visits', () => {
  const a = visit('a', 10, { title: '시설', fields: { 장소: '상점 (쇼핑몰), 도로 1' } });
  const b = visit('b', 20, { title: '시설', coordinates: { lat: a.coordinates.lat + .000001, lng: a.coordinates.lng }, fields: { 장소: '상점(쇼핑몰) · 도로1' } });
  assert.equal(sameFacility(a, b), true);
  assert.deepEqual(model([a, b]).visitGroups[0].eventIds, ['a', 'b']);
  const other = visit('other', 30, { coordinates: a.coordinates });
  const back = visit('back', 40, { ...a, id: 'back', routeOrder: 40 });
  const result = model([a, other, back]);
  assert.equal(result.visitGroups.length, 3);
  const markers = routeMarkerGroups(result.points);
  assert.equal(markers.length, 1);
  assert.deepEqual(markers[0].map(p => p.number), [1, 2, 3]);
  assert.deepEqual(result.points.map(p => p.lat), [a.coordinates.lat, a.coordinates.lat, a.coordinates.lat]);
});
