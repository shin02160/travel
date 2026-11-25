import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScheduleTimeline, groupClock, scheduleClock } from '../src/scheduleTimelineModel.js';
import { scheduleTiming } from '../src/todaySchedule.js';

const day = '2027-05-06', zone = 'Europe/London';
const row = (id, title, time, activity = id) => ({ id, title, activity, fields: {
  일시: time ? `${day}T${time}` : day, 장소: title, 진행상태: '예정', 구분: '관광',
}, coordinates: { lat: 51.5, lng: -.1 }, note: `memo:${id}`, bookingIds: ['booking'] });

test('timeline visits use exactly the map groups/order and transfers are compact connections', () => {
  const rows = [row('a', '시설 A', '09:00'), row('a2', '시설 A', '09:30'),
    row('t', '시설 A → 시설 B', '09:45'), row('b', '시설 B', '10:00'), row('a3', '시설 A', '11:00')];
  const result = buildScheduleTimeline(rows, { zone });
  const entries = result.days[0].entries;
  assert.deepEqual(entries.map(entry => entry.type), ['visit', 'transfer', 'visit', 'visit']);
  assert.deepEqual(entries.filter(entry => entry.type === 'visit').map(entry => entry.id), result.route.visitGroups.map(group => group.id));
  assert.deepEqual(entries[0].group.eventIds, ['a', 'a2']);
  assert.equal(entries[0].group.activities[1].note, 'memo:a2');
  assert.deepEqual(entries[0].group.activities[1].bookingIds, ['booking']);
  assert.equal(entries[1].resolved, true);
});

test('activity search preserves complete visit groups and original map numbers', () => {
  const result = buildScheduleTimeline([row('a', '시설 A', '09:00', '조식'), row('a2', '시설 A', '09:30', '대기'),
    row('b', '시설 B', '10:00', '공연')], { zone }, '대기');
  assert.equal(result.days[0].entries.length, 1);
  assert.deepEqual(result.days[0].entries[0].group.eventIds, ['a', 'a2']);
  assert.equal(result.days[0].entries[0].group.number, 1);
  const later = buildScheduleTimeline([row('a', '시설 A', '09:00'), row('b', '시설 B', '10:00', '공연')], { zone }, '공연');
  assert.equal(later.days[0].entries[0].group.number, 2);
});

test('unknown transfers, private, canceled and undated sources survive without becoming visit cards', () => {
  const privateRow = row('home', '집', '12:00');
  const canceled = row('cancel', '취소 시설', '13:00'); canceled.fields.진행상태 = '취소';
  const undated = row('undated', '날짜 미정 시설', null); undated.fields.일시 = null;
  const result = buildScheduleTimeline([row('a', '시설 A', '09:00'), row('t', 'X → Y', null), privateRow, canceled, undated], { zone });
  const entries = result.days.flatMap(date => [...date.entries, ...date.unplaced]);
  assert.deepEqual(new Set(entries.map(entry => entry.id)), new Set(['a', 't', 'home', 'cancel', 'undated']));
  assert.equal(entries.find(entry => entry.id === 't').type, 'transfer');
  assert.equal(entries.find(entry => entry.id === 'home').type, 'record');
  assert.equal(entries.find(entry => entry.id === 'cancel').source.cancelled, true);
  assert.equal(result.days.at(-1).date, null);
});

test('time-only labels preserve real ranges and do not invent end times', () => {
  const a = row('a', '시설 A', '09:00');
  const b = row('b', '시설 A', '09:30'); b.date = { start: `${day}T09:30`, end: `${day}T10:00` };
  const group = buildScheduleTimeline([a, b], { zone }).route.visitGroups[0];
  assert.equal(groupClock(group), '09:00–10:00');
  assert.equal(scheduleClock(scheduleTiming(a, zone)), '09:00');
  assert.equal(scheduleClock(scheduleTiming(row('u', '시설', null), zone)), '시간 미정');
  assert.equal(scheduleClock(scheduleTiming({ ...a, date: { start: `${day}T23:00`, end: '2027-05-07T01:00' } }, zone)), '23:00–익일 01:00');
});

test('date-only planned timeline order remains identical to map order', () => {
  const rows = Array.from({ length: 8 }, (_, i) => ({ ...row(String(i), `시설 ${i}`, null), routeOrder: (i + 1) * 10 }));
  const result = buildScheduleTimeline(rows.toReversed(), { zone });
  assert.deepEqual(result.days[0].entries.map(entry => entry.group.number), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(result.days[0].entries.every(entry => groupClock(entry.group) === '시간 미정'));
});

test('next visit skips transfer/private/canceled records and never invents times for plans', () => {
  const rows = [row('a', '시설 A', '09:00'), row('t', '시설 A → 시설 B', '09:45'), row('b', '시설 B', '10:00')];
  const next = buildScheduleTimeline(rows, { zone, now: scheduleTiming(rows[1], zone).stamp - 5 * 60000 }).next;
  assert.equal(next.row.id, 'b');
  assert.equal(next.group.row.title, '시설 B');
  assert.equal(buildScheduleTimeline([{ ...row('p', '시설 P', null), routeOrder: 10 }], { zone, now: 0 }).next, null);
});
