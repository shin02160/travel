import { useState } from 'react';
import { useApp as useStore, computeCheckItems } from '../store';
import { Icon } from '../icons';

function CheckItem({ item, onToggle, onDelete, loggedIn, editingId, editText, onStartEdit, onEditChange, onCommitEdit }) {
  const isEditing = loggedIn && editingId === item.id;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0',
      borderBottom: '1px solid rgba(43,38,34,.05)',
    }}>
      <button onClick={() => onToggle(item.id)} style={{
        width: 22, height: 22, borderRadius: 6,
        background: item.checked ? 'var(--primary)' : 'transparent',
        border: item.checked ? 'none' : '1.5px solid rgba(43,38,34,.25)',
        cursor: 'pointer', flexShrink: 0, padding: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all .15s',
      }}>
        {item.checked && <Icon name="check" size={12} color="#fff" strokeWidth={2.5} />}
      </button>

      {isEditing ? (
        <input
          autoFocus
          value={editText}
          onChange={e => onEditChange(e.target.value)}
          onBlur={() => onCommitEdit(item.id)}
          onKeyDown={e => { if (e.key === 'Enter') onCommitEdit(item.id); if (e.key === 'Escape') onCommitEdit(null); }}
          style={{
            flex: 1, fontSize: 13.5, fontWeight: 500, border: 'none', borderBottom: '1.5px solid var(--primary)',
            outline: 'none', background: 'transparent', fontFamily: 'var(--ff-sans)', color: 'var(--ink-body)', padding: '2px 0',
          }}
        />
      ) : (
        <span
          onDoubleClick={() => loggedIn && onStartEdit(item.id, item.t)}
          style={{
            flex: 1, fontSize: 13.5, fontWeight: 500,
            color: item.checked ? 'var(--ink-muted)' : 'var(--ink-body)',
            textDecoration: item.checked ? 'line-through' : 'none',
            transition: 'color .15s',
            cursor: loggedIn ? 'text' : 'default',
          }}
        >
          {item.t}
        </span>
      )}

      {loggedIn && !isEditing && (
        <button onClick={() => onStartEdit(item.id, item.t)} style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 2,
        }}>
          <Icon name="pencil" size={13} color="var(--ink-muted)" />
        </button>
      )}

      <button onClick={() => onDelete(item.id)} style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: 2,
      }}>
        <Icon name="x" size={14} color="var(--ink-muted)" />
      </button>
    </div>
  );
}

export default function CheckTab() {
  const { checks, addedChecks, deletedChecks, editedChecks, toggleCheck, deleteCheckItem, editCheckItem, setOverlay, setAddCheckCat, loggedIn } = useStore(s => ({
    checks: s.checks,
    addedChecks: s.addedChecks,
    deletedChecks: s.deletedChecks,
    editedChecks: s.editedChecks,
    toggleCheck: s.toggleCheck,
    deleteCheckItem: s.deleteCheckItem,
    editCheckItem: s.editCheckItem,
    setOverlay: s.setOverlay,
    setAddCheckCat: s.setAddCheckCat,
    loggedIn: s.loggedIn,
  }));

  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');

  const checkItems = computeCheckItems(checks, addedChecks, deletedChecks, editedChecks);
  const allItems = Object.values(checkItems).flat();
  const done = allItems.filter(i => i.checked).length;
  const total = allItems.length;
  const pct = total ? Math.round(done / total * 100) : 0;

  const handleAddClick = (cat) => {
    setAddCheckCat(cat);
    setOverlay('addCheck');
  };

  const handleStartEdit = (id, currentText) => {
    setEditingId(id);
    setEditText(currentText);
  };

  const handleCommitEdit = (id) => {
    if (id && editText.trim()) {
      editCheckItem(id, editText.trim());
    }
    setEditingId(null);
    setEditText('');
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
                loggedIn={loggedIn}
                editingId={editingId}
                editText={editText}
                onStartEdit={handleStartEdit}
                onEditChange={setEditText}
                onCommitEdit={handleCommitEdit}
              />
            ))
          )}
        </div>
      ))}
    </div>
  );
}
