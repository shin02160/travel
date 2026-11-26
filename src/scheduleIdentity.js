export const normalizePlace = value => typeof value === 'string' ? value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase() : '';

export const validRouteOrder = value => Number.isSafeInteger(value) && value > 0 ? value : null;

export function scheduleActivity(row) {
  const activity = typeof row.activity === 'string' ? row.activity.trim() : '';
  return activity && normalizePlace(activity) !== normalizePlace(row.title) ? activity : null;
}

export function scheduleMatches(row, query) {
  return [row.title, scheduleActivity(row)].some(value => value?.toLowerCase().includes(query));
}

export function scheduleKind(row) {
  const values = [row.title, row.fields.장소].map(normalizePlace).filter(Boolean);
  const chains = values.filter(value => /→|->|↔/.test(value)).map(value => value.split(/→|->|↔/).map(normalizePlace).filter(Boolean));
  if (chains.some(parts => parts.length > 1)) return 'transfer';
  if (values.some(value => /^(?:집(?: 도착)?|자택(?: 도착)?|우리 집|본가|귀가(?: 완료)?|home)$/.test(value))) return 'private';
  return 'visit';
}

export function transferEndpoints(row) {
  const chains = [row.title, row.fields.장소].map(normalizePlace).filter(value => /→|->|↔/.test(value))
    .map(value => value.split(/→|->|↔/).map(normalizePlace).filter(Boolean));
  if (!chains.length || chains.some(parts => parts.length !== 2)) return null;
  // The schedule title names the leg; detailed addresses may use other languages.
  // This association is only for displaying transfer records, never map geometry.
  return chains[0];
}

const placeKey = value => normalizePlace(value).replace(/[\s\p{P}\p{S}]/gu, '');

export function placeMatches(a, b) {
  const left = placeKey(a), right = placeKey(b);
  return Boolean(left && right && left === right);
}

export function sameFacility(a, b) {
  const titleA = normalizePlace(a.title), titleB = normalizePlace(b.title);
  const placeA = normalizePlace(a.fields.장소), placeB = normalizePlace(b.fields.장소);
  const ca = a.coordinates, cb = b.coordinates;
  // Small rounding differences are common for a facility's representative point.
  // A shared point by itself never proves that two different businesses are one.
  const conflict = ca && cb && (Math.abs(ca.lat - cb.lat) > .00005 || Math.abs(ca.lng - cb.lng) > .00005);
  if (conflict) return false;
  if (titleA && titleA === titleB && (!placeA || !placeB || placeMatches(placeA, placeB))) return true;
  // An explicit facility hierarchy may share a representative point. Proximity alone is never identity.
  const member = (title, facility) => title === facility || [' · ', ' / ', ' > '].some(separator => title.startsWith(facility + separator));
  return Boolean(placeA && placeA === placeB && ca && cb && member(titleA, placeA) && member(titleB, placeA));
}
