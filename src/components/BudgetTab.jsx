import { useApp as useStore } from '../store';
import { Icon } from '../icons';

const CAT_COLORS = {
  숙박: '#7A6BA0', 공연: '#E2603F', 교통: '#5E7A6B', 식비: '#2F8A55', 쇼핑: '#B5821E', 기타: '#8E8E93',
};

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

export default function BudgetTab() {
  const { budgetCur, setBudgetCur, fxRate, requireLogin, loggedIn, budgetItems, expenses, deleteBudgetItem, deleteExpense, setEditingExpense } = useStore(s => ({
    budgetCur: s.budgetCur,
    setBudgetCur: s.setBudgetCur,
    fxRate: s.fxRate,
    requireLogin: s.requireLogin,
    loggedIn: s.loggedIn,
    budgetItems: s.budgetItems,
    expenses: s.expenses,
    deleteBudgetItem: s.deleteBudgetItem,
    deleteExpense: s.deleteExpense,
    setEditingExpense: s.setEditingExpense,
  }));

  // 총 예산 (모두 JPY 기준)
  const totalBudgetJpy = budgetItems.reduce((acc, b) => acc + (b.currency === 'KRW' ? Math.round(b.amount / fxRate) : b.amount), 0);

  // 총 지출 (JPY 기준 환산)
  const totalSpentJpy = expenses.reduce((acc, e) => acc + (e.currency === 'KRW' ? Math.round(e.amount / fxRate) : e.amount), 0);
  const remaining = totalBudgetJpy - totalSpentJpy;
  const pct = totalBudgetJpy ? Math.round(totalSpentJpy / totalBudgetJpy * 100) : 0;

  // JPY 지출만
  const jpyExpenses = expenses.filter(e => e.currency === 'JPY');
  const totalJpy = jpyExpenses.reduce((acc, e) => acc + e.amount, 0);

  // KRW 지출만
  const krwExpenses = expenses.filter(e => e.currency === 'KRW');
  const totalKrw = krwExpenses.reduce((acc, e) => acc + e.amount, 0);

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
          {/* 다크 히어로 */}
          <div style={{
            background: 'linear-gradient(135deg, var(--dark-card-from), var(--dark-card-to))',
            borderRadius: 16, padding: '18px 18px 16px', marginBottom: 12, color: '#fff',
          }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', marginBottom: 4 }}>예산 대비 지출</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 30, fontWeight: 700, color: 'var(--primary)' }}>
                ¥{totalSpentJpy.toLocaleString()}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)' }}>총 예산</div>
                <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 15, fontWeight: 600 }}>¥{totalBudgetJpy.toLocaleString()}</div>
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
              <span>잔액 <span style={{ color: remaining >= 0 ? '#fff' : '#ff6b6b', fontFamily: 'var(--ff-serif)', fontWeight: 600 }}>¥{remaining.toLocaleString()}</span></span>
              <span>외화 + 원화 합산</span>
            </div>
          </div>

          {/* 예산 항목 리스트 */}
          <div style={{ background: '#fff', borderRadius: 14, padding: '14px 14px 6px', boxShadow: 'var(--shadow-card)', border: '1px solid var(--card-border)', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-sub)', marginBottom: 10 }}>예산 항목</div>
            {budgetItems.map(b => {
              const bJpy = b.currency === 'KRW' ? Math.round(b.amount / fxRate) : b.amount;
              const bPct = totalBudgetJpy ? Math.round(bJpy / totalBudgetJpy * 100) : 0;
              return (
                <div key={b.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: CAT_COLORS[b.cat] || '#8E8E93', flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-body)' }}>{b.cat}</span>
                      {b.note && <span style={{ fontSize: 11, color: 'var(--ink-muted)' }}>{b.note}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: 'var(--ff-serif)', fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                        {b.currency === 'KRW' ? `₩${b.amount.toLocaleString()}` : `¥${b.amount.toLocaleString()}`}
                      </span>
                      {loggedIn && (
                        <button onClick={() => deleteBudgetItem(b.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                          <Icon name="x" size={13} color="var(--ink-muted)" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ height: 3, borderRadius: 2, background: 'rgba(43,38,34,.08)' }}>
                    <div style={{ height: '100%', borderRadius: 2, background: CAT_COLORS[b.cat] || '#8E8E93', width: `${bPct}%`, transition: 'width .4s' }} />
                  </div>
                </div>
              );
            })}
            {loggedIn && (
              <button onClick={() => requireLogin('addBudgetItem')} style={{
                width: '100%', padding: '10px 0', background: 'none', border: '1.5px dashed rgba(43,38,34,.15)',
                borderRadius: 10, cursor: 'pointer', color: 'var(--primary)', fontSize: 13, fontWeight: 700, fontFamily: 'var(--ff-sans)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 4, marginBottom: 8,
              }}>
                <Icon name="plus" size={13} color="var(--primary)" />예산 항목 추가
              </button>
            )}
          </div>

          {/* 환율 행 */}
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

      {/* JPY view - 지출 내역 */}
      {budgetCur === 'jpy' && (
        <>
          <div style={{ background: '#fff', borderRadius: 16, padding: '16px', boxShadow: 'var(--shadow-card)', border: '1px solid var(--card-border)', marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--ink-sub)', marginBottom: 4 }}>외화 지출 합계</div>
            <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 26, fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>¥{totalJpy.toLocaleString()}</div>

            {jpyExpenses.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--ink-muted)', padding: '8px 0' }}>외화 지출 내역이 없습니다</div>
            ) : (
              jpyExpenses.map(e => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid rgba(43,38,34,.06)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: CAT_COLORS[e.cat] || '#8E8E93', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-body)', marginBottom: 1 }}>
                      {e.shop ? `${e.shop} · ` : ''}{e.item}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-muted)' }}>{e.date} · {e.cat}{e.memo ? ` · ${e.memo}` : ''}</div>
                  </div>
                  <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 14, fontWeight: 700, color: 'var(--ink)', flexShrink: 0 }}>¥{e.amount.toLocaleString()}</div>
                  {loggedIn && (
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button onClick={() => setEditingExpense(e)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                        <Icon name="pencil" size={13} color="var(--ink-muted)" />
                      </button>
                      <button onClick={() => deleteExpense(e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                        <Icon name="x" size={14} color="var(--ink-muted)" />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          <button onClick={() => { if (loggedIn) setEditingExpense(null); else requireLogin('editExpense'); }} style={{
            width: '100%', padding: 14, background: 'var(--primary)', border: 'none', borderRadius: 12,
            color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'var(--ff-sans)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <Icon name="plus" size={15} color="#fff" />지출 추가 (¥)
          </button>
        </>
      )}

      {/* KRW view */}
      {budgetCur === 'krw' && (
        <>
          <div style={{ background: '#fff', borderRadius: 16, padding: '16px', boxShadow: 'var(--shadow-card)', border: '1px solid var(--card-border)', marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--ink-sub)', marginBottom: 4 }}>원화 지출 합계</div>
            <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 26, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>₩{totalKrw.toLocaleString()}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginBottom: 14, fontFamily: 'var(--ff-serif)' }}>
              ≈ ¥{Math.round(totalKrw / fxRate).toLocaleString()} (÷{fxRate})
            </div>

            {krwExpenses.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--ink-muted)', padding: '8px 0' }}>원화 지출 내역이 없습니다</div>
            ) : (
              krwExpenses.map(e => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid rgba(43,38,34,.06)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: CAT_COLORS[e.cat] || '#8E8E93', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-body)', marginBottom: 1 }}>
                      {e.shop ? `${e.shop} · ` : ''}{e.item}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-muted)' }}>{e.date} · {e.cat}{e.memo ? ` · ${e.memo}` : ''}</div>
                  </div>
                  <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 14, fontWeight: 700, color: 'var(--ink)', flexShrink: 0 }}>₩{e.amount.toLocaleString()}</div>
                  {loggedIn && (
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button onClick={() => setEditingExpense(e)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                        <Icon name="pencil" size={13} color="var(--ink-muted)" />
                      </button>
                      <button onClick={() => deleteExpense(e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                        <Icon name="x" size={14} color="var(--ink-muted)" />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          <button onClick={() => { const exp = null; if (loggedIn) setEditingExpense(exp); else requireLogin('editExpense'); }} style={{
            width: '100%', padding: 14, background: 'var(--primary)', border: 'none', borderRadius: 12,
            color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'var(--ff-sans)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <Icon name="plus" size={15} color="#fff" />지출 추가 (₩)
          </button>
        </>
      )}
    </div>
  );
}
