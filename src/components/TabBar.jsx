import { useApp as useStore } from '../store';

const TABS = [
  { id: 'overview', label: '개요' },
  { id: 'booking', label: '예약' },
  { id: 'budget', label: '예산' },
  { id: 'memo', label: '메모' },
  { id: 'check', label: '체크' },
];

export default function TabBar() {
  const { tab, setTab } = useStore(s => ({ tab: s.tab, setTab: s.setTab }));

  return (
    <div style={{
      display: 'flex', background: 'var(--bg-app)',
      borderBottom: '1px solid var(--card-border)',
      padding: '0 4px',
    }}>
      {TABS.map(t => (
        <button key={t.id} onClick={() => setTab(t.id)} style={{
          flex: 1, padding: '10px 0', border: 'none', background: 'none',
          cursor: 'pointer', fontSize: 13, fontFamily: 'var(--ff-sans)',
          fontWeight: tab === t.id ? 700 : 500,
          color: tab === t.id ? 'var(--primary)' : 'var(--ink-sub)',
          borderBottom: tab === t.id ? '2.5px solid var(--primary)' : '2.5px solid transparent',
          transition: 'color .15s',
        }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
