import { Globe, Radio, AlertTriangle, Wifi, ArrowRight } from 'lucide-react';

const icons = { countries: Globe, signals: Radio, alerts: AlertTriangle, sources: Wifi };
const colors = { countries: '#8da2ff', signals: '#7ee7c4', alerts: '#ff9ba9', sources: '#ffd38a' };

function Stat({ id, label, value, delta, deltaColor, onClick }) {
  const Icon = icons[id] || Radio;
  const color = colors[id] || '#8da2ff';
  return (
    <button className="qg-stat" onClick={onClick}>
      <i className="qg-icon" style={{ color, background: color + '18' }}><Icon size={16} /></i>
      <span>{label}</span>
      <b>{value === null || value === undefined ? '—' : value}</b>
      {delta && <em className="qg-delta" style={{ color: deltaColor || '#7ee7c4' }}>{delta}</em>}
    </button>
  );
}

export default function QuickGlance({ data, onCountries, onSignals, onAlerts, onSources }) {
  const handlers = {
    countries: onCountries,
    signals: onSignals,
    alerts: onAlerts,
    sources: onSources
  };

  return (
    <section className="wp-card quick-glance">
      <div className="wp-section-head"><span>Quick Glance</span></div>
      {Array.isArray(data) && data.map((stat) => (
        <Stat 
          key={stat.id} 
          id={stat.id} 
          label={stat.label} 
          value={stat.value}
          delta={stat.delta}
          deltaColor={stat.deltaColor}
          onClick={handlers[stat.id]} 
        />
      ))}
    </section>
  );
}
