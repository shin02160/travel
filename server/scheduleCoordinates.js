import { safeScheduleMapUrl } from '../src/mapLinks.js';

export function validCoordinates(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

export function scheduleCoordinates(properties) {
  const lat = properties.위도?.type === 'number' ? properties.위도.number : null;
  const lng = properties.경도?.type === 'number' ? properties.경도.number : null;
  // These two Notion fields are defined as WGS84. Explicitly incompatible CRS labels are rejected.
  const crs = properties.좌표계;
  const crsName = crs?.type === 'select' ? crs.select?.name : null;
  if (crs && crsName !== 'WGS84') return null;
  if (validCoordinates(lat, lng)) return { lat, lng, source: 'notion' };
  const saved = safeScheduleMapUrl(properties['지도 URL']?.url);
  if (!saved) return null;
  const url = new URL(saved);
  // Numeric searches alone don't prove the coordinate system (notably in mainland China).
  // #WGS84 is an explicit operator confirmation, never inferred from a camera or a place name.
  if (!['www.google.com', 'google.com'].includes(url.hostname) || !/^\/maps\/search\/?$/.test(url.pathname) ||
      url.hash !== '#WGS84' || url.searchParams.get('api') !== '1' ||
      [...url.searchParams.keys()].some(key => !['api', 'query'].includes(key)) ||
      url.searchParams.getAll('api').length !== 1 || url.searchParams.getAll('query').length !== 1) return null;
  const match = url.searchParams.get('query')?.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!match || !validCoordinates(Number(match[1]), Number(match[2]))) return null;
  return { lat: Number(match[1]), lng: Number(match[2]), source: 'map-url' };
}
