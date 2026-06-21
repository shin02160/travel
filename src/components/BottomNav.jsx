import { useApp as useStore } from '../store';
import { Icon } from '../icons';

const NAV = [
  { id: 'home', label: '홈', icon: 'home' },
  { id: 'map', label: '탐색', icon: 'map' },
  { id: 'ai', label: 'AI', icon: 'sparkles' },
  { id: 'settings', label: '설정', icon: 'settings' },
];

export default function BottomNav() {
  const { screen, overlay, setScreen, setOverlay, openTrip, currentTripId } = useStore(s => ({
    screen: s.screen,
    overlay: s.overlay,
    setScreen: s.setScreen,
    setOverlay: s.setOverlay,
    openTrip: s.openTrip,
    currentTripId: s.currentTripId,
  }));

  const handleNav = (id) => {
    if (id === 'home') {
      setScreen('home');
    } else {
      setOverlay(id);
    }
  };

  const active = (id) => {
    if (id === 'home') return screen === 'home' && !overlay;
    return overlay === id;
  };

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 480,
      background: 'rgba(251,247,240,.95)', backdropFilter: 'blur(12px)',
      borderTop: '1px solid var(--card-border)',
      display: 'flex', zIndex: 20, paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {NAV.map(n => (
        <button key={n.id} onClick={() => handleNav(n.id)} style={{
          flex: 1, padding: '10px 0 12px', border: 'none', background: 'none',
          cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        }}>
          <Icon
            name={n.icon}
            size={22}
            color={active(n.id) ? 'var(--primary)' : 'var(--ink-muted)'}
            strokeWidth={active(n.id) ? 2.2 : 1.7}
          />
          <span style={{
            fontSize: 10, fontFamily: 'var(--ff-sans)', fontWeight: active(n.id) ? 700 : 500,
            color: active(n.id) ? 'var(--primary)' : 'var(--ink-muted)',
          }}>{n.label}</span>
        </button>
      ))}
    </div>
  );
}
