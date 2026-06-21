import { useState } from 'react';
import { useApp as useStore } from '../../store';
import { Sheet } from '../Overlay';

const RATES = [9.0, 9.2, 9.4, 9.6];

export default function FxSheet() {
  const { fxRate, setFxRate, closeOverlay } = useStore(s => ({
    fxRate: s.fxRate, setFxRate: s.setFxRate, closeOverlay: s.closeOverlay,
  }));
  const [selected, setSelected] = useState(fxRate);

  return (
    <Sheet onClose={closeOverlay} title="환율 설정">
      <div style={{ padding: '12px 20px 32px' }}>
        <p style={{ fontSize: 13, color: 'var(--ink-sub)', marginBottom: 16, lineHeight: 1.5 }}>
          KRW를 JPY로 환산할 때 사용하는 나눗셈 환율입니다.<br />
          <strong>JPY = KRW ÷ 환율</strong>
        </p>
        <div style={{ display: 'flex', gap: 9, marginBottom: 20 }}>
          {RATES.map(r => (
            <button key={r} onClick={() => setSelected(r)} style={{
              flex: 1, padding: '11px 4px', border: 'none', borderRadius: 10, cursor: 'pointer',
              background: selected === r ? 'var(--primary)' : 'rgba(43,38,34,.07)',
              color: selected === r ? '#fff' : 'var(--ink-body)',
              fontFamily: 'var(--ff-serif)', fontSize: 15, fontWeight: 700,
              transition: 'all .15s',
            }}>{r}</button>
          ))}
        </div>
        <div style={{ background: 'rgba(43,38,34,.05)', borderRadius: 10, padding: '11px 14px', marginBottom: 20, fontSize: 13, color: 'var(--ink-sub)' }}>
          ₩100,000 = ¥{Math.round(100000 / selected).toLocaleString()}
        </div>
        <button onClick={() => setFxRate(selected)} style={{
          width: '100%', padding: '14px', background: 'var(--primary)',
          border: 'none', borderRadius: 12, cursor: 'pointer',
          color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'var(--ff-sans)',
          boxShadow: 'var(--shadow-primary)',
        }}>적용하기</button>
      </div>
    </Sheet>
  );
}
