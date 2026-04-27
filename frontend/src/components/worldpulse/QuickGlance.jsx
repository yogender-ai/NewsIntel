import { Globe, Radio, AlertTriangle, Wifi, ArrowRight } from 'lucide-react';

const icons = { countries: Globe, signals: Radio, alerts: AlertTriangle, sources: Wifi };
const colors = { countries: '#8da2ff', signals: '#7ee7c4', alerts: '#ff9ba9', sources: '#ffd38a' };

function Stat({ id, label, value, delta, deltaColor, onClick }) {
  const Icon = icons[id] || Radio;
  const color = colors[id] || '#8da2ff';
  return (
    <button className="qg-stat" onClick={onClick} style={{ padding: '8px 0', minHeight: '32px' }}>
      <i className="qg-icon" style={{ color, background: color + '18', width: '20px', height: '20px' }}><Icon size={12} /></i>
      <span style={{ fontSize: '11px' }}>{label}</span>
      <b style={{ fontSize: '18px' }}>{value === null || value === undefined ? '—' : value}</b>
      {delta && <em className="qg-delta" style={{ color: deltaColor || '#7ee7c4', fontSize: '9px' }}>{delta}</em>}
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
