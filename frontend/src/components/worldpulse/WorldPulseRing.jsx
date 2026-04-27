export default function WorldPulseRing({ worldPulse }) {
  const value = worldPulse?.value;
  const pct = value === null || value === undefined ? 0 : value;
  const size = 260;
  const center = size / 2;
  const radius = 100;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <section className="world-pulse-card advanced-ring-card">
      <div className={`advanced-ring-wrap ${value > 60 ? 'heartbeat-active' : ''}`}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <defs>
            <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#5eead4" />
              <stop offset="55%" stopColor="#8da2ff" />
              <stop offset="100%" stopColor="#ffd38a" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="4" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <circle cx={center} cy={center} r={120} fill="none" stroke="rgba(141,162,255,0.15)" strokeWidth="1" strokeDasharray="4 8" className="orbit-spin-slow" />
          <circle cx={center} cy={center} r={80} fill="none" stroke="rgba(94,234,212,0.2)" strokeWidth="1" strokeDasharray="2 4" className="orbit-spin-fast-reverse" />
          <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="url(#ringGrad)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${center} ${center})`}
            filter="url(#glow)"
            style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
          />
        </svg>

        <div className="advanced-ring-center">
          <span className="ring-label">WORLD PULSE</span>
          <span className="ring-value">{value === null || value === undefined ? '-' : Math.round(value)}</span>
          <span className="ring-status">{worldPulse?.label || 'Establishing baseline'}</span>
          <b className={worldPulse?.delta > 0 ? 'up' : worldPulse?.delta < 0 ? 'down' : 'neutral'}>
            {worldPulse?.deltaLabel || 'Establishing baseline'}
          </b>
        </div>
      </div>

      <div className="pulse-copy">
        <p>Overall global intensity of events<br />across all key dimensions.</p>
      </div>
    </section>
  );
}
