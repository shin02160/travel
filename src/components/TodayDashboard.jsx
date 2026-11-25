import { shiftDate, tripCalendar } from '../todaySchedule.js';
import { buildScheduleTimeline } from '../scheduleTimelineModel.js';
import { scheduleActivity } from '../scheduleIdentity.js';
import StatusChips from './StatusChips.jsx';
import ScheduleTimeline from './ScheduleTimeline.jsx';

export default function TodayDashboard({ data, selectedDate, onDateChange, now }) {
  const { start, end, today, zone } = tripCalendar(data.trip, now);
  if (!start || !end) return <p className="travel-empty">여행 기간이 등록되면 날짜별 일정을 볼 수 있습니다.</p>;
  const inTrip = today && start <= today && today <= end;
  const day = selectedDate && start <= selectedDate && selectedDate <= end ? selectedDate : inTrip ? today : start;
  const isToday = day === today;
  const { next } = buildScheduleTimeline(data.sections.schedule, { date: day, zone, now });
  return <section className="travel-today" aria-label="오늘 일정">
    <header className="travel-reader-card travel-today-heading">
      <div><p className="travel-eyebrow">현지 일정</p><h2>{day}</h2><p>{zone ?? '시간대 확인 필요'}</p></div>
      <div className="travel-today-actions" aria-label="일정 날짜 선택">
        <button type="button" disabled={day <= start} onClick={() => onDateChange(shiftDate(day, -1))}>전날</button>
        <button type="button" disabled={!inTrip || isToday} onClick={() => onDateChange(today)}>오늘</button>
        <button type="button" disabled={day >= end} onClick={() => onDateChange(shiftDate(day, 1))}>다음날</button>
      </div>
    </header>
    <div className="travel-today-grid">
      <section className="travel-reader-card travel-today-next" aria-labelledby="travel-next-event">
        <h3 id="travel-next-event">다음 일정</h3>
        {isToday && next ? <>
          <p className="travel-event-time">{next.time}</p>
          <div className="travel-item-heading"><h4>{next.group.row.title}</h4><StatusChips statuses={{ 진행상태: next.row.fields.진행상태 }} /></div>
          {scheduleActivity(next.row) && <p className="schedule-activity">{scheduleActivity(next.row)}</p>}
        </> : <p>{isToday ? '시작 시간이 확인된 다음 일정이 없습니다.' : '현지 오늘 날짜를 선택하면 다음 일정을 볼 수 있습니다.'}</p>}
      </section>
      <section className="travel-today-timeline" aria-labelledby="travel-day-timeline">
        <h3 id="travel-day-timeline">{isToday ? '오늘 타임라인' : '선택한 날짜의 타임라인'}</h3>
        <ScheduleTimeline rows={data.sections.schedule} zone={zone} bookings={data.sections.bookings} now={now} date={day} heading={false} />
      </section>
    </div>
  </section>;
}
