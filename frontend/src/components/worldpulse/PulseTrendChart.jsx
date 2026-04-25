import EmptyState from './EmptyState';

export default function PulseTrendChart({ history }) {
  if (!history?.length) {
    return (
      <section className="wp-card pulse-chart-card">
        <div className="wp-section-head"><span>Live World Pulse Chart</span></div>
        <EmptyState title="Pulse history building." body="Check back after refresh cycles." />
      </section>
    );
  }
  const max = Math.max(...history.map((p) => p.value), 100);
  const min = Math.min(...history.map((p) => p.value), 0);
  const points = history.map((point, index) => {
    const x = (index / Math.max(history.length - 1, 1)) * 280;
    const y = 120 - ((point.value - min) / Math.max(max - min, 1)) * 100;
    return `${x},${y}`;
  }).join(' ');
  return (
    <section className="wp-card pulse-chart-card">
      <div className="wp-section-head"><span>Live World Pulse Chart</span></div>
      <svg className="pulse-trend" viewBox="0 0 280 130" role="img" aria-label="24 hour pulse trend">
        <polygon points={`0,130 ${points} 280,130`} />
        <polyline points={points} />
      </svg>
    </section>
  );
}

