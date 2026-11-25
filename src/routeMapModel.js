import { datePart, orderScheduleDay, scheduleTiming, shiftDate } from './todaySchedule.js';
import { normalizePlace, sameFacility, scheduleKind, transferEndpoints, validRouteOrder } from './scheduleIdentity.js';

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
  const days = new Map();
  for (const row of scheduleRows) {
    const event = scheduleTiming(row, zone);
    if (date !== 'all' && event.day !== date) continue;
    if (!days.has(event.day)) days.set(event.day, []);
    days.get(event.day).push(event);
  }
  const visitGroups = [], rows = [], segments = [], transfers = [], warnings = [];
  for (const [day, events] of [...days].sort(([a], [b]) => (a ?? '9999').localeCompare(b ?? '9999'))) {
    const ordered = orderScheduleDay(events);
    warnings.push(...ordered.warnings.map(message => ({ date: day, message })));
    const color = ROUTE_COLORS[Math.max(0, calendar.dates.indexOf(day)) % ROUTE_COLORS.length];
    const excluded = events.filter(event => scheduleKind(event.row) !== 'visit' && event.row.fields.진행상태 !== '취소');
    const between = (event, a, b) => ordered.plan
      ? validRouteOrder(event.row.routeOrder) !== null && event.row.routeOrder > a.row.routeOrder && event.row.routeOrder < b.row.routeOrder
      : event.stamp !== null && a.stamp !== null && b.stamp !== null && event.stamp >= a.stamp && event.stamp <= b.stamp;
    const groups = [];
    for (const event of ordered.candidates) {
      const previous = groups.at(-1);
      const last = previous?.events.at(-1);
      const barrier = last && excluded.some(other => between(other, last, event));
      const established = ordered.plan || (last?.stamp !== null && last?.stamp !== undefined && event.stamp !== null);
      const ambiguousTie = event.stamp !== null && ordered.candidates.some(other => other.stamp === event.stamp && !sameFacility(other.row, event.row));
      if (previous && established && !barrier && !ambiguousTie && !event.issue && !last.issue && previous.events.every(other => sameFacility(other.row, event.row))) {
        previous.events.push(event);
      } else groups.push({ id: event.row.id, row: event.row, events: [event] });
    }
    const endpointMatches = (group, name) => group.events.some(event =>
      [event.row.title, event.row.fields.장소].some(value => normalizePlace(value) === name));
    const dayTransfers = [];
    for (const event of excluded.filter(event => scheduleKind(event.row) === 'transfer')) {
      const endpoints = transferEndpoints(event.row);
      const matches = groups.flatMap((group, i) => i + 1 < groups.length && endpoints &&
        endpointMatches(group, endpoints[0]) && endpointMatches(groups[i + 1], endpoints[1]) ? [i] : []);
      const index = matches.length === 1 ? matches[0] : -1;
      dayTransfers.push({ event, index, resolved: index >= 0 && !event.issue });
    }
    // An unplaced transfer may contain an unrepresented stop. Do not invent its position.
    const unplacedTransfer = dayTransfers.some(transfer => !transfer.resolved && transfer.event.stamp === null);
    let number = 0;
    groups.forEach(group => {
      const candidates = group.events;
      const first = candidates[0];
      const coordinates = candidates.map(event => routeCoordinates(event.row.coordinates)).find(Boolean);
      const issue = candidates.find(event => event.issue)?.issue;
      const numbered = Boolean(day && (ordered.plan || candidates.every(event => event.stamp !== null && !event.allDay)));
      const reasons = [];
      if (issue) reasons.push(issue);
      if (candidates.some(event => event.allDay)) reasons.push('종일');
      else if (candidates.some(event => !event.time)) reasons.push('시간 미정');
      if (ordered.plan) reasons.push('계획 순서');
      if (!numbered && day) reasons.push('순서 미확정');
      if (!coordinates) reasons.push('위치 미확인');
      else if (Math.abs(coordinates.lat) > MERCATOR_LATITUDE) reasons.push('지도 투영 범위 밖');
      Object.assign(group, { date: day, time: first.time, color, number: numbered ? ++number : null,
        eventIds: candidates.map(event => event.row.id), activities: candidates.map(event => event.row),
        planned: ordered.plan, reasons, collision: false,
        mapped: Boolean(day && coordinates && Math.abs(coordinates.lat) <= MERCATOR_LATITUDE && !issue),
        ...(coordinates ?? {}), outOfPeriod: Boolean(day && calendar.validPeriod && (day < start || day > end)) });
    });
    // Distinct facilities at the same instant remain uncertain, even with ID or plan tie breakers.
    for (const group of groups) {
      group.collision = groups.some(other => other !== group && group.events.some(event => event.stamp !== null &&
        other.events.some(candidate => candidate.stamp === event.stamp)));
      if (group.collision) group.reasons.push('동시각 · 순서 미확정');
    }
    groups.forEach((group, i) => {
      if (i === 0) return;
      const previous = groups[i - 1];
      const a = previous.events.at(-1), b = group.events[0];
      const badTransfer = dayTransfers.some(transfer => !transfer.resolved && between(transfer.event, a, b));
      const privateBarrier = excluded.some(event => scheduleKind(event.row) === 'private' && (between(event, a, b) ||
        (event.stamp === null && (!ordered.plan || validRouteOrder(event.row.routeOrder) === null))));
      if (day && !ordered.blocked && !unplacedTransfer && !badTransfer && !privateBarrier && previous.number !== null && group.number !== null &&
          previous.mapped && group.mapped && !previous.collision && !group.collision) {
        segments.push({ date: day, fromId: previous.id, toId: group.id, color });
      }
    });
    const groupByEvent = new Map(groups.flatMap(group => group.eventIds.map(id => [id, group])));
    // Original rows are retained separately from rendered visit groups.
    for (const event of ordered.events) {
      const group = groupByEvent.get(event.row.id);
      const kind = scheduleKind(event.row);
      const cancelled = event.row.fields.진행상태 === '취소';
      const transfer = dayTransfers.find(item => item.event === event);
      const reasons = group?.reasons ?? [cancelled ? '취소' : kind === 'private' ? '사적 장소 · 지도 제외' : '이동 구간',
        ...(transfer && !transfer.resolved ? ['방문 연결 미확인'] : []), ...(event.issue ? [event.issue] : [])];
      const item = { ...event, id: event.row.id, date: day, kind, cancelled, color, groupId: group?.id ?? null,
        number: group?.number ?? null, mapped: Boolean(group?.mapped), reasons, collision: group?.collision ?? false,
        outOfPeriod: group?.outOfPeriod ?? Boolean(day && calendar.validPeriod && (day < start || day > end)) };
      rows.push(item);
      if (kind === 'transfer') transfers.push({ ...item, resolved: Boolean(transfer?.resolved),
        fromId: transfer?.resolved ? groups[transfer.index].id : null,
        toId: transfer?.resolved ? groups[transfer.index + 1].id : null });
    }
    visitGroups.push(...groups);
  }
  const points = visitGroups.filter(group => group.mapped);
  return { ...calendar, points, segments, rows, visitGroups, transfers, warnings,
    unmapped: visitGroups.filter(group => !group.mapped), unordered: visitGroups.filter(group => group.number === null),
    counts: { total: rows.length, visits: visitGroups.length, mapped: points.length,
      missing: visitGroups.filter(group => group.reasons.includes('위치 미확인')).length,
      unordered: visitGroups.filter(group => group.number === null).length,
      transfers: transfers.length, private: rows.filter(item => item.kind === 'private' && !item.cancelled).length,
      cancelled: rows.filter(item => item.cancelled).length } };
}

// Choose a minimal wrapped interval for antimeridian crossings, without modifying stored coordinates.
export function routeDisplayPositions(points) {
  if (!points.length) return new Map();
  const sorted = points.map(point => ((point.lng % 360) + 360) % 360).sort((a, b) => a - b);
  let gap = -1, cut = sorted[0];
  sorted.forEach((value, i) => {
    const next = sorted[(i + 1) % sorted.length] + (i === sorted.length - 1 ? 360 : 0);
    if (next - value > gap) { gap = next - value; cut = sorted[(i + 1) % sorted.length]; }
  });
  const values = points.map(point => {
    const normalized = ((point.lng % 360) + 360) % 360;
    return normalized < cut ? normalized + 360 : normalized;
  });
  const shift = (Math.min(...values) + Math.max(...values)) / 2 > 180 ? 360 : 0;
  return new Map(points.map((point, i) => [point.id, [point.lat, values[i] - shift]]));
}
