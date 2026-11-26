// Local UI fixture only. No Notion calls, real credentials, or production data.
// Public London-area test coordinates are synthetic route points, not saved user destinations.
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const first = '10000000-0000-4000-8000-000000000001';
const second = '10000000-0000-4000-8000-000000000002';
let updated = false, expired = false;
const row = (id, start, coordinates, extra = {}) => ({
  id: `20000000-0000-4000-8000-${String(id).padStart(12, '0')}`, title: `QA 장소 ${id}`,
  activity: `활동 ${id}`, routeOrder: null, note: '합성 QA 메모 · 원본 정보 보존',
  bookingIds: id === 1 ? ['30000000-0000-4000-8000-000000000001'] : [],
  fields: { 일시: start, 장소: `합성 테스트 지점 ${id}`, 구분: '관광', 진행상태: '예정', ...extra },
  date: { start, timeZone: 'Europe/London' }, coordinates,
  mapUrl: 'https://www.google.com/maps/search/?api=1&query=51.505,-0.09#WGS84',
  sourceUrl: 'https://www.notion.so/20000000000040008000000000000001',
});
const trip = id => ({ id, title: id === first ? '합성 QA · 동선 지도' : '합성 QA · 위치 없음',
  fields: { 여행기간: '2026-12-05 ~ 2026-12-07', 상태: '준비중', 여행지: 'QA' },
  cities: [{ id: 'GB_QA', zone: 'Europe/London' }], calendarZone: 'Europe/London' });
const named = (id, title, start, coordinates, extra = {}) => ({ ...row(id, start, coordinates, { 장소: title, ...extra }), title });
const schedule = () => [
  named(1, '시설 A', '2026-12-05T09:00', { lat: 51.505, lng: -.09 }),
  named(2, '시설 A', '2026-12-05T09:30', { lat: 51.505, lng: -.09 }),
  named(3, '시설 A → 시설 B', '2026-12-05T09:45', null, { 구분: '이동' }),
  named(4, '시설 B', '2026-12-05T10:00', { lat: 51.506, lng: -.091 }),
  named(5, '시설 C', '2026-12-05T11:00', updated ? { lat: 51.5065, lng: -.0915 } : null),
  named(6, '시설 D', '2026-12-05T12:00', { lat: 51.507, lng: -.092 }),
  named(7, '시설 A', '2026-12-05T13:00', { lat: 51.505, lng: -.09 }),
  named(8, '시설 E', '2026-12-05T13:00', { lat: 51.505, lng: -.09 }),
  named(9, '취소 일정', '2026-12-05T14:00', { lat: 51.508, lng: -.094 }, { 진행상태: '취소' }),
  named(10, '집 도착', '2026-12-05T15:00', { lat: 51.51, lng: -.1 }),
  named(11, '<img src=x onerror=alert(1)>', null, null),
  ...Array.from({ length: 8 }, (_, i) => ({ ...named(20 + i, `계획 시설 ${i + 1}`, '2026-12-06',
    { lat: 51.51 + i * .001, lng: -.11 - i * .001 }), routeOrder: (i + 1) * 10 })),
  named(30, '계획 시설 1 → 계획 시설 2', '2026-12-06', null, { 구분: '이동' }),
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
      else body = { trip: trip(id), expiresAt, sections: { schedule: id === first ? schedule() : [row(1, '2026-12-05T09:00', updated ? { lat: 51.505, lng: -.09 } : null)],
        bookings: [{ id: '30000000-0000-4000-8000-000000000001', title: '합성 예약', fields: { 예약상태: '확정' } }],
        budgets: [], expenses: [], receipts: [], checklist: [], shopping: [] } };
      res.end(JSON.stringify(body));
    });
  } }], server: { host: '0.0.0.0', port: Number(process.env.ROUTE_QA_PORT) || (failedTiles ? 5180 : 5179), strictPort: true },
});
await server.listen();
console.log(`Route map QA: ${server.resolvedUrls.local[0]}#trip=${first}&tab=schedule`);
