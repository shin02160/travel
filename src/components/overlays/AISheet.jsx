import { useState, useEffect, useRef } from 'react';
import { useApp as useStore, getCurrentTrip } from '../../store';
import { Sheet } from '../Overlay';
import { Icon } from '../../icons';

const SUGGESTIONS = [
  { time: '11:00', title: '요코하마 차이나타운', note: '숙소 인근 도보 이동. 런치타임 전 도착 추천 (11:30 이후 웨이팅)' },
  { time: '13:30', title: '미나토미라이 워크', note: '사쿠라기초 → 코스모 월드 → 랜드마크 타워 산책 코스' },
  { time: '15:00', title: '공연장 사전 도착', note: '피아 아레나 MM 도보 11분. MD 줄 일찍 서기 권장' },
  { time: '21:00', title: '요코하마 항구 야경', note: '공연 후 미나토미라이 야경 산책. 코스모 월드 야간 운영' },
];

export default function AISheet() {
  const { closeOverlay, trips, currentTripId, bookings, timeline } = useStore(s => ({
    closeOverlay: s.closeOverlay,
    trips: s.trips,
    currentTripId: s.currentTripId,
    bookings: s.bookings,
    timeline: s.timeline,
  }));

  const trip = getCurrentTrip(trips, currentTripId);
  const concertBooking = bookings.find(b => b.type === 'concert');
  const nights = trip?.nights || 0;
  const dest = trip?.dest || '';

  const AI_TEXT = `${dest} ${nights}박 ${nights + 1}일 일정을 분석했습니다.${concertBooking ? ` ${concertBooking.title}을 중심으로` : ''} 효율적인 동선을 제안해 드릴게요.\n\n숙소(사쿠라기초 워싱턴)에서 공연장(피아 아레나 MM)까지 도보 11분으로 이동이 매우 편리합니다. 공연 전후 미나토미라이 지역 탐방을 추천합니다.`;

  const [text, setText] = useState('');
  const [done, setDone] = useState(false);
  const idx = useRef(0);

  useEffect(() => {
    idx.current = 0;
    setText('');
    setDone(false);
    const interval = setInterval(() => {
      if (idx.current < AI_TEXT.length) {
        setText(AI_TEXT.slice(0, idx.current + 1));
        idx.current++;
      } else {
        setDone(true);
        clearInterval(interval);
      }
    }, 20);
    return () => clearInterval(interval);
  }, []);

  return (
    <Sheet onClose={closeOverlay} title="" style={{ maxHeight: '88dvh' }}>
      <div style={{ padding: '4px 20px 32px' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 18,
            background: 'linear-gradient(135deg, var(--dark-card-from), var(--dark-card-to))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="sparkles" size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>Claude AI</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-muted)' }}>일정 최적화 추천</div>
          </div>
          <button onClick={closeOverlay} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}>
            <Icon name="x" size={20} color="var(--ink-sub)" />
          </button>
        </div>

        {/* streaming bubble */}
        <div style={{
          background: 'rgba(43,38,34,.05)', borderRadius: '4px 14px 14px 14px',
          padding: '13px 15px', marginBottom: 16,
          fontSize: 13.5, color: 'var(--ink-body)', lineHeight: 1.65, whiteSpace: 'pre-wrap',
        }}>
          {text}
          {!done && (
            <span style={{
              display: 'inline-block', width: 2, height: 14, background: 'var(--ink)',
              marginLeft: 2, verticalAlign: 'middle',
              animation: 'carot 1s steps(1) infinite',
            }} />
          )}
        </div>

        {/* suggestion cards */}
        {done && SUGGESTIONS.map((s, i) => (
          <div key={i} style={{
            background: '#fff', borderRadius: 14, padding: '13px 14px', marginBottom: 10,
            boxShadow: 'var(--shadow-card)', border: '1px solid var(--card-border)',
            display: 'flex', gap: 12, alignItems: 'flex-start',
          }}>
            <div style={{
              fontFamily: 'var(--ff-serif)', fontSize: 13, color: 'var(--primary)',
              fontWeight: 600, minWidth: 38, paddingTop: 1,
            }}>{s.time}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 3 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-sub)', lineHeight: 1.5 }}>{s.note}</div>
            </div>
            <button style={{
              background: 'var(--primary-tint)', border: 'none', borderRadius: 8, cursor: 'pointer',
              color: 'var(--primary)', fontSize: 12, fontWeight: 700, padding: '5px 10px',
              fontFamily: 'var(--ff-sans)', flexShrink: 0,
            }}>추가</button>
          </div>
        ))}
      </div>
    </Sheet>
  );
}
