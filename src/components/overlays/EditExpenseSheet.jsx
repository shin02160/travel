import { useState } from 'react';
import { useApp as useStore } from '../../store';
import { Sheet } from '../Overlay';

const CATS = ['숙박', '공연', '교통', '식비', '쇼핑', '기타'];

export default function EditExpenseSheet() {
  const { editingExpense, closeOverlay, addExpense, updateExpense } = useStore(s => ({
    editingExpense: s.editingExpense,
    closeOverlay: s.closeOverlay,
    addExpense: s.addExpense,
    updateExpense: s.updateExpense,
  }));

  const isNew = !editingExpense;
  const [form, setForm] = useState({
    cat: editingExpense?.cat || '식비',
    shop: editingExpense?.shop || '',
    item: editingExpense?.item || '',
    amount: editingExpense?.amount?.toString() || '',
    currency: editingExpense?.currency || 'JPY',
    memo: editingExpense?.memo || '',
    receipt: editingExpense?.receipt || null,
    date: editingExpense?.date || new Date().toISOString().slice(0, 10),
  });
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleReceipt = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setField('receipt', ev.target.result);
    reader.readAsDataURL(file);
  };

  const save = () => {
    if (!form.amount || !form.item) return;
    const exp = { ...form, amount: Number(form.amount) };
    if (isNew) addExpense(exp);
    else updateExpense(editingExpense.id, exp);
  };

  return (
    <Sheet onClose={closeOverlay} title={isNew ? '지출 추가' : '지출 수정'} style={{ maxHeight: '92dvh' }}>
      <div style={{ padding: '8px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* 카테고리 선택 */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-sub)', display: 'block', marginBottom: 8 }}>카테고리</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {CATS.map(c => (
              <button key={c} onClick={() => setField('cat', c)} style={{
                padding: '7px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'var(--ff-sans)',
                background: form.cat === c ? 'var(--primary)' : 'rgba(43,38,34,.08)',
                color: form.cat === c ? '#fff' : 'var(--ink-body)',
              }}>{c}</button>
            ))}
          </div>
        </div>
        {/* 날짜 */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-sub)', display: 'block', marginBottom: 6 }}>날짜</label>
          <input type="date" value={form.date} onChange={e => setField('date', e.target.value)}
            style={{ width: '100%', padding: '11px 14px', border: '1.5px solid rgba(43,38,34,.15)', borderRadius: 10, fontSize: 15, fontFamily: 'var(--ff-sans)', background: '#fff', boxSizing: 'border-box' }} />
        </div>
        {/* 상점명 */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-sub)', display: 'block', marginBottom: 6 }}>상점명</label>
          <input value={form.shop} onChange={e => setField('shop', e.target.value)} placeholder="상점명 (선택)"
            style={{ width: '100%', padding: '11px 14px', border: '1.5px solid rgba(43,38,34,.15)', borderRadius: 10, fontSize: 15, fontFamily: 'var(--ff-sans)', background: '#fff', boxSizing: 'border-box' }} />
        </div>
        {/* 품목 */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-sub)', display: 'block', marginBottom: 6 }}>품목 *</label>
          <input value={form.item} onChange={e => setField('item', e.target.value)} placeholder="구매 품목"
            style={{ width: '100%', padding: '11px 14px', border: '1.5px solid rgba(43,38,34,.15)', borderRadius: 10, fontSize: 15, fontFamily: 'var(--ff-sans)', background: '#fff', boxSizing: 'border-box' }} />
        </div>
        {/* 금액 + 통화 */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-sub)', display: 'block', marginBottom: 6 }}>금액 *</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="number" value={form.amount} onChange={e => setField('amount', e.target.value)} placeholder="0"
              style={{ flex: 1, padding: '11px 14px', border: '1.5px solid rgba(43,38,34,.15)', borderRadius: 10, fontSize: 15, fontFamily: 'var(--ff-sans)', background: '#fff', boxSizing: 'border-box' }} />
            <select value={form.currency} onChange={e => setField('currency', e.target.value)}
              style={{ padding: '11px 14px', border: '1.5px solid rgba(43,38,34,.15)', borderRadius: 10, fontSize: 15, fontFamily: 'var(--ff-sans)', background: '#fff' }}>
              <option>JPY</option>
              <option>KRW</option>
            </select>
          </div>
        </div>
        {/* 메모 */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-sub)', display: 'block', marginBottom: 6 }}>메모</label>
          <input value={form.memo} onChange={e => setField('memo', e.target.value)} placeholder="메모 (선택)"
            style={{ width: '100%', padding: '11px 14px', border: '1.5px solid rgba(43,38,34,.15)', borderRadius: 10, fontSize: 15, fontFamily: 'var(--ff-sans)', background: '#fff', boxSizing: 'border-box' }} />
        </div>
        {/* 영수증 */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-sub)', display: 'block', marginBottom: 6 }}>영수증</label>
          <label style={{ display: 'block', padding: '11px 14px', border: '1.5px dashed rgba(43,38,34,.2)', borderRadius: 10, cursor: 'pointer', textAlign: 'center', fontSize: 13, color: 'var(--ink-muted)' }}>
            {form.receipt ? '✓ 첨부됨 (변경하려면 탭)' : '📷 사진 또는 파일 첨부'}
            <input type="file" accept="image/*" onChange={handleReceipt} style={{ display: 'none' }} />
          </label>
          {form.receipt && (
            <img src={form.receipt} alt="영수증" style={{ width: '100%', borderRadius: 10, marginTop: 8, objectFit: 'contain', maxHeight: 200 }} />
          )}
        </div>
        <button onClick={save} style={{ width: '100%', padding: 14, background: 'var(--primary)', border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: 'var(--ff-sans)', cursor: 'pointer', marginTop: 4 }}>
          {isNew ? '추가하기' : '저장하기'}
        </button>
      </div>
    </Sheet>
  );
}
