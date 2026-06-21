import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

// Shallow-wrapped hook — use this instead of useStore to avoid infinite loops with object selectors
export const useApp = (selector) => useStore(useShallow(selector));

const SAMPLE_TRIPS = [
  {
    id: 1,
    name: '도쿄 여름 콘서트',
    dest: '일본 · 도쿄',
    destEn: 'Tokyo, Japan',
    startDate: '2026-08-14',
    endDate: '2026-08-18',
    nights: 4,
    budget: 260000,
    currency: 'JPY',
    photo: 'photo-1540959733332-eab4deabeeaf',
    status: 'upcoming',
  },
  {
    id: 2,
    name: '오사카 미식 투어',
    dest: '일본 · 오사카',
    destEn: 'Osaka, Japan',
    startDate: '2025-11-01',
    endDate: '2025-11-05',
    nights: 4,
    budget: 180000,
    currency: 'JPY',
    photo: 'photo-1542051841857-5f90071e7989',
    status: 'done',
  },
];

const SAMPLE_BOOKINGS = [
  { id: 1, type: 'flight', title: '인천 → 나리타 (OZ102)', sub: '08.14 09:20 · 2시간 30분', status: 'confirmed', code: 'PNR 3KX9Q2' },
  { id: 2, type: 'hotel', title: '신주쿠 그랜비아 호텔', sub: '08.14 – 08.18 · 4박', status: 'confirmed', code: '#A-22841' },
  { id: 3, type: 'concert', title: '도쿄돔 콘서트', sub: '08.16 18:00 · 1층 A블록', status: 'confirmed', code: 'A12-34' },
  { id: 4, type: 'transport', title: '나리타 익스프레스', sub: '08.14 11:00 · 편도', status: 'pending', code: 'NE-408' },
];

const SAMPLE_TIMELINE = [
  {
    day: 1, date: '08.14 목',
    events: [
      { time: '11:00', title: '나리타 공항 도착', sub: '이동 · 나리타 익스프레스 예약' },
      { time: '14:30', title: '신주쿠 그랜비아 체크인', sub: '' },
      { time: '19:00', title: '오모이데 요코초 야식', sub: '맛집 탐방' },
    ]
  },
  {
    day: 2, date: '08.15 금',
    events: [
      { time: '10:00', title: '하라주쿠 / 오모테산도', sub: '쇼핑' },
      { time: '14:00', title: '시부야 스카이 전망대', sub: '예약 필요' },
      { time: '18:00', title: '이케부쿠로 맛집', sub: '' },
    ]
  },
  {
    day: 3, date: '08.16 토', concert: true,
    events: [
      { time: '12:00', title: '도쿄돔 주변 탐방', sub: '굿즈 구매' },
      { time: '18:00', title: '도쿄돔 콘서트', sub: '1층 A블록 · 메인 이벤트', highlight: true },
      { time: '22:00', title: '공연 후 뒷풀이', sub: '라멘집' },
    ]
  },
  {
    day: 4, date: '08.17 일',
    events: [
      { time: '10:00', title: '아사쿠사 / 스카이트리', sub: '' },
      { time: '15:00', title: '아키하바라', sub: '전자상가·굿즈' },
      { time: '19:00', title: '스시 오마카세', sub: '예약 완료' },
    ]
  },
  {
    day: 5, date: '08.18 월',
    events: [
      { time: '10:00', title: '신주쿠 체크아웃', sub: '' },
      { time: '13:00', title: '나리타 공항 이동', sub: '나리타 익스프레스' },
      { time: '16:00', title: '귀국 출발', sub: 'OZ103 · 인천행' },
    ]
  },
];

const SAMPLE_MEMOS = [
  { id: 1, tag: '맛집', title: '오모이데 요코초', body: '신주쿠역 서쪽 골목. 야키토리·오뎅 골목. 밤에 가야 분위기 제대로.' },
  { id: 2, tag: '공연', title: '도쿄돔 입장 팁', body: '공연 1시간 전 도착 권장. 굿즈 줄은 2~3시간 대기. 물·간식 반입 가능.' },
  { id: 3, tag: '장소', title: '시부야 스카이', body: '사전 예약 필수. 황혼 타임(17:30~) 가장 예쁨. 카드 결제 가능.' },
  { id: 4, tag: '숙박', title: '신주쿠 그랜비아', body: '체크인 14:00 / 체크아웃 12:00. 조식 포함. 프런트에서 우산 대여 가능.' },
  { id: 5, tag: '맛집', title: '이치란 라멘 신주쿠점', body: '24시간 영업. 1인석. 매운맛 레벨 3 추천. 현금·카드 모두 가능.' },
];

const SAMPLE_CHECKS = {
  '필수 서류': [
    { id: 'c1', t: '여권 (유효기간 6개월+)', def: true },
    { id: 'c2', t: 'Visit Japan Web 등록', def: true },
    { id: 'c3', t: '해외여행자 보험', def: false },
  ],
  '공연': [
    { id: 'c4', t: '콘서트 티켓 캡처', def: true },
    { id: 'c5', t: '응원봉 + 여분 건전지', def: false },
    { id: 'c6', t: '공식 굿즈 예약 확인', def: false },
  ],
  '여행 준비': [
    { id: 'c7', t: '환전 (엔화)', def: false },
    { id: 'c8', t: '포켓 와이파이 / SIM', def: false },
    { id: 'c9', t: '보조 배터리', def: false },
  ],
};

const SAMPLE_PLACES = [
  { id: 1, name: '도쿄돔', note: '콘서트 장소 · 08.16', cat: '공연', color: '#E2603F' },
  { id: 2, name: '신주쿠 그랜비아', note: '체크인 08.14', cat: '숙박', color: '#7A6BA0' },
  { id: 3, name: '오모이데 요코초', note: '야키토리 골목', cat: '맛집', color: '#2F8A55' },
];

export const useStore = create((set, get) => ({
  // Navigation
  screen: 'home', // 'home' | 'detail'
  currentTripId: null,
  tab: 'overview', // 'overview'|'booking'|'budget'|'memo'|'check'
  overlay: null, // null|'menu'|'create'|'fx'|'login'|'needLogin'|'ai'|'map'|'settings'|'addCheck'|'addBooking'
  pendingOverlay: null,

  // Auth
  loggedIn: false,

  // Data
  trips: SAMPLE_TRIPS,
  bookings: SAMPLE_BOOKINGS,
  timeline: SAMPLE_TIMELINE,
  memos: SAMPLE_MEMOS,
  places: SAMPLE_PLACES,

  // Checklist
  checks: {}, // { itemId: bool } overrides
  addedChecks: {}, // { cat: [{id,t,def:false}] }
  deletedChecks: {}, // { itemId: true }
  addCheckCat: '',
  addCheckText: '',

  // Budget
  budgetCur: 'all', // 'all'|'jpy'|'krw'
  fxRate: 9.2,

  // Memo
  memoFilter: '전체',

  // Filter
  tripFilter: '출발 임박순',

  // Actions
  setScreen: (screen) => set({ screen }),
  openTrip: (id) => set({ screen: 'detail', currentTripId: id, tab: 'overview' }),
  setTab: (tab) => set({ tab, overlay: null }),
  setOverlay: (overlay) => set({ overlay }),
  closeOverlay: () => set({ overlay: null }),

  requireLogin: (pendingOverlay) => {
    if (get().loggedIn) {
      set({ overlay: pendingOverlay });
    } else {
      set({ overlay: 'needLogin', pendingOverlay });
    }
  },

  login: (pw) => {
    if (pw === '1234') {
      const pending = get().pendingOverlay;
      set({ loggedIn: true, overlay: pending, pendingOverlay: null });
      return true;
    }
    return false;
  },

  logout: () => set({ loggedIn: false, overlay: null }),

  // Trip CRUD
  addTrip: (trip) => set((s) => ({ trips: [...s.trips, { ...trip, id: Date.now(), status: 'upcoming' }], overlay: null })),
  deleteTrip: (id) => set((s) => ({ trips: s.trips.filter(t => t.id !== id) })),

  // Booking
  addBooking: (b) => set((s) => ({ bookings: [...s.bookings, { ...b, id: Date.now() }], overlay: null })),

  // Memo
  setMemoFilter: (f) => set({ memoFilter: f }),

  // Budget
  setBudgetCur: (c) => set({ budgetCur: c }),
  setFxRate: (r) => set({ fxRate: r, overlay: null }),

  // Checklist
  toggleCheck: (id) => set((s) => {
    const current = s.checks[id];
    // Find default value
    let def = false;
    Object.values(SAMPLE_CHECKS).forEach(items => {
      const item = items.find(i => i.id === id);
      if (item) def = item.def;
    });
    Object.values(s.addedChecks).forEach(items => {
      const item = items?.find(i => i.id === id);
      if (item) def = item.def;
    });
    return { checks: { ...s.checks, [id]: current === undefined ? !def : !current } };
  }),
  deleteCheckItem: (id) => set((s) => ({ deletedChecks: { ...s.deletedChecks, [id]: true } })),
  setAddCheckCat: (cat) => set({ addCheckCat: cat }),
  setAddCheckText: (t) => set({ addCheckText: t }),
  submitAddCheck: () => set((s) => {
    const { addCheckCat, addCheckText, addedChecks } = s;
    if (!addCheckText.trim()) return { overlay: null, addCheckText: '' };
    const newItem = { id: `ua_${Date.now()}`, t: addCheckText.trim(), def: false };
    const catItems = addedChecks[addCheckCat] || [];
    return {
      addedChecks: { ...addedChecks, [addCheckCat]: [...catItems, newItem] },
      addCheckText: '',
      overlay: null,
    };
  }),

}));

export { SAMPLE_CHECKS };

// Pure helpers — call outside useStore selectors to avoid infinite loops
export function computeCheckItems(checks, addedChecks, deletedChecks) {
  const result = {};
  Object.entries(SAMPLE_CHECKS).forEach(([cat, items]) => {
    const added = addedChecks[cat] || [];
    const all = [...items, ...added].filter(i => !deletedChecks[i.id]);
    result[cat] = all.map(i => ({
      ...i,
      checked: checks[i.id] !== undefined ? checks[i.id] : i.def,
    }));
  });
  return result;
}

export function getCurrentTrip(trips, currentTripId) {
  return trips.find(t => t.id === currentTripId) || trips[0] || null;
}
