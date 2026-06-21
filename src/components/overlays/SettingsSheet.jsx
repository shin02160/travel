import { useApp as useStore } from '../../store';
import { Sheet } from '../Overlay';
import { Icon } from '../../icons';

export default function SettingsSheet() {
  const { closeOverlay, trips, loggedIn, requireLogin, deleteTrip, currentTripId, setOverlay, fxRate } = useStore(s => ({
    closeOverlay: s.closeOverlay,
    trips: s.trips,
    loggedIn: s.loggedIn,
    requireLogin: s.requireLogin,
    deleteTrip: s.deleteTrip,
    currentTripId: s.currentTripId,
    setOverlay: s.setOverlay,
    fxRate: s.fxRate,
  }));

  const section = (title) => (
    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-muted)', letterSpacing: '.04em', textTransform: 'uppercase', margin: '18px 0 8px' }}>
      {title}
    </div>
  );

  const row = (label, sub, right, onClick) => (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '13px 0', borderBottom: '1px solid rgba(43,38,34,.06)', cursor: onClick ? 'pointer' : 'default',
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{sub}</div>}
      </div>
      {right}
    </div>
  );

  return (
    <Sheet onClose={closeOverlay} title="설정">
      <div style={{ padding: '4px 20px 40px' }}>

        {section('여행 관리')}
        {trips.map(t => (
          <div key={t.id} style={{
            display: 'flex', alignItems: 'center', padding: '12px 0',
            borderBottom: '1px solid rgba(43,38,34,.06)',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{t.name}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{t.dest}</div>
            </div>
            {t.id === currentTripId ? (
              <span style={{
                background: 'var(--green-bg)', color: 'var(--green)',
                fontSize: 11, fontWeight: 700, borderRadius: 10, padding: '3px 9px',
              }}>현재</span>
            ) : (
              loggedIn && (
                <button onClick={() => deleteTrip(t.id)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                }}>
                  <Icon name="trash" size={16} color="var(--ink-muted)" />
                </button>
              )
            )}
          </div>
        ))}
        <button onClick={() => requireLogin('create')} style={{
          width: '100%', marginTop: 10, padding: '12px',
          background: 'none', border: '1.5px dashed rgba(43,38,34,.18)', borderRadius: 12,
          cursor: 'pointer', color: 'var(--primary)', fontSize: 13.5, fontWeight: 700,
          fontFamily: 'var(--ff-sans)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <Icon name="plus" size={14} color="var(--primary)" />새 여행 추가
        </button>

        {section('통화 설정')}
        {row('대표 통화', 'JPY (일본 엔)', <span style={{ fontSize: 13, color: 'var(--ink-sub)' }}>JPY</span>)}
        {row('환율', `KRW ÷ ${fxRate}`, (
          <button onClick={() => requireLogin('fx')} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--primary)', fontSize: 13, fontWeight: 700, fontFamily: 'var(--ff-sans)',
          }}>변경</button>
        ))}

        {section('계정')}
        {row(
          loggedIn ? '관리자 로그인됨' : '관리자 로그인',
          loggedIn ? '여행 생성·삭제 가능' : '여행 관리 기능 사용',
          <button onClick={() => setOverlay('login')} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--primary)', fontSize: 13, fontWeight: 700, fontFamily: 'var(--ff-sans)',
          }}>{loggedIn ? '로그아웃' : '로그인'}</button>
        )}
      </div>
    </Sheet>
  );
}
