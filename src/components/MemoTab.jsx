import { useApp as useStore } from '../store';
import { Icon } from '../icons';

const TAG_COLORS = {
  '전체': 'var(--ink)',
  '맛집': 'var(--primary)',
  '공연': 'var(--purple)',
  '장소': 'var(--sage)',
  '숙박': 'var(--gold)',
};

const TAG_BG = {
  '전체': 'var(--ink)',
  '맛집': 'var(--primary-tint)',
  '공연': 'var(--purple-bg)',
  '장소': 'var(--sage-bg)',
  '숙박': 'var(--gold-bg)',
};

export default function MemoTab() {
  const { memos, memoFilter, setMemoFilter, setOverlay } = useStore(s => ({
    memos: s.memos,
    memoFilter: s.memoFilter,
    setMemoFilter: s.setMemoFilter,
    setOverlay: s.setOverlay,
  }));

  const tags = ['전체', '맛집', '공연', '장소', '숙박'];
  const filtered = memoFilter === '전체' ? memos : memos.filter(m => m.tag === memoFilter);

  return (
    <div style={{ padding: '16px 16px 100px' }}>
      {/* filter chips */}
      <div style={{ display: 'flex', gap: 7, marginBottom: 16, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {tags.map(t => (
          <div key={t} onClick={() => setMemoFilter(t)} style={{
            padding: '6px 13px', borderRadius: 20,
            background: memoFilter === t ? 'var(--ink)' : 'rgba(43,38,34,.07)',
            color: memoFilter === t ? '#fff' : 'var(--ink-body)',
            fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
          }}>{t}</div>
        ))}
      </div>

      {/* masonry grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--ink-muted)', fontSize: 13 }}>
          메모가 없습니다
        </div>
      ) : (
        <div style={{ columns: 2, gap: 9 }}>
          {filtered.map(memo => (
            <div key={memo.id} className="anim-modal" style={{
              breakInside: 'avoid', marginBottom: 9,
              background: '#fff', borderRadius: 14, padding: '13px',
              boxShadow: 'var(--shadow-card)', border: '1px solid var(--card-border)',
            }}>
              <span style={{
                display: 'inline-block', marginBottom: 7,
                padding: '3px 9px', borderRadius: 20,
                background: TAG_BG[memo.tag] || 'rgba(43,38,34,.07)',
                color: TAG_COLORS[memo.tag] || 'var(--ink-sub)',
                fontSize: 11, fontWeight: 700,
              }}>{memo.tag}</span>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 5, lineHeight: 1.3 }}>
                {memo.title}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-sub)', lineHeight: 1.55 }}>
                {memo.body}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI banner */}
      <div onClick={() => setOverlay('ai')} style={{
        marginTop: 16,
        background: 'linear-gradient(135deg, var(--dark-card-from), var(--dark-card-to))',
        borderRadius: 14, padding: '14px 16px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <Icon name="sparkles" size={16} color="#fff" />
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>AI 장소 추천</div>
          <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 11.5 }}>도쿄 명소·맛집을 AI가 추천해드려요</div>
        </div>
      </div>
    </div>
  );
}
