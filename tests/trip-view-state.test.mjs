import test from 'node:test';
import assert from 'node:assert/strict';
import { readTripViewState, saveTripViewState } from '../src/tripViewState.js';

function memoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('trip screen preferences survive reload and are isolated by trip', () => {
  const storage = memoryStorage();
  const state = readTripViewState('first', storage);
  state.expenseView = 'statistics';
  state.scheduleView = 'map';
  state.routeDate = '2026-12-06';
  state.expensePeriod = { start: '2026-12-05', end: '2026-12-06' };
  state.filters.expenses = { query: '식비', category: '식비', costType: '공동' };
  state.expenseDrilldown = true;
  state.opened = ['checklist:4136d8c5-8de1-810a-8b3b-e0553575f3b3', 'bookings:4136d8c5-8de1-810a-8b3b-e0553575f3b3'];
  saveTripViewState('first', state, storage);
  assert.deepEqual(readTripViewState('first', storage), state);
  assert.equal(readTripViewState('second', storage).expenseView, 'history');
  assert.equal(readTripViewState('second', storage).scheduleView, 'timeline');
  assert.equal(readTripViewState('second', storage).routeDate, null);
  assert.equal(readTripViewState('second', storage).filters.expenses.costType, null);
  assert.deepEqual(readTripViewState('second', storage).opened, []);
});

test('corrupt or blocked browser storage falls back to usable defaults', () => {
  const defaults = readTripViewState('trip');
  assert.equal(defaults.expenseView, 'history');
  assert.deepEqual(defaults.expensePeriod, { start: '', end: '' });
  assert.deepEqual(readTripViewState('trip', { getItem: () => '{broken' }), defaults);
  const blocked = {
    getItem() { throw Error('blocked'); },
    setItem() { throw Error('blocked'); },
  };
  assert.deepEqual(readTripViewState('trip', blocked), defaults);
  assert.doesNotThrow(() => saveTripViewState('trip', defaults, blocked));
  const invalid = readTripViewState('trip', { getItem: () => JSON.stringify({
    filters: { expenses: { query: null, category: 17, costType: 42 } },
    expensePeriod: { start: 'bad', end: null },
    expenseView: 'unexpected', opened: [null, 'invalid'],
    scheduleView: 'unexpected', routeDate: '2026-02-30',
  }) });
  assert.deepEqual(invalid, defaults);
});
