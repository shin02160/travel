import { useState } from 'react';
import { useApp as useStore } from '../../store';
import { Sheet } from '../Overlay';

export default function EditEventSheet() {
  const { editingEvent, closeOverlay, addTimelineEvent, updateTimelineEvent, deleteTimelineEvent } = useStore(s => ({
    editingEvent: s.editingEvent,
    closeOverlay: s.closeOverlay,
    addTimelineEvent: s.addTimelineEvent,
    updateTimelineEvent: s.updateTimelineEvent,
    deleteTimelineEvent: s.deleteTimelineEvent,
  }));

  const isNew = !editingEvent?.event;
  const [form, setForm] = useState({
    time: editingEvent?.event?.time || '',
    title: editingEvent?.event?.title || '',
    sub: editingEvent?.event?.sub || '',
  });
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = () => {
    if (!form.time || !form.title) return;
    if (isNew) addTimelineEvent(editingEvent.day, form);
    else updateTimelineEvent(editingEvent.day, editingEvent.event.id, form);
    closeOverlay();
  };

  const remove = () => {
    deleteTimelineEvent(editingEvent.day, editingEvent.event.id);
    closeOverlay();
  };

  return (
    <Sheet onClose={closeOverlay} title={isNew ? '일정 추가' : '일정 수정'}>
      <div style={{ padding: '8px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-sub)', display: 'block', marginBottom: 6 }}>시간</label>
          <input type="time" value={form.time} onChange={e => setField('time', e.target.value)}
            style={{ width: '100%', padding: '11px 14px', border: '1.5px solid rgba(43,38,34,.15)', borderRadius: 10, fontSize: 15, fontFamily: 'var(--ff-sans)', background: '#fff', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-sub)', display: 'block', marginBottom: 6 }}>제목</label>
          <input value={form.title} onChange={e => setField('title', e.target.value)} placeholder="일정 제목"
            style={{ width: '100%', padding: '11px 14px', border: '1.5px solid rgba(43,38,34,.15)', borderRadius: 10, fontSize: 15, fontFamily: 'var(--ff-sans)', background: '#fff', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-sub)', display: 'block', marginBottom: 6 }}>메모 (선택)</label>
          <input value={form.sub} onChange={e => setField('sub', e.target.value)} placeholder="추가 설명"
            style={{ width: '100%', padding: '11px 14px', border: '1.5px solid rgba(43,38,34,.15)', borderRadius: 10, fontSize: 15, fontFamily: 'var(--ff-sans)', background: '#fff', boxSizing: 'border-box' }} />
        </div>
        <button onClick={save} style={{ width: '100%', padding: 14, background: 'var(--primary)', border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: 'var(--ff-sans)', cursor: 'pointer', marginTop: 4 }}>
          {isNew ? '추가하기' : '저장하기'}
        </button>
        {!isNew && (
          <button onClick={remove} style={{ width: '100%', padding: 12, background: 'none', border: '1.5px solid rgba(220,60,40,.3)', borderRadius: 12, color: '#E2603F', fontSize: 14, fontWeight: 600, fontFamily: 'var(--ff-sans)', cursor: 'pointer' }}>
            삭제
          </button>
        )}
      </div>
    </Sheet>
  );
}
