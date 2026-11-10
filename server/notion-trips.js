import { setTimeout as delay } from 'node:timers/promises';
import { tripPinConfig, tripSessionExpiry, unlockTrip } from './trip-pin.js';

const ID = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;
const SECTIONS = {
  schedule: ['일정명', '일시', '구분', '장소', '진행상태'],
  bookings: ['예약명', '예약유형', '예약상태', '이용일', '결제상태'],
  budgets: ['예산항목', '분류', '예산 KRW', '사용금액', '잔액'],
  expenses: ['지출명', '분류', '결제일', '결제자', '정산여부', '현지 금액', '통화', '원화 확정액', '집계 금액'],
  receipts: ['영수증명', '처리상태'],
  checklist: ['할 일', '분류', '상태', '단계', '기한'],
};
const TRIP_FIELDS = ['여행명', '여행지', '여행기간', '상태', '메모', '총예산', '총지출', '잔여예산'];
const SOURCE_KEYS = ['trips', ...Object.keys(SECTIONS)];
const NOTION_API = 'https://api.notion.com/v1';

class NotionError extends Error {
  constructor(status) {
    super('Notion request failed');
    this.status = status;
  }
}

function respond(res, status, body) {
  res.statusCode = status;
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(body));
}

function propertyValue(property) {
  const type = property?.type;
  const value = property?.[type];
  switch (type) {
    case 'title':
    case 'rich_text':
      return Array.isArray(value) ? value.map(part => part.plain_text ?? '').join('') : null;
    case 'select':
    case 'status':
      return value?.name ?? null;
    case 'date':
      return value?.start ? [value.start, value.end].filter(Boolean).join(' ~ ') : null;
    case 'number':
      return value ?? null;
    case 'checkbox':
      return typeof value === 'boolean' ? value : null;
    case 'formula':
    case 'rollup':
      return value?.type === 'number' ? value.number : null;
    default:
      return null;
  }
}

function project(page, [title, ...fields]) {
  if (page.properties[title]?.type !== 'title') throw new NotionError(502);
  return {
    id: page.id,
    title: propertyValue(page.properties[title]) || '제목 없음',
    fields: Object.fromEntries(fields.map(name => [name, propertyValue(page.properties[name])])),
  };
}

function savedMapUrl(property) {
  try {
    const url = new URL(property?.url);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const googleMap = ['google.com', 'www.google.com'].includes(url.hostname) && /^\/maps(?:\/|$)/.test(url.pathname);
    return googleMap || ['maps.google.com', 'maps.app.goo.gl', 'maps.apple.com', 'map.naver.com', 'map.kakao.com'].includes(url.hostname)
      ? url.href : null;
  } catch {
    return null;
  }
}

function scheduleDetails(page) {
  const properties = page.properties;
  const date = properties.일시?.date;
  const relation = properties['관련 예약'];
  return {
    date: date?.start ? { start: date.start, end: date.end ?? null, timeZone: date.time_zone ?? null } : null,
    note: propertyValue(properties.메모),
    mapUrl: savedMapUrl(properties['지도 URL']),
    sourceUrl: page.url ? `https://www.notion.so/${page.id.replaceAll('-', '')}` : null,
    bookingIds: relation?.type === 'relation' && Array.isArray(relation.relation)
      ? relation.relation.map(item => item.id) : [],
  };
}

function belongsTo(page, source) {
  return page?.object === 'page' && ID.test(page.id) &&
    page.parent?.type === 'data_source_id' && page.parent.data_source_id === source &&
    page.archived !== true && page.is_archived !== true && page.in_trash !== true &&
    page.properties && typeof page.properties === 'object';
}

function belongsToTrip(page, tripId) {
  const relation = page.properties['여행'];
  return relation?.type === 'relation' && relation.has_more === false &&
    Array.isArray(relation.relation) && relation.relation.length === 1 && relation.relation[0]?.id === tripId;
}

function notionReader(token, fetcher, signal) {
  async function request(path, body) {
    for (let attempt = 0; ; attempt++) {
      const response = await fetcher(`${NOTION_API}${path}`, {
        method: body ? 'POST' : 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Notion-Version': '2026-03-11',
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        redirect: 'error',
        signal,
      });
      if (response.ok) return response.json();
      if (attempt === 2 || ![429, 502, 503, 504].includes(response.status)) {
        throw new NotionError(response.status);
      }
      const retryAfter = response.headers.get('Retry-After');
      const wait = retryAfter === null ? 250 * 2 ** attempt : Number(retryAfter) * 1000;
      if (!Number.isFinite(wait) || wait < 0 || wait > 3000) throw new NotionError(response.status);
      await delay(wait, undefined, { signal });
    }
  }

  async function query(source, tripId) {
    const pages = new Map();
    const seen = new Set();
    let cursor;
    const filter = tripId ? { property: '여행', relation: { contains: tripId } } : undefined;
    do {
      const result = await request(`/data_sources/${source}/query`, {
        page_size: 100, start_cursor: cursor, filter,
      });
      if (!Array.isArray(result.results) || typeof result.has_more !== 'boolean' ||
          result.request_status?.type === 'incomplete') throw new NotionError(502);
      for (const page of result.results) {
        if (belongsTo(page, source) && (!tripId || belongsToTrip(page, tripId))) pages.set(page.id, page);
      }
      if (!result.has_more) return [...pages.values()];
      cursor = result.next_cursor;
      if (typeof cursor !== 'string' || !cursor || seen.has(cursor) || seen.size >= 100) {
        throw new NotionError(502);
      }
      seen.add(cursor);
    } while (cursor);
  }

  return { query, readTrip: id => request(`/pages/${id}`) };
}

export async function handleTrips(req, res, env = process.env, fetcher = fetch, { behindVercel = false } = {}) {
  const url = new URL(req.url, 'http://localhost');
  const ids = url.searchParams.getAll('tripId');
  const detailPath = url.pathname.match(/^\/api\/trips\/([^/]+)$/);
  if (detailPath && ids[0] !== detailPath[1]) ids.push(detailPath[1]);
  if (ids.length > 1 || (ids.length === 1 && !ID.test(ids[0]))) {
    return respond(res, 400, { error: 'invalid_trip_id' });
  }

  const tripId = ids[0]?.toLowerCase();
  const methods = tripId ? ['GET', 'POST'] : ['GET'];
  if (!methods.includes(req.method)) {
    res.setHeader('Allow', methods.join(', '));
    return respond(res, 405, { error: 'method_not_allowed' });
  }

  const config = tripId ? tripPinConfig(tripId, env) : null;
  if (req.method === 'POST') return unlockTrip(req, res, respond, tripId, config, env, fetcher, behindVercel);
  const expiresAt = tripId ? tripSessionExpiry(req, tripId, config) : 0;
  if (tripId && !config) return respond(res, 403, { error: 'trip_pin_not_configured' });
  if (tripId && !expiresAt) return respond(res, 401, { error: 'trip_pin_required' });

  const token = env.NOTION_TRAVEL_TOKEN?.trim();
  const sources = Object.fromEntries(SOURCE_KEYS.map(key => [
    key, env[`NOTION_TRAVEL_${key.toUpperCase()}_SOURCE_ID`]?.trim().toLowerCase(),
  ]));
  if (!token || !ID.test(sources.trips) || (tripId && (
    SOURCE_KEYS.some(key => !ID.test(sources[key])) ||
    new Set(Object.values(sources)).size !== SOURCE_KEYS.length
  ))) {
    return respond(res, 503, { error: 'notion_not_configured' });
  }

  const sendData = body => expiresAt * 1000 > Date.now()
    ? respond(res, 200, { expiresAt, ...body })
    : respond(res, 401, { error: 'trip_pin_required' });

  const reader = notionReader(token, fetcher, AbortSignal.timeout(15000));
  try {
    if (!tripId) {
      const trips = await reader.query(sources.trips);
      return respond(res, 200, {
        trips: trips.map(page => project(page, TRIP_FIELDS.slice(0, 4))),
      });
    }

    const trip = await reader.readTrip(tripId).catch(error => {
      if (error instanceof NotionError && error.status === 404) return null;
      throw error;
    });
    if (!belongsTo(trip, sources.trips) || trip.id !== tripId) {
      return respond(res, 404, { error: 'trip_not_found' });
    }

    const sections = {};
    for (const [key, fields] of Object.entries(SECTIONS)) {
      const pages = await reader.query(sources[key], tripId);
      const expenses = key === 'receipts' ? new Map(sections.expenses.map(row => [row.id, row.title])) : null;
      sections[key] = pages.map(page => {
        const row = project(page, fields);
        if (key === 'schedule') Object.assign(row, scheduleDetails(page));
        if (expenses) {
          const related = page.properties['관련 지출'];
          row.fields['관련 지출'] = related?.type === 'relation' && Array.isArray(related.relation)
            ? related.relation.map(entry => expenses.get(entry.id)).filter(Boolean).join(', ')
            : null;
        }
        return row;
      });
    }

    const bookingIds = new Set(sections.bookings.map(row => row.id));
    for (const event of sections.schedule) {
      event.bookingIds = [...new Set(event.bookingIds.filter(id => bookingIds.has(id)))];
    }

    return sendData({ trip: project(trip, TRIP_FIELDS), sections });
  } catch (error) {
    const status = error instanceof NotionError && error.status === 429 ? 503 : 502;
    return respond(res, status, { error: 'notion_unavailable' });
  }
}
