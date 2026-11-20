export const INFO_CATEGORIES = ['지역 특징', '주요 교통', '주의사항', '여행 팁'];

export function validZone(zone) {
  if (typeof zone !== 'string' || (zone !== 'UTC' && !/^(?:[A-Za-z_]+\/)+[A-Za-z0-9_+-]+$/.test(zone))) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone }).format(0);
    return true;
  } catch { return false; }
}

export function zoneOffset(epoch, zone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(epoch).map(({ type, value }) => [type, value]));
  return (Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second)) - Math.floor(epoch / 1000) * 1000) / 1000;
}

export function calendarZone(cities = [], start, end = start) {
  if (!cities.length || cities.some(city => !validZone(city.zone))) return null;
  const zones = [...new Set(cities.map(city => city.zone))];
  if (zones.length === 1) return zones[0];
  const first = Date.parse(`${start?.slice(0, 10)}T00:00:00Z`);
  const last = Date.parse(`${end?.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(first) || !Number.isFinite(last) || last < first || last - first > 366 * 86400000) return null;
  // Preserve equivalent zones (Macau/Shanghai), without choosing a zone for mixed-offset trips.
  for (let stamp = first; stamp <= last + 86400000; stamp += 6 * 3600000) {
    const offset = zoneOffset(stamp, zones[0]);
    if (zones.some(zone => zoneOffset(stamp, zone) !== offset)) return null;
  }
  return zones[0];
}
