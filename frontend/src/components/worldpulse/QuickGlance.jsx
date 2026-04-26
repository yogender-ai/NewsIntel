const Stat = ({ label, value, onClick }) => (
  <button className="qg-stat" onClick={onClick}>
    <span>{label}</span>
    <b>{value === null || value === undefined ? '-' : value}</b>
  </button>
);

export default function QuickGlance({ data, onCountries, onSignals, onAlerts, onSources }) {
  return (
    <section className="wp-card quick-glance">
      <div className="wp-section-head"><span>Quick Glance</span></div>
      <Stat label="Countries in focus" value={data?.countriesInFocus} onClick={onCountries} />
      <Stat label="Signals tracked" value={data?.signalsTracked} onClick={onSignals} />
      <Stat label="High impact alerts" value={data?.highImpactAlerts} onClick={onAlerts} />
      <Stat label="Sources monitored" value={data?.sourcesMonitored} onClick={onSources} />
    </section>
  );
}
