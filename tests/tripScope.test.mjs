import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyTripData, snapshotTripData, selectTripData } from '../src/tripScope.js';

const trips = [
  { id: 1, name: 'Sample', startDate: '2026-07-11', endDate: '2026-07-13' },
  { id: 2, name: 'New trip', startDate: '2026-12-05', endDate: '2026-12-08' },
];

test('new trip starts without unrelated bookings/expenses/checklist items', () => {
  const data = createEmptyTripData(trips[1]);
  assert.deepEqual(data.bookings, []);
  assert.deepEqual(data.expenses, []);
  assert.deepEqual(data.checkTemplate['예약'], []);
  assert.equal(data.timeline.length, 4);
});

test('switching between trips restores independent scoped data', () => {
  let state = {
    trips, currentTripId: 1, tripDataById: {},
    ...createEmptyTripData(trips[0]),
    bookings: [{ id: 'first', title: 'Sample booking' }],
    expenses: [{ id: 'first-expense', amount: 100 }],
    checks: { x: true },
  };
  state = { ...state, ...selectTripData(state, 2) };
  assert.equal(state.bookings.length, 0);
  assert.equal(state.expenses.length, 0);
  state.bookings = [{ id: 'second', title: 'Other booking' }];
  state.checks = { y: true };
  state = { ...state, ...selectTripData(state, 1) };
  assert.equal(state.bookings[0].id, 'first');
  assert.equal(state.expenses[0].id, 'first-expense');
  assert.deepEqual(state.checks, { x: true });
  state = { ...state, ...selectTripData(state, 2) };
  assert.equal(state.bookings[0].id, 'second');
  assert.deepEqual(state.checks, { y: true });
  assert.ok(snapshotTripData(state).bookings.length === 1);
});

test('invalid trip id must not switch active trip', () => {
  const s = { trips, currentTripId: 1, tripDataById: {}, ...createEmptyTripData(trips[0]) };
  assert.equal(selectTripData(s, 9999), null);
});
