import { Icon } from '../icons.jsx';
import { buildScheduleTimeline, groupClock, scheduleClock } from '../scheduleTimelineModel.js';
import { scheduleActivity } from '../scheduleIdentity.js';
import StatusChips from './StatusChips.jsx';
import ScheduleEventDetails from './ScheduleEventDetails.jsx';
import './ScheduleTimeline.css';

const ICONS = { 이동: 'train', 관광: 'map', 식사: 'compass', 쇼핑: 'wallet', 공연: 'music', 숙박: 'hotel', 휴식: 'home' };

function Activity({ event, grouped }) {
  const activity = scheduleActivity(event.row);
  if (!activity) return null;
  return <span className="schedule-stop-activity">{grouped && <span className="travel-number">{scheduleClock(event)} · </span>}{activity}</span>;
}

function Visit({ group, bookings, now, zone }) {
  const statuses = [...new Set(group.activities.map(row => row.fields.진행상태).filter(Boolean))];
  return <li className="schedule-stop" data-group-id={group.id} data-visit-number={group.number}>
    <span className="schedule-stop-icon" aria-hidden="true"><Icon name={ICONS[group.row.fields.구분] ?? 'calendar'} size={16} /></span>
    <details className="schedule-stop-card">
      <summary aria-label={`${group.row.title} 상세 정보`}>
        <span className="schedule-stop-meta"><span className="travel-number">{groupClock(group)}</span>
          <StatusChips statuses={Object.fromEntries(statuses.map((status, i) => [`진행상태 ${i + 1}`, status]))} /></span>
        <strong className="schedule-stop-title">{group.row.title}</strong>
        {group.events.map(event => <Activity key={event.row.id} event={event} grouped={group.events.length > 1} />)}
        {group.collision && <span className="schedule-stop-note">동시각 · 순서 미확정</span>}
        {group.events.some(event => event.issue) && <span className="schedule-stop-note">일정 시각 확인 필요</span>}
        {group.events.some(event => event.stamp !== null && event.stamp < now && !['완료', '취소'].includes(event.row.fields.진행상태)) && <span className="schedule-stop-note">예정 시간 지남</span>}
      </summary>
      <div className="schedule-stop-body">
        {group.events.map(event => <section key={event.row.id} data-event-id={event.row.id}>
          <h5>{event.row.title} · {scheduleActivity(event.row) ?? '일정 상세'}</h5>
          {event.row.fields.진행상태?.trim() !== '예정' && <StatusChips statuses={{ 진행상태: event.row.fields.진행상태 }} />}
          <ScheduleEventDetails row={event.row} bookings={bookings} tripZone={zone} inline />
        </section>)}
      </div>
    </details>
  </li>;
}

function Connection({ entry, bookings, zone }) {
  const { source } = entry;
  return <li className="schedule-connection" data-event-id={source.id}>
    <details>
      <summary><Icon name={entry.type === 'transfer' ? 'train' : 'calendar'} size={14} />
        <span>{scheduleClock(source)} · {source.row.title}{scheduleActivity(source.row) ? ` · ${scheduleActivity(source.row)}` : ''}</span>
        {source.row.fields.진행상태?.trim() !== '예정' && <StatusChips statuses={{ 진행상태: source.row.fields.진행상태 }} />}
      </summary>
      <p className="schedule-stop-note">{entry.type === 'transfer' ? entry.resolved ? '연결 방문 확인 · 이동 기록' : '이동 기록 · 연결 순서 미확인' : source.reasons.join(' · ')}</p>
      <ScheduleEventDetails row={source.row} bookings={bookings} tripZone={zone} inline />
    </details>
  </li>;
}

export default function ScheduleTimeline({ rows, zone, bookings = [], now, date = 'all', query = '', heading = true }) {
  const { days } = buildScheduleTimeline(rows, { zone, date }, query);
  if (!days.length) return <p className="travel-empty">{query.trim() ? '조건에 맞는 항목이 없습니다.' : '등록된 일정이 없습니다.'}</p>;
  return <div className="schedule-timeline">{days.map(day => <section className="schedule-timeline-day" key={day.date ?? 'undated'} aria-label={day.date ?? '날짜 미정'}>
    {heading && <h3 className="schedule-day-heading"><Icon name="calendar" size={17} />{day.date ?? '날짜 미정'}</h3>}
    {day.planned && <p className="schedule-order-note">계획 순서 · 시각을 추정하지 않습니다.</p>}
    {day.warnings.map(warning => <p key={warning.message} className="schedule-order-note">{warning.message}</p>)}
    <ol className="schedule-stop-list">
      {day.entries.map(entry => entry.type === 'visit' ? <Visit key={entry.id} group={entry.group} bookings={bookings} now={now} zone={zone} />
        : <Connection key={entry.id} entry={entry} bookings={bookings} zone={zone} />)}
    </ol>
    {day.unplaced.length > 0 && <div className="schedule-unplaced">
      <p className="schedule-stop-note">추가 기록 · 방문 사이의 위치 미확정</p>
      <ol className="schedule-stop-list">{day.unplaced.map(entry => <Connection key={entry.id} entry={entry} bookings={bookings} zone={zone} />)}</ol>
    </div>}
  </section>)}</div>;
}
