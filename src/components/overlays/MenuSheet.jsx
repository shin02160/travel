import { useApp as useStore } from '../../store';
import { Sheet } from '../Overlay';
import { Icon } from '../../icons';

export default function MenuSheet() {
  const { closeOverlay, requireLogin, setOverlay, loggedIn, logout } = useStore(s => ({
    closeOverlay: s.closeOverlay,
    requireLogin: s.requireLogin,
    setOverlay: s.setOverlay,
    loggedIn: s.loggedIn,
    logout: s.logout,
  }));

  const items = [
    { icon: 'plus', label: '새 여행 만들기', action: () => requireLogin('create'), admin: true },
    { icon: 'currency', label: '환율 설정', action: () => requireLogin('fx'), admin: true },
    { icon: 'user', label: loggedIn ? '관리자 로그아웃' : '관리자 로그인', action: () => loggedIn ? logout() : setOverlay('login'), admin: false },
  ];

  return (
    <Sheet onClose={closeOverlay} title="빠른 메뉴">
      <div style={{ padding: '4px 20px 32px' }}>
        {items.map((item, i) => (
          <div key={i} onClick={(e) => { e.stopPropagation(); item.action(); }} style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0',
            borderBottom: i < items.length - 1 ? '1px solid rgba(43,38,34,.06)' : 'none',
            cursor: 'pointer',
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 12, background: 'var(--primary-tint)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name={item.icon} size={18} color="var(--primary)" />
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{item.label}</span>
            {item.admin && !loggedIn && (
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-muted)' }}>관리자</span>
            )}
          </div>
        ))}
      </div>
    </Sheet>
  );
}
