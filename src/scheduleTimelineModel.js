import { buildRouteModel } from './routeMapModel.js';
import { datePart } from './todaySchedule.js';
import { scheduleMatches } from './scheduleIdentity.js';

export function scheduleClock(event) {
  if (!event.time) return event.allDay ? '종일' : '시간 미정';
  const endDay = datePart(event.end), endTime = event.end?.match(/T(\d{2}:\d{2})/)?.[1];
  if (!endTime || event.issue || (endDay === event.day && endTime === event.time)) return event.time;
  const days = endDay && event.day ? Math.round((Date.parse(endDay) - Date.parse(event.day)) / 86400000) : 0;
  return `${event.time}–${days > 0 ? `${days === 1 ? '익일' : `${days}일 후`} ` : ''}${endTime}`;
}

export function groupClock(group) {
  const first = group.events[0], last = group.events.at(-1);
  if (group.events.length === 1 || !first.time || !last.time) return scheduleClock(first);
  const lastClock = scheduleClock(last);
  const finish = lastClock.split('–').at(-1);
  return first.time === finish ? first.time : `${first.time}–${finish}`;
}

// Keep the map's complete grouping/order, then filter presentation rather than regrouping search results.
export function buildScheduleTimeline(rows, options = {}, query = '') {
  const route = buildRouteModel(rows, options);
  const search = query.trim().toLowerCase();
  const days = [];
  const dates = [...new Set(route.rows.map(row => row.date))];
  for (const date of dates) {
    const groups = route.visitGroups.filter(group => group.date === date);
    const sources = route.rows.filter(row => row.date === date && !row.groupId);
    const transfers = route.transfers.filter(row => row.date === date);
    const entries = groups.map(group => ({ type: 'visit', id: group.id, group, after: [] }));
    const loose = [];
    for (const source of sources) {
      const transfer = transfers.find(row => row.id === source.id);
      const entry = { type: source.kind === 'transfer' ? 'transfer' : 'record', id: source.id, source,
        resolved: transfer?.resolved ?? false, fromId: transfer?.fromId, toId: transfer?.toId };
      let preceding = transfer?.resolved ? entries.find(item => item.id === transfer.fromId) : null;
      // Timed records can be placed chronologically without claiming a confirmed map connection.
      if (!preceding && source.stamp !== null) preceding = entries.findLast(item =>
        item.group.events.every(event => event.stamp !== null && event.stamp <= source.stamp));
      if (preceding) preceding.after.push(entry);
      else loose.push(entry);
    }
    const matches = row => !search || scheduleMatches(row, search);
    const visibleGroups = entries.filter(entry => entry.group.activities.some(matches) ||
      entry.after.some(item => matches(item.source.row)) || transfers.some(item => item.resolved && item.toId === entry.id && matches(item.row)));
    const visible = visibleGroups.flatMap(entry => [entry, ...entry.after.filter(item => matches(item.source.row))]);
    const unplaced = loose.filter(entry => matches(entry.source.row));
    if (visible.length || unplaced.length) days.push({ date, entries: visible, unplaced,
      warnings: route.warnings.filter(warning => warning.date === date),
      planned: groups.some(group => group.planned) });
  }
  const next = route.visitGroups.flatMap(group => group.events.map(event => ({ ...event, group })))
    .filter(event => event.stamp !== null && event.stamp >= options.now && !['완료', '취소', '진행중'].includes(event.row.fields.진행상태))
    .toSorted((a, b) => a.stamp - b.stamp || a.row.id.localeCompare(b.row.id))[0] ?? null;
  return { route, days, next };
}
