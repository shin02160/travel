// Keep the currently selected trip's data isolated until the Notion API migration.
// Nothing here persists to a server or survives a full page reload.
export const TRIP_SCOPED_KEYS = [
  'bookings', 'timeline', 'memos', 'places', 'checkTemplate', 'checks',
  'addedChecks', 'deletedChecks', 'editedChecks', 'budgetItems', 'expenses',
  'budgetCur', 'fxRate', 'memoFilter',
];

const NEW_TRIP_CATEGORIES = ['예약', '준비물', '공연 준비', '쇼핑', '기타'];

export function createEmptyTripData(trip = {}) {
  const start = new Date(`${trip.startDate}T00:00:00Z`);
  const end = new Date(`${trip.endDate}T00:00:00Z`);
  const nights = Number.isFinite(+end) ? Math.max(0, (end - start) / 86400000) : 0;
  const timeline = Number.isFinite(+start) ? Array.from({ length: nights + 1 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + index);
    const iso = date.toISOString().slice(0, 10);
    return { day: index + 1, date: iso.slice(5).replace('-', '.'), events: [] };
  }) : [];
  return {
    bookings: [], timeline, memos: [], places: [],
    checkTemplate: Object.fromEntries(NEW_TRIP_CATEGORIES.map(cat => [cat, []])),
    checks: {}, addedChecks: {}, deletedChecks: {}, editedChecks: {},
    budgetItems: [], expenses: [], budgetCur: 'all', fxRate: 9.2,
    memoFilter: '전체',
  };
}

export function snapshotTripData(state) {
  return Object.fromEntries(TRIP_SCOPED_KEYS.map(key => [key, state[key]]));
}

export function selectTripData(state, tripId) {
  const trip = state.trips.find(t => String(t.id) === String(tripId));
  if (!trip) return null;
  const previous = { ...state.tripDataById };
  if (state.currentTripId !== null && state.currentTripId !== undefined) {
    previous[state.currentTripId] = snapshotTripData(state);
  }
  const data = previous[trip.id] ?? createEmptyTripData(trip);
  return {
    ...data, tripDataById: previous, currentTripId: trip.id,
    screen: 'detail', tab: 'overview', ...resetTripEditor(),
  };
}

export function resetTripEditor() {
  return {
    overlay: null, pendingOverlay: null, overlayContext: {},
    editingExpense: null, editingEvent: null, addCheckCat: '', addCheckText: '',
  };
}
