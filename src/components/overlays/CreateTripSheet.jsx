import { useState } from 'react';
import { useApp as useStore } from '../../store';
import { Sheet } from '../Overlay';

export default function CreateTripSheet() {
  const { addTrip, closeOverlay } = useStore(s => ({ addTrip: s.addTrip, closeOverlay: s.closeOverlay }));
  const [form, setForm] = useState({ name: '', dest: '', destEn: '', startDate: '', endDate: '', budget: '', currency: 'JPY' });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const inputStyle = {
    width: '100%', padding: '11px 13px', border: '1.5px solid rgba(43,38,34,.15)',
    borderRadius: 11, fontSize: 13.5, fontFamily: 'var(--ff-sans)',
    background: '#fff', outline: 'none', color: 'var(--ink)', boxSizing: 'border-box',
  };

  const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--ink-sub)', marginBottom: 5, display: 'block' };

  const handleSubmit = () => {
    if (!form.name || !form.startDate || !form.endDate) return;
    const nights = Math.ceil((new Date(form.endDate) - new Date(form.startDate)) / 86400000);
    addTrip({
      ...form,
      budget: Number(form.budget) || 0,
      nights,
      photo: 'photo-1540959733332-eab4deabeeaf',
    });
  };

  return (
    <Sheet onClose={closeOverlay} title="새 여행 만들기">
      <div style={{ padding: '12px 20px 36px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={labelStyle}>여행명 *</label>
          <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="도쿄 여름 콘서트" />
        </div>
        <div>
          <label style={labelStyle}>목적지</label>
          <input style={inputStyle} value={form.dest} onChange={e => set('dest', e.target.value)} placeholder="일본 · 도쿄" />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>출발일 *</label>
            <input type="date" style={inputStyle} value={form.startDate} onChange={e => set('startDate', e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>귀국일 *</label>
            <input type="date" style={inputStyle} value={form.endDate} onChange={e => set('endDate', e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>예산</label>
            <input type="number" style={inputStyle} value={form.budget} onChange={e => set('budget', e.target.value)} placeholder="260000" />
          </div>
          <div style={{ flex: 0.6 }}>
            <label style={labelStyle}>통화</label>
            <select style={inputStyle} value={form.currency} onChange={e => set('currency', e.target.value)}>
              {['JPY','KRW','USD','EUR'].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <button onClick={handleSubmit} style={{
          width: '100%', padding: '14px', marginTop: 4,
          background: 'var(--primary)', border: 'none', borderRadius: 12, cursor: 'pointer',
          color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: 'var(--ff-sans)',
          boxShadow: 'var(--shadow-primary)',
        }}>여행 만들기</button>
      </div>
    </Sheet>
  );
}
