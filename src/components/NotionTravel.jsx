import { useEffect, useState } from 'react';
import { loginWithPassword, logoutSession } from '../authClient.js';
import '../styles.css';
import './NotionTravel.css';

const TABS = {
  overview: '개요', schedule: '일정', bookings: '예약', budgets: '예산',
  expenses: '지출', receipts: '영수증', checklist: '체크리스트',
};
const WON_FIELDS = new Set(['총예산', '총지출', '잔여예산', '예산 KRW', '사용금액', '잔액', '원화 확정액', '집계 금액']);
const ERRORS = {
  notion_not_configured: 'Notion 연동을 사용하려면 서버 설정이 필요합니다.',
  trip_not_found: '이 여행은 Notion에서 조회할 수 없습니다.',
  notion_unavailable: 'Notion에서 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
};

async function readTrips(tripId, signal) {
  const path = tripId ? `/api/trips/${encodeURIComponent(tripId)}` : '/api/trips';
  const response = await fetch(path, { signal, credentials: 'same-origin', cache: 'no-store' });
  if (response.status === 401) return { needsLogin: true };
  if (!response.headers.get('content-type')?.startsWith('application/json')) {
    throw new Error('여행 조회 API에 연결할 수 없습니다.');
  }
  const data = await response.json();
  if (!response.ok) throw new Error(ERRORS[data.error] ?? '여행을 불러오지 못했습니다.');
  if (!Number.isInteger(data.expiresAt) || data.expiresAt * 1000 <= Date.now()) {
    return { needsLogin: true };
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

function NotionLink({ row }) {
  return <a href={row.notionUrl} target="_blank" rel="noopener noreferrer">Notion에서 열기</a>;
}

function TripDetail({ data }) {
  const [tab, setTab] = useState('overview');
  const [query, setQuery] = useState('');
  const rows = data.sections[tab]?.filter(row =>
    row.title.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <>
      <div className="travel-reader-card">
        <h2>{data.trip.title}</h2>
        <NotionLink row={data.trip} />
      </div>
      <nav aria-label="여행 정보" className="travel-reader-tabs">
        {Object.entries(TABS).map(([key, label]) => (
          <button key={key} aria-pressed={tab === key} onClick={() => { setTab(key); setQuery(''); }}>
            {label}
          </button>
        ))}
      </nav>
      {tab === 'overview' ? (
        <section className="travel-reader-card" aria-label="개요"><Fields fields={data.trip.fields} /></section>
      ) : (
        <section aria-label={TABS[tab]}>
          <label className="travel-reader-filter">
            제목 검색 <input type="search" value={query} onChange={event => setQuery(event.target.value)} />
          </label>
          {rows.length === 0 && <p>{query.trim() ? '검색 결과가 없습니다.' : '등록된 항목이 없습니다.'}</p>}
          <ul className="travel-reader-list">
            {rows.map(row => (
              <li key={row.id} className="travel-reader-card">
                <h3>{row.title}</h3>
                <Fields fields={row.fields} />
                <NotionLink row={row} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

export default function NotionTravel() {
  const [tripId, setTripId] = useState(null);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [logoutFailed, setLogoutFailed] = useState(false);
  const key = `${tripId ?? 'list'}:${revision}`;
  const current = result?.key === key ? result : null;

  useEffect(() => {
    const controller = new AbortController();
    let expiryTimer;
    readTrips(tripId, controller.signal).then(value => {
      if (controller.signal.aborted) return;
      setResult({ key, ...value });
      if (value.data) {
        expiryTimer = setTimeout(() => setResult({ key, needsLogin: true }),
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
  const login = async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const password = new FormData(form).get('password');
    setBusy(true);
    setAuthError('');
    try {
      if (await loginWithPassword(password)) {
        form.reset();
        refresh();
      } else {
        setAuthError('비밀번호가 올바르지 않습니다.');
      }
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    setBusy(true);
    setResult({ key, needsLogin: true });
    setAuthError('');
    try {
      if (!await logoutSession()) throw new Error();
      setLogoutFailed(false);
    } catch {
      setLogoutFailed(true);
      setAuthError('로그아웃에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="travel-reader">
      <header className="travel-reader-header">
        <div>
          <h1>My Travel Hub</h1>
          <p>여행 정보는 Notion에서 편집합니다.</p>
        </div>
        {current?.data && <button onClick={logout} disabled={busy}>로그아웃</button>}
      </header>
      {tripId && <button onClick={() => setTripId(null)} disabled={busy || logoutFailed}>여행 목록</button>}
      {current?.data && <button onClick={refresh} disabled={busy}>새로고침</button>}
      {!current && <p role="status">여행 정보를 불러오는 중입니다.</p>}
      {current?.error && (
        <div role="alert"><p>{current.error}</p><button onClick={refresh}>다시 시도</button></div>
      )}
      {current?.needsLogin && (
        <section className="travel-reader-card">
          {authError && <p role="alert">{authError}</p>}
          {logoutFailed ? (
            <button onClick={logout} disabled={busy}>로그아웃 다시 시도</button>
          ) : (
            <form onSubmit={login}>
              <label>관리자 비밀번호 <input type="password" name="password" autoComplete="current-password" required maxLength={256} /></label>
              <button type="submit" disabled={busy}>로그인</button>
            </form>
          )}
        </section>
      )}
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
