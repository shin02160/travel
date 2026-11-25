import { lazy, Suspense, useEffect, useId, useState } from 'react';
import { Icon } from '../icons.jsx';
import { chooseTrips, datePart, tripCalendar } from '../todaySchedule.js';
import { scheduleMatches } from '../scheduleIdentity.js';
import { formatDateTime, formatLocalTimestamp } from '../dateDisplay.js';
import { calculateExpenseStatistics, expenseCategory, expenseCostType } from '../expenseStatistics.js';
import { compareBookingUseDate, sortByDisplayOrder } from '../displayOrder.js';
import { readTripViewState, saveTripViewState } from '../tripViewState.js';
import { sortTripList } from '../tripListOrder.js';
import { overviewTransport } from '../overviewTransport.js';
import { useTripPhotos } from '../useTripPhotos.js';
import ExpenseStatistics from './ExpenseStatistics.jsx';
import DestinationInfoTab from './DestinationInfoTab.jsx';
import TodayDashboard from './TodayDashboard.jsx';
import StatusChips from './StatusChips.jsx';
import TravelGallery from './TravelGallery.jsx';
import ScheduleMapBoundary from './ScheduleMapBoundary.jsx';
import ScheduleTimeline from './ScheduleTimeline.jsx';
import './NotionTravel.css';

const ScheduleRouteMap = lazy(() => import('./ScheduleRouteMap.jsx'));

const TABS = {
  overview: '개요', today: '오늘 일정', schedule: '일정', bookings: '예약', budgets: '예산',
  expenses: '지출', receipts: '영수증', checklist: '체크리스트', packing: '간편 체크리스트', shopping: '쇼핑 리스트',
  photos: '사진', info: '정보',
};
const TAB_ICONS = {
  overview: 'compass', today: 'calendar', schedule: 'calendar', bookings: 'plane', budgets: 'wallet',
  expenses: 'currency', receipts: 'fileText', checklist: 'check', packing: 'check', shopping: 'wallet',
  photos: 'image', info: 'compass',
};
const COVERS = {
  '41d6d8c5-8de1-81ca-a669-c3b27d75a996': 'destination-mokpo.svg',
  '4176d8c5-8de1-81e2-8644-f3b66935e8e4': 'destination-busan.png',
  '4136d8c5-8de1-81ce-a4c8-dbda8e993076': 'destination-shanghai.jpg',
  '4136d8c5-8de1-81f4-a070-e07878964af0': 'destination-guangzhou.jpg',
};
const BUDGET_FIELDS = ['총예산', '총지출', '잔여예산'];
const FILTER_FIELDS = {
  bookings: '예약유형',
  budgets: '분류',
  expenses: '분류',
  checklist: '분류',
  shopping: '분류',
};
const WON_FIELDS = new Set(['총예산', '총지출', '잔여예산', '예산 KRW', '사용금액', '잔액', '원화 확정액', '집계 금액']);
const DATE_FIELDS = new Set(['여행기간', '일시', '이용일', '결제일', '구매예정일', '기한', '취소기한']);
const STATUS_FIELDS = {
  bookings: ['예약상태', '결제상태'],
  expenses: ['정산여부'],
  receipts: ['처리상태'],
  checklist: ['상태'],
  shopping: ['상태'],
};
const LATIN_TITLE = /^(?=.*\p{Script=Latin})[\p{Script=Latin}\p{M}\p{N}\p{P}\p{Z}]+$/u;
const ERRORS = {
  trip_access_blocked: '이 여행은 현재 접근이 차단되어 있습니다.',
  trip_pin_not_configured: '이 여행의 비밀번호가 아직 설정되지 않았습니다.',
  invalid_pin: '여행 비밀번호가 올바르지 않습니다.',
  invalid_pin_format: '숫자 4자리를 입력해 주세요.',
  too_many_pin_attempts: '비밀번호 입력 횟수를 초과했습니다. 잠시 후 다시 시도해 주세요.',
  pin_limiter_unavailable: '비밀번호 확인 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  notion_not_configured: 'Notion 연동을 사용하려면 서버 설정이 필요합니다.',
  trip_not_found: '이 여행은 Notion에서 조회할 수 없습니다.',
  item_not_found: '이 항목은 현재 여행에서 조회할 수 없습니다.',
  packing_not_found: '이 여행에 공통 준비물 간편 체크 페이지가 아직 없습니다.',
  trip_pin_required: '여행 비밀번호를 다시 입력해 주세요.',
  notion_unavailable: 'Notion에서 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
};

function tripPath(tripId) {
  return tripId ? `/api/trips/${encodeURIComponent(tripId)}` : '/api/trips';
}

async function responseData(response) {
  if (!response.headers.get('content-type')?.startsWith('application/json')) {
    throw new Error('여행 조회 API에 연결할 수 없습니다.');
  }
  const data = await response.json();
  if (!response.ok) throw new Error(ERRORS[data.error] ?? '여행을 불러오지 못했습니다.');
  return data;
}

async function readTrips(tripId, signal) {
  const response = await fetch(tripPath(tripId), { signal, credentials: 'same-origin', cache: 'no-store' });
  if (tripId && response.status === 401) return { needsPin: true };
  const data = await responseData(response);
  if (tripId && (!Number.isInteger(data.expiresAt) || data.expiresAt * 1000 <= Date.now())) {
    return { needsPin: true };
  }
  return { data };
}

function settlementLabel(value) {
  return typeof value === 'boolean' ? (value ? '정산 완료' : '미정산') : value;
}

function Fields({ fields }) {
  return (
    <dl className="travel-reader-fields">
      {Object.entries(fields).map(([name, value]) => (
        <div key={name}>
          <dt>{name}</dt>
          <dd className={typeof value === 'number' || DATE_FIELDS.has(name) ? 'travel-number' : undefined}>{typeof value === 'number'
            ? `${WON_FIELDS.has(name) ? '₩' : ''}${value.toLocaleString('ko-KR')}${name === '현지 금액' && fields.통화 ? ` ${fields.통화}` : ''}`
            : (DATE_FIELDS.has(name) ? formatDateTime(value) : settlementLabel(value)) || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

function Mark({ name, size = 18 }) {
  return <span className="travel-icon" aria-hidden="true"><Icon name={name} size={size} /></span>;
}

function Cover({ trip, className = '', photoSrc }) {
  const file = COVERS[trip.id];
  return (
    <div className={`travel-cover ${className}`} aria-hidden="true">
      <Mark name="map" size={44} />
      {file && (
        <img src={`${import.meta.env.BASE_URL}${file}`} alt="" width="1200" height="600"
          loading="lazy" decoding="async" onError={event => { event.currentTarget.hidden = true; }} />
      )}
      {photoSrc && <img key={photoSrc} src={photoSrc} alt="" width="1200" height="600" loading="lazy" decoding="async"
        onError={event => { event.currentTarget.hidden = true; }} />}
    </div>
  );
}

function TripFacts({ fields }) {
  return (
    <div className="travel-facts">
      {fields.여행지 && <span><Mark name="pin" />{fields.여행지}</span>}
      {fields.여행기간 && <span className="travel-number"><Mark name="calendar" />{formatDateTime(fields.여행기간)}</span>}
    </div>
  );
}

function TripCard({ trip, onSelect }) {
  return (
    <li>
      <article className="travel-trip-card">
        <Cover trip={trip} photoSrc={`${tripPath(trip.id)}?section=cover`} />
        <div className="travel-trip-copy">
          <div className="travel-item-heading">
            <h3>
              <button type="button" lang={LATIN_TITLE.test(trip.title) ? 'en' : undefined} onClick={() => onSelect(trip.id)}>
                {trip.title}
              </button>
            </h3>
            <StatusChips statuses={{ 상태: trip.fields.상태 }} />
          </div>
          <TripFacts fields={trip.fields} />
          <span className="travel-card-link">여행 상세 <Mark name="arrowRight" /></span>
        </div>
      </article>
    </li>
  );
}

function ChecklistProgress({ items }) {
  const complete = items.filter(item => item.fields.상태 === '완료').length;
  return (
    <div className="travel-progress">
      {items.length ? (
        <>
          <p><strong>{complete}</strong> / {items.length} 완료</p>
          <progress aria-label="체크리스트 진행률" max={items.length} value={complete} />
        </>
      ) : <p>등록된 항목이 없습니다.</p>}
    </div>
  );
}

function OverviewBookings({ bookings, lodging = false }) {
  const hasFlights = bookings.some(booking => booking.fields.예약유형 === '항공');
  const hasTrains = bookings.some(booking => booking.fields.예약유형 !== '항공');
  const title = lodging ? '숙소' : hasFlights && !hasTrains ? '항공편'
    : hasTrains && !hasFlights ? '기차편' : '항공편 · 기차편';
  return (
    <article className="travel-reader-card">
      <h3 className="travel-overview-booking-heading"><Mark name={lodging ? 'hotel' : hasTrains && !hasFlights ? 'train' : 'plane'} />{title}</h3>
      {bookings.length === 0 ? <p>등록된 {title} 정보가 없습니다.</p> : (
        <ul className="travel-overview-booking-list">
          {bookings.map(booking => (
            <li key={booking.id}>
              <div className="travel-item-heading">
                <h4>{booking.title}</h4>
                <StatusChips statuses={{ 예약상태: booking.fields.예약상태, 진행상태: booking.fields.진행상태 }} />
              </div>
              <Fields fields={{ 이용일: booking.fields.이용일 }} />
              {lodging ? (
                <dl className="travel-lodging-address">
                  <dt>현지 상호명</dt>
                  <dd>{booking.location?.trim() || '등록되지 않았습니다.'}</dd>
                  <dt>현지 주소</dt>
                  <dd>{booking.address || '등록되지 않았습니다.'}</dd>
                </dl>
              ) : booking.location && <p className="travel-flight-route">{booking.location}</p>}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function Overview({ data, onSelectTab }) {
  const { trip, sections } = data;
  const { 메모, ...fields } = trip.fields;
  const bookings = sections.bookings.toSorted(compareBookingUseDate);
  const bookingPreview = bookings.slice(0, 3);
  return (
    <section aria-label="개요">
      <div className="travel-card-grid travel-overview-bookings">
        <OverviewBookings bookings={overviewTransport(sections)} />
        <OverviewBookings lodging bookings={bookings.filter(booking => booking.fields.예약유형 === '숙소')} />
      </div>
      <div className="travel-kpis" aria-label="예산 요약">
        {BUDGET_FIELDS.map(label => (
          <div className="travel-reader-card" key={label}>
            <span>{label}</span>
            <strong>{typeof fields[label] === 'number' ? `₩${fields[label].toLocaleString('ko-KR')}` : '—'}</strong>
          </div>
        ))}
      </div>
      <div className="travel-card-grid">
        <article className="travel-reader-card">
          <h3>여행 정보</h3>
          <Fields fields={{ 여행지: fields.여행지, 여행기간: fields.여행기간, 상태: fields.상태, 메모 }} />
        </article>
        <article className="travel-reader-card">
          <h3>예약 요약</h3>
          <p>{sections.bookings.length ? `${sections.bookings.length}건의 예약` : '등록된 예약이 없습니다.'}</p>
          {sections.bookings.length > 0 && (
            <ul className="travel-summary-list">
              {bookingPreview.map(item => (
                <li key={item.id}>
                  <span className="travel-item-heading">
                    <span>{item.title}</span>
                    <StatusChips statuses={{ 예약상태: item.fields.예약상태 }} />
                  </span>
                </li>
              ))}
            </ul>
          )}
          <button className="travel-link-button" onClick={() => onSelectTab('bookings')}>예약 보기 <Mark name="arrowRight" /></button>
        </article>
        <article className="travel-reader-card">
          <h3>체크리스트</h3>
          <ChecklistProgress items={sections.checklist} />
          <button className="travel-link-button" onClick={() => onSelectTab('checklist')}>체크리스트 보기 <Mark name="arrowRight" /></button>
        </article>
      </div>
    </section>
  );
}

function ItemBlocks({ blocks }) {
  return (
    <div className="travel-item-blocks">
      {blocks.map(({ id, type, text, checked, children }) => (
        <div className={`travel-item-block travel-item-block--${type}`} key={id}>
          {type === 'divider' ? <hr /> : type.startsWith('heading_') ? <h4>{text}</h4> : (
            <p>
              {type === 'to_do' && <span className="travel-item-check" role="img"
                aria-label={checked ? '완료' : '미완료'}>{checked ? '☑' : '☐'}</span>}
              {text}
            </p>
          )}
          {children.length > 0 && <ItemBlocks blocks={children} />}
        </div>
      ))}
    </div>
  );
}

function RecordDetails({ tripId, itemId, section }) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ section });
    if (itemId) params.set('itemId', itemId);
    fetch(`${tripPath(tripId)}?${params}`, {
      signal: controller.signal, credentials: 'same-origin', cache: 'no-store',
    }).then(responseData).then(data => {
      if (!controller.signal.aborted) setResult({ data });
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ error: error.message });
    });
    return () => controller.abort();
  }, [tripId, itemId, section, attempt]);

  if (!result) return <p role="status">세부 내용을 불러오는 중입니다.</p>;
  if (result.error) return (
    <>
      <p className="travel-error-text" role="alert">{result.error}</p>
      <button type="button" onClick={() => {
        setResult(null);
        setAttempt(value => value + 1);
      }}>다시 시도</button>
    </>
  );

  const { fields = {}, blocks, partial, sourceId = itemId } = result.data;
  if (section === 'bookings') {
    return (
      <>
        {Object.keys(fields).length ? <Fields fields={fields} /> : <p>등록된 세부 정보가 없습니다.</p>}
      </>
    );
  }
  return (
    <>
      {blocks.length > 0 && <ItemBlocks blocks={blocks} />}
      {blocks.length === 0 && !partial && <p>등록된 세부 내용이 없습니다.</p>}
      {partial && <p>일부 내용은 <a href={`https://www.notion.so/${sourceId.replaceAll('-', '')}`}
        target="_blank" rel="noopener noreferrer">Notion 원본</a>에서 확인할 수 있습니다.</p>}
    </>
  );
}

function RecordCard({ row, tab, tripId, statusFields, open, onToggle }) {
  const bodyId = useId();
  const expandable = tab === 'bookings' || tab === 'checklist' || tab === 'shopping';
  const complete = expandable && row.fields.상태 === '완료';
  const statuses = Object.fromEntries(statusFields.map(field => [field, settlementLabel(row.fields[field])]));

  return (
    <li className={`travel-reader-card${complete ? ' travel-complete' : ''}`}>
      <div className="travel-item-heading">
        <h3>
          {expandable ? (
            <button className="travel-item-toggle" type="button" aria-expanded={open} aria-controls={bodyId}
              onClick={onToggle}>
              <Mark name={TAB_ICONS[tab]} /><span>{row.title}</span><Mark name="chevronDown" size={16} />
            </button>
          ) : <><Mark name={TAB_ICONS[tab]} /><span>{row.title}</span></>}
        </h3>
        <StatusChips statuses={statuses} />
      </div>
      <Fields fields={row.fields} />
      {expandable && <div id={bodyId} className="travel-item-body" hidden={!open}>
        {open && <RecordDetails tripId={tripId} itemId={row.id} section={row.sourceSection ?? tab} />}
      </div>}
    </li>
  );
}

function RecordList({ rows, tab, tripId, opened, onToggle }) {
  const statusFields = STATUS_FIELDS[tab] ?? [];
  return (
    <ul className="travel-card-grid travel-reader-list">
      {rows.map(row => {
        const itemKey = `${row.sourceSection ?? tab}:${row.id}`;
        return <RecordCard key={row.id} row={row} tab={tab} tripId={tripId} statusFields={statusFields}
          open={opened.includes(itemKey)} onToggle={() => onToggle(itemKey)} />;
      })}
    </ul>
  );
}

const EXPENSE_VIEWS = { history: '지출 내역', statistics: '통계' };

function ExpenseTabs({ view, onChange }) {
  return (
    <div className="expense-stats-tabs" role="tablist" aria-label="지출 보기"
      onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 'history' : event.key === 'End' ? 'statistics' :
          view === 'history' ? 'statistics' : 'history';
        onChange(next);
        document.getElementById(`expense-tab-${next}`).focus();
      }}>
      {Object.entries(EXPENSE_VIEWS).map(([id, label]) => (
        <button key={id} type="button" id={`expense-tab-${id}`} data-testid={`expense-subtab-${id}`}
          role="tab" aria-controls={`expense-panel-${id}`} aria-selected={view === id}
          tabIndex={view === id ? 0 : -1} onClick={() => onChange(id)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function TripDetail({ data, tab, selectedDate, onSelectTab, onDateChange, onPinRequired, now, lastRead }) {
  const gallery = useTripPhotos(data.trip.id);
  const coverPhoto = gallery.result?.data?.photos.find(photo => photo.id === gallery.result.data.coverId);
  const [view, setView] = useState(() => {
    try {
      return readTripViewState(data.trip.id, window.sessionStorage);
    } catch {
      return readTripViewState(data.trip.id);
    }
  });
  const { expenseView, expensePeriod, expenseDrilldown, opened } = view;
  const { query = '', category = null, costType = null } = view.filters[tab] ?? {};
  useEffect(() => {
    try {
      saveTripViewState(data.trip.id, view, window.sessionStorage);
    } catch {
      // Continue with in-memory state when the browser blocks storage access.
    }
  }, [data.trip.id, view]);
  const setFilter = change => setView(previous => ({
    ...previous,
    filters: { ...previous.filters, [tab]: { ...previous.filters[tab], ...change } },
  }));
  const toggleItem = id => setView(previous => ({
    ...previous, opened: previous.opened.includes(id) ? previous.opened.filter(item => item !== id) : [...previous.opened, id],
  }));
  const isExpenses = tab === 'expenses';
  const showRoute = tab === 'schedule' && view.scheduleView === 'map';
  const showStatistics = isExpenses && expenseView === 'statistics';
  const shoppingUnconfigured = tab === 'shopping' && !Array.isArray(data.sections.shopping);
  const items = data.sections[tab] ?? [];
  const budget = data.trip.fields.총예산;
  const budgetValue = budget === 0 && !data.sections.budgets.length ? null : budget;
  const stats = isExpenses && (showStatistics || expenseDrilldown)
    ? calculateExpenseStatistics(items, budgetValue, { ...expensePeriod, zone: tripCalendar(data.trip, now).zone })
    : null;
  const historyItems = isExpenses && expenseDrilldown ? items.filter(item => stats.includedIds.has(item.id)) : items;
  const filterField = FILTER_FIELDS[tab];
  const categoryOf = item => expenseCategory(item.fields[filterField]);
  const categories = filterField ? [...new Set(historyItems.map(categoryOf))] : [];
  const costTypeOf = item => expenseCostType(item.fields.비용구분);
  const costTypes = isExpenses ? [...new Set(historyItems.map(costTypeOf))] : [];
  const search = query.trim().toLowerCase();
  const filtered = historyItems.filter(item =>
    (category === null || categoryOf(item) === category) &&
    (!isExpenses || costType === null || costTypeOf(item) === costType) &&
    (tab === 'schedule' ? scheduleMatches(item, search) : item.title.toLowerCase().includes(search)));
  let rows = filtered;
  if (tab === 'bookings') rows = sortByDisplayOrder(filtered, compareBookingUseDate);
  if (isExpenses) rows = sortByDisplayOrder(filtered);
  const selectTab = nextTab => {
    if (nextTab === tab) return;
    onSelectTab(nextTab);
  };
  const openExpenseHistory = (name = null, costType = null) => {
    setView(previous => ({
      ...previous,
      filters: { ...previous.filters, expenses: { query: '', category: name, costType } },
      expenseDrilldown: name !== null || costType !== null, expenseView: 'history',
    }));
    document.getElementById('expense-tab-history').focus();
  };

  return (
    <>
      <header className="travel-hero">
        <Cover trip={data.trip} photoSrc={tab !== 'photos' ? coverPhoto?.src : null} />
        <div className="travel-hero-copy">
          <div className="travel-item-heading">
            <h1 lang={LATIN_TITLE.test(data.trip.title) ? 'en' : undefined}>{data.trip.title}</h1>
            <StatusChips statuses={{ 상태: data.trip.fields.상태 }} />
          </div>
          <TripFacts fields={data.trip.fields} />
        </div>
      </header>
      <div className="travel-detail-layout">
        <nav aria-label="여행 정보" className="travel-reader-tabs">
          {Object.entries(TABS).map(([key, label]) => (
            <button key={key} type="button" aria-pressed={tab === key} onClick={() => selectTab(key)}>
              <Mark name={TAB_ICONS[key]} />{label}
            </button>
          ))}
        </nav>
        {tab === 'overview' && <Overview data={data} onSelectTab={selectTab} />}
        {tab === 'today' && <TodayDashboard data={data} selectedDate={selectedDate} onDateChange={onDateChange} now={now} />}
        {tab === 'packing' && (
          <section className="travel-section" aria-label="간편 체크리스트">
            <header className="travel-section-heading"><h2>간편 체크리스트</h2></header>
            <p className="travel-packing-note">Notion의 공통 준비물 간편 체크 페이지입니다. 체크 상태는 Notion에서 변경해 주세요.</p>
            <div className="travel-reader-card">
              <RecordDetails key={lastRead} tripId={data.trip.id} section="packing" />
            </div>
          </section>
        )}
        {tab === 'info' && <DestinationInfoTab key={`${data.trip.id}:${lastRead}`} trip={data.trip} now={now} />}
        {tab === 'photos' && <TravelGallery {...gallery} onPinRequired={onPinRequired} />}
        {!['overview', 'today', 'packing', 'photos', 'info'].includes(tab) && (
          <section className="travel-section" aria-label={TABS[tab]}>
            <header className="travel-section-heading">
              <div><h2>{TABS[tab]}</h2>{!shoppingUnconfigured && !showStatistics && <p>{historyItems.length}개 항목</p>}</div>
              {tab === 'checklist' && <ChecklistProgress items={items} />}
            </header>
            {tab === 'schedule' && <div className="schedule-view-switch" role="group" aria-label="일정 보기 선택">
              <button type="button" aria-pressed={!showRoute} onClick={() => setView(previous => ({ ...previous, scheduleView: 'timeline' }))}>타임라인</button>
              <button type="button" aria-pressed={showRoute} onClick={() => setView(previous => ({ ...previous, scheduleView: 'map' }))}>동선 지도</button>
            </div>}
            {isExpenses && <ExpenseTabs view={expenseView} onChange={value => setView(previous => ({ ...previous, expenseView: value }))} />}
            {isExpenses && (
              <div id="expense-panel-statistics" role="tabpanel" aria-labelledby="expense-tab-statistics" hidden={!showStatistics} tabIndex={0}>
                {showStatistics && <ExpenseStatistics trip={data.trip} stats={stats} period={expensePeriod}
                  onPeriodChange={value => setView(previous => ({ ...previous, expensePeriod: value }))} onCategory={openExpenseHistory}
                  onHistory={() => openExpenseHistory()} lastRead={lastRead} />}
              </div>
            )}
            <div id={isExpenses ? 'expense-panel-history' : undefined} role={isExpenses ? 'tabpanel' : undefined}
              aria-labelledby={isExpenses ? 'expense-tab-history' : undefined} hidden={showStatistics}>
              {isExpenses && expenseDrilldown && (
                <div className="expense-stats-history-scope">
                  <p>통계 집계 범위 · {expensePeriod.start || expensePeriod.end
                    ? `${expensePeriod.start || '처음'} ~ ${expensePeriod.end || '최근'}` : '여행 전체'}</p>
                  <button type="button" onClick={() => openExpenseHistory()}>통계 범위 해제</button>
                </div>
              )}
              {categories.length > 0 && (
                <div role="group" aria-label={`${filterField} 필터`} className="travel-reader-chips">
                  <button type="button" aria-pressed={category === null} onClick={() => setFilter({ category: null })}>전체</button>
                  {categories.map(option => (
                    <button key={option} type="button" aria-pressed={category === option} onClick={() => setFilter({ category: option })}>
                      {option}
                    </button>
                  ))}
                </div>
              )}
              {costTypes.length > 0 && (
                <div role="group" aria-label="비용구분 필터" className="travel-reader-chips">
                  <span className="travel-reader-chip-label">비용구분</span>
                  <button type="button" aria-pressed={costType === null} onClick={() => setFilter({ costType: null })}>전체</button>
                  {costTypes.map(option => (
                    <button key={option} type="button" aria-pressed={costType === option}
                      onClick={() => setFilter({ costType: option })}>{option}</button>
                  ))}
                </div>
              )}
              {!shoppingUnconfigured && !showRoute && (
                <label className="travel-reader-filter">
                  <Mark name="search" /><input type="search" aria-label={tab === 'schedule' ? '장소·활동 검색' : '제목 검색'} placeholder={tab === 'schedule' ? '장소·활동 검색' : '제목 검색'} value={query} onChange={event => setFilter({ query: event.target.value })} />
                </label>
              )}
              {shoppingUnconfigured && <p className="travel-empty">쇼핑 리스트가 아직 연결되지 않았습니다.</p>}
              {!shoppingUnconfigured && !showRoute && tab !== 'schedule' && rows.length === 0 && <p className="travel-empty">{search || category !== null || (isExpenses && costType !== null)
                ? '조건에 맞는 항목이 없습니다.' : '등록된 항목이 없습니다.'}</p>}
              {tab === 'schedule' && (showRoute ? <ScheduleMapBoundary key={lastRead} onTimeline={() => setView(previous => ({ ...previous, scheduleView: 'timeline' }))}>
                <Suspense fallback={<p role="status">동선 지도를 불러오는 중입니다.</p>}>
                  <ScheduleRouteMap trip={data.trip} rows={items} bookings={data.sections.bookings} now={now} selectedDate={view.routeDate}
                    onDateChange={date => setView(previous => ({ ...previous, routeDate: date }))} />
                </Suspense>
              </ScheduleMapBoundary> : <ScheduleTimeline rows={items} query={query} now={now} bookings={data.sections.bookings} zone={tripCalendar(data.trip, now).zone} />)}
              {!showStatistics && tab !== 'schedule' && rows.length > 0 && <RecordList rows={rows} tab={tab} tripId={data.trip.id}
                opened={opened} onToggle={toggleItem} />}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

function PinForm({ tripId, onUnlock }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showPin, setShowPin] = useState(false);

  const submit = async event => {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const pin = new FormData(form).get('pin');
    setBusy(true);
    setError('');
    try {
      const response = await fetch(tripPath(tripId), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
        signal: AbortSignal.timeout(20000),
      });
      const data = await responseData(response);
      if (data.unlocked !== true) throw new Error('여행 비밀번호를 확인할 수 없습니다.');
      form.reset();
      onUnlock();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="travel-reader-card travel-pin" aria-labelledby="travel-pin-title">
      <span className="travel-pin-icon"><Mark name="lock" size={24} /></span>
      <h1 id="travel-pin-title">여행 잠금 해제</h1>
      <p>이 여행에 설정된 숫자 4자리를 입력하세요.</p>
      <form onSubmit={submit} aria-busy={busy}>
        <label htmlFor="travel-pin">여행 비밀번호</label>
        <div className="travel-pin-entry">
          <input id="travel-pin" type={showPin ? 'text' : 'password'} name="pin" inputMode="numeric"
            pattern="[0-9]{4}" maxLength={4} autoComplete="off" required
            aria-invalid={error ? true : undefined} aria-describedby={error ? 'travel-pin-error' : undefined} />
          <button type="button" onClick={() => setShowPin(value => !value)}
            aria-label={showPin ? '비밀번호 숨기기' : '비밀번호 보기'}>
            <Mark name={showPin ? 'eyeOff' : 'eye'} size={20} />
          </button>
        </div>
        {error && <p id="travel-pin-error" className="travel-error-text" role="alert">{error}</p>}
        <button type="submit" className="travel-primary" disabled={busy}>
          {busy ? '확인 중…' : '여행 열기'} <Mark name="arrowRight" />
        </button>
      </form>
    </section>
  );
}

function readRoute() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const trip = params.get('trip');
  const tripId = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(trip) ? trip : null;
  const tab = params.get('tab');
  const date = params.get('date');
  return { tripId, tab: tripId && Object.hasOwn(TABS, tab) ? tab : 'overview',
    selectedDate: tripId && date === datePart(date) ? date : null };
}

function TodayHome({ trips, now, navigate }) {
  const { active, next, unknownZone } = chooseTrips(trips, now);
  return (
    <section className="travel-reader-card travel-today-home" aria-labelledby="travel-home-today">
      <h2 id="travel-home-today">오늘 일정</h2>
      {active.length === 0 ? (
        <p>{unknownZone ? '시간대를 확인해야 하는 여행이 있습니다.' : '오늘 진행 중인 여행이 없습니다.'}</p>
      ) : (
        <p>{active.length === 1 ? `${active[0].title} 여행이 진행 중입니다.` : '진행 중인 여행 중 오늘 일정을 볼 여행을 선택하세요.'}</p>
      )}
      <div className="travel-today-actions">
        {active.map(trip => (
          <button className="travel-secondary" type="button" key={trip.id} onClick={() => navigate(trip.id, 'today')}>
            {active.length === 1 ? '오늘 일정 보기' : trip.title}
          </button>
        ))}
        {active.length === 0 && next && (
          <>
            <button className="travel-secondary" type="button" onClick={() => navigate(next.id, 'overview')}>다음 여행 · {next.title}</button>
            <button className="travel-secondary" type="button" onClick={() => navigate(next.id, 'checklist')}>준비 체크리스트</button>
          </>
        )}
      </div>
    </section>
  );
}

export default function NotionTravel() {
  const [{ tripId, tab, selectedDate }, setRoute] = useState(readRoute);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState(null);
  const [now, setNow] = useState(Date.now);
  const [lastRead, setLastRead] = useState(null);
  const key = `${tripId ?? 'list'}:${revision}`;
  const current = result?.key === key ? result : null;

  useEffect(() => {
    const controller = new AbortController();
    let expiryTimer;
    let pending = false;
    let locked = false;
    const load = async () => {
      if (pending || locked) return;
      pending = true;
      try {
        const value = await readTrips(tripId, controller.signal);
        if (controller.signal.aborted) return;
        clearTimeout(expiryTimer);
        locked = Boolean(value.needsPin);
        setResult({ key, ...value });
        if (value.data) setLastRead({ tripId, time: Date.now() });
        if (tripId && value.data) {
          expiryTimer = setTimeout(() => {
            locked = true;
            setResult({ key, needsPin: true });
          }, value.data.expiresAt * 1000 - Date.now());
        }
      } catch (error) {
        if (!controller.signal.aborted && !locked) setResult({ key, error: error.message });
      } finally {
        pending = false;
      }
    };
    void load();
    const refreshExpenses = () => {
      if (tripId && document.visibilityState === 'visible' && readRoute().tab === 'expenses') void load();
    };
    const expenseTimer = tripId ? setInterval(refreshExpenses, 60_000) : undefined;
    return () => {
      controller.abort();
      clearTimeout(expiryTimer);
      clearInterval(expenseTimer);
    };
  }, [key, tripId]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onHistory = () => setRoute(readRoute());
    window.addEventListener('popstate', onHistory);
    return () => window.removeEventListener('popstate', onHistory);
  }, []);

  const navigate = (nextTrip, nextTab = 'overview', replace = false, date = null) => {
    const url = new URL(window.location.href);
    const params = new URLSearchParams();
    if (nextTrip) {
      params.set('trip', nextTrip);
      params.set('tab', nextTab);
      if (date) params.set('date', date);
    }
    url.hash = params.toString();
    if (url.href !== window.location.href) {
      if (replace) window.history.replaceState(null, '', url);
      else window.history.pushState(null, '', url);
    }
    setRoute({ tripId: nextTrip, tab: nextTab, selectedDate: date });
  };

  const refresh = () => setRevision(value => value + 1);
  return (
    <div className="travel-reader">
      <a className="travel-skip" href="#travel-content" onClick={event => {
        event.preventDefault();
        document.getElementById('travel-content').focus();
      }}>본문으로 이동</a>
      <header className="travel-reader-header">
        <div className="travel-bar">
          <button className="travel-brand" onClick={() => navigate(null)} aria-label="My Travel Hub 여행 목록">
            <span className="travel-brand-icon"><Mark name="compass" size={23} /></span>
            <span className="travel-brand-title" lang="en">My Travel Hub</span>
          </button>
          {current?.data && (
            <button className="travel-secondary" onClick={refresh}><Mark name="sync" />새로고침</button>
          )}
        </div>
      </header>
      <main id="travel-content" className="travel-content" tabIndex={-1}>
        {tripId && <button className="travel-back" onClick={() => navigate(null)}><Mark name="chevronLeft" />여행 목록</button>}
        {!current && (tab === 'expenses' ? (
          <div className="travel-empty expense-stats-loading" role="status">
            <p>지출 정보를 불러오는 중입니다.</p>
            <div aria-hidden="true"><span /><span /><span /><span /></div>
          </div>
        ) : <p className="travel-empty" role="status">여행 정보를 불러오는 중입니다.</p>)}
        {current?.error && (
          <div className="travel-empty" role="alert">
            <p>{tab === 'expenses' ? `지출 정보를 불러오지 못했습니다. ${current.error}` : current.error}</p>
            {lastRead?.tripId === tripId && <p>마지막 성공 조회 {formatLocalTimestamp(lastRead.time)}</p>}
            <button className="travel-secondary" onClick={refresh}>다시 시도</button>
          </div>
        )}
        {current?.needsPin && <PinForm key={tripId} tripId={tripId} onUnlock={refresh} />}
        {current?.data?.trips && (
          <section aria-labelledby="travel-list-title">
            <div className="travel-list-heading">
              <div>
                <p className="travel-eyebrow">TRAVEL PLANNER</p>
                <h1 id="travel-list-title">내 여행</h1>
                <p>다가오는 여행과 지난 여정을 한곳에서 확인하세요.</p>
              </div>
              <span className="travel-list-count">여행 {current.data.trips.length}개</span>
            </div>
            <TodayHome trips={current.data.trips} now={now} navigate={navigate} />
            {current.data.trips.length === 0 && <p className="travel-empty">등록된 여행이 없습니다.</p>}
            <ul className="travel-card-grid travel-reader-list">
              {sortTripList(current.data.trips).map(trip => <TripCard key={trip.id} trip={trip} onSelect={navigate} />)}
            </ul>
          </section>
        )}
        {current?.data?.trip && (
          <TripDetail key={tripId} data={current.data} tab={tab} selectedDate={selectedDate} now={now} lastRead={lastRead?.time}
            onPinRequired={refresh}
            onSelectTab={next => navigate(tripId, next, true, selectedDate)}
            onDateChange={date => navigate(tripId, 'today', true, date)} />
        )}
      </main>
    </div>
  );
}
