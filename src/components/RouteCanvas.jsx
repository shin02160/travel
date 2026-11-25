import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { routeDisplayPositions } from '../routeMapModel.js';
import { routeTileConfig } from '../routeTileConfig.js';
import { scheduleActivity } from '../scheduleIdentity.js';
import { safeScheduleMapUrl, safeScheduleSourceUrl } from '../mapLinks.js';

function popup(point, neighbours, select, bookings) {
  const container = document.createElement('div');
  for (const text of [`${point.date} ${point.time ?? '시간 미정'} · ${point.number ?? '보조 장소'}`,
    point.row.title, point.row.fields.장소 || '장소 미입력', point.row.fields.진행상태 || '상태 미입력']) {
    const line = document.createElement('p');
    line.textContent = text;
    container.append(line);
  }
  if (point.planned) {
    const note = document.createElement('p');
    note.textContent = '계획 순서 · 시각 추정 없음';
    container.append(note);
  }
  for (const event of point.events) {
    const block = document.createElement('div');
    for (const text of [event.row.title, `${event.time ?? (event.allDay ? '종일' : '시간 미정')} · ${scheduleActivity(event.row) ?? '활동 미입력'}`,
      event.row.fields.진행상태, event.row.note,
      ...bookings.filter(booking => event.row.bookingIds?.includes(booking.id)).map(booking => `관련 예약: ${booking.title}`)].filter(Boolean)) {
      const line = document.createElement('p');
      line.textContent = text;
      block.append(line);
    }
    for (const [name, href] of [['외부 지도 열기', safeScheduleMapUrl(event.row.mapUrl)], ['Notion 원본', safeScheduleSourceUrl(event.row.sourceUrl)]]) {
      if (!href) continue;
      const link = document.createElement('a');
      link.textContent = name;
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      block.append(link);
    }
    container.append(block);
  }
  if (neighbours.length > 1) {
    const note = document.createElement('p');
    note.textContent = '겹친 장소 · 방문 선택';
    container.append(note);
    neighbours.forEach(other => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `${other.date} ${other.number ?? '•'} · ${other.row.title}`;
      button.addEventListener('click', () => select(other.id));
      container.append(button);
    });
  }
  return container;
}

export default function RouteCanvas({ model, bookings, selectedId, onSelect }) {
  const containerRef = useRef(null), mapRef = useRef(null), tileRef = useRef(null);
  const markersRef = useRef(new Map()), fitRef = useRef(null), tileFault = useRef(false);
  const leafletRef = useRef(null), tileTimerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [tileState, setTileState] = useState('loading');

  useEffect(() => {
    let map, observer;
    let active = true;
    const markers = markersRef.current;
    import('leaflet').then(L => {
    if (!active) return;
    leafletRef.current = L;
    try {
      const config = routeTileConfig(import.meta.env);
      if (!config) throw new Error('tile_configuration');
      map = L.map(containerRef.current, { scrollWheelZoom: false });
      mapRef.current = map;
      const credit = document.createElement('a');
      credit.href = config.link;
      credit.textContent = config.name;
      credit.target = '_blank';
      credit.rel = 'noopener noreferrer';
      const tiles = L.tileLayer(config.template, {
        attribution: credit.outerHTML, maxZoom: 19, updateWhenIdle: true, keepBuffer: 1,
        referrerPolicy: 'strict-origin-when-cross-origin',
      });
      tiles.on('tileerror', () => { tileFault.current = true; setTileState('error'); });
      tiles.on('load', () => { clearTimeout(tileTimerRef.current); if (!tileFault.current) setTileState('ready'); });
      tiles.addTo(map);
      tileRef.current = tiles;
      tileTimerRef.current = setTimeout(() => setTileState(state => state === 'loading' ? 'error' : state), 12000);
      observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
      observer.observe(containerRef.current);
      setReady(true);
    } catch { if (active) setError('지도를 초기화하지 못했습니다. 아래 일정 목록이나 타임라인을 이용해 주세요.'); }
    }).catch(() => { if (active) setError('지도 모듈을 불러오지 못했습니다.'); });
    return () => {
      active = false;
      clearTimeout(tileTimerRef.current);
      observer?.disconnect();
      markers.clear();
      map?.remove();
      mapRef.current = null;
      tileRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const L = leafletRef.current;
    let active = true;
    const layer = L.layerGroup().addTo(map);
    const positions = routeDisplayPositions(model.points);
    const markers = new Map();
    try {
      model.segments.forEach(segment => L.polyline([positions.get(segment.fromId), positions.get(segment.toId)],
        { color: segment.color.line, weight: 3, dashArray: '6 6', interactive: false }).addTo(layer));
      model.points.forEach(point => {
        const badge = document.createElement('span');
        badge.className = `route-number${point.number === null ? ' route-number-aux' : ''}`;
        badge.style.backgroundColor = point.color.fill;
        badge.textContent = String(point.number ?? '•');
        const label = `${point.date} ${point.number ?? '보조 장소'} · ${point.row.title}`;
        const marker = L.marker(positions.get(point.id), {
          icon: L.divIcon({ html: badge, className: 'route-marker', iconSize: [32, 32], iconAnchor: [16, 16] }),
          title: label, alt: label, keyboard: true, riseOnHover: true,
        }).addTo(layer);
        marker.bindPopup(() => {
          const origin = map.latLngToContainerPoint(positions.get(point.id));
          const neighbours = model.points.filter(other => origin.distanceTo(map.latLngToContainerPoint(positions.get(other.id))) < 34);
          return popup(point, neighbours, id => { onSelect(id); markers.get(id)?.openPopup(); }, bookings);
        });
        marker.on('click', () => onSelect(point.id));
        markers.set(point.id, marker);
      });
      markersRef.current = markers;
      const fit = () => {
        map.invalidateSize({ pan: false });
        if (positions.size === 1) map.setView([...positions.values()][0], 14, { animate: false });
        else map.fitBounds(L.latLngBounds([...positions.values()]), { padding: [32, 32], maxZoom: 16, animate: false });
      };
      fitRef.current = fit;
      fit();
    } catch { queueMicrotask(() => { if (active) setError('동선 레이어를 표시하지 못했습니다. 아래 일정 목록을 이용해 주세요.'); }); }
    return () => { active = false; layer.remove(); markers.clear(); fitRef.current = null; };
  }, [ready, model, onSelect, bookings]);

  useEffect(() => {
    if (!ready) return;
    const marker = markersRef.current.get(selectedId);
    markersRef.current.forEach((value, id) => {
      value.setZIndexOffset(id === selectedId ? 1000 : 0);
      value.getElement()?.classList.toggle('route-marker-selected', id === selectedId);
    });
    if (marker) { mapRef.current.panTo(marker.getLatLng(), { animate: false }); marker.openPopup(); }
    else mapRef.current?.closePopup();
  }, [selectedId, model, ready]);

  return <div className="route-map-frame">
    <div ref={containerRef} className="route-map-canvas" role="region" aria-label="일정 동선 지도" />
    {error ? <p role="alert">{error}</p> : <>
      {tileState === 'loading' && <p role="status">지도 타일을 불러오는 중입니다.</p>}
      {tileState === 'error' && <p role="alert">지도 타일을 불러오지 못했습니다. 일정 목록은 계속 이용할 수 있습니다.</p>}
      <div className="route-map-actions">
        <button type="button" onClick={() => fitRef.current?.()}>전체 장소 보기</button>
        {tileState === 'error' && <button type="button" onClick={() => {
          tileFault.current = false;
          setTileState('loading');
          clearTimeout(tileTimerRef.current);
          tileTimerRef.current = setTimeout(() => setTileState(state => state === 'loading' ? 'error' : state), 12000);
          tileRef.current?.redraw();
        }}>지도 다시 시도</button>}
      </div>
      <p className="route-map-hint">드래그·확대/축소로 지도 조작 · 확대/축소 버튼과 방문 목록으로도 선택할 수 있습니다.</p>
    </>}
  </div>;
}
