import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

// Shallow-wrapped hook — use this instead of useStore to avoid infinite loops with object selectors
export const useApp = (selector) => useStore(useShallow(selector));

const SAMPLE_TRIPS = [
  {
    id: 1,
    name: '2026 밴드 킹덤 요코하마',
    dest: '일본 · 요코하마',
    destEn: 'Yokohama, Japan',
    startDate: '2026-07-11',
    endDate: '2026-07-13',
    nights: 2,
    budget: 200000,
    currency: 'JPY',
    photo: `${import.meta.env.BASE_URL}band-kingdom-2026.jpg`,
    status: 'upcoming',
  },
];

const SAMPLE_BOOKINGS = [
  { id: 1, type: 'flight', title: '인천 → 나리타 (LJ201)', sub: '07.11 토 07:25 출발 → 09:55 도착', status: 'confirmed', code: 'B8K3FJ' },
  { id: 2, type: 'transport', title: 'N\'EX 나리타 익스프레스 (가는 편)', sub: '07.11 11:44 나리타T1 → 13:14 요코하마 · 4호차 14-D', status: 'confirmed', code: 'NEX-18' },
  { id: 3, type: 'hotel', title: '사쿠라기초 워싱턴 호텔', sub: '07.11 체크인 14:00 / 07.13 체크아웃 10:00 · 2박', status: 'confirmed', code: '+81 45-683-3111' },
  { id: 4, type: 'concert', title: 'FNC 밴드 킹덤 2026', sub: '07.11~12 · 피아 아레나 MM · 미나토미라이', status: 'confirmed', code: '발권 예정' },
  { id: 5, type: 'transport', title: 'N\'EX 나리타 익스프레스 (귀국 편)', sub: '07.13 13:29 요코하마 → 14:58 나리타T1 · 8호차 1-A', status: 'confirmed', code: 'NEX-31' },
  { id: 6, type: 'flight', title: '나리타 → 인천 (LJ202)', sub: '07.13 월 17:15 나리타T3 출발 → 20:10 인천T1 도착', status: 'confirmed', code: 'B8K3FJ' },
];

const SAMPLE_TIMELINE = [
  {
    day: 1, date: '07.11 토',
    events: [
      { time: '07:25', title: '인천공항 출발 (LJ201)', sub: '진에어 · 예약번호 B8K3FJ' },
      { time: '09:55', title: '나리타 공항 도착', sub: '입국 심사 + 수하물 수령' },
      { time: '11:44', title: 'N\'EX 탑승 (나리타T1)', sub: '4호차 14-D · 요코하마행' },
      { time: '13:14', title: '요코하마역 도착', sub: 'JR 네기시선 환승 → 사쿠라기초역' },
      { time: '13:40', title: '워싱턴 호텔 짐 보관', sub: '사쿠라기초 1-101-1' },
      { time: '14:00', title: '점심 · 크로스 게이트', sub: '호텔 저층부 식당가' },
      { time: '15:00', title: 'FNC 밴드 킹덤 공연', sub: '피아 아레나 MM · 메인 이벤트', highlight: true },
    ]
  },
  {
    day: 2, date: '07.12 일', concert: true,
    events: [
      { time: '09:00', title: '호텔 체크인 후 조식', sub: '체크인 14:00 기준, 이른 아침 미나토미라이 산책' },
      { time: '11:00', title: '코스모 월드 / 랜드마크 타워', sub: '요코하마 대관람차·전망대' },
      { time: '14:00', title: '차이나타운 점심', sub: '요코하마 중화가 (横浜中華街)' },
      { time: '16:00', title: 'FNC 밴드 킹덤 공연 Day 2', sub: '피아 아레나 MM · 호텔에서 도보 11분', highlight: true },
      { time: '21:00', title: '공연 후 미나토미라이 야경', sub: '요코하마 항구 야경 산책' },
    ]
  },
  {
    day: 3, date: '07.13 월',
    events: [
      { time: '10:00', title: '호텔 체크아웃', sub: '짐 찾기 후 사쿠라기초역 이동' },
      { time: '11:00', title: '요코하마 붉은벽돌 창고', sub: '기념품 쇼핑' },
      { time: '13:29', title: 'N\'EX 탑승 (요코하마역)', sub: '8호차 1-A · 나리타T1행 → T2 하차 권장' },
      { time: '14:55', title: '나리타 제2터미널 도착', sub: '도보로 제3터미널 이동' },
      { time: '17:15', title: '귀국 출발 (LJ202)', sub: '나리타 T3 · 인천 T1 20:10 도착' },
    ]
  },
];

const SAMPLE_MEMOS = [
  { id: 1, tag: '공연', title: '피아 아레나 MM 입장 팁', body: '숙소에서 도보 약 11분 (750m). 미나토미라이 대로 직진. 공연 1시간 전 도착 권장. 굿즈 줄 일찍 서기.' },
  { id: 2, tag: '숙박', title: '사쿠라기초 워싱턴 호텔', body: '체크인 14:00 / 체크아웃 10:00. 체크인 전후 짐 보관 가능. ☎ +81 45-683-3111. 저층부 크로스 게이트에 식당가 있음.' },
  { id: 3, tag: '장소', title: 'N\'EX 귀국 편 주의사항', body: 'NEX 31 예약은 나리타 T1 종착이지만 T2(14:55)에서 내리는 것 권장. 진에어는 T3 출발 — T2→T3 도보 연결통로 이용.' },
  { id: 4, tag: '장소', title: '요코하마 차이나타운', body: '일본 최대 중화가. 런치타임 (11:30~14:00) 혼잡. 유명 맛집은 웨이팅 있으니 오픈 시간 맞춰 가기.' },
  { id: 5, tag: '맛집', title: '크로스 게이트 요코하마', body: '사쿠라기초 워싱턴 호텔 저층부 쇼핑몰. 라멘·이자카야·카페 등 다양. 공연 전후 식사하기 좋음.' },
];

const SAMPLE_CHECKS = {
  '예약': [
    { id: 'c1', t: '항공편 확인 (LJ201 / LJ202)', def: true },
    { id: 'c2', t: '숙소 확인 (사쿠라기초 워싱턴)', def: true },
    { id: 'c3', t: 'NEX 티켓 확인 (4호차 14-D / 8호차 1-A)', def: true },
    { id: 'c4', t: '콘서트 티켓 발권 (7월 발권 필요)', def: false },
    { id: 'c5', t: '이심 (E-SIM) 구매', def: false },
    { id: 'c6', t: 'Visit Japan Web 등록', def: false },
    { id: 'c7', t: 'MD 예약 확인 (리스트 확인 후)', def: false },
  ],
  '준비물': [
    { id: 'c8', t: '여권 (유효기간 6개월+)', def: false },
    { id: 'c9', t: '엔화 환전', def: false },
    { id: 'c10', t: '여행자 보험 가입', def: false },
    { id: 'c11', t: '보조배터리', def: false },
    { id: 'c12', t: '충전기', def: false },
    { id: 'c13', t: '옷 / 화장품', def: false },
  ],
  '공연 준비': [
    { id: 'c14', t: '응원봉 (엔피봉)', def: false },
    { id: 'c15', t: '나눔 물품 준비', def: false },
    { id: 'c16', t: '굿즈 구매 예산 현금 준비', def: false },
  ],
};

const SAMPLE_PLACES = [
  { id: 1, name: '피아 아레나 MM', note: '공연장 · 미나토미라이 3-2-2', cat: '공연', color: '#E2603F' },
  { id: 2, name: '사쿠라기초 워싱턴 호텔', note: '체크인 07.11 · 나카구 사쿠라기초 1-101-1', cat: '숙박', color: '#7A6BA0' },
  { id: 3, name: '요코하마 차이나타운', note: '점심 · 일본 최대 중화가', cat: '맛집', color: '#2F8A55' },
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
