import { useEffect, useState } from 'react';
import '../styles.css';
import './NotionTravel.css';

const TABS = {
  overview: '개요', schedule: '일정', bookings: '예약', budgets: '예산',
  expenses: '지출', receipts: '영수증', checklist: '체크리스트',
};
const FILTER_FIELDS = { bookings: '예약유형', checklist: '분류' };
const WON_FIELDS = new Set(['총예산', '총지출', '잔여예산', '예산 KRW', '사용금액', '잔액', '원화 확정액', '집계 금액']);
const ERRORS = {
  trip_pin_not_configured: '이 여행의 비밀번호가 아직 설정되지 않았습니다.',
  invalid_pin: '여행 비밀번호가 올바르지 않습니다.',
  invalid_pin_format: '숫자 4자리를 입력해 주세요.',
  too_many_pin_attempts: '비밀번호 입력 횟수를 초과했습니다. 잠시 후 다시 시도해 주세요.',
  pin_limiter_unavailable: '비밀번호 확인 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  notion_not_configured: 'Notion 연동을 사용하려면 서버 설정이 필요합니다.',
  trip_not_found: '이 여행은 Notion에서 조회할 수 없습니다.',
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

function Fields({ fields }) {
  return (
    <dl className="travel-reader-fields">
      {Object.entries(fields).map(([name, value]) => (
        <div key={name}>
          <dt>{name}</dt>
          <dd>{typeof value === 'number'
            ? `${WON_FIELDS.has(name) ? '₩' : ''}${value.toLocaleString('ko-KR')}`
            : value || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

function TripDetail({ data }) {
  const [tab, setTab] = useState('overview');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(null);
  const items = data.sections[tab] ?? [];
  const filterField = FILTER_FIELDS[tab];
  const categoryOf = item => {
    const value = item.fields[filterField];
    return typeof value === 'string' && value.trim() ? value.trim() : '미분류';
  };
  const categories = filterField ? [...new Set(items.map(categoryOf))] : [];
  const search = query.trim().toLowerCase();
  const rows = items.filter(item =>
    (category === null || categoryOf(item) === category) && item.title.toLowerCase().includes(search));

  const selectTab = nextTab => {
    if (nextTab === tab) return;
    setTab(nextTab);
    setQuery('');
    setCategory(null);
  };

  return (
    <>
      <div className="travel-reader-card">
        <h2>{data.trip.title}</h2>
      </div>
      <nav aria-label="여행 정보" className="travel-reader-tabs">
        {Object.entries(TABS).map(([key, label]) => (
          <button key={key} aria-pressed={tab === key} onClick={() => selectTab(key)}>
            {label}
          </button>
        ))}
      </nav>
      {tab === 'overview' ? (
        <section className="travel-reader-card" aria-label="개요"><Fields fields={data.trip.fields} /></section>
      ) : (
        <section aria-label={TABS[tab]}>
          {categories.length > 0 && (
            <div role="group" aria-label={`${TABS[tab]} ${filterField} 필터`} className="travel-reader-chips">
              <button type="button" aria-pressed={category === null} onClick={() => setCategory(null)}>전체</button>
              {categories.map(option => (
                <button key={option} type="button" aria-pressed={category === option} onClick={() => setCategory(option)}>
                  {option}
                </button>
              ))}
            </div>
          )}
          <label className="travel-reader-filter">
            제목 검색 <input type="search" value={query} onChange={event => setQuery(event.target.value)} />
          </label>
          {rows.length === 0 && <p>{query.trim() ? '검색 결과가 없습니다.' : '등록된 항목이 없습니다.'}</p>}
          <ul className="travel-reader-list">
            {rows.map(row => (
              <li key={row.id} className="travel-reader-card">
                <h3>{row.title}</h3>
                <Fields fields={row.fields} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function PinForm({ tripId, onUnlock }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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
        signal: AbortSignal.timeout(10000),
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
    <section className="travel-reader-card">
      {error && <p role="alert">{error}</p>}
      <form onSubmit={submit}>
        <label>여행 비밀번호 <input type="password" name="pin" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} required /></label>
        <button type="submit" disabled={busy}>여행 열기</button>
      </form>
    </section>
  );
}

export default function NotionTravel() {
  const [tripId, setTripId] = useState(null);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState(null);
  const key = `${tripId ?? 'list'}:${revision}`;
  const current = result?.key === key ? result : null;

  useEffect(() => {
    const controller = new AbortController();
    let expiryTimer;
    readTrips(tripId, controller.signal).then(value => {
      if (controller.signal.aborted) return;
      setResult({ key, ...value });
      if (tripId && value.data) {
        expiryTimer = setTimeout(() => setResult({ key, needsPin: true }),
          value.data.expiresAt * 1000 - Date.now());
      }
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ key, error: error.message });
    });
    return () => {
      controller.abort();
      clearTimeout(expiryTimer);
    };
  }, [key, tripId]);

  const refresh = () => setRevision(value => value + 1);
  return (
    <main className="travel-reader">
      <header className="travel-reader-header">
        <div>
          <h1>My Travel Hub</h1>
          <p>여행 정보는 Notion에서 편집합니다.</p>
        </div>
      </header>
      {tripId && <button onClick={() => setTripId(null)}>여행 목록</button>}
      {current?.data && <button onClick={refresh}>새로고침</button>}
      {!current && <p role="status">여행 정보를 불러오는 중입니다.</p>}
      {current?.error && (
        <div role="alert"><p>{current.error}</p><button onClick={refresh}>다시 시도</button></div>
      )}
      {current?.needsPin && <PinForm key={tripId} tripId={tripId} onUnlock={refresh} />}
      {current?.data?.trips && (
        <section aria-label="여행 목록">
          {current.data.trips.length === 0 && <p>등록된 여행이 없습니다.</p>}
          <ul className="travel-reader-list">
            {current.data.trips.map(trip => (
              <li key={trip.id} className="travel-reader-card">
                <h2><button onClick={() => setTripId(trip.id)}>{trip.title}</button></h2>
                <Fields fields={trip.fields} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {current?.data?.trip && <TripDetail key={tripId} data={current.data} />}
    </main>
  );
}
