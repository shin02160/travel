import { useApp as useStore } from '../store';
import { Icon, BookingTypeIcon } from '../icons';

function StatusBadge({ status }) {
  const config = {
    confirmed: { label: '확정', bg: 'var(--green-bg)', color: 'var(--green)' },
    pending: { label: '미확인', bg: 'var(--gold-bg)', color: 'var(--gold)' },
    cancelled: { label: '취소', bg: '#f5f5f5', color: '#999' },
  };
  const c = config[status] || config.pending;
  return (
    <span style={{
      background: c.bg, color: c.color,
      fontSize: 11, fontWeight: 700, borderRadius: 10,
      padding: '3px 8px', whiteSpace: 'nowrap',
    }}>{c.label}</span>
  );
}

function BookingCard({ booking }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: '13px 14px',
      boxShadow: 'var(--shadow-card)', border: '1px solid var(--card-border)',
      display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10,
    }}>
      <BookingTypeIcon type={booking.type} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10.5, color: 'var(--ink-sub)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 1 }}>
          {booking.type === 'flight' ? '항공편' : booking.type === 'hotel' ? '숙소' : booking.type === 'concert' ? '공연' : '교통'}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {booking.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-sub)' }}>{booking.sub}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <StatusBadge status={booking.status} />
        {booking.code && (
          <div style={{ fontSize: 11, color: 'var(--ink-muted)', fontFamily: 'var(--ff-serif)', marginTop: 3 }}>
            {booking.code}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BookingTab() {
  const { bookings, requireLogin } = useStore(s => ({
    bookings: s.bookings,
    requireLogin: s.requireLogin,
  }));

  return (
    <div style={{ padding: '16px 16px 100px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>예약 {bookings.length}건</span>
        <button onClick={() => requireLogin('addBooking')} style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--primary)', fontSize: 13, fontWeight: 700, fontFamily: 'var(--ff-sans)',
        }}>
          <Icon name="plus" size={16} color="var(--primary)" />추가
        </button>
      </div>

      {bookings.map(b => <BookingCard key={b.id} booking={b} />)}

      {/* Notion export */}
      <button style={{
        width: '100%', marginTop: 6, padding: '13px',
        background: 'none',
        border: '1.5px dashed rgba(43,38,34,.2)',
        borderRadius: 14, cursor: 'pointer',
        color: 'var(--ink-sub)', fontSize: 13, fontWeight: 600, fontFamily: 'var(--ff-sans)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        <Icon name="sync" size={15} color="var(--ink-sub)" />
        Notion DB로 내보내기
      </button>
    </div>
  );
}
