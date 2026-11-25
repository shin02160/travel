import { useMemo, useState } from 'react';
import { buildRouteModel, initialRouteDate } from '../routeMapModel.js';
import { tripCalendar } from '../todaySchedule.js';
import { safeScheduleMapUrl, safeScheduleSourceUrl } from '../mapLinks.js';
import RouteCanvas from './RouteCanvas.jsx';
import './ScheduleRouteMap.css';

function RowLinks({ row }) {
  const mapUrl = safeScheduleMapUrl(row.mapUrl);
  const sourceUrl = safeScheduleSourceUrl(row.sourceUrl);
  return <div className="route-row-links">
    {mapUrl && <a href={mapUrl} target="_blank" rel="noopener noreferrer">외부 지도 열기</a>}
    {sourceUrl && <a href={sourceUrl} target="_blank" rel="noopener noreferrer">Notion 원본</a>}
  </div>;
}

export default function ScheduleRouteMap({ trip, rows, now, selectedDate, onDateChange }) {
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
  const selected = model.rows.find(row => row.id === selectedId);
  const legendDates = (date === 'all' ? all.dates.filter(day => model.rows.some(row => row.date === day)) : [date]).filter(Boolean);

  return <div className="schedule-route-map">
    <div className="route-date-choices" role="group" aria-label="동선 날짜 선택">
      <button type="button" aria-pressed={date === 'all'} onClick={() => onDateChange('all')}>전체</button>
      {all.dates.map(day => <button key={day} type="button" aria-pressed={date === day} onClick={() => onDateChange(day)}>{day}</button>)}
    </div>
    {!all.validPeriod && <p className="route-row-note">여행 기간을 확인해 주세요. 일정에 등록된 날짜로 표시합니다.</p>}
    {all.truncated && <p className="route-row-note">여행 기간의 첫 366일과 실제 일정이 있는 날짜를 표시합니다.</p>}
    {all.rows.some(row => !row.date) && date !== 'all' && <p className="route-row-note">날짜 미정 일정은 전체 보기에서 확인할 수 있습니다.</p>}
    <p role="status">지도 표시 {model.counts.mapped}/{model.counts.total} · 위치 미확인 {model.counts.missing}건 · 취소 {model.counts.cancelled}건</p>
    {model.rows.some(row => row.reasons.includes('시간대·시각 미확인')) && <p className="route-row-note">시각을 확인할 수 없는 일정이 있는 날짜는 순서를 확정할 수 없어 점선을 생략합니다.</p>}
    <div className="route-legend" aria-label="일자별 동선 색상">{legendDates.map(day => {
      const color = all.rows.find(row => row.date === day)?.color;
      return <span key={day}><i style={{ backgroundColor: color?.line ?? '#66736e' }} aria-hidden="true" />{day}</span>;
    })}</div>
    <div className="route-layout">
      <div className="route-map-column">
        {model.points.length ? <RouteCanvas model={model} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
          : <p className="travel-empty">{model.rows.length ? '표시할 위치가 없습니다. Notion 일정에 확인된 WGS84 위도·경도를 등록해 주세요.' : '이 날짜에 등록된 일정이 없습니다.'}</p>}
        <p className="route-map-disclaimer">점선은 방문 순서를 나타내며 실제 이동 경로가 아닙니다.</p>
      </div>
      <ol className="route-visit-list" aria-label="동선 방문 순서">
        {model.rows.map(item => <li className="travel-reader-card" key={item.id} data-selected={selected?.id === item.id}>
          <button type="button" aria-pressed={selected?.id === item.id} onClick={() => setSelectedId(item.id)}>
            <span className="route-list-number" style={{ backgroundColor: item.color.fill }}>{item.number ?? '•'}</span>
            <span><small>{item.date ?? '날짜 미정'} {item.time ?? (item.reasons.includes('종일') ? '종일' : '시간 미정')}</small><strong>{item.row.title}</strong></span>
          </button>
          <p>{item.row.fields.장소 || '장소 미입력'} · {item.row.fields.진행상태 || '상태 미입력'}</p>
          {item.outOfPeriod && <p className="route-row-note">여행 기간 밖 일정</p>}
          {item.reasons.length > 0 && <p className="route-row-note">{item.reasons.join(' · ')}</p>}
          <RowLinks row={item.row} />
        </li>)}
      </ol>
    </div>
  </div>;
}
