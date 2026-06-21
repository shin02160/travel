import { useApp as useStore, computeCheckItems } from '../store';
import { Icon } from '../icons';

function CheckItem({ item, onToggle, onDelete }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0',
      borderBottom: '1px solid rgba(43,38,34,.05)',
    }}>
      <button onClick={() => onToggle(item.id)} style={{
        width: 22, height: 22, borderRadius: 6, border: 'none',
        background: item.checked ? 'var(--primary)' : 'transparent',
        border: item.checked ? 'none' : '1.5px solid rgba(43,38,34,.25)',
        cursor: 'pointer', flexShrink: 0, padding: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all .15s',
      }}>
        {item.checked && <Icon name="check" size={12} color="#fff" strokeWidth={2.5} />}
      </button>
      <span style={{
        flex: 1, fontSize: 13.5, fontWeight: 500,
        color: item.checked ? 'var(--ink-muted)' : 'var(--ink-body)',
        textDecoration: item.checked ? 'line-through' : 'none',
        transition: 'color .15s',
      }}>
        {item.t}
      </span>
      <button onClick={() => onDelete(item.id)} style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: 2,
      }}>
        <Icon name="x" size={14} color="var(--ink-muted)" />
      </button>
    </div>
  );
}

export default function CheckTab() {
  const { checks, addedChecks, deletedChecks, toggleCheck, deleteCheckItem, setOverlay, setAddCheckCat } = useStore(s => ({
    checks: s.checks,
    addedChecks: s.addedChecks,
    deletedChecks: s.deletedChecks,
    toggleCheck: s.toggleCheck,
    deleteCheckItem: s.deleteCheckItem,
    setOverlay: s.setOverlay,
    setAddCheckCat: s.setAddCheckCat,
  }));

  const checkItems = computeCheckItems(checks, addedChecks, deletedChecks);
  const allItems = Object.values(checkItems).flat();
  const done = allItems.filter(i => i.checked).length;
  const total = allItems.length;
  const pct = total ? Math.round(done / total * 100) : 0;

  const handleAddClick = (cat) => {
    setAddCheckCat(cat);
    setOverlay('addCheck');
  };

  return (
    <div style={{ padding: '16px 16px 100px' }}>
      {/* progress hero */}
      <div style={{
        background: 'linear-gradient(135deg, var(--dark-card-from), var(--dark-card-to))',
        borderRadius: 16, padding: '16px 18px', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', marginBottom: 4 }}>준비 진행</div>
            <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 28, fontWeight: 700, color: 'var(--primary)' }}>
              {pct}%
            </div>
          </div>
          <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 18, fontWeight: 600, color: '#fff' }}>
            {done} / {total}
          </div>
        </div>
        <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,.15)' }}>
          <div style={{
            height: '100%', borderRadius: 3,
            background: 'linear-gradient(90deg, var(--primary), #ff8c6e)',
            width: `${pct}%`, transition: 'width .4s ease',
          }} />
        </div>
      </div>

      {/* categories */}
      {Object.entries(checkItems).map(([cat, items]) => (
        <div key={cat} style={{ marginBottom: 20 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-sub)' }}>{cat}</span>
            </div>
            <button onClick={() => handleAddClick(cat)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--primary)', fontSize: 12, fontWeight: 700, fontFamily: 'var(--ff-sans)',
              display: 'flex', alignItems: 'center', gap: 2,
            }}>
              <Icon name="plus" size={13} color="var(--primary)" />추가
            </button>
          </div>
          {items.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--ink-muted)', padding: '8px 0' }}>항목을 추가해보세요</div>
          ) : (
            items.map(item => (
              <CheckItem
                key={item.id}
                item={item}
                onToggle={toggleCheck}
                onDelete={deleteCheckItem}
              />
            ))
          )}
        </div>
      ))}
    </div>
  );
}
