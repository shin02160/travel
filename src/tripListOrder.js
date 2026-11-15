import { datePart } from './todaySchedule.js';

function statusOrder(status) {
  switch (status?.replace(/\s/g, '')) {
    case '여행중':
    case '진행중':
      return 0;
    case '완료':
    case '종료':
    case '취소':
      return 2;
    default:
      return 1;
  }
}

export function sortTripList(trips) {
  return trips.map(trip => ({
    trip,
    group: statusOrder(trip.fields.상태),
    start: datePart(trip.fields.여행기간) ?? '9999-99-99',
  })).sort((a, b) => a.group - b.group || (a.group === 1 ? a.start.localeCompare(b.start) : 0))
    .map(({ trip }) => trip);
}
