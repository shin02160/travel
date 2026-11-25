import { useMemo, useState } from 'react';
import { buildRouteModel, initialRouteDate } from '../routeMapModel.js';
import { tripCalendar } from '../todaySchedule.js';
import RouteCanvas from './RouteCanvas.jsx';
import ScheduleEventDetails from './ScheduleEventDetails.jsx';
import { scheduleActivity } from '../scheduleIdentity.js';
import './ScheduleRouteMap.css';

export default function ScheduleRouteMap({ trip, rows, bookings = [], now, selectedDate, onDateChange }) {
  const calendar = tripCalendar(trip, now);
  const start = calendar.start ? String(calendar.start) : null;
  const end = calendar.end ? String(calendar.end) : null;
  const zone = calendar.zone ? String(calendar.zone) : null;
  const today = calendar.today;
  const all = useMemo(() => buildRouteModel(rows, { date: 'all', start, end, zone }), [rows, start, end, zone]);
  const date = selectedDate === 'all' || all.dates.includes(selectedDate) ? selectedDate
    : initialRouteDate(all, { start, end, today });
  const model = useMemo(() => date === 'all' ? all : buildRouteModel(rows, { date, start, end, zone }), [all, rows, date, start, end, zone]);
  const [selectedId, setSelectedId] = useState(null);
  const selected = model.visitGroups.find(group => group.id === selectedId);
  const legendDates = (date === 'all' ? all.dates.filter(day => model.rows.some(row => row.date === day)) : [date]).filter(Boolean);

  return <div className="schedule-route-map">
    <div className="route-date-choices" role="group" aria-label="동선 날짜 선택">
      <button type="button" aria-pressed={date === 'all'} onClick={() => onDateChange('all')}>전체</button>
      {all.dates.map(day => <button key={day} type="button" aria-pressed={date === day} onClick={() => onDateChange(day)}>{day}</button>)}
    </div>
    {!all.validPeriod && <p className="route-row-note">여행 기간을 확인해 주세요. 일정에 등록된 날짜로 표시합니다.</p>}
    {!zone && <p className="route-row-note">여행 시간대 확인 필요 · 날짜는 원본 일정의 현지 일자를 유지합니다.</p>}
    {all.truncated && <p className="route-row-note">여행 기간의 첫 366일과 실제 일정이 있는 날짜를 표시합니다.</p>}
    {all.rows.some(row => !row.date) && date !== 'all' && <p className="route-row-note">날짜 미정 일정은 전체 보기에서 확인할 수 있습니다.</p>}
    <p role="status">일정 {model.counts.total}건 · 방문 {model.counts.visits}곳 · 지도 {model.counts.mapped}/{model.counts.visits}곳 · 위치 미확인 {model.counts.missing}곳</p>
    <p className="route-row-note">이동 구간 {model.counts.transfers}건 · 순서 미확정 {model.counts.unordered}곳 · 취소 {model.counts.cancelled}건 · 사적 장소 제외 {model.counts.private}건</p>
    {model.warnings.map(({ date, message }) => <p key={`${date}:${message}`} className="route-row-note">{date ?? '날짜 미정'} · {message} · 확정된 방문 구간은 유지하며, 연결 보류 사유는 아래에서 확인할 수 있습니다.</p>)}
    {model.transfers.some(item => !item.resolved && !item.cancelled) && <p className="route-row-note">일부 이동 기록의 방문 매칭을 확인하지 못했습니다. 점선은 이동 기록과 독립적으로 방문 순서에 따라 표시합니다.</p>}
    <div className="route-legend" aria-label="일자별 동선 색상">{legendDates.map(day => {
      const color = all.rows.find(row => row.date === day)?.color;
      return <span key={day}><i style={{ backgroundColor: color?.line ?? '#66736e' }} aria-hidden="true" />{day}</span>;
    })}</div>
    <div className="route-layout">
      <div className="route-map-column">
        {model.points.length ? <RouteCanvas model={model} bookings={bookings} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
          : <p className="travel-empty">{model.rows.length ? '표시할 위치가 없습니다. Notion 일정에 확인된 WGS84 위도·경도를 등록해 주세요.' : '이 날짜에 등록된 일정이 없습니다.'}</p>}
        <p className="route-map-disclaimer">점선은 방문 순서를 나타내며 실제 이동 경로가 아닙니다.</p>
      </div>
      <ol className="route-visit-list" aria-label="동선 방문 순서">
        {model.visitGroups.map(item => <li className="travel-reader-card" key={item.id} data-selected={selected?.id === item.id}>
          <button type="button" aria-pressed={selected?.id === item.id} onClick={() => setSelectedId(item.id)}>
            <span className="route-list-number" style={{ backgroundColor: item.color.fill }}>{item.number ?? '•'}</span>
            <span><small>{item.date ?? '날짜 미정'} {item.time ?? (item.reasons.includes('종일') ? '종일' : '시간 미정')}</small><strong>{item.row.title}</strong></span>
          </button>
          <p>{item.row.fields.장소 || '장소 미입력'} · {item.row.fields.진행상태 || '상태 미입력'}</p>
          {item.outOfPeriod && <p className="route-row-note">여행 기간 밖 일정</p>}
          {item.reasons.length > 0 && <p className="route-row-note">{item.reasons.join(' · ')}</p>}
          <ul className="route-group-activities" aria-label={`${item.row.title} 활동`}>
            {item.events.map(event => <li key={event.row.id}>
              <p><span className="travel-number">{event.time ?? (event.allDay ? '종일' : '시간 미정')}</span> · {scheduleActivity(event.row) ?? '활동 미입력'} · {event.row.fields.진행상태 ?? '상태 미입력'}</p>
              <ScheduleEventDetails row={event.row} bookings={bookings} />
            </li>)}
          </ul>
        </li>)}
      </ol>
    </div>
    {model.omittedSegments.length > 0 && <section className="route-records" aria-label="동선 연결 보류 사유">
      <h3>연결을 보류한 구간</h3>
      {model.omittedSegments.map(item => <p key={`${item.fromId}:${item.toId}`} className="route-row-note">
        {item.date ?? '날짜 미정'} · {model.visitGroups.find(group => group.id === item.fromId)?.row.title} → {model.visitGroups.find(group => group.id === item.toId)?.row.title}: {item.reasons.join(' · ')}
      </p>)}
    </section>}
    {model.transfers.length > 0 && <section className="route-records" aria-label="이동 구간 기록">
      <h3>이동 구간</h3>
      {model.transfers.map(item => <article className="travel-reader-card" key={item.id}>
        <h4>{item.row.title}</h4>
        <p>{item.date ?? '날짜 미정'} {item.time ?? '시간 미정'} · {scheduleActivity(item.row) ?? '활동 미입력'}</p>
        <p>{item.cancelled ? '취소' : item.resolved ? '양쪽 방문 확인 · 방문 번호 없이 연결' : '방문 연결 미확인'}</p>
        <ScheduleEventDetails row={item.row} bookings={bookings} />
      </article>)}
    </section>}
    {model.rows.some(item => item.cancelled || item.kind === 'private') && <section className="route-records" aria-label="지도 제외 일정">
      <h3>지도 제외 일정</h3>
      {model.rows.filter(item => item.cancelled || item.kind === 'private').map(item => <article className="travel-reader-card" key={item.id}>
        <h4>{item.row.title}</h4><p>{item.reasons.join(' · ')}</p>
      </article>)}
    </section>}
  </div>;
}
