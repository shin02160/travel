import { compareScheduleEvents, datePart, scheduleTiming, shiftDate } from './todaySchedule.js';

export const ROUTE_COLORS = [
  { fill: '#B6E876', line: '#3f7227' }, { fill: '#B9B0ED', line: '#6653ad' },
  { fill: '#F4B9A5', line: '#a34d35' }, { fill: '#A9D6F4', line: '#28658e' },
  { fill: '#F5D785', line: '#866512' }, { fill: '#C9C2BA', line: '#62594f' },
];
export const MERCATOR_LATITUDE = 85.0511287798;

export function routeCoordinates(value) {
  if (!value || !Number.isFinite(value.lat) || !Number.isFinite(value.lng) ||
      Math.abs(value.lat) > 90 || Math.abs(value.lng) > 180) return null;
  return { lat: value.lat, lng: value.lng };
}

export function routeDates(rows, start, end) {
  const dates = new Set(rows.map(row => scheduleTiming(row).day).filter(Boolean));
  const validPeriod = Boolean(start && end && start === datePart(start) && end === datePart(end) && start <= end);
  let truncated = false;
  if (validPeriod) {
    let day = start;
    for (let i = 0; i < 366; i++) {
      dates.add(day);
      if (day === end) break;
      if (i === 365) { truncated = true; break; }
      day = shiftDate(day, 1);
    }
  }
  return { dates: [...dates].sort(), validPeriod, truncated };
}

export function initialRouteDate({ dates, validPeriod }, { start, end, today }) {
  if (validPeriod && today >= start && today <= end && dates.includes(today)) return today;
  return validPeriod ? start : dates[0] ?? null;
}

export function buildRouteModel(scheduleRows, { date = 'all', zone, start, end } = {}) {
  const calendar = routeDates(scheduleRows, start, end);
  const events = scheduleRows.map(row => scheduleTiming(row, zone)).sort((a, b) =>
    (a.day ?? '9999-99-99').localeCompare(b.day ?? '9999-99-99') || compareScheduleEvents(a, b));
  const points = [], segments = [], rows = [];
  const numberByDate = new Map(), timedCounts = new Map();
  const uncertainDays = new Set(events.filter(event => event.time && event.stamp === null && event.row.fields.진행상태 !== '취소').map(event => event.day));
  for (const event of events) {
    if (event.stamp !== null && event.row.fields.진행상태 !== '취소') {
      const key = `${event.day}:${event.stamp}`;
      timedCounts.set(key, (timedCounts.get(key) ?? 0) + 1);
    }
  }
  let previous = null;
  for (const event of events) {
    if (date !== 'all' && event.day !== date) continue;
    const { row, day, time, stamp, allDay, issue } = event;
    const color = ROUTE_COLORS[Math.max(0, calendar.dates.indexOf(day)) % ROUTE_COLORS.length];
    const cancelled = row.fields.진행상태 === '취소';
    const timed = stamp !== null && !allDay && !cancelled;
    const number = timed ? (numberByDate.get(day) ?? 0) + 1 : null;
    if (timed) numberByDate.set(day, number);
    const coordinates = routeCoordinates(row.coordinates);
    const ambiguousMove = row.fields.구분 === '이동' && /→|->|↔|에서.+(?:까지|도착)/.test(`${row.title} ${row.fields.장소 ?? ''}`);
    const collision = timed && timedCounts.get(`${day}:${stamp}`) > 1;
    const reasons = [];
    if (cancelled) reasons.push('취소');
    if (issue) reasons.push(issue);
    if (allDay) reasons.push('종일');
    else if (!time && day && !issue) reasons.push('시간 미정');
    if (ambiguousMove) reasons.push('이동 기록 · 지점 미확인');
    if (!coordinates) reasons.push('위치 미확인');
    else if (Math.abs(coordinates.lat) > MERCATOR_LATITUDE) reasons.push('지도 투영 범위 밖');
    if (collision) reasons.push('동시각 · 순서 미확정');
    const mapped = Boolean(day && coordinates && !cancelled && !ambiguousMove && Math.abs(coordinates.lat) <= MERCATOR_LATITUDE && !issue);
    const item = { id: row.id, row, date: day, time, number, color, mapped, reasons, collision,
      ...(coordinates ?? {}), outOfPeriod: Boolean(day && calendar.validPeriod && (day < start || day > end)) };
    rows.push(item);
    if (mapped) points.push(item);
    if (cancelled) continue;
    if (timed) {
      if (!uncertainDays.has(day) && previous?.date === day && previous.mapped && mapped && !previous.collision && !collision) {
        segments.push({ date: day, fromId: previous.id, toId: item.id, color });
      }
      previous = item;
    } else if (time || ambiguousMove || issue) {
      // Invalid clock or explicit transfer records break the chain, rather than creating a shortcut.
      previous = null;
    }
  }
  return { ...calendar, points, segments, rows,
    counts: { total: rows.length, mapped: points.length,
      missing: rows.filter(row => row.reasons.includes('위치 미확인') && !row.reasons.includes('취소')).length,
      cancelled: rows.filter(row => row.reasons.includes('취소')).length } };
}

// Choose a minimal wrapped interval for antimeridian crossings, without modifying stored coordinates.
export function routeDisplayPositions(points) {
  if (!points.length) return new Map();
  const sorted = points.map(point => ((point.lng % 360) + 360) % 360).sort((a, b) => a - b);
  let gap = -1, cut = sorted[0];
  sorted.forEach((value, i) => {
    const next = sorted[(i + 1) % sorted.length] + (i === sorted.length - 1 ? 360 : 0);
    if (next - value > gap) { gap = next - value; cut = next % 360; }
  });
  const values = points.map(point => {
    const normalized = ((point.lng % 360) + 360) % 360;
    return normalized < cut ? normalized + 360 : normalized;
  });
  const shift = (Math.min(...values) + Math.max(...values)) / 2 > 180 ? 360 : 0;
  return new Map(points.map((point, i) => [point.id, [point.lat, values[i] - shift]]));
}
