import { useApp as useStore, getCurrentTrip } from '../store';
import { Icon } from '../icons';

const SPENT_JPY = 97330;
const SPENT_KRW = 560000;
const TOTAL_JPY = 260000;

const CAT_JPY = [
  { label: '숙박', amount: 52000, color: '#7A6BA0' },
  { label: '공연', amount: 28000, color: '#E2603F' },
  { label: '식비', amount: 17330, color: '#2F8A55' },
];
const CAT_KRW = [
  { label: '항공', amount: 420000, color: '#E2603F' },
  { label: '교통패스', amount: 86000, color: '#5E7A6B' },
  { label: '보험', amount: 54000, color: '#B5821E' },
];

function SegmentControl({ value, onChange, options }) {
  return (
    <div style={{
      display: 'flex', background: 'rgba(43,38,34,.07)', borderRadius: 10, padding: 3,
      marginBottom: 16,
    }}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)} style={{
          flex: 1, padding: '7px 4px', border: 'none', borderRadius: 8, cursor: 'pointer',
          background: value === o.value ? '#fff' : 'none',
          fontFamily: 'var(--ff-sans)', fontSize: 13, fontWeight: 700,
          color: value === o.value ? 'var(--ink)' : 'var(--ink-sub)',
          boxShadow: value === o.value ? '0 1px 4px rgba(43,38,34,.12)' : 'none',
          transition: 'all .15s',
        }}>{o.label}</button>
      ))}
    </div>
  );
}

function CategoryBar({ cats, total }) {
  return (
    <div>
      <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}>
        {cats.map((c, i) => (
          <div key={i} style={{
            flex: c.amount, background: c.color, transition: 'flex .4s ease',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
        {cats.map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: c.color }} />
            <span style={{ color: 'var(--ink-sub)' }}>{c.label}</span>
            <span style={{ fontWeight: 600, color: 'var(--ink-body)', fontFamily: 'var(--ff-serif)' }}>
              {c.amount.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BudgetTab() {
  const { budgetCur, setBudgetCur, fxRate, requireLogin, trips, currentTripId } = useStore(s => ({
    budgetCur: s.budgetCur,
    setBudgetCur: s.setBudgetCur,
    fxRate: s.fxRate,
    requireLogin: s.requireLogin,
    trips: s.trips,
    currentTripId: s.currentTripId,
  }));

  const trip = getCurrentTrip(trips, currentTripId);
  const totalSpentJpy = SPENT_JPY + Math.round(SPENT_KRW / fxRate);
  const remaining = TOTAL_JPY - totalSpentJpy;
  const pct = Math.round(totalSpentJpy / TOTAL_JPY * 100);
  const krwInJpy = Math.round(SPENT_KRW / fxRate);

  return (
    <div style={{ padding: '16px 16px 100px' }}>
      <SegmentControl
        value={budgetCur}
        onChange={setBudgetCur}
        options={[
          { value: 'all', label: '전체' },
          { value: 'jpy', label: '외화 ¥' },
          { value: 'krw', label: '원화 ₩' },
        ]}
      />

      {/* ALL view */}
      {budgetCur === 'all' && (
        <>
          {/* dark hero card */}
          <div style={{
            background: 'linear-gradient(135deg, var(--dark-card-from), var(--dark-card-to))',
            borderRadius: 16, padding: '18px 18px 16px', marginBottom: 12,
            color: '#fff',
          }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', marginBottom: 4 }}>사용 예산 (대표 통화)</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 30, fontWeight: 700, color: 'var(--primary)' }}>
                ¥{totalSpentJpy.toLocaleString()}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)' }}>총</div>
                <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 15, fontWeight: 600 }}>¥{TOTAL_JPY.toLocaleString()}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0' }}>
              <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'rgba(255,255,255,.15)' }}>
                <div style={{
                  height: '100%', borderRadius: 3, background: 'var(--primary)',
                  width: `${Math.min(pct, 100)}%`, transition: 'width .4s ease',
                }} />
              </div>
              <div style={{ fontFamily: 'var(--ff-serif)', fontWeight: 700, color: 'var(--primary)', minWidth: 36 }}>
                {pct}%
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,.6)' }}>
              <span>잔액 <span style={{ color: '#fff', fontFamily: 'var(--ff-serif)', fontWeight: 600 }}>¥{remaining.toLocaleString()}</span></span>
              <span>외화 + 원화 합산</span>
            </div>
          </div>

          {/* mini cards */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            {[
              { label: '외화 ¥', sub: '일본 결제', val: `¥${SPENT_JPY.toLocaleString()}`, cur: 'jpy', accent: '#7A6BA0' },
              { label: '원화 ₩', sub: `≈ ¥${krwInJpy.toLocaleString()}`, val: `₩${SPENT_KRW.toLocaleString()}`, cur: 'krw', accent: '#E2603F' },
            ].map(card => (
              <div key={card.cur} onClick={() => setBudgetCur(card.cur)} style={{
                flex: 1, background: '#fff', borderRadius: 14, padding: '12px 14px',
                boxShadow: 'var(--shadow-card)', border: '1px solid var(--card-border)',
                cursor: 'pointer',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                  <div style={{ width: 7, height: 7, borderRadius: 2, background: card.accent }} />
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-sub)' }}>{card.label}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-muted)', marginBottom: 2 }}>{card.sub}</div>
                <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
                  {card.val}
                </div>
              </div>
            ))}
          </div>

          {/* fx rate row */}
          <div style={{
            background: '#fff', borderRadius: 14, padding: '13px 14px',
            boxShadow: 'var(--shadow-card)', border: '1px solid var(--card-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-sub)', marginBottom: 1 }}>적용 환율</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', fontFamily: 'var(--ff-serif)' }}>
                KRW ÷ {fxRate}
              </div>
            </div>
            <button onClick={() => requireLogin('fx')} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--primary)', fontSize: 13, fontWeight: 700, fontFamily: 'var(--ff-sans)',
            }}>변경</button>
          </div>
        </>
      )}

      {/* JPY view */}
      {budgetCur === 'jpy' && (
        <>
          <div style={{ background: '#fff', borderRadius: 16, padding: '16px', boxShadow: 'var(--shadow-card)', border: '1px solid var(--card-border)', marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--ink-sub)', marginBottom: 4 }}>외화 합계 (현금 + 카드)</div>
            <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 26, fontWeight: 700, color: 'var(--ink)' }}>¥{SPENT_JPY.toLocaleString()}</div>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--ink-sub)', marginBottom: 8 }}>카테고리</div>
              <CategoryBar cats={CAT_JPY} total={SPENT_JPY} />
            </div>
          </div>
          <div style={{ background: 'var(--gold-bg)', borderRadius: 12, padding: '11px 14px', fontSize: 12.5, color: 'var(--gold)', fontWeight: 600 }}>
            💡 현지 소비는 현금 결제 시 소액권 준비 권장
          </div>
        </>
      )}

      {/* KRW view */}
      {budgetCur === 'krw' && (
        <>
          <div style={{ background: '#fff', borderRadius: 16, padding: '16px', boxShadow: 'var(--shadow-card)', border: '1px solid var(--card-border)', marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--ink-sub)', marginBottom: 4 }}>원화 합계</div>
            <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 26, fontWeight: 700, color: 'var(--ink)' }}>₩{SPENT_KRW.toLocaleString()}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginBottom: 12, fontFamily: 'var(--ff-serif)' }}>
              ≈ ¥{krwInJpy.toLocaleString()} (÷{fxRate})
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-sub)', marginBottom: 8 }}>카테고리</div>
            <CategoryBar cats={CAT_KRW} total={SPENT_KRW} />
          </div>
          <button onClick={() => requireLogin('fx')} style={{
            width: '100%', padding: '13px', background: 'none',
            border: '1.5px dashed rgba(43,38,34,.2)', borderRadius: 14, cursor: 'pointer',
            color: 'var(--ink-sub)', fontSize: 13, fontWeight: 600, fontFamily: 'var(--ff-sans)',
          }}>
            환율 설정 변경 →
          </button>
        </>
      )}
    </div>
  );
}
