import { datePart } from './todaySchedule.js';

export function compareBookingUseDate(a, b) {
  const first = datePart(a.fields.이용일);
  const second = datePart(b.fields.이용일);
  if (first === second) return 0;
  if (!first) return 1;
  if (!second) return -1;
  return first.localeCompare(second);
}

export function sortByDisplayOrder(items, fallback = () => 0) {
  return items.toSorted((a, b) => {
    const first = Number.isFinite(a.displayOrder) ? a.displayOrder : Infinity;
    const second = Number.isFinite(b.displayOrder) ? b.displayOrder : Infinity;
    return first === second ? fallback(a, b) : first - second;
  });
}
