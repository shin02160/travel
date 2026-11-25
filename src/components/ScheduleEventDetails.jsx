import { safeScheduleMapUrl } from '../mapLinks.js';
import { formatDateTime } from '../dateDisplay.js';
import { useState } from 'react';

export default function ScheduleEventDetails({ row, bookings = [], label = '일정 정보', inline = false, tripZone }) {
  const [copyMessage, setCopyMessage] = useState('');
  const map = safeScheduleMapUrl(row.mapUrl);
  const related = bookings.filter(booking => row.bookingIds?.includes(booking.id));
  const content = <>
    <dl className="travel-reader-fields">
      {row.fields.일시 && <div><dt>일시</dt><dd>{formatDateTime(row.fields.일시)}</dd></div>}
      {row.fields.장소 && <div><dt>장소·주소</dt><dd>{row.fields.장소}</dd></div>}
      {(row.date?.timeZone ?? tripZone) && <div><dt>시간대</dt><dd>{row.date?.timeZone ?? tripZone}</dd></div>}
      {row.fields.구분 && <div><dt>구분</dt><dd>{row.fields.구분}</dd></div>}
      {row.note && <div><dt>메모</dt><dd className="schedule-note">{row.note}</dd></div>}
      {related.length > 0 && <div><dt>관련 예약</dt><dd><ul>{related.map(booking => <li key={booking.id}>{booking.title}</li>)}</ul></dd></div>}
    </dl>
    <div className="route-row-links">
      {map && <a href={map} target="_blank" rel="noopener noreferrer">외부 지도 열기</a>}
      {row.fields.장소 && navigator.clipboard?.writeText && <button type="button" onClick={async () => {
        try { await navigator.clipboard.writeText(row.fields.장소); setCopyMessage('장소를 복사했습니다.'); }
        catch { setCopyMessage('장소를 복사하지 못했습니다.'); }
      }}>장소 복사</button>}
    </div>
    {copyMessage && <p role="status">{copyMessage}</p>}
  </>;
  return inline ? <div className="schedule-event-details">{content}</div> : <details className="schedule-event-details"><summary>{label}</summary>{content}</details>;
}
