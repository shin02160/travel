// Local UI fixture only. No Notion calls, real credentials, or production data.
// Public London-area test coordinates are synthetic route points, not saved user destinations.
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const first = '10000000-0000-4000-8000-000000000001';
const second = '10000000-0000-4000-8000-000000000002';
let updated = false, expired = false;
const row = (id, start, coordinates, extra = {}) => ({
  id: `20000000-0000-4000-8000-${String(id).padStart(12, '0')}`, title: `QA 장소 ${id}`,
  fields: { 일시: start, 장소: `합성 테스트 지점 ${id}`, 구분: '관광', 진행상태: '예정', ...extra },
  date: { start, timeZone: 'Europe/London' }, coordinates,
  mapUrl: 'https://www.google.com/maps/search/?api=1&query=51.505,-0.09#WGS84',
  sourceUrl: 'https://www.notion.so/20000000000040008000000000000001',
});
const trip = id => ({ id, title: id === first ? '합성 QA · 동선 지도' : '합성 QA · 위치 없음',
  fields: { 여행기간: '2026-12-05 ~ 2026-12-06', 상태: '준비중', 여행지: 'QA' },
  cities: [{ id: 'GB_QA', zone: 'Europe/London' }], calendarZone: 'Europe/London' });
const schedule = () => [
  row(1, '2026-12-05T09:00', { lat: 51.505, lng: -0.09 }),
  row(2, '2026-12-05T10:00', { lat: 51.506, lng: -0.091 }),
  row(3, '2026-12-05T11:00', updated ? { lat: 51.5065, lng: -0.0915 } : null),
  row(4, '2026-12-05T12:00', { lat: 51.507, lng: -0.092 }),
  row(5, '2026-12-05T13:00', { lat: 51.505, lng: -0.09 }),
  row(6, '2026-12-05T13:00', { lat: 51.505, lng: -0.09 }),
  row(7, '2026-12-05', { lat: 51.504, lng: -0.093 }),
  row(8, '2026-12-05T14:00', { lat: 51.508, lng: -0.094 }, { 진행상태: '취소' }),
  row(9, '2026-12-06T09:00', { lat: 51.51, lng: -0.11 }),
  row(10, '2026-12-06T10:00', { lat: 51.52, lng: -0.12 }),
  { ...row(11, null, null), title: '<img src=x onerror=alert(1)>' },
];
const failedTiles = process.argv.includes('--failed-tiles');
const server = await createServer({ configFile: false, root: process.cwd(),
  ...(failedTiles && { define: { 'import.meta.env.VITE_ROUTE_TILE_URL': JSON.stringify('https://route-map-qa.invalid/{z}/{x}/{y}.png') } }),
  plugins: [react(), { name: 'route-map-qa-only', configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/qa/update') { updated = !updated; res.end('QA dataset updated. Refresh the app.'); return; }
      if (url.pathname === '/qa/expire') { expired = true; res.end('QA session expired. Refresh the app.'); return; }
      if (!url.pathname.startsWith('/api/trips')) return next();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      const id = url.pathname.split('/')[3];
      if (id && expired) { res.statusCode = 401; res.end(JSON.stringify({ error: 'trip_pin_required' })); return; }
      const expiresAt = Math.floor(Date.now() / 1000) + 1800;
      let body;
      if (!id) body = { trips: [trip(first), trip(second)] };
      else if (url.searchParams.get('section') === 'photos') body = { photos: [], coverId: null, configured: false, expiresAt };
      else if (url.searchParams.has('section')) { res.statusCode = 404; body = { error: 'item_not_found' }; }
      else body = { trip: trip(id), expiresAt, sections: { schedule: id === first ? schedule() : [row(1, '2026-12-05T09:00', null)],
        bookings: [], budgets: [], expenses: [], receipts: [], checklist: [], shopping: [] } };
      res.end(JSON.stringify(body));
    });
  } }], server: { host: '127.0.0.1', port: Number(process.env.ROUTE_QA_PORT) || (failedTiles ? 5180 : 5179), strictPort: true },
});
await server.listen();
console.log(`Route map QA: ${server.resolvedUrls.local[0]}#trip=${first}&tab=schedule`);
