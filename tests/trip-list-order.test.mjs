import test from 'node:test';
import assert from 'node:assert/strict';
import { sortTripList } from '../src/tripListOrder.js';

test('active trips lead, planned trips sort by departure, and finished trips stay last', () => {
  const trip = (id, status, dates) => ({ id, fields: { 상태: status, 여행기간: dates } });
  const trips = [
    trip('finished', '완료', '2026-11-01'),
    trip('later', '준비중', '2027-03-01'),
    trip('unknown-date', '준비중', '2027-02-31'),
    trip('active', '여행중', '2026-12-14'),
    trip('canceled', '취소', '2026-12-02'),
    trip('earlier', '준비중', '2026-12-04 ~ 2026-12-08'),
    trip('same-date', '준비중', '2026-12-04'),
  ];
  assert.deepEqual(sortTripList(trips).map(trip => trip.id), [
    'active', 'earlier', 'same-date', 'later', 'unknown-date', 'finished', 'canceled',
  ]);
  assert.equal(trips[0].id, 'finished');
});
