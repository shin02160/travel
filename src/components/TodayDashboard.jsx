import { useState } from 'react';
import { Icon } from '../icons.jsx';
import { planDay, shiftDate, tripCalendar } from '../todaySchedule.js';
import { formatDateTime } from '../dateDisplay.js';
import StatusChips from './StatusChips.jsx';

const EVENT_ICONS = { 이동: 'train', 관광: 'map', 식사: 'compass', 쇼핑: 'wallet', 공연: 'music', 숙박: 'hotel', 휴식: 'home' };

function EventDetails({ row, end, bookings }) {
  const [copyMessage, setCopyMessage] = useState('');
  const location = row.fields.장소;
  const related = (row.bookingIds ?? []).map(id => bookings.get(id)).filter(Boolean);
  const sourceTime = row.fields.일시;
  const zone = row.date?.timeZone;
  if (!location && !row.note && !row.sourceUrl && !related.length && !sourceTime) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(location);
      setCopyMessage('장소를 복사했습니다.');
    } catch {
      setCopyMessage('장소를 복사하지 못했습니다.');
    }
  };

  return (
    <details>
      <summary>일정 상세</summary>
      <dl className="travel-reader-fields">
        {sourceTime && <div><dt>{end ? '시작·종료' : '일시'}</dt><dd className="travel-number">{formatDateTime(sourceTime)}</dd></div>}
        {zone && <div><dt>시간대</dt><dd>{zone}</dd></div>}
        {location && <div><dt>장소</dt><dd>{location}</dd></div>}
        {row.note && <div><dt>메모</dt><dd>{row.note}</dd></div>}
        {related.length > 0 && (
          <div>
            <dt>관련 예약</dt>
            <dd>
              <ul className="travel-summary-list">
                {related.map(booking => (
                  <li key={booking.id}>
                    <span className="travel-item-heading">
                      <span>{booking.title}</span>
                      <StatusChips statuses={{ 예약상태: booking.fields.예약상태 }} />
                    </span>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
      </dl>
      <div className="travel-today-actions">
        {location && navigator.clipboard?.writeText && <button type="button" onClick={copy}>장소 복사</button>}
        {location && row.mapUrl && <a href={row.mapUrl} target="_blank" rel="noopener noreferrer">지도 열기</a>}
        {row.sourceUrl && <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer">Notion 원본</a>}
      </div>
      {copyMessage && <p role="status">{copyMessage}</p>}
    </details>
  );
}

export default function TodayDashboard({ data, selectedDate, onDateChange, now }) {
  const { start, end, today, zone } = tripCalendar(data.trip, now);
  if (!start || !end) return <p className="travel-empty">여행 기간이 등록되면 날짜별 일정을 볼 수 있습니다.</p>;

  const inTrip = today && start <= today && today <= end;
  const day = selectedDate && start <= selectedDate && selectedDate <= end ? selectedDate : inTrip ? today : start;
  const isToday = day === today;
  const { events, next } = planDay(data.sections.schedule, day, zone, now);
  const bookings = new Map(data.sections.bookings.map(row => [row.id, row]));
  return (
    <section className="travel-today" aria-label="오늘 일정">
      <header className="travel-reader-card travel-today-heading">
        <div>
          <p className="travel-eyebrow">현지 일정</p>
          <h2>{day}</h2>
          <p>{zone ?? '시간대 확인 필요'}</p>
        </div>
        <div className="travel-today-actions" aria-label="일정 날짜 선택">
          <button type="button" disabled={day <= start} onClick={() => onDateChange(shiftDate(day, -1))}>전날</button>
          <button type="button" disabled={!inTrip || isToday} onClick={() => onDateChange(today)}>오늘</button>
          <button type="button" disabled={day >= end} onClick={() => onDateChange(shiftDate(day, 1))}>다음날</button>
        </div>
      </header>
      <div className="travel-today-grid">
        <section className="travel-reader-card travel-today-next" aria-labelledby="travel-next-event">
          <h3 id="travel-next-event">다음 일정</h3>
          {isToday && next ? (
            <>
              <p className="travel-event-time">{day} {next.time}</p>
              <div className="travel-item-heading">
                <h4>{next.row.title}</h4>
                <StatusChips statuses={{ 진행상태: next.row.fields.진행상태 }} />
              </div>
              {next.row.fields.장소 && <p>{next.row.fields.장소}</p>}
            </>
          ) : <p>{isToday ? '시작 시간이 확인된 다음 일정이 없습니다.' : '현지 오늘 날짜를 선택하면 다음 일정을 볼 수 있습니다.'}</p>}
        </section>
        <section className="travel-today-timeline" aria-labelledby="travel-day-timeline">
          <h3 id="travel-day-timeline">{isToday ? '오늘 타임라인' : '선택한 날짜의 타임라인'}</h3>
          {events.length === 0 ? <p className="travel-empty">이 날짜에 등록된 일정이 없습니다.</p> : (
            <ol className="travel-timeline">
              {events.map(event => {
                const { row, time, stamp, allDay, passed, end: eventEnd } = event;
                const { 구분, 장소, 진행상태 } = row.fields;
                return (
                  <li key={row.id}>
                    <span className="travel-timeline-icon" aria-hidden="true"><Icon name={EVENT_ICONS[구분] ?? 'calendar'} size={18} /></span>
                    <article className="travel-reader-card">
                      <div className="travel-event-meta">
                        <span className="travel-event-time">{day} {allDay ? '종일' : time ?? '시간 미정'}</span>
                        {구분 && <span className="travel-badge">{구분}</span>}
                        {passed && <span className="travel-badge">예정 시간 지남</span>}
                        {time && stamp === null && <span className="travel-badge">시간대 확인 필요</span>}
                        {eventEnd?.slice(0, 10) > day && <span className="travel-badge">{formatDateTime(eventEnd)} 종료</span>}
                      </div>
                      <div className="travel-item-heading">
                        <h4>{row.title}</h4>
                        <StatusChips statuses={{ 진행상태 }} />
                      </div>
                      {장소 && <p className="travel-event-location">{장소}</p>}
                      <EventDetails row={row} end={eventEnd} bookings={bookings} />
                    </article>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </section>
  );
}
