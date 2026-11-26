export default function StatusChips({ statuses }) {
  const entries = Object.entries(statuses).filter(([, value]) => typeof value === 'string' && value.trim());
  if (!entries.length) return null;

  return (
    <span className="travel-status-chips">
      {entries.map(([label, value]) => (
        <span className="travel-badge" key={label} title={label}
          data-tone={['완료', '확정', '결제완료', '결제 완료', '정산완료', '정산 완료', '구매완료', '구매 완료'].includes(value.trim()) ? 'success'
            : ['진행중', '여행중'].includes(value.trim()) ? 'active'
              : ['취소', '실패', '오류'].includes(value.trim()) ? 'danger'
                : ['미결제', '미정산', '보류'].includes(value.trim()) ? 'warning' : 'neutral'}>{value.trim()}</span>
      ))}
    </span>
  );
}
