import { useApp as useStore } from '../../store';
import { Sheet } from '../Overlay';
import { Icon } from '../../icons';

const PIN_COLORS = { '공연': '#E2603F', '숙박': '#7A6BA0', '맛집': '#2F8A55' };

export default function MapSheet() {
  const { closeOverlay, places } = useStore(s => ({ closeOverlay: s.closeOverlay, places: s.places }));

  return (
    <Sheet onClose={closeOverlay} title="탐색 · 지도">
      <div style={{ padding: '0 0 32px' }}>
        {/* map placeholder */}
        <div style={{
          height: 200, background: 'linear-gradient(135deg, #c8d8c8, #a8c0a0)',
          position: 'relative', overflow: 'hidden',
        }}>
          <img
            src="https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&q=60&fit=crop"
            alt="map"
            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: .6, filter: 'saturate(.7)' }}
          />
          {/* pins */}
          {places.map((p, i) => (
            <div key={p.id} style={{
              position: 'absolute',
              top: 40 + i * 50, left: 60 + i * 80,
              width: 28, height: 28, borderRadius: 14,
              background: p.color || 'var(--primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,.3)',
            }}>
              <Icon name="pin" size={14} color="#fff" />
            </div>
          ))}
        </div>

        {/* search bar */}
        <div style={{ padding: '14px 16px 10px', display: 'flex', gap: 10 }}>
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(43,38,34,.07)', borderRadius: 12, padding: '10px 13px',
          }}>
            <Icon name="search" size={15} color="var(--ink-muted)" />
            <input placeholder="장소 검색" style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13.5, color: 'var(--ink)', flex: 1, fontFamily: 'var(--ff-sans)' }} />
          </div>
        </div>

        {/* legend */}
        <div style={{ display: 'flex', gap: 10, padding: '0 16px', marginBottom: 14 }}>
          {Object.entries(PIN_COLORS).map(([k, c]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 5, background: c }} />
              <span style={{ color: 'var(--ink-sub)' }}>{k}</span>
            </div>
          ))}
        </div>

        {/* places list */}
        <div style={{ padding: '0 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 10 }}>
            저장한 장소 {places.length}
          </div>
          {places.map(p => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10,
              background: '#fff', borderRadius: 13, padding: '12px 13px',
              boxShadow: 'var(--shadow-card)', border: '1px solid var(--card-border)',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: `${p.color}20`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon name="pin" size={17} color={p.color} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{p.name}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-sub)' }}>{p.note}</div>
              </div>
              <span style={{
                background: `${p.color}18`, color: p.color,
                fontSize: 11, fontWeight: 700, borderRadius: 10, padding: '3px 8px',
              }}>{p.cat}</span>
            </div>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
