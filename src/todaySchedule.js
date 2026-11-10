const TRIP_ZONES = {
  '4136d8c5-8de1-81ce-a4c8-dbda8e993076': 'Asia/Shanghai',
  '4136d8c5-8de1-81f4-a070-e07878964af0': 'Asia/Macau',
};
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

function localDateTime(stamp, zone) {
  const { year, month, day, hour, minute, second } = localParts(stamp, zone);
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

export function tripCalendar(trip, now) {
  const [from, to] = trip.fields.여행기간?.split(' ~ ') ?? [];
  const start = datePart(from);
  const end = datePart(to ?? from);
  const zone = TRIP_ZONES[trip.id] ?? null;
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

function eventStamp(value, zone) {
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
  const order = event => event.allDay ? 0 : event.time ? 1 : 2;
  events.sort((a, b) => order(a) - order(b) ||
    (a.stamp ?? Infinity) - (b.stamp ?? Infinity) ||
    (a.time ?? '').localeCompare(b.time ?? ''));
  return {
    events,
    next: events.find(event => event.stamp !== null && event.stamp >= now &&
      !ENDED.has(event.row.fields.진행상태) && event.row.fields.진행상태 !== '진행중') ?? null,
  };
}
