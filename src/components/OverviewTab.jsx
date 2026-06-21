import { useApp as useStore, computeCheckItems, getCurrentTrip } from '../store';
import { Icon } from '../icons';

function StatCard({ label, value, sub, accent, progress }) {
  return (
    <div style={{
      flex: 1, background: '#fff', borderRadius: 14, padding: '12px 14px',
      boxShadow: 'var(--shadow-card)', border: '1px solid var(--card-border)',
    }}>
      <div style={{ fontSize: 11, color: 'var(--ink-sub)', fontWeight: 500, marginBottom: 4 }}>{label}</div>
      <div style={{
        fontSize: 22, fontWeight: 800, fontFamily: 'var(--ff-serif)',
        color: accent || 'var(--ink)', letterSpacing: '-.02em',
      }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 2 }}>{sub}</div>}
      {progress !== undefined && (
        <div style={{ marginTop: 6, height: 3, borderRadius: 2, background: 'rgba(43,38,34,.1)' }}>
          <div style={{
            height: '100%', borderRadius: 2, background: 'var(--primary)',
            width: `${progress}%`, transition: 'width .4s ease',
          }} />
        </div>
      )}
    </div>
  );
}

function TimelineDay({ day, isLast }) {
  return (
    <div style={{ marginBottom: isLast ? 0 : 20 }}>
      <div style={{
        fontSize: 12, fontWeight: 700,
        color: day.concert ? 'var(--primary)' : 'var(--ink-sub)',
        marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span>DAY {day.day}</span>
        <span style={{ fontWeight: 500 }}>· {day.date}</span>
        {day.concert && <span style={{ fontSize: 11, background: 'var(--primary-tint)', color: 'var(--primary)', borderRadius: 10, padding: '1px 7px', fontWeight: 600 }}>공연일</span>}
      </div>
      <div style={{ paddingLeft: 12, borderLeft: `2px solid ${day.concert ? 'var(--primary)' : 'rgba(43,38,34,.15)'}` }}>
        {day.events.map((ev, i) => (
          <div key={i} style={{
            display: 'flex', gap: 10, marginBottom: i < day.events.length - 1 ? 10 : 0,
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute', left: -16, top: 5,
              width: 8, height: 8, borderRadius: 4,
              background: ev.highlight ? 'var(--primary)' : 'rgba(43,38,34,.2)',
              boxShadow: ev.highlight ? '0 0 0 4px rgba(226,96,63,.2)' : 'none',
            }} />
            <div style={{ fontSize: 12, color: 'var(--ink-muted)', width: 38, flexShrink: 0, fontFamily: 'var(--ff-serif)', paddingTop: 2 }}>
              {ev.time}
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: ev.highlight ? 700 : 500, color: ev.highlight ? 'var(--primary)' : 'var(--ink-body)' }}>
                {ev.title}
              </div>
              {ev.sub && <div style={{ fontSize: 11.5, color: 'var(--ink-muted)' }}>{ev.sub}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OverviewTab() {
  const { trips, currentTripId, timeline, checks, addedChecks, deletedChecks, setOverlay } = useStore(s => ({
    trips: s.trips,
    currentTripId: s.currentTripId,
    timeline: s.timeline,
    checks: s.checks,
    addedChecks: s.addedChecks,
    deletedChecks: s.deletedChecks,
    setOverlay: s.setOverlay,
  }));
  const trip = getCurrentTrip(trips, currentTripId);
  const checkItems = computeCheckItems(checks, addedChecks, deletedChecks);
  const allChecks = Object.values(checkItems).flat();
  const done = allChecks.filter(i => i.checked).length;
  const total = allChecks.length;
  const pct = total ? Math.round(done / total * 100) : 0;

  const spent = 158200;
  const remaining = trip.budget - spent;
  const budgetPct = Math.round(spent / trip.budget * 100);

  const diff = Math.ceil((new Date(trip.startDate) - new Date()) / 86400000);

  return (
    <div style={{ padding: '16px 16px 100px' }}>
      {/* hero */}
      <div style={{
        borderRadius: 16, overflow: 'hidden', marginBottom: 14, position: 'relative',
        height: 130,
        background: 'linear-gradient(135deg, #C2553B, #8B3A28)',
      }}>
        <img
          src={`https://images.unsplash.com/${trip.photo}?w=600&q=70&fit=crop`}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: .8 }}
        />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, transparent 20%, rgba(20,12,8,.65) 100%)',
        }} />
        <div style={{ position: 'absolute', bottom: 14, left: 16 }}>
          <div style={{ fontFamily: 'var(--ff-serif)', fontStyle: 'italic', color: 'rgba(255,255,255,.75)', fontSize: 12 }}>
            {trip.destEn}
          </div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 18, letterSpacing: '-.02em' }}>{trip.name}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', marginTop: 2 }}>
            {trip.startDate.slice(5).replace('-','.')} – {trip.endDate.slice(5).replace('-','.')} · {trip.nights}박 {trip.nights+1}일
          </div>
        </div>
      </div>

      {/* stat cards */}
      <div style={{ display: 'flex', gap: 9, marginBottom: 20 }}>
        <StatCard label="출발까지" value={diff > 0 ? `D-${diff}` : 'D-day'} accent="var(--primary)" />
        <StatCard label="준비 완료" value={`${pct}%`} progress={pct} />
        <StatCard
          label="잔여 예산"
          value={`¥${remaining.toLocaleString()}`}
          sub={`/ ¥${trip.budget.toLocaleString()}`}
        />
      </div>

      {/* timeline */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>타임라인</span>
        <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>{trip.nights+1}일 전체</span>
      </div>
      {timeline.map((day, i) => (
        <TimelineDay key={day.day} day={day} isLast={i === timeline.length - 1} />
      ))}

      {/* AI button */}
      <button onClick={() => setOverlay('ai')} style={{
        width: '100%', marginTop: 24, padding: '14px',
        background: 'linear-gradient(135deg, var(--dark-card-from), var(--dark-card-to))',
        border: 'none', borderRadius: 14, cursor: 'pointer',
        color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'var(--ff-sans)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        <Icon name="sparkles" size={16} color="#fff" />
        AI로 일정 최적화하기
      </button>
    </div>
  );
}
