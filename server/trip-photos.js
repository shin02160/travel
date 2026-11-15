import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { datePart } from '../src/todaySchedule.js';

const IMAGE_TYPES = new Set(['image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp']);
const HEIC_TYPES = new Set(['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']);
const PUBLIC_COVER_EDGE = 800;
const NOTION_BUCKETS = ['prod-files-secure', 'secure.notion-static.com'];
const S3 = /^s3(?:[.-][a-z]{2}(?:-[a-z0-9]+)+)?\.amazonaws\.com$/;

function hostedPhoto(file) {
  if (file?.type !== 'file') return null;
  let url;
  try {
    url = new URL(file.file?.url);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.port || url.username || url.password) return null;
  const bucket = url.pathname.split('/')[1];
  if (S3.test(url.hostname) && NOTION_BUCKETS.includes(bucket)) return file.file;
  return NOTION_BUCKETS.some(name => url.hostname.startsWith(`${name}.`) &&
    S3.test(url.hostname.slice(name.length + 1))) ? file.file : null;
}

function filesFor(page) {
  const property = page.properties.사진;
  return property?.type === 'files' && Array.isArray(property.files) ? property.files : [];
}

function sortedPhotos(pages, tripId, value) {
  const rows = pages.flatMap(page => {
    const p = page.properties;
    const files = filesFor(page);
    const displayOrder = value(p['표시 순서']);
    return files.map((file, index) => {
      const params = new URLSearchParams({ section: 'photos', photoId: page.id, file: String(index) });
      return {
        photo: {
          id: `${page.id}:${index}`,
          title: value(p.사진명)?.trim() || file?.name || '여행 사진',
          src: hostedPhoto(file) ? `/api/trips/${tripId}?${params}` : null,
          type: value(p['사진 유형']),
          shotAt: datePart(p.촬영일?.date?.start),
          place: value(p.장소),
          description: value(p.설명),
          isCover: value(p['대표 사진']) === true,
          displayOrder: Number.isFinite(displayOrder) ? displayOrder : null,
        },
        page,
        index,
      };
    });
  });

  return rows.sort((a, b) =>
    (a.photo.displayOrder ?? Infinity) - (b.photo.displayOrder ?? Infinity) ||
    (a.photo.shotAt ?? '9999-99-99').localeCompare(b.photo.shotAt ?? '9999-99-99') ||
    a.page.id.localeCompare(b.page.id) || a.index - b.index);
}

function coverRow(rows) {
  return rows.find(({ photo }) => photo.src && photo.isCover) ?? rows.find(({ photo }) => photo.src);
}

export function galleryPhotos(pages, tripId, value) {
  const rows = sortedPhotos(pages, tripId, value);
  return {
    coverId: coverRow(rows)?.photo.id ?? null,
    photos: rows.map(({ photo }) => photo),
  };
}

export function selectCover(pages, tripId, value) {
  return coverRow(sortedPhotos(pages, tripId, value));
}

export async function fetchPhoto(loadPage, index, fetcher, signal, { publicCover = false, initialPage } = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const page = attempt === 0 && initialPage ? initialPage : await loadPage();
    const attachment = page && filesFor(page)[index];
    const file = hostedPhoto(attachment);
    if (!file) return null;
    if (!(Date.parse(file.expiry_time) > Date.now())) continue;
    const response = await fetcher(file.url, { redirect: 'error', signal });
    const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    if (response.status === 200 && response.body) {
      const heic = HEIC_TYPES.has(type) || (type === 'application/octet-stream' && /\.hei[cf]$/i.test(attachment.name));
      const webImage = IMAGE_TYPES.has(type);
      if (webImage && !publicCover) return { response, type };
      if (heic || webImage) {
        const { heicToJpeg, coverToJpeg } = await import('./photo-render.js');
        const bytes = heic
          ? await heicToJpeg(response, publicCover ? PUBLIC_COVER_EDGE : undefined)
          : await coverToJpeg(response, PUBLIC_COVER_EDGE);
        return bytes ? { response: new Response(bytes), type: 'image/jpeg' } : null;
      }
    }
    await response.body?.cancel();
    if (![401, 403, 404].includes(response.status)) return null;
  }
  return null;
}

export async function sendPhoto(res, { response, type }) {
  res.statusCode = 200;
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  await pipeline(Readable.fromWeb(response.body), res);
}
