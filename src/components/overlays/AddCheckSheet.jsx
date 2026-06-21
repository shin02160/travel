import { useApp as useStore } from '../../store';
import { Sheet } from '../Overlay';

export default function AddCheckSheet() {
  const { closeOverlay, addCheckCat, addCheckText, setAddCheckText, submitAddCheck } = useStore(s => ({
    closeOverlay: s.closeOverlay,
    addCheckCat: s.addCheckCat,
    addCheckText: s.addCheckText,
    setAddCheckText: s.setAddCheckText,
    submitAddCheck: s.submitAddCheck,
  }));

  return (
    <Sheet onClose={closeOverlay} title={`항목 추가 — ${addCheckCat}`}>
      <div style={{ padding: '12px 20px 32px' }}>
        <input
          autoFocus
          value={addCheckText}
          onChange={e => setAddCheckText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submitAddCheck()}
          placeholder="준비물 입력..."
          style={{
            width: '100%', padding: '12px 14px', marginBottom: 14,
            border: '1.5px solid rgba(43,38,34,.18)', borderRadius: 11,
            fontSize: 14, fontFamily: 'var(--ff-sans)', outline: 'none',
            color: 'var(--ink)', background: '#fff', boxSizing: 'border-box',
          }}
        />
        <button onClick={submitAddCheck} style={{
          width: '100%', padding: '14px', background: 'var(--primary)',
          border: 'none', borderRadius: 12, cursor: 'pointer',
          color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'var(--ff-sans)',
          boxShadow: 'var(--shadow-primary)',
        }}>추가하기</button>
      </div>
    </Sheet>
  );
}
