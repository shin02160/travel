import { calendarZone, validZone } from './destinationCities.js';
const DAY = 86400000;
const DATE = /^\d{4}-\d{2}-\d{2}/;
const TIME = /T(\d{2}:\d{2})/;
const ENDED = new Set(['완료', '취소']);
const formatters = new Map();

export function datePart(value) {
  const day = typeof value === 'string' ? value.match(DATE)?.[0] : null;
  if (!day) return null;
  const stamp = Date.parse(`${day}T00:00:00Z`);
  return Number.isFinite(stamp) && new Date(stamp).toISOString().startsWith(day) ? day : null;
}

export function shiftDate(day, offset) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + offset * DAY).toISOString().slice(0, 10);
}

function localParts(stamp, zone) {
  let formatter = formatters.get(zone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    });
    formatters.set(zone, formatter);
  }
  return Object.fromEntries(formatter.formatToParts(stamp).map(({ type, value }) => [type, value]));
}

export function dateInZone(value, zone) {
  const day = datePart(value);
  if (!day || !zone) return day;
  const [start] = value.split(' ~ ');
  if (!start.includes('T') || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(start)) return day;
  const stamp = Date.parse(start);
  if (!Number.isFinite(stamp)) return day;
  const { year, month, day: localDay } = localParts(stamp, zone);
  return `${year}-${month}-${localDay}`;
}

function localDateTime(stamp, zone) {
  const { year, month, day, hour, minute, second } = localParts(stamp, zone);
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

export function tripCalendar(trip, now) {
  const [from, to] = trip.fields.여행기간?.split(' ~ ') ?? [];
  const start = datePart(from);
  const end = datePart(to ?? from);
  const zone = (validZone(trip.calendarZone) ? trip.calendarZone : calendarZone(trip.cities, from, to ?? from));
  const today = zone ? localDateTime(now, zone).slice(0, 10) : null;
  return { start, end: start && end && end >= start ? end : null, zone, today };
}

export function chooseTrips(trips, now) {
  const active = [];
  let next = null;
  let unknownZone = false;
  for (const trip of trips) {
    if (ENDED.has(trip.fields.상태)) continue;
    const { start, end, today } = tripCalendar(trip, now);
    if (!start || !end) continue;
    if (!today) {
      unknownZone = true;
      continue;
    }
    if (start <= today && today <= end) active.push(trip);
    else if (start > today && (!next || start < next.start)) next = { trip, start };
  }
  return { active, next: next?.trip ?? null, unknownZone };
}

export function eventStamp(value, zone) {
  if (!value?.match(TIME)) return null;
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) {
    const stamp = Date.parse(value);
    return Number.isFinite(stamp) ? stamp : null;
  }
  if (!zone) return null;
  const wall = value.slice(0, 19).padEnd(19, ':00');
  const naive = Date.parse(`${wall}Z`);
  if (!Number.isFinite(naive)) return null;
  try {
    // Try the offsets on both sides of a possible DST transition. An ambiguous
    // or nonexistent wall time needs an explicit offset from the source.
    const offsets = new Set([-DAY, 0, DAY].map(delta =>
      Date.parse(`${localDateTime(naive + delta, zone)}Z`) - (naive + delta)));
    const matches = [...offsets].map(offset => naive - offset)
      .filter(stamp => localDateTime(stamp, zone) === wall);
    return matches.length === 1 ? matches[0] : null;
  } catch {
    return null;
  }
}

export function scheduleTiming(row, zone) {
  const [legacyStart, legacyEnd] = row.fields.일시?.split(' ~ ') ?? [];
  const { start = legacyStart, end = legacyEnd, timeZone, allDay } = row.date ?? {};
  const day = datePart(start);
  const hasTime = typeof start === 'string' && start.includes('T');
  const validTime = !hasTime || /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?$/.test(start);
  const time = !allDay && validTime ? start?.match(TIME)?.[1] : null;
  const effectiveZone = timeZone ?? zone;
  const stamp = day && time && (!effectiveZone || validZone(effectiveZone)) ? eventStamp(start, effectiveZone) : null;
  const invalidEndTime = typeof end === 'string' && end.includes('T') && !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?$/.test(end);
  const invalidRange = end && (invalidEndTime || !datePart(end) || (day && datePart(end) < day) ||
    (stamp !== null && end.includes('T') && eventStamp(end, effectiveZone) !== null && eventStamp(end, effectiveZone) < stamp));
  const issue = !day ? '날짜 미정' : !validTime ? '시간 오류' : invalidRange ? '일정 기간 오류' : time && stamp === null ? '시간대·시각 미확인' : null;
  return { row, start, end, day, time, stamp: issue ? null : stamp, allDay, issue };
}

export function compareScheduleEvents(a, b) {
  const order = event => event.allDay ? 0 : event.time ? 1 : 2;
  return order(a) - order(b) || (a.stamp ?? Infinity) - (b.stamp ?? Infinity) ||
    (a.time ?? '').localeCompare(b.time ?? '') || a.row.id.localeCompare(b.row.id);
}

export function planDay(rows, day, zone, now) {
  if (!day) return { events: [], next: null };
  const events = rows.flatMap(row => {
    const [legacyStart, legacyEnd] = row.fields.일시?.split(' ~ ') ?? [];
    const { start = legacyStart, end = legacyEnd, timeZone, allDay } = row.date ?? {};
    if (datePart(start) !== day) return [];
    const time = !allDay ? start?.match(TIME)?.[1] : null;
    const stamp = time ? eventStamp(start, timeZone ?? zone) : null;
    const ended = ENDED.has(row.fields.진행상태);
    return [{ row, time, end, stamp, allDay, passed: !ended && stamp !== null && stamp < now }];
  });
  events.sort(compareScheduleEvents);
  return {
    events,
    next: events.find(event => event.stamp !== null && event.stamp >= now &&
      !ENDED.has(event.row.fields.진행상태) && event.row.fields.진행상태 !== '진행중') ?? null,
  };
}
