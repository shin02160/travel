import test from 'node:test';
import assert from 'node:assert/strict';
import { overviewTransport } from '../src/overviewTransport.js';

test('overview includes flight and rail bookings and standalone train schedules without duplicating linked trains', () => {
  const bookings = [
    { id: 'flight', title: '인천 → 상하이', fields: { 예약유형: '항공', 이용일: '2026-11-22' } },
    { id: 'rail', title: '광명 → 목포 KTX', fields: { 예약유형: '교통', 이용일: '2026-11-21' } },
    { id: 'rail-type', title: '목포 → 광명', fields: { 예약유형: '기차', 이용일: '2026-11-21' } },
    { id: 'hotel', title: '기차역 호텔', fields: { 예약유형: '숙소' } },
    { id: 'bus', title: '공항 버스', fields: { 예약유형: '교통' } },
  ];
  const event = (id, title, bookingIds = [], 구분 = '이동') => ({
    id, title, bookingIds, fields: { 구분, 일시: '2026-11-21T18:48 ~ 2026-11-21T21:00',
      진행상태: '예정', 장소: '목포역 → 광명역' },
  });
  const result = overviewTransport({ bookings, schedule: [
    event('linked', 'KTX-산천 403', ['rail']),
    event('return', '목포역 → 광명역 (KTX 436)'),
    event('bus', '시내 버스'), event('sight', '기차 박물관', [], '관광'),
  ] });
  assert.deepEqual(result.map(row => row.id), ['rail', 'rail-type', 'schedule:return', 'flight']);
  assert.equal(result[2].fields.이용일, '2026-11-21T18:48 ~ 2026-11-21T21:00');
  assert.equal(result[2].fields.진행상태, '예정');
  assert.equal(result[2].location, '목포역 → 광명역');
  assert.deepEqual(overviewTransport({}), []);
});
