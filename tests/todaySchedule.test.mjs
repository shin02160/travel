import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseTrips, planDay, shiftDate, tripCalendar } from '../src/todaySchedule.js';

const macau = { id: '4136d8c5-8de1-81f4-a070-e07878964af0', fields: { 여행기간: '2026-12-05 ~ 2026-12-08' } };
const shanghai = { id: '4136d8c5-8de1-81ce-a4c8-dbda8e993076', fields: { 여행기간: '2026-12-05' } };
const stamp = Date.parse;
const row = (id, start, status = '예정', date = {}) => ({
  id, fields: { 일시: start, 진행상태: status }, date: { start, ...date },
});

test('chooses trips at local midnight and includes both travel boundaries', () => {
  assert.equal(tripCalendar(macau, stamp('2026-12-04T15:59:59Z')).today, '2026-12-04');
  assert.equal(chooseTrips([macau], stamp('2026-12-04T15:59:59Z')).next, macau);
  assert.deepEqual(chooseTrips([macau, shanghai], stamp('2026-12-04T16:00:00Z')).active, [macau, shanghai]);
  assert.deepEqual(chooseTrips([macau], stamp('2026-12-08T15:59:59Z')).active, [macau]);
  assert.deepEqual(chooseTrips([macau], stamp('2026-12-08T16:00:00Z')).active, []);
  assert.equal(chooseTrips([{ ...macau, id: 'unknown' }], stamp('2026-12-05')).unknownZone, true);
  assert.equal(shiftDate('2026-12-31', 1), '2027-01-01');
});

test('preserves all-day and untimed ordering and chooses the next eligible timed event', () => {
  const rows = [
    row('later', '2026-12-05T12:00:00+08:00'),
    row('untimed-first', '2026-12-05'),
    row('all-day', '2026-12-05', '예정', { allDay: true }),
    row('past', '2026-12-05T09:00:00+08:00'),
    row('completed', '2026-12-05T10:05:00+08:00', '완료'),
    row('cancelled', '2026-12-05T10:10:00+08:00', '취소'),
    row('ongoing', '2026-12-05T10:15:00+08:00', '진행중'),
    row('next', '2026-12-05T11:00:00+09:00', '예정', { end: '2026-12-06T00:30:00+09:00' }),
    row('untimed-second', '2026-12-05'),
    row('tomorrow', '2026-12-06T11:00:00+08:00'),
  ];
  const result = planDay(rows, '2026-12-05', 'Asia/Macau', stamp('2026-12-05T01:50:00Z'));
  assert.deepEqual(result.events.map(e => e.row.id), [
    'all-day', 'past', 'next', 'completed', 'cancelled', 'ongoing', 'later', 'untimed-first', 'untimed-second',
  ]);
  assert.equal(result.next.row.id, 'next');
  assert.equal(result.events.find(e => e.row.id === 'past').passed, true);
  assert.equal(rows.find(e => e.id === 'past').fields.진행상태, '예정');
  assert.equal(result.events.at(-1).time, undefined);
  assert.equal(result.next.end, '2026-12-06T00:30:00+09:00');
  const afterNext = planDay(rows, '2026-12-05', 'Asia/Macau', stamp('2026-12-05T02:01:00Z'));
  assert.equal(afterNext.next.row.id, 'later');
});

test('uses an explicit event zone and rejects unknown, ambiguous or nonexistent wall times', () => {
  const now = stamp('2026-12-05T00:00:00Z');
  const value = row('zone', '2026-12-05T09:30', '예정', { timeZone: 'Asia/Seoul' });
  assert.equal(planDay([value], '2026-12-05', 'Asia/Macau', now).next.stamp, stamp('2026-12-05T00:30Z'));
  const withoutZone = row('unknown', '2026-12-05T09:30');
  assert.equal(planDay([withoutZone], '2026-12-05', null, now).next, null);
  const fold = row('fold', '2026-11-01T01:30', '예정', { timeZone: 'America/New_York' });
  const gap = row('gap', '2026-03-08T02:30', '예정', { timeZone: 'America/New_York' });
  assert.equal(planDay([fold], '2026-11-01', null, now).events[0].stamp, null);
  assert.equal(planDay([gap], '2026-03-08', null, now).events[0].stamp, null);
});
