import { compareBookingUseDate } from './displayOrder.js';

const RAIL_TYPES = new Set(['기차', '열차', '철도', '기차편']);
const RAIL_NAME = /\b(?:KTX(?:-산천)?|SRT|ITX|KORAIL)\b|무궁화|새마을|누리로|기차|열차|철도|신칸센/i;

export function overviewTransport({ bookings = [], schedule = [] }) {
  const reserved = bookings.filter(row => row.fields.예약유형 === '항공' ||
    RAIL_TYPES.has(row.fields.예약유형) ||
    (row.fields.예약유형 === '교통' && RAIL_NAME.test(row.title)));
  const ids = new Set(reserved.map(row => row.id));
  const trains = schedule.filter(row => row.fields.구분 === '이동' && RAIL_NAME.test(row.title) &&
    !(row.bookingIds ?? []).some(id => ids.has(id))).map(row => ({
    id: `schedule:${row.id}`,
    title: row.title,
    fields: { 이용일: row.fields.일시, 진행상태: row.fields.진행상태 },
    location: row.fields.장소,
  }));
  return [...reserved, ...trains].toSorted(compareBookingUseDate);
}
