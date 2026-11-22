import { NotionError, notionReader, propertyValue } from './notion-reader.js';
import { validZone } from '../src/destinationCities.js';

const ID = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;
export const CITY_TTL = 5 * 60 * 1000;
const caches = new WeakMap();

export class CityError extends Error {
  constructor(code, status = 502) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

export function normalizeCities(pages) {
  const codes = new Set();
  const cities = [];
  for (const page of pages) {
    const p = page.properties;
    const id = propertyValue(p['도시 코드'])?.trim();
    if (!id || !/^[A-Z]{2}_[A-Z0-9_]+$/.test(id) || codes.has(id)) throw new CityError('city_data_invalid');
    codes.add(id);
    if (p.활성?.type !== 'checkbox') throw new CityError('city_data_invalid');
    if (!p.활성.checkbox) continue;
    const name = propertyValue(p.도시명)?.trim();
    const countryCode = propertyValue(p['국가 코드'])?.trim();
    const zone = propertyValue(p.시간대)?.trim();
    const latitude = p.위도?.type === 'number' ? p.위도.number : null;
    const longitude = p.경도?.type === 'number' ? p.경도.number : null;
    if (!name || !/^[A-Z]{2}$/.test(countryCode ?? '') || !validZone(zone) ||
        !Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
        !Number.isFinite(longitude) || Math.abs(longitude) > 180) throw new CityError('city_data_invalid');
    cities.push({ id, notionId: page.id, name, countryCode, zone, latitude, longitude });
  }
  return cities;
}

export async function loadCities(env = process.env, fetcher = fetch, signal, now = Date.now()) {
  const token = env.NOTION_TRAVEL_TOKEN?.trim();
  const source = env.NOTION_TRAVEL_CITIES_SOURCE_ID?.trim().toLowerCase();
  if (!token || !ID.test(source ?? '')) throw new CityError('cities_not_configured', 503);
  let cache = caches.get(fetcher);
  if (!cache) { cache = new Map(); caches.set(fetcher, cache); }
  const key = `${source}:${token}`;
  const cached = cache.get(key);
  if (cached && now < cached.expires) return cached.promise;
  if (cache.size >= 8) cache.clear();
  const entry = { expires: now + CITY_TTL };
  entry.promise = (async () => {
    try {
      return normalizeCities(await notionReader(token, fetcher, signal).query(source));
    } catch (error) {
      if (cache.get(key) === entry) cache.delete(key);
      const failure = error instanceof CityError ? error : new CityError(
        error instanceof NotionError && [401, 403, 404].includes(error.status) ? 'cities_access_denied' : 'cities_unavailable',
        error instanceof NotionError && error.status === 429 ? 503 : 502);
      console.warn('City repository failed', { reason: failure.code });
      throw failure;
    }
  })();
  cache.set(key, entry);
  return entry.promise;
}

export function citiesForPage(page, cities) {
  const relation = page.properties.도시;
  if (relation?.type !== 'relation' || relation.has_more !== false || !Array.isArray(relation.relation) ||
      relation.relation.some(item => !ID.test(item?.id ?? ''))) throw new CityError('city_relation_invalid');
  return [...new Set(relation.relation.map(item => item.id))].flatMap(id => {
    const city = cities.find(city => city.notionId === id);
    return city ? [city] : [];
  });
}

export function publicCity({ id, name, countryCode, zone, latitude, longitude }) {
  return { id, name, countryCode, zone, latitude, longitude };
}
