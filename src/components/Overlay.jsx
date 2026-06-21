import { useApp as useStore } from '../store';
import { Icon } from '../icons';

export function Backdrop({ onClick }) {
  return (
    <div className="anim-overlay" onClick={onClick} style={{
      position: 'fixed', inset: 0, background: 'rgba(28,18,12,.45)', zIndex: 99,
    }} />
  );
}

export function Sheet({ children, onClose, title, style }) {
  return (
    <>
      <Backdrop onClick={onClose} />
      <div className="anim-sheet" style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: 'min(100vw, 480px)',
        background: 'var(--bg-app)', borderRadius: '24px 24px 0 0',
        boxShadow: 'var(--shadow-sheet)',
        zIndex: 100, maxHeight: '90dvh', overflowY: 'auto',
        ...style,
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--ink-muted)' }} />
        </div>
        {title && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px 4px' }}>
            <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--ink)' }}>{title}</span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              <Icon name="x" size={20} color="var(--ink-sub)" />
            </button>
          </div>
        )}
        {children}
      </div>
    </>
  );
}

export function Modal({ children, onClose, title }) {
  return (
    <>
      <Backdrop onClick={onClose} />
      <div className="anim-modal" style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(90vw, 360px)',
        background: 'var(--bg-app)', borderRadius: 20,
        boxShadow: '0 20px 60px rgba(28,18,12,.3)',
        zIndex: 100, padding: '20px 20px 24px',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--ink)' }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <Icon name="x" size={20} color="var(--ink-sub)" />
          </button>
        </div>
        {children}
      </div>
    </>
  );
}
