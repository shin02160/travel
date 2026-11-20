import { NotionError, propertyValue, belongsTo, belongsToTrip, notionReader } from './notion-reader.js';
import { loadCities, citiesForPage, publicCity, CityError } from './notion-cities.js';
import { calendarZone } from '../src/destinationCities.js';
import { tripPinConfig, tripSessionExpiry, unlockTrip } from './trip-pin.js';
import { INFO_CATEGORIES } from '../src/destinationCities.js';
import { fetchPhoto, galleryPhotos, selectCover, sendPhoto } from './trip-photos.js';

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
const BOOKING_DETAIL_FIELDS = ['예약처', '장소', '숙소 주소', '장소 주소', '통화', '예약금액', '취소기한', '취소·환불 조건'];
const REQUIRED_SOURCES = ['trips', ...Object.keys(SECTIONS).filter(key => key !== 'shopping')];
function respond(res, status, body) {
  res.statusCode = status;
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(body));
}

function project(page, [title, ...fields]) {
  if (page.properties[title]?.type !== 'title') throw new NotionError(502);
  return {
    id: page.id,
    title: propertyValue(page.properties[title]) || '제목 없음',
    fields: Object.fromEntries(fields.map(name => [name, propertyValue(page.properties[name])])),
  };
}

function bookingDetails(page) {
  const details = {};
  for (const name of BOOKING_DETAIL_FIELDS) {
    const value = propertyValue(page.properties[name]);
    if (name === '예약금액' ? Number.isFinite(value) : typeof value === 'string' && value.trim()) {
      details[name] = typeof value === 'string' ? value.trim() : value;
    }
  }
  if (details['숙소 주소'] === details['장소 주소']) delete details['장소 주소'];
  return details;
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

function destinationSourceUrl(property) {
  try {
    const url = new URL(property?.url);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

function bodyText(blocks) {
  return blocks.flatMap(block => [block.text, ...bodyText(block.children)]).filter(Boolean).join('\n');
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
  const cityIds = url.searchParams.getAll('city');
  const photoIds = url.searchParams.getAll('photoId');
  const photoFiles = url.searchParams.getAll('file');
  const photoParams = photoIds.length > 0 || photoFiles.length > 0;
  const itemRequest = itemIds.length > 0 || itemSections.length > 0 || cityIds.length > 0 || photoParams;
  const itemSection = itemSections[0];
  const packingRequest = itemSections.length === 1 && itemSection === 'packing' && itemIds.length === 0;
  const infoRequest = itemSections.length === 1 && itemSection === 'info' && itemIds.length === 0 &&
    cityIds.length === 1 && /^[A-Z]{2}_[A-Z0-9_]+$/.test(cityIds[0]);
  const recordRequest = itemIds.length === 1 && ID.test(itemIds[0]) &&
    itemSections.length === 1 && ['bookings', 'checklist', 'shopping'].includes(itemSection);
  const photoRequest = itemSections.length === 1 && itemSection === 'photos' && !itemIds.length && !cityIds.length &&
    (!photoParams || (photoIds.length === 1 && ID.test(photoIds[0]) &&
      photoFiles.length === 1 && /^(0|[1-9][0-9]{0,5})$/.test(photoFiles[0])));
  const coverRequest = itemSections.length === 1 && itemSection === 'cover' &&
    [...url.searchParams.keys()].every(key => key === 'section' || key === 'tripId');
  const otherItemRequest = !photoParams && (infoRequest || (!cityIds.length && (packingRequest || recordRequest)));
  if (itemRequest && (!tripId || !(coverRequest || photoRequest || otherItemRequest))) {
    return respond(res, 400, { error: 'invalid_item_request' });
  }
  const methods = tripId && !itemRequest ? ['GET', 'POST'] : ['GET'];
  if (!methods.includes(req.method)) {
    res.setHeader('Allow', methods.join(', '));
    return respond(res, 405, { error: 'method_not_allowed' });
  }

  const needsPin = Boolean(tripId && !coverRequest);
  const config = needsPin ? tripPinConfig(tripId, env) : null;
  if (req.method === 'POST') return unlockTrip(req, res, respond, tripId, config, env, fetcher, behindVercel);
  const expiresAt = needsPin ? tripSessionExpiry(req, tripId, config) : 0;
  if (needsPin && !config) return respond(res, 403, { error: 'trip_pin_not_configured' });
  if (needsPin && !expiresAt) return respond(res, 401, { error: 'trip_pin_required' });

  const token = env.NOTION_TRAVEL_TOKEN?.trim();
  const sourceKeys = env.NOTION_TRAVEL_SHOPPING_SOURCE_ID?.trim()
    ? [...REQUIRED_SOURCES, 'shopping'] : REQUIRED_SOURCES;
  const sources = Object.fromEntries(sourceKeys.map(key => [
    key, env[`NOTION_TRAVEL_${key.toUpperCase()}_SOURCE_ID`]?.trim().toLowerCase(),
  ]));
  const infoSource = env.NOTION_TRAVEL_INFO_SOURCE_ID?.trim().toLowerCase();
  const photoSource = env.NOTION_TRAVEL_PHOTOS_SOURCE_ID?.trim().toLowerCase();
  const invalidOptionalSource = source => source && (!ID.test(source) || Object.values(sources).includes(source));
  if (!token || !ID.test(sources.trips) || (tripId && (
    photoRequest || coverRequest ? (invalidOptionalSource(photoSource) || (photoSource && photoSource === infoSource)) :
    infoRequest ? invalidOptionalSource(infoSource) :
      (sourceKeys.some(key => !ID.test(sources[key])) || new Set(Object.values(sources)).size !== sourceKeys.length)
  ))) {
    return respond(res, 503, { error: 'notion_not_configured' });
  }
  if (coverRequest && !photoSource) return respond(res, 404, { error: 'photo_not_found' });

  const sendData = body => expiresAt * 1000 > Date.now()
    ? respond(res, 200, { expiresAt, ...body })
    : respond(res, 401, { error: 'trip_pin_required' });

  const signal = AbortSignal.timeout(15000);
  const reader = notionReader(token, fetcher, signal);
  const readPage = id => reader.readPage(id).catch(error => {
    if (error instanceof NotionError && error.status === 404) return null;
    throw error;
  });
  try {
    if (!tripId) {
      const trips = await reader.query(sources.trips);
      return respond(res, 200, {
        trips: await Promise.all(trips.map(async page => {
          const summary = project(page, TRIP_FIELDS.slice(0, 4));
          try {
            const cities = citiesForPage(page, await loadCities(env, fetcher, signal));
            const [start, end = start] = summary.fields.여행기간?.split(' ~ ') ?? [];
            summary.calendarZone = calendarZone(cities, start, end);
          } catch (error) {
            if (!(error instanceof CityError)) throw error;
            summary.calendarZone = null;
          }
          return summary;
        })),
      });
    }

    const trip = await readPage(tripId);
    if (!belongsTo(trip, sources.trips) || trip.id !== tripId) {
      return respond(res, 404, { error: 'trip_not_found' });
    }

    if (coverRequest) {
      const pages = await reader.query(photoSource, tripId);
      const cover = selectCover(pages, tripId, propertyValue);
      if (!cover) return respond(res, 404, { error: 'photo_not_found' });
      const image = await fetchPhoto(async () => {
        // Reapply selection if a signed attachment expires during the request.
        const latest = await reader.query(photoSource, tripId);
        const selected = selectCover(latest, tripId, propertyValue);
        return selected?.photo.id === cover.photo.id ? selected.page : null;
      }, cover.index, fetcher, signal, { publicCover: true, initialPage: cover.page });
      if (!image) return respond(res, 404, { error: 'photo_not_found' });
      return await sendPhoto(res, image);
    }

    if (photoRequest) {
      if (!photoParams) {
        const pages = photoSource ? await reader.query(photoSource, tripId) : [];
        return sendData({ ...galleryPhotos(pages, tripId, propertyValue), configured: Boolean(photoSource) });
      }
      const photoId = photoIds[0].toLowerCase();
      if (!photoSource) return respond(res, 404, { error: 'photo_not_found' });
      const image = await fetchPhoto(async () => {
        const page = await readPage(photoId);
        return belongsTo(page, photoSource) && page.id === photoId && belongsToTrip(page, tripId) ? page : null;
      }, Number(photoFiles[0]), fetcher, signal);
      if (!image) return respond(res, 404, { error: 'photo_not_found' });
      if (expiresAt * 1000 <= Date.now()) {
        await image.response.body.cancel();
        return respond(res, 401, { error: 'trip_pin_required' });
      }
      return await sendPhoto(res, image);
    }

    if (infoRequest) {
      const cities = citiesForPage(trip, await loadCities(env, fetcher, signal));
      const city = cities.find(city => city.id === cityIds[0]);
      if (!city) return respond(res, 403, { error: 'city_not_in_trip' });
      if (!infoSource) return sendData({ cards: [], configured: false });
      const pages = await reader.query(infoSource, tripId, undefined, city);
      const cards = await Promise.all(INFO_CATEGORIES.map(async category => {
        const matches = pages.filter(page => propertyValue(page.properties.분류) === category);
        if (matches.length > 1) {
          console.warn('Duplicate destination info category', { city: cityIds[0], category });
          return { category, duplicate: true };
        }
        if (!matches.length) return null;
        const page = matches[0];
        const p = page.properties;
        const url = destinationSourceUrl(p['출처 URL']);
        const start = p.확인일?.date?.start;
        const verifiedDate = typeof start === 'string' ? start.match(/^\d{4}-\d{2}-\d{2}(?=T|$)/)?.[0] ?? null : null;
        const status = propertyValue(p['정보 상태']);
        const summary = propertyValue(p.내용)?.trim();
        const body = summary ? null : await reader.readItemBody(page.id);
        return {
          category, text: summary || bodyText(body.blocks), partial: body?.partial ?? false,
          ...(category === '지역 특징' && { clothing: propertyValue(p['추천 옷차림'])?.trim() || null }),
          date: verifiedDate, url, source: url ? propertyValue(p.출처명) : null,
          status: status === '예상' ? status : status === '공식 확인' && url && verifiedDate ? status : '미확인',
        };
      }));
      return sendData({ cards: cards.filter(Boolean), configured: true });
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
      const item = await readPage(itemId);
      if (!belongsTo(item, source) || item.id !== itemId || !belongsToTrip(item, tripId)) {
        return respond(res, 404, { error: 'item_not_found' });
      }
      if (itemSection === 'bookings') return sendData({ fields: bookingDetails(item), sourceId: itemId });
      return sendData(await reader.readItemBody(itemId));
    }

    const sections = {};
    const checklistShopping = [];
    for (const [key, fields] of Object.entries(SECTIONS)) {
      if (key === 'shopping' && !sources.shopping) {
        sections.shopping = null;
        continue;
      }
      const sorts = key === 'expenses' ? [{ timestamp: 'created_time', direction: 'ascending' }] : undefined;
      const pages = await reader.query(sources[key], tripId, sorts);
      const expenses = key === 'receipts' ? new Map(sections.expenses.map(row => [row.id, row.title])) : null;
      sections[key] = pages.flatMap(page => {
        if (key === 'checklist' && propertyValue(page.properties.분류) === '쇼핑') {
          checklistShopping.push({
            ...project(page, ['할 일', ...SECTIONS.shopping.slice(1)]),
            sourceSection: 'checklist',
          });
          return [];
        }
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
        return [row];
      });
    }

    if (checklistShopping.length) sections.shopping = [...(sections.shopping ?? []), ...checklistShopping];

    const bookingIds = new Set(sections.bookings.map(row => row.id));
    for (const event of sections.schedule) {
      event.bookingIds = [...new Set(event.bookingIds.filter(id => bookingIds.has(id)))];
    }

    let cities = [];
    let citiesError = null;
    try {
      cities = citiesForPage(trip, await loadCities(env, fetcher, signal)).map(publicCity);
    } catch (error) {
      if (!(error instanceof CityError)) throw error;
      citiesError = error.code;
    }
    return sendData({ trip: { ...project(trip, TRIP_FIELDS), cities, citiesError }, sections });
  } catch (error) {
    if (res.headersSent || res.destroyed) return;
    if (error instanceof CityError) return respond(res, error.status, { error: error.code });
    const status = error instanceof NotionError && error.status === 429 ? 503 : 502;
    return respond(res, status, { error: 'notion_unavailable' });
  }
}
