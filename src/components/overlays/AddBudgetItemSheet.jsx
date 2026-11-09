import { useApp } from '../../store';
import { Sheet } from '../Overlay';

const categories = ['숙박', '공연', '교통', '식비', '쇼핑', '기타'];

export default function AddBudgetItemSheet() {
  const { addBudgetItem, closeOverlay } = useApp(s => ({
    addBudgetItem: s.addBudgetItem, closeOverlay: s.closeOverlay,
  }));

  const submit = (event) => {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    const amount = Number(fields.amount);
    if (Number.isFinite(amount) && amount > 0) addBudgetItem({ ...fields, amount });
  };

  return (
    <Sheet onClose={closeOverlay} title="예산 항목 추가">
      <form onSubmit={submit} style={{ display: 'grid', gap: 12, padding: '12px 20px 32px' }}>
        <label>카테고리 <select name="cat">
          {categories.map(category => <option key={category}>{category}</option>)}
        </select></label>
        <label>금액 <input type="number" name="amount" required min="1" /></label>
        <label>통화 <select name="currency">
          <option value="JPY">JPY</option>
          <option value="KRW">KRW</option>
        </select></label>
        <label>메모 <input name="note" maxLength={250} /></label>
        <button type="submit">저장</button>
      </form>
    </Sheet>
  );
}
