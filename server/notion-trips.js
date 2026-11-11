import { setTimeout as delay } from 'node:timers/promises';
import { tripPinConfig, tripSessionExpiry, unlockTrip } from './trip-pin.js';

const ID = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;
const SECTIONS = {
  schedule: ['일정명', '일시', '구분', '장소', '진행상태'],
  bookings: ['예약명', '예약유형', '예약상태', '이용일', '결제상태'],
  budgets: ['예산항목', '분류', '예산 KRW', '사용금액', '잔액'],
  expenses: ['지출명', '분류', '결제일', '결제자', '결제수단', '정산여부', '통화', '현지 금액', '원화 확정액', '집계 금액'],
  receipts: ['영수증명', '처리상태'],
  checklist: ['할 일', '분류', '상태', '단계', '기한'],
  shopping: ['품목', '분류', '유형', '상태', '우선순위', '구매방법', '매장', '위치', '추천품목', '구매예정일', '단계', '기한', '메모'],
};
const TRIP_FIELDS = ['여행명', '여행지', '여행기간', '상태', '메모', '총예산', '총지출', '잔여예산'];
const REQUIRED_SOURCES = ['trips', ...Object.keys(SECTIONS).filter(key => key !== 'shopping')];
const NOTION_API = 'https://api.notion.com/v1';
const ITEM_BLOCK_TYPES = new Set([
  'paragraph', 'heading_1', 'heading_2', 'heading_3', 'to_do', 'bulleted_list_item',
  'numbered_list_item', 'toggle', 'quote', 'callout', 'divider',
]);

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

  async function query(source, tripId, sorts) {
    const pages = new Map();
    const seen = new Set();
    let cursor;
    const filter = tripId ? { property: '여행', relation: { contains: tripId } } : undefined;
    do {
      const result = await request(`/data_sources/${source}/query`, {
        page_size: 100, start_cursor: cursor, filter, sorts,
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

  async function readItemBody(pageId) {
    let remaining = 300;
    let partial = false;

    async function children(parentId, depth) {
      const blocks = [];
      const seen = new Set();
      let cursor;
      do {
        if (depth > 4 || remaining === 0) {
          partial = true;
          break;
        }
        const params = new URLSearchParams({ page_size: String(Math.min(100, remaining)) });
        if (cursor) params.set('start_cursor', cursor);
        const result = await request(`/blocks/${parentId}/children?${params}`);
        if (!Array.isArray(result.results) || typeof result.has_more !== 'boolean') throw new NotionError(502);
        for (const block of result.results) {
          if (remaining === 0) {
            partial = true;
            break;
          }
          remaining--;
          if (block?.archived || block?.is_archived || block?.in_trash) continue;
          if (!ID.test(block?.id) || !ITEM_BLOCK_TYPES.has(block.type)) {
            partial = true;
            continue;
          }
          const richText = block[block.type]?.rich_text;
          const value = Array.isArray(richText) ? richText.map(part => part?.plain_text ?? '').join('') : '';
          blocks.push({
            id: block.id,
            type: block.type,
            text: value,
            checked: block.type === 'to_do' && block.to_do?.checked === true,
            children: block.has_children === true ? await children(block.id, depth + 1) : [],
          });
        }
        if (!result.has_more) break;
        cursor = result.next_cursor;
        if (typeof cursor !== 'string' || !cursor || seen.has(cursor) || seen.size >= 20) throw new NotionError(502);
        seen.add(cursor);
      } while (cursor);
      return blocks;
    }

    const blocks = await children(pageId, 0);
    return { blocks, partial };
  }

  async function findPackingPage(tripId) {
    const matches = new Set();
    const seen = new Set();
    let cursor;
    do {
      const params = new URLSearchParams({ page_size: '100' });
      if (cursor) params.set('start_cursor', cursor);
      const result = await request(`/blocks/${tripId}/children?${params}`);
      if (!Array.isArray(result.results) || typeof result.has_more !== 'boolean') throw new NotionError(502);
      for (const block of result.results) {
        if (block?.type === 'child_page' && ID.test(block.id) &&
            block.child_page?.title === '공통 준비물 간편 체크' &&
            !block.archived && !block.in_trash && !block.is_archived) matches.add(block.id);
      }
      if (!result.has_more) break;
      cursor = result.next_cursor;
      if (typeof cursor !== 'string' || !cursor || seen.has(cursor) || seen.size >= 20) throw new NotionError(502);
      seen.add(cursor);
    } while (cursor);
    if (matches.size > 1) throw new NotionError(502);
    return [...matches][0] ?? null;
  }

  return { query, readPage: id => request(`/pages/${id}`), readItemBody, findPackingPage };
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
  const itemIds = url.searchParams.getAll('itemId');
  const itemSections = url.searchParams.getAll('section');
  const itemRequest = itemIds.length > 0 || itemSections.length > 0;
  const itemSection = itemSections[0];
  const packingRequest = itemSections.length === 1 && itemSection === 'packing' && itemIds.length === 0;
  if (itemRequest && (!tripId || (!packingRequest && (itemIds.length !== 1 || !ID.test(itemIds[0]) ||
      itemSections.length !== 1 || !['checklist', 'shopping'].includes(itemSection))))) {
    return respond(res, 400, { error: 'invalid_item_request' });
  }
  const methods = tripId && !itemRequest ? ['GET', 'POST'] : ['GET'];
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
  const sourceKeys = env.NOTION_TRAVEL_SHOPPING_SOURCE_ID?.trim()
    ? [...REQUIRED_SOURCES, 'shopping'] : REQUIRED_SOURCES;
  const sources = Object.fromEntries(sourceKeys.map(key => [
    key, env[`NOTION_TRAVEL_${key.toUpperCase()}_SOURCE_ID`]?.trim().toLowerCase(),
  ]));
  if (!token || !ID.test(sources.trips) || (tripId && (
    sourceKeys.some(key => !ID.test(sources[key])) ||
    new Set(Object.values(sources)).size !== sourceKeys.length
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

    const trip = await reader.readPage(tripId).catch(error => {
      if (error instanceof NotionError && error.status === 404) return null;
      throw error;
    });
    if (!belongsTo(trip, sources.trips) || trip.id !== tripId) {
      return respond(res, 404, { error: 'trip_not_found' });
    }

    if (packingRequest) {
      const pageId = await reader.findPackingPage(tripId);
      if (!pageId) return respond(res, 404, { error: 'packing_not_found' });
      const page = await reader.readPage(pageId);
      if (page?.id !== pageId || page.parent?.type !== 'page_id' || page.parent.page_id !== tripId ||
          page.archived || page.in_trash || page.is_archived) {
        return respond(res, 404, { error: 'packing_not_found' });
      }
      return sendData({ sourceId: pageId, ...await reader.readItemBody(pageId) });
    }

    if (itemRequest) {
      const itemId = itemIds[0].toLowerCase();
      const source = sources[itemSection];
      if (!source) return respond(res, 404, { error: 'item_not_found' });
      const item = await reader.readPage(itemId).catch(error => {
        if (error instanceof NotionError && error.status === 404) return null;
        throw error;
      });
      if (!belongsTo(item, source) || item.id !== itemId || !belongsToTrip(item, tripId)) {
        return respond(res, 404, { error: 'item_not_found' });
      }
      return sendData(await reader.readItemBody(itemId));
    }

    const sections = {};
    for (const [key, fields] of Object.entries(SECTIONS)) {
      if (key === 'shopping' && !sources.shopping) {
        sections.shopping = null;
        continue;
      }
      const sorts = key === 'expenses' ? [{ timestamp: 'created_time', direction: 'ascending' }] : undefined;
      const pages = await reader.query(sources[key], tripId, sorts);
      const expenses = key === 'receipts' ? new Map(sections.expenses.map(row => [row.id, row.title])) : null;
      sections[key] = pages.map(page => {
        const row = project(page, fields);
        if (key === 'schedule') Object.assign(row, scheduleDetails(page));
        if (key === 'bookings' || key === 'expenses') {
          const order = page.properties['표시 순서'];
          row.displayOrder = order?.type === 'number' && Number.isFinite(order.number) ? order.number : null;
        }
        if (key === 'expenses') {
          row.posting = {
            status: propertyValue(page.properties.상태),
            type: propertyValue(page.properties.유형),
            rate: propertyValue(page.properties['적용 환율']),
          };
        }
        if (key === 'bookings') {
          const type = row.fields.예약유형;
          if (type === '항공' || type === '숙소') row.location = propertyValue(page.properties.장소);
          if (type === '숙소') {
            row.address = propertyValue(page.properties['숙소 주소'])?.trim() ||
              propertyValue(page.properties['장소 주소'])?.trim() || null;
          }
        }
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
