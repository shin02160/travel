import { useState, useEffect, useRef } from 'react';
import { useApp as useStore } from '../../store';
import { Sheet } from '../Overlay';
import { Icon } from '../../icons';

const SUGGESTIONS = [
  { time: '09:00', title: '아사쿠사 이른 아침 탐방', note: '관광객 몰리기 전 한산한 센소지 감상 추천' },
  { time: '11:30', title: '우에노 공원 피크닉', note: '근처 편의점에서 도시락 구매 후 공원에서 점심' },
  { time: '14:00', title: '아키하바라 → 오카치마치', note: '도보 이동 가능, 빈티지 쇼핑 동선 효율 높음' },
  { time: '18:30', title: '이케부쿠로 선샤인 시티 야경', note: '60층 전망대는 예약 없이 당일 방문 가능' },
];

const AI_TEXT = `도쿄 4박 5일 일정을 분석했습니다. 현재 일정의 동선을 개선할 수 있는 포인트가 있어요.

DAY 2와 DAY 4의 이동 거리가 다소 길어 피로도가 높을 수 있습니다. 아래 추천 일정을 참고해보세요.`;

export default function AISheet() {
  const { closeOverlay } = useStore(s => ({ closeOverlay: s.closeOverlay }));
  const [text, setText] = useState('');
  const [done, setDone] = useState(false);
  const idx = useRef(0);

  useEffect(() => {
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
          fontSize: 13.5, color: 'var(--ink-body)', lineHeight: 1.65,
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
