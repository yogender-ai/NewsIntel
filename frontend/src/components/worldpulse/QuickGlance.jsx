const Stat = ({ label, value }) => (
  <div className="qg-stat">
    <span>{label}</span>
    <b>{value === null || value === undefined ? '—' : value}</b>
  </div>
);

export default function QuickGlance({ data }) {
  return (
    <section className="wp-card quick-glance">
      <div className="wp-section-head"><span>Quick Glance</span></div>
      <Stat label="Countries in focus" value={data?.countriesInFocus} />
      <Stat label="Signals tracked" value={data?.signalsTracked} />
      <Stat label="High impact alerts" value={data?.highImpactAlerts} />
      <Stat label="Sources monitored" value={data?.sourcesMonitored} />
    </section>
  );
}

