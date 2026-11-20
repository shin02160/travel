import { setTimeout as delay } from 'node:timers/promises';
const ID = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;
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

  async function query(source, tripId, sorts, city) {
    const pages = new Map();
    const seen = new Set();
    let cursor;
    const tripFilter = tripId ? { property: '여행', relation: { contains: tripId } } : undefined;
    const filter = city ? { and: [tripFilter, { property: '도시', relation: { contains: city.notionId } }] } : tripFilter;
    do {
      const result = await request(`/data_sources/${source}/query`, {
        page_size: 100, start_cursor: cursor, filter, sorts,
      });
      if (!Array.isArray(result.results) || typeof result.has_more !== 'boolean' ||
          result.request_status?.type === 'incomplete') throw new NotionError(502);
      for (const page of result.results) {
        if (belongsTo(page, source) && (!tripId || belongsToTrip(page, tripId)) &&
            (!city || matchesCity(page, city))) pages.set(page.id, page);
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

export { NotionError, propertyValue, belongsTo, belongsToTrip, notionReader };

function matchesCity(page, city) {
  const relation = page.properties.도시;
  if (relation?.type !== 'relation' || relation.has_more !== false ||
      !Array.isArray(relation.relation) || relation.relation.length !== 1 ||
      relation.relation[0]?.id !== city.notionId) return false;
  const legacy = propertyValue(page.properties['도시 코드']);
  if (legacy && legacy !== city.id) {
    console.warn('Destination city relation/code mismatch', { pageId: page.id });
    throw new NotionError(502);
  }
  return true;
}
