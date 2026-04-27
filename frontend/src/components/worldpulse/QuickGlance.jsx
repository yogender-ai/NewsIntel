import { useEffect, useState } from 'react';
import { Globe, Radio, AlertTriangle, Wifi } from 'lucide-react';

const icons = { countries: Globe, signals: Radio, alerts: AlertTriangle, sources: Wifi };
const colors = { countries: '#818cf8', signals: '#34d399', alerts: '#fb7185', sources: '#fbbf24' };
const bgColors = { countries: 'rgba(129,140,248,0.10)', signals: 'rgba(52,211,153,0.10)', alerts: 'rgba(251,113,133,0.10)', sources: 'rgba(251,191,36,0.10)' };

/* Animated counter hook */
function useAnimatedValue(target, duration = 800) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const num = Number(target);
    if (!Number.isFinite(num)) { setDisplay(target); return; }
    let start = null;
    const from = 0;
    function step(ts) {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (num - from) * eased));
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, [target, duration]);
  return display;
}

function Stat({ id, label, value, delta, deltaColor, onClick, index }) {
  const Icon = icons[id] || Radio;
  const color = colors[id] || '#818cf8';
  const bg = bgColors[id] || 'rgba(129,140,248,0.10)';
  const animatedVal = useAnimatedValue(value);
  const isNum = Number.isFinite(Number(value));

  return (
    <button
      className="qg-stat"
      onClick={onClick}
      style={{
        animationDelay: `${index * 0.08}s`,
        '--qg-accent': color,
      }}
    >
      <i className="qg-icon" style={{ color, background: bg }}>
        <Icon size={14} />
      </i>
      <div className="qg-text">
        <span>{label}</span>
        {delta && <em className="qg-delta" style={{ color: deltaColor || '#34d399' }}>{delta}</em>}
      </div>
      <b>{value === null || value === undefined ? '—' : isNum ? animatedVal : value}</b>
    </button>
  );
}

export default function QuickGlance({ data, onCountries, onSignals, onAlerts, onSources }) {
  const handlers = {
    countries: onCountries,
    signals: onSignals,
    alerts: onAlerts,
    sources: onSources,
  };

  return (
    <section className="wp-card quick-glance">
      <div className="wp-section-head"><span>Quick Glance</span></div>
      {Array.isArray(data) && data.map((stat, i) => (
        <Stat
          key={stat.id}
          id={stat.id}
          label={stat.label}
          value={stat.value}
          delta={stat.delta}
          deltaColor={stat.deltaColor}
          onClick={handlers[stat.id]}
          index={i}
        />
      ))}
      {(!Array.isArray(data) || data.length === 0) && (
        <div className="qg-empty">
          <span>No live metrics available from backend.</span>
        </div>
      )}
    </section>
  );
}
