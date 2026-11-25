import { safeScheduleMapUrl, safeScheduleSourceUrl } from '../mapLinks.js';
import { formatDateTime } from '../dateDisplay.js';

export default function ScheduleEventDetails({ row, bookings = [], label = '일정 정보' }) {
  const map = safeScheduleMapUrl(row.mapUrl), source = safeScheduleSourceUrl(row.sourceUrl);
  const related = bookings.filter(booking => row.bookingIds?.includes(booking.id));
  return <details className="schedule-event-details">
    <summary>{label}</summary>
    <dl className="travel-reader-fields">
      {row.fields.일시 && <div><dt>일시</dt><dd>{formatDateTime(row.fields.일시)}</dd></div>}
      {row.fields.장소 && <div><dt>장소·주소</dt><dd>{row.fields.장소}</dd></div>}
      {row.note && <div><dt>메모</dt><dd className="schedule-note">{row.note}</dd></div>}
      {related.length > 0 && <div><dt>관련 예약</dt><dd><ul>{related.map(booking => <li key={booking.id}>{booking.title}</li>)}</ul></dd></div>}
    </dl>
    <div className="route-row-links">
      {map && <a href={map} target="_blank" rel="noopener noreferrer">외부 지도 열기</a>}
      {source && <a href={source} target="_blank" rel="noopener noreferrer">Notion 원본</a>}
    </div>
  </details>;
}
