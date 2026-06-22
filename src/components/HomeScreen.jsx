import { useApp as useStore } from '../store';
import { Icon } from '../icons';

function dday(dateStr) {
  const today = new Date();
  const target = new Date(dateStr);
  const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  if (diff > 0) return `D-${diff}`;
  if (diff === 0) return 'D-day';
  return '완료';
}

function TripCard({ trip }) {
  const openTrip = useStore(s => s.openTrip);
  const dd = dday(trip.startDate);
  const isDone = trip.status === 'done';

  return (
    <div onClick={() => openTrip(trip.id)} style={{
      borderRadius: 16,
      overflow: 'hidden',
      background: '#ddd',
      boxShadow: 'var(--shadow-card)',
      cursor: 'pointer',
      position: 'relative',
      marginBottom: 14,
    }}>
      {/* Hero image */}
      <div style={{
        height: 152, position: 'relative',
        background: isDone
          ? 'linear-gradient(135deg, #5E7A6B, #3A5247)'
          : 'linear-gradient(135deg, #C2553B, #8B3A28)',
        overflow: 'hidden',
      }}>
        <img
          src={trip.photo.startsWith('/') ? trip.photo : `https://images.unsplash.com/${trip.photo}?w=400&q=70&fit=crop`}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: .85 }}
          loading="lazy"
        />
        {/* gradient overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, transparent 40%, rgba(20,12,8,.7) 100%)',
        }} />
        {/* D-day badge */}
        <div style={{
          position: 'absolute', top: 12, left: 12,
          background: isDone ? 'rgba(46,58,51,.85)' : 'var(--primary)',
          color: '#fff', borderRadius: 20, padding: '3px 10px',
          fontSize: 12, fontWeight: 700, fontFamily: 'var(--ff-serif)',
        }}>{dd}</div>
        {/* status badge */}
        <div style={{
          position: 'absolute', top: 12, right: 12,
          background: 'rgba(255,255,255,.18)', backdropFilter: 'blur(8px)',
          color: '#fff', borderRadius: 20, padding: '3px 10px',
          fontSize: 11, fontWeight: 600,
        }}>{isDone ? '완료' : '예정'}</div>
        {/* title on image */}
        <div style={{ position: 'absolute', bottom: 14, left: 16 }}>
          <div style={{ fontFamily: 'var(--ff-serif)', fontStyle: 'italic', color: 'rgba(255,255,255,.8)', fontSize: 12 }}>
            {trip.destEn}
          </div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 18, letterSpacing: '-.02em' }}>
            {trip.name}
          </div>
        </div>
      </div>
      {/* meta bar */}
      <div style={{
        background: '#fff', padding: '10px 16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--ink-sub)', fontWeight: 500 }}>{trip.dest}</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-body)', fontWeight: 500 }}>
            {trip.startDate.slice(5).replace('-', '.')} – {trip.endDate.slice(5).replace('-', '.')}
          </div>
        </div>
        <div style={{
          fontFamily: 'var(--ff-serif)', fontSize: 15, fontWeight: 600,
          color: isDone ? 'var(--ink-sub)' : 'var(--primary)',
        }}>
          {trip.currency === 'JPY' ? '¥' : '₩'}{trip.budget.toLocaleString()}
        </div>
      </div>
    </div>
  );
}

export default function HomeScreen() {
  const { trips, requireLogin, tripFilter, setTripFilter, setOverlay } = useStore(s => ({
    trips: s.trips,
    requireLogin: s.requireLogin,
    tripFilter: s.tripFilter,
    setTripFilter: s.setTripFilter,
    setOverlay: s.setOverlay,
  }));

  const sorted = [...trips].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  const filtered = tripFilter === '예정'
    ? sorted.filter(t => t.status !== 'done')
    : tripFilter === '완료'
    ? sorted.filter(t => t.status === 'done')
    : sorted;

  return (
    <div style={{ padding: '24px 20px 100px' }}>
      {/* greeting */}
      <div style={{ fontFamily: 'var(--ff-serif)', fontStyle: 'italic', color: 'var(--ink-sub)', fontSize: 14, marginBottom: 2 }}>
        こんにちは, Shin
      </div>
      {/* title row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.02em', color: 'var(--ink)' }}>내 여행</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{
            width: 36, height: 36, borderRadius: 18,
            background: 'rgba(43,38,34,.08)', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="search" size={18} color="var(--ink-sub)" />
          </button>
          <button onClick={() => requireLogin('create')} style={{
            width: 36, height: 36, borderRadius: 18,
            background: 'var(--primary)', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--shadow-primary)',
          }}>
            <Icon name="plus" size={18} color="#fff" />
          </button>
        </div>
      </div>

      {/* filter chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {['출발 임박순', '예정', '완료'].map(f => (
          <button key={f} onClick={() => setTripFilter(f)} style={{
            padding: '7px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
            background: tripFilter === f ? 'var(--ink)' : 'rgba(43,38,34,.08)',
            color: tripFilter === f ? '#fff' : 'var(--ink-body)',
            fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--ff-sans)',
            minHeight: 36,
          }}>{f}</button>
        ))}
      </div>

      {/* trip cards */}
      {filtered.map(t => <TripCard key={t.id} trip={t} />)}
    </div>
  );
}
