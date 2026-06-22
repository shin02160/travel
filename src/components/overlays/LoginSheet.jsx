import { useState } from 'react';
import { useApp as useStore } from '../../store';
import { Sheet } from '../Overlay';
import { Icon } from '../../icons';

export default function LoginSheet() {
  const { login, closeOverlay, loggedIn, logout } = useStore(s => ({
    login: s.login,
    closeOverlay: s.closeOverlay,
    loggedIn: s.loggedIn,
    logout: s.logout,
  }));
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);

  const handleLogin = () => {
    const ok = login(pw);
    if (!ok) setError('비밀번호가 올바르지 않습니다.');
    else { setPw(''); setError(''); }
  };

  return (
    <Sheet onClose={closeOverlay} title="관리자 로그인">
      <div style={{ padding: '8px 20px 32px' }}>
        {loggedIn ? (
          <>
            <div style={{
              background: 'var(--green-bg)', borderRadius: 12, padding: '14px 16px', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{ width: 10, height: 10, borderRadius: 5, background: 'var(--green-dot)' }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--green)' }}>관리자로 로그인됨</span>
            </div>
            <button onClick={logout} style={{
              width: '100%', padding: '14px', background: 'rgba(43,38,34,.07)',
              border: 'none', borderRadius: 12, cursor: 'pointer',
              color: 'var(--ink-body)', fontSize: 14, fontWeight: 700, fontFamily: 'var(--ff-sans)',
            }}>로그아웃</button>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, color: 'var(--ink-sub)', marginBottom: 16, lineHeight: 1.5 }}>
              여행 생성·삭제 등 관리 기능은 관리자 로그인이 필요합니다.
            </p>
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <input
                type={showPw ? 'text' : 'password'}
                value={pw}
                onChange={e => { setPw(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="비밀번호"
                style={{
                  width: '100%', padding: '12px 44px 12px 14px',
                  border: `1.5px solid ${error ? '#e05' : 'rgba(43,38,34,.18)'}`,
                  borderRadius: 12, fontSize: 14, fontFamily: 'var(--ff-sans)',
                  background: '#fff', outline: 'none', color: 'var(--ink)',
                  boxSizing: 'border-box',
                }}
              />
              <button onClick={() => setShowPw(v => !v)} style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
              }}>
                <Icon name={showPw ? 'eyeOff' : 'eye'} size={16} color="var(--ink-muted)" />
              </button>
            </div>
            {error && <p style={{ color: '#e05', fontSize: 12, marginBottom: 10 }}>{error}</p>}

            <button onClick={handleLogin} style={{
              width: '100%', padding: '14px', background: 'var(--primary)',
              border: 'none', borderRadius: 12, cursor: 'pointer',
              color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'var(--ff-sans)',
              boxShadow: 'var(--shadow-primary)',
            }}>로그인하기</button>
          </>
        )}
      </div>
    </Sheet>
  );
}
