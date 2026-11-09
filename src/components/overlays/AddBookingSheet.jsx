import { useApp } from '../../store';
import { Sheet } from '../Overlay';

export default function AddBookingSheet() {
  const { addBooking, closeOverlay } = useApp(s => ({
    addBooking: s.addBooking, closeOverlay: s.closeOverlay,
  }));

  const submit = (event) => {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    const title = fields.title.trim();
    if (title) addBooking({ ...fields, title });
  };

  return (
    <Sheet onClose={closeOverlay} title="예약 추가">
      <form onSubmit={submit} style={{ display: 'grid', gap: 12, padding: '12px 20px 32px' }}>
        <label>유형 <select name="type">
          <option value="flight">항공편</option>
          <option value="hotel">숙소</option>
          <option value="concert">공연</option>
          <option value="transport">교통</option>
        </select></label>
        <label>이름 <input name="title" required maxLength={120} /></label>
        <label>상세 <input name="sub" maxLength={250} /></label>
        <label>예약번호 <input name="code" maxLength={80} /></label>
        <label>상태 <select name="status">
          <option value="pending">미확인</option>
          <option value="confirmed">확정</option>
          <option value="cancelled">취소</option>
        </select></label>
        <button type="submit">저장</button>
      </form>
    </Sheet>
  );
}
