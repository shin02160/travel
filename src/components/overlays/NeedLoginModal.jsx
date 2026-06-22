import { useState } from 'react';
import { useApp as useStore } from '../../store';
import { Modal } from '../Overlay';
import { Icon } from '../../icons';

export default function NeedLoginModal() {
  const { closeOverlay, login } = useStore(s => ({
    closeOverlay: s.closeOverlay,
    login: s.login,
  }));
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);

  const handleConfirm = () => {
    const ok = login(pw);
    if (!ok) { setError('비밀번호가 올바르지 않습니다.'); setPw(''); }
  };

  return (
    <Modal onClose={closeOverlay} title="비밀번호 확인">
      <p style={{ fontSize: 13.5, color: 'var(--ink-sub)', lineHeight: 1.6, marginBottom: 16 }}>
        관리자 비밀번호를 입력해주세요.
      </p>
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <input
          type={showPw ? 'text' : 'password'}
          value={pw}
          autoFocus
          onChange={e => { setPw(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && handleConfirm()}
          placeholder="비밀번호"
          style={{
            width: '100%', padding: '12px 44px 12px 14px',
            border: `1.5px solid ${error ? '#e05' : 'rgba(43,38,34,.18)'}`,
            borderRadius: 12, fontSize: 15, fontFamily: 'var(--ff-sans)',
            background: '#fff', outline: 'none', color: 'var(--ink)',
            boxSizing: 'border-box',
          }}
        />
        <button onClick={() => setShowPw(v => !v)} style={{
          position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer', padding: 4,
        }}>
          <Icon name={showPw ? 'eyeOff' : 'eye'} size={16} color="var(--ink-muted)" />
        </button>
      </div>
      {error && <p style={{ color: '#e05', fontSize: 12, marginBottom: 8 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <button onClick={closeOverlay} style={{
          flex: 1, padding: '13px', background: 'rgba(43,38,34,.07)',
          border: 'none', borderRadius: 12, cursor: 'pointer',
          color: 'var(--ink-body)', fontSize: 14, fontWeight: 600, fontFamily: 'var(--ff-sans)',
        }}>취소</button>
        <button onClick={handleConfirm} style={{
          flex: 1, padding: '13px', background: 'var(--primary)',
          border: 'none', borderRadius: 12, cursor: 'pointer',
          color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'var(--ff-sans)',
          boxShadow: 'var(--shadow-primary)',
        }}>확인</button>
      </div>
    </Modal>
  );
}
