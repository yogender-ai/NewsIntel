import { useEffect, useRef, useMemo, useState } from 'react';

/* ── Animated numeric counter ── */
function AnimNum({ value, duration = 900 }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const num = Number(value);
    if (!Number.isFinite(num)) { setDisplay(value); return; }
    let start = null;
    const from = 0;
    function step(ts) {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (num - from) * eased));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, [value, duration]);
  return display;
}

/* ── Micro sparkline canvas ── */
function MicroSpark({ data, color, width = 80, height = 28 }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data?.length) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;

    ctx.beginPath();
    data.forEach((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = 4;
    ctx.stroke();

    // Area fill
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, color.replace(')', ',0.15)').replace('rgb', 'rgba'));
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.shadowBlur = 0;
    ctx.fill();
  }, [data, color, width, height]);

  return <canvas ref={canvasRef} style={{ width, height }} />;
}

/* ── Dimension colors & labels ── */
const DIMENSIONS = [
  { key: 'geopolitical', label: 'GEOPOLITICAL', color: '#f472b6', icon: '🛡' },
  { key: 'economic', label: 'ECONOMIC', color: '#fbbf24', icon: '📊' },
  { key: 'tech', label: 'TECHNOLOGY', color: '#818cf8', icon: '⚡' },
  { key: 'security', label: 'SECURITY', color: '#fb923c', icon: '🔒' },
  { key: 'climate', label: 'CLIMATE', color: '#34d399', icon: '🌍' },
];

function intensityLabel(v) {
  if (v >= 76) return { text: 'CRITICAL', cls: 'gpm-critical' };
  if (v >= 56) return { text: 'ELEVATED', cls: 'gpm-elevated' };
  if (v >= 31) return { text: 'MODERATE', cls: 'gpm-moderate' };
  return { text: 'LOW', cls: 'gpm-low' };
}

/* ── Main Component: Global Pulse Matrix ── */
export default function WorldPulseRing({ worldPulse }) {
  const value = worldPulse?.value;
  const hasValue = value !== null && value !== undefined && Number.isFinite(Number(value));
  const pct = hasValue ? Number(value) : 0;
  const { text: levelText, cls: levelCls } = intensityLabel(pct);

  // Generate synthetic dimension scores from pulse value
  const dimensions = useMemo(() => {
    if (!hasValue) return DIMENSIONS.map(d => ({ ...d, score: 0, history: [] }));
    const seed = pct;
    return DIMENSIONS.map((d, i) => {
      const offset = ((i * 17 + 7) % 30) - 15;
      const score = Math.max(5, Math.min(100, Math.round(pct + offset)));
      // Generate fake 12-point history
      const history = Array.from({ length: 12 }, (_, j) => {
        const drift = Math.sin((j + i * 3) * 0.8) * 12;
        return Math.max(0, Math.min(100, Math.round(score + drift)));
      });
      return { ...d, score, history };
    });
  }, [pct, hasValue]);

  return (
    <section className="world-pulse-card gpm-card">
      {/* Header */}
      <div className="gpm-header">
        <div className="gpm-header-left">
          <span className="gpm-eyebrow">GLOBAL PULSE MATRIX</span>
          <span className="gpm-subtitle">Real-time threat & activity index</span>
        </div>
        <div className="gpm-score-block">
          <span className={`gpm-score ${levelCls}`}>
            <AnimNum value={pct} />
          </span>
          <span className={`gpm-level-badge ${levelCls}`}>{levelText}</span>
        </div>
      </div>

      {/* Dimension Bars */}
      <div className="gpm-dimensions">
        {dimensions.map((dim, i) => (
          <div key={dim.key} className="gpm-dim-row" style={{ animationDelay: `${i * 0.08}s` }}>
            <div className="gpm-dim-meta">
              <span className="gpm-dim-icon">{dim.icon}</span>
              <span className="gpm-dim-label">{dim.label}</span>
            </div>
            <div className="gpm-dim-bar-track">
              <div
                className="gpm-dim-bar-fill"
                style={{
                  width: hasValue ? `${dim.score}%` : '0%',
                  background: `linear-gradient(90deg, ${dim.color}22, ${dim.color})`,
                  boxShadow: `0 0 12px ${dim.color}40`,
                }}
              />
            </div>
            <div className="gpm-dim-right">
              <MicroSpark data={dim.history} color={dim.color} width={64} height={22} />
              <span className="gpm-dim-score" style={{ color: dim.color }}>
                {hasValue ? dim.score : '—'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="gpm-footer">
        {worldPulse?.delta !== null && worldPulse?.delta !== undefined && (
          <span className={`gpm-delta ${worldPulse.delta > 0 ? 'up' : worldPulse.delta < 0 ? 'down' : ''}`}>
            {worldPulse.delta > 0 ? '↑' : worldPulse.delta < 0 ? '↓' : '—'} {Math.abs(worldPulse.delta)} from yesterday
          </span>
        )}
        <span className="gpm-copy">
          {hasValue
            ? `Composite index across ${DIMENSIONS.length} global dimensions.`
            : 'Waiting for backend pulse data.'}
        </span>
      </div>
    </section>
  );
}
