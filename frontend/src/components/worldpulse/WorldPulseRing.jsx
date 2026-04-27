export default function WorldPulseRing({ worldPulse }) {
  const value = worldPulse?.value;
  const pct = value === null || value === undefined ? 0 : value;
  const pressureClass = pct >= 76 ? 'high' : pct >= 56 ? 'elevated' : pct >= 31 ? 'normal' : 'calm';

  return (
    <section className={`world-pulse-card ${pressureClass}`}>
      <div className="pulse-ring-wrap">
        <div className="pulse-ring" style={{ '--pulse': `${pct * 3.6}deg` }}>
          <span>{value === null || value === undefined ? '—' : Math.round(value)}</span>
        </div>
      </div>
      <div className="pulse-copy">
        <span>World Pulse</span>
        <h2>{worldPulse?.label || 'Establishing baseline'}</h2>
        <b className={worldPulse?.delta > 0 ? 'up' : worldPulse?.delta < 0 ? 'down' : 'neutral'}>
          {worldPulse?.deltaLabel || 'Establishing baseline'}
        </b>
        <p>Overall global intensity of events across all key dimensions.</p>
      </div>
    </section>
  );
}
