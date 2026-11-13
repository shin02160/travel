export default function StatusChips({ statuses }) {
  const entries = Object.entries(statuses).filter(([, value]) => typeof value === 'string' && value.trim());
  if (!entries.length) return null;

  return (
    <span className="travel-status-chips">
      {entries.map(([label, value]) => (
        <span className="travel-badge" key={label} title={label}>{value.trim()}</span>
      ))}
    </span>
  );
}
