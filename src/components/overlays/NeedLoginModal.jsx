import { useApp as useStore } from '../../store';
import { Modal } from '../Overlay';
import { Icon } from '../../icons';

export default function NeedLoginModal() {
  const { closeOverlay, setOverlay } = useStore(s => ({
    closeOverlay: s.closeOverlay,
    setOverlay: s.setOverlay,
  }));

  return (
    <Modal onClose={closeOverlay} title="로그인이 필요해요">
      <p style={{ fontSize: 13.5, color: 'var(--ink-sub)', lineHeight: 1.6, marginBottom: 20 }}>
        이 기능은 관리자 로그인 후 사용할 수 있습니다.
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={closeOverlay} style={{
          flex: 1, padding: '12px', background: 'rgba(43,38,34,.07)',
          border: 'none', borderRadius: 12, cursor: 'pointer',
          color: 'var(--ink-body)', fontSize: 14, fontWeight: 600, fontFamily: 'var(--ff-sans)',
        }}>취소</button>
        <button onClick={() => setOverlay('login')} style={{
          flex: 1, padding: '12px', background: 'var(--primary)',
          border: 'none', borderRadius: 12, cursor: 'pointer',
          color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'var(--ff-sans)',
          boxShadow: 'var(--shadow-primary)',
        }}>로그인하기</button>
      </div>
    </Modal>
  );
}
