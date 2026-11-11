import { datePart } from './todaySchedule.js';

const TABS = ['overview', 'today', 'schedule', 'bookings', 'budgets', 'expenses', 'receipts', 'checklist', 'packing', 'shopping'];
const ITEM_KEY = /^(checklist|shopping):[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;
const storageKey = tripId => `travel:view:v1:${tripId}`;

export function readTripViewState(tripId, storage) {
  let saved;
  try {
    saved = JSON.parse(storage.getItem(storageKey(tripId)));
  } catch {
    saved = null;
  }
  const filters = Object.fromEntries(TABS.map(tab => {
    const filter = saved?.filters?.[tab];
    return [tab, {
      query: typeof filter?.query === 'string' ? filter.query : '',
      category: typeof filter?.category === 'string' ? filter.category : null,
    }];
  }));
  const period = saved?.expensePeriod;
  const opened = Array.isArray(saved?.opened) ? saved.opened.filter(id => typeof id === 'string' && ITEM_KEY.test(id)) : [];
  return {
    filters,
    expenseView: saved?.expenseView === 'statistics' ? 'statistics' : 'history',
    expensePeriod: { start: datePart(period?.start) ?? '', end: datePart(period?.end) ?? '' },
    expenseDrilldown: saved?.expenseDrilldown === true,
    opened,
  };
}

export function saveTripViewState(tripId, state, storage) {
  try {
    storage.setItem(storageKey(tripId), JSON.stringify(state));
  } catch {
    // Browser storage may be blocked or full; the current screen remains usable.
  }
}
