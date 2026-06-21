import { useApp as useStore, getCurrentTrip } from '../store';
import { Icon } from '../icons';

export default function DetailHeader({ trip }) {
  const { setScreen, setOverlay } = useStore(s => ({ setScreen: s.setScreen, setOverlay: s.setOverlay }));

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 16px 10px',
      background: 'var(--bg-app)',
      borderBottom: '1px solid var(--card-border)',
      position: 'sticky', top: 0, zIndex: 10,
    }}>
      <button onClick={() => setScreen('home')} style={{
        width: 32, height: 32, borderRadius: 16,
        background: 'rgba(43,38,34,.07)', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name="chevronLeft" size={18} color="var(--ink)" />
      </button>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)', lineHeight: 1.2 }}>{trip.name}</div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-sub)' }}>
          {trip.dest} · {dday(trip.startDate)}
        </div>
      </div>
      <button onClick={() => setOverlay('menu')} style={{
        width: 32, height: 32, borderRadius: 16,
        background: 'rgba(43,38,34,.07)', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name="moreVert" size={18} color="var(--ink)" strokeWidth={2.2} />
      </button>
    </div>
  );
}

function dday(dateStr) {
  const diff = Math.ceil((new Date(dateStr) - new Date()) / 86400000);
  if (diff > 0) return `D-${diff}`;
  if (diff === 0) return 'D-day';
  return '완료';
}
