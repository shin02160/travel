import { calendarZone, validZone } from './destinationCities.js';
import { scheduleKind, validRouteOrder } from './scheduleIdentity.js';
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

// UUIDs stabilize presentation only. They never establish an uncertain visit order.
export function orderScheduleDay(events) {
  const candidates = events.filter(event => event.row.fields.진행상태 !== '취소' && scheduleKind(event.row) === 'visit');
  const orders = candidates.map(event => validRouteOrder(event.row.routeOrder));
  const supplied = orders.filter(value => value !== null);
  const duplicate = new Set(supplied).size !== supplied.length;
  // Explicit order is authoritative even when another visit has no order/time.
  // Unplaceable visits remain visible after the ordered chain, without vetoing it.
  const plan = supplied.length > 0;
  const explicit = candidates.filter(event => validRouteOrder(event.row.routeOrder) !== null)
    .toSorted((a, b) => a.row.routeOrder - b.row.routeOrder || compareScheduleEvents(a, b));
  const certainty = new Map();
  for (const event of candidates) {
    const order = validRouteOrder(event.row.routeOrder);
    certainty.set(event, plan ? order !== null && orders.filter(value => value === order).length === 1
      : event.stamp !== null && !event.allDay);
  }
  const sortedCandidates = plan ? [...explicit] : candidates.toSorted(compareScheduleEvents);
  const unplaced = new Set();
  if (plan) {
    for (const event of candidates.filter(event => validRouteOrder(event.row.routeOrder) === null).toSorted(compareScheduleEvents)) {
      // A clock can locate an unordered visit only against a complete, monotonic
      // set of timed anchors. Otherwise its relationship to the plan is unknown.
      const anchorsTimed = explicit.every(anchor => anchor.stamp !== null);
      const monotonic = explicit.every((anchor, i) => !i || anchor.stamp > explicit[i - 1].stamp);
      const tied = explicit.some(anchor => anchor.stamp === event.stamp);
      if (event.stamp !== null && anchorsTimed && monotonic && !tied) {
        const index = sortedCandidates.findIndex(other => other.stamp > event.stamp);
        sortedCandidates.splice(index < 0 ? sortedCandidates.length : index, 0, event);
        certainty.set(event, true);
      } else { sortedCandidates.push(event); unplaced.add(event); }
    }
  }
  const known = candidates.filter(event => event.stamp !== null && validRouteOrder(event.row.routeOrder) !== null)
    .toSorted((a, b) => a.row.routeOrder - b.row.routeOrder);
  const conflict = known.some((event, i) => i > 0 && event.stamp < known[i - 1].stamp);
  const unresolved = candidates.some(event => event.issue);
  const unordered = candidates.some(event => !certainty.get(event));
  const warnings = [duplicate && '동선 순서 중복', conflict && '동선 순서·시각 충돌',
    unordered && '시간 미정·동선 순서 미확정', unresolved && '일정 시각·기간 확인 필요'].filter(Boolean);
  const rest = events.filter(event => !candidates.includes(event)).toSorted(compareScheduleEvents);
  return { events: plan ? [...sortedCandidates, ...rest] : events.toSorted(compareScheduleEvents),
    candidates: sortedCandidates, plan, warnings, certainty, unplaced };
}

export function planDay(rows, day, zone, now) {
  if (!day) return { events: [], next: null };
  const events = rows.flatMap(row => {
    const timing = scheduleTiming(row, zone);
    if (timing.day !== day) return [];
    const { stamp } = timing;
    const ended = ENDED.has(row.fields.진행상태);
    return [{ ...timing, passed: !ended && stamp !== null && stamp < now }];
  });
  const ordered = orderScheduleDay(events);
  return {
    events: ordered.events,
    plan: ordered.plan,
    warnings: ordered.warnings,
    next: events.toSorted(compareScheduleEvents).find(event => event.stamp !== null && event.stamp >= now &&
      !ENDED.has(event.row.fields.진행상태) && event.row.fields.진행상태 !== '진행중') ?? null,
  };
}
