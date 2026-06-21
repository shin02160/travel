import { createPortal } from 'react-dom';
import { useApp as useStore, getCurrentTrip } from './store';
import './styles.css';
import HomeScreen from './components/HomeScreen';
import DetailHeader from './components/DetailHeader';
import TabBar from './components/TabBar';
import BottomNav from './components/BottomNav';
import OverviewTab from './components/OverviewTab';
import BookingTab from './components/BookingTab';
import BudgetTab from './components/BudgetTab';
import MemoTab from './components/MemoTab';
import CheckTab from './components/CheckTab';
import DesktopLayout from './components/DesktopLayout';

import LoginSheet from './components/overlays/LoginSheet';
import NeedLoginModal from './components/overlays/NeedLoginModal';
import CreateTripSheet from './components/overlays/CreateTripSheet';
import FxSheet from './components/overlays/FxSheet';
import AISheet from './components/overlays/AISheet';
import MapSheet from './components/overlays/MapSheet';
import SettingsSheet from './components/overlays/SettingsSheet';
import MenuSheet from './components/overlays/MenuSheet';
import AddCheckSheet from './components/overlays/AddCheckSheet';
import EditEventSheet from './components/overlays/EditEventSheet';
import EditExpenseSheet from './components/overlays/EditExpenseSheet';

const TAB_MAP = {
  overview: OverviewTab,
  booking: BookingTab,
  budget: BudgetTab,
  memo: MemoTab,
  check: CheckTab,
};

export function OverlayManager() {
  const overlay = useStore(s => s.overlay);
  if (!overlay) return null;
  const map = {
    login: LoginSheet,
    needLogin: NeedLoginModal,
    create: CreateTripSheet,
    fx: FxSheet,
    ai: AISheet,
    map: MapSheet,
    settings: SettingsSheet,
    menu: MenuSheet,
    addCheck: AddCheckSheet,
    editEvent: EditEventSheet,
    editExpense: EditExpenseSheet,
  };
  const Component = map[overlay];
  if (!Component) return null;
  return createPortal(<Component />, document.body);
}

function MobileApp() {
  const { screen, tab, trips, currentTripId } = useStore(s => ({
    screen: s.screen, tab: s.tab, trips: s.trips, currentTripId: s.currentTripId,
  }));

  const trip = getCurrentTrip(trips, currentTripId);
  const TabContent = TAB_MAP[tab] || OverviewTab;

  return (
    <div className="phone-frame">
      <div className="scroll-area">
        {screen === 'home' ? (
          <HomeScreen />
        ) : (
          <>
            {trip && <DetailHeader trip={trip} />}
            <TabBar />
            <TabContent />
          </>
        )}
      </div>
      <BottomNav />
      <OverlayManager />
    </div>
  );
}

export default function App() {
  const isDesktop = window.innerWidth >= 1024;

  if (isDesktop) {
    return (
      <div style={{ width: '100%', minHeight: '100dvh', background: 'var(--bg-app)' }}>
        <DesktopLayout overlays={<OverlayManager />} />
      </div>
    );
  }

  return <MobileApp />;
}
