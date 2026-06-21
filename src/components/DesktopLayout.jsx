import { useApp as useStore, getCurrentTrip } from '../store';
import HomeScreen from './HomeScreen';
import OverviewTab from './OverviewTab';
import BookingTab from './BookingTab';
import BudgetTab from './BudgetTab';
import MemoTab from './MemoTab';
import CheckTab from './CheckTab';
import TabBar from './TabBar';
import { Icon } from '../icons';

function dday(dateStr) {
  const diff = Math.ceil((new Date(dateStr) - new Date()) / 86400000);
  if (diff > 0) return `D-${diff}`;
  if (diff === 0) return 'D-day';
  return '완료';
}

function Sidebar() {
  const { trips, openTrip, currentTripId, requireLogin } = useStore(s => ({
    trips: s.trips, openTrip: s.openTrip,
    currentTripId: s.currentTripId, requireLogin: s.requireLogin,
  }));

  return (
    <div style={{
      width: 280, flexShrink: 0, background: 'var(--bg-app)',
      borderRight: '1px solid var(--card-border)',
      display: 'flex', flexDirection: 'column', height: '100vh',
      position: 'sticky', top: 0,
    }}>
      <div style={{ padding: '24px 20px 16px' }}>
        <div style={{ fontFamily: 'var(--ff-serif)', fontStyle: 'italic', color: 'var(--ink-sub)', fontSize: 13, marginBottom: 2 }}>
          こんにちは, Shin
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', color: 'var(--ink)' }}>내 여행</h2>
          <button onClick={() => requireLogin('create')} style={{
            width: 30, height: 30, borderRadius: 15,
            background: 'var(--primary)', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="plus" size={14} color="#fff" />
          </button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '0 12px 20px' }}>
        {trips.map(t => (
          <div key={t.id} onClick={() => openTrip(t.id)} style={{
            padding: '11px 12px', borderRadius: 12, marginBottom: 4, cursor: 'pointer',
            background: currentTripId === t.id ? 'var(--primary-tint)' : 'transparent',
            border: currentTripId === t.id ? '1px solid rgba(226,96,63,.2)' : '1px solid transparent',
            transition: 'all .15s',
          }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: currentTripId === t.id ? 'var(--primary)' : 'var(--ink)' }}>
              {t.name}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-muted)', marginTop: 2 }}>
              {t.dest} · {dday(t.startDate)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const TAB_MAP = {
  overview: OverviewTab,
  booking: BookingTab,
  budget: BudgetTab,
  memo: MemoTab,
  check: CheckTab,
};

export default function DesktopLayout({ overlays }) {
  const { screen, tab, trips, currentTripId, setOverlay } = useStore(s => ({
    screen: s.screen, tab: s.tab,
    trips: s.trips, currentTripId: s.currentTripId, setOverlay: s.setOverlay,
  }));

  const trip = getCurrentTrip(trips, currentTripId);
  const TabContent = TAB_MAP[tab] || OverviewTab;

  return (
    <div style={{ display: 'flex', width: '100%', minHeight: '100dvh' }}>
      <Sidebar />
      <div style={{ flex: 1, overflow: 'auto' }}>
        {screen === 'home' ? (
          <HomeScreen />
        ) : trip ? (
          <>
            {/* desktop detail header */}
            <div style={{
              padding: '20px 28px 0', borderBottom: '1px solid var(--card-border)',
              background: 'var(--bg-app)', position: 'sticky', top: 0, zIndex: 10,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.02em' }}>{trip.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-sub)', marginTop: 2 }}>{trip.dest}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setOverlay('ai')} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                    background: 'var(--primary)', border: 'none', borderRadius: 10, cursor: 'pointer',
                    color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'var(--ff-sans)',
                  }}>
                    <Icon name="sparkles" size={14} color="#fff" />AI 추천
                  </button>
                  <button onClick={() => setOverlay('menu')} style={{
                    width: 36, height: 36, borderRadius: 10, border: 'none',
                    background: 'rgba(43,38,34,.07)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon name="moreVert" size={18} color="var(--ink)" strokeWidth={2} />
                  </button>
                </div>
              </div>
              <TabBar />
            </div>
            <div style={{ padding: '0' }}>
              <TabContent />
            </div>
          </>
        ) : (
          <HomeScreen />
        )}
      </div>
      {overlays}
    </div>
  );
}
