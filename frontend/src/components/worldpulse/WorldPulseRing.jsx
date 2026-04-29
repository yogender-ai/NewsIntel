import { useEffect, useRef, useMemo } from 'react';

/* ── Live Threat Radar — sweeping beam with activity dots ── */
function ThreatRadar({ size, pulseValue, dimensions }) {
  const canvasRef = useRef(null);
  const frameRef = useRef(null);

  const intensity = useMemo(() => {
    if (!pulseValue || pulseValue <= 0) return 0.2;
    return Math.max(0.2, Math.min(1, pulseValue / 100));
  }, [pulseValue]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const maxR = size * 0.42;

    // Generate blips from dimension data
    const blips = dimensions.map((d, i) => {
      const angle = (i / dimensions.length) * Math.PI * 2 - Math.PI / 2;
      const dist = (d.score / 100) * maxR * 0.85;
      return {
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        color: d.color,
        score: d.score,
        pulse: 0,
      };
    });

    let sweepAngle = 0;

    function draw() {
      sweepAngle += 0.012 * (0.8 + intensity * 0.6);
      ctx.clearRect(0, 0, size, size);

      // Concentric rings
      [0.25, 0.5, 0.75, 1.0].forEach((r, i) => {
        ctx.beginPath();
        ctx.arc(cx, cy, maxR * r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(139,92,246,${0.04 + i * 0.01})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      });

      // Cross lines
      ctx.strokeStyle = 'rgba(139,92,246,0.04)';
      ctx.lineWidth = 0.5;
      [0, Math.PI / 2, Math.PI, Math.PI * 1.5].forEach(a => {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * maxR, cy + Math.sin(a) * maxR);
        ctx.stroke();
      });

      // Sweep beam
      const sweepGrad = ctx.createConicGradient(sweepAngle, cx, cy);
      sweepGrad.addColorStop(0, `rgba(94,234,212,${0.12 * intensity})`);
      sweepGrad.addColorStop(0.08, `rgba(94,234,212,${0.06 * intensity})`);
      sweepGrad.addColorStop(0.15, 'transparent');
      sweepGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = sweepGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
      ctx.fill();

      // Sweep line
      const sx = cx + Math.cos(sweepAngle) * maxR;
      const sy = cy + Math.sin(sweepAngle) * maxR;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(sx, sy);
      ctx.strokeStyle = `rgba(94,234,212,${0.3 * intensity})`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Blips
      blips.forEach(blip => {
        // Check if sweep just passed this blip
        const blipAngle = Math.atan2(blip.y - cy, blip.x - cx);
        const diff = ((sweepAngle - blipAngle + Math.PI * 3) % (Math.PI * 2));
        if (diff < 0.15) blip.pulse = 1;
        blip.pulse *= 0.97;

        const sz = 2 + blip.pulse * 4;
        ctx.beginPath();
        ctx.arc(blip.x, blip.y, sz, 0, Math.PI * 2);
        ctx.fillStyle = blip.color;
        ctx.shadowColor = blip.color;
        ctx.shadowBlur = 6 + blip.pulse * 10;
        ctx.globalAlpha = 0.5 + blip.pulse * 0.5;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      });

      // Center dot
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(94,234,212,0.6)';
      ctx.shadowColor = 'rgba(94,234,212,0.5)';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;

      frameRef.current = requestAnimationFrame(draw);
    }

    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [size, intensity, dimensions]);

  return <canvas ref={canvasRef} className="threat-radar-canvas" />;
}

/* ── Dimension data ── */
const DIMENSIONS = [
  { key: 'geopolitical', label: 'GEO', fullLabel: 'Geopolitical', color: '#f472b6' },
  { key: 'economic', label: 'ECON', fullLabel: 'Economic', color: '#fbbf24' },
  { key: 'tech', label: 'TECH', fullLabel: 'Technology', color: '#818cf8' },
  { key: 'security', label: 'SEC', fullLabel: 'Security', color: '#fb923c' },
  { key: 'climate', label: 'ENV', fullLabel: 'Climate', color: '#34d399' },
];

function intensityMeta(v) {
  if (v >= 76) return { text: 'CRITICAL', color: '#fb7185' };
  if (v >= 56) return { text: 'ELEVATED', color: '#fbbf24' };
  if (v >= 31) return { text: 'MODERATE', color: '#818cf8' };
  return { text: 'LOW', color: '#34d399' };
}

export default function WorldPulseRing({ worldPulse }) {
  const value = worldPulse?.value;
  const hasValue = value !== null && value !== undefined && Number.isFinite(Number(value));
  const pct = hasValue ? Number(value) : 0;
  const meta = intensityMeta(pct);

  const dimensions = useMemo(() => {
    if (!hasValue) return DIMENSIONS.map(d => ({ ...d, score: 0 }));
    return DIMENSIONS.map((d, i) => {
      const offset = ((i * 17 + 7) % 30) - 15;
      return { ...d, score: Math.max(5, Math.min(100, Math.round(pct + offset))) };
    });
  }, [pct, hasValue]);

  const SIZE = 200;

  return (
    <section className="world-pulse-card radar-card">
      <div className="radar-layout">
        {/* Radar Canvas */}
        <div className="radar-visual" style={{ width: SIZE, height: SIZE }}>
          <ThreatRadar size={SIZE} pulseValue={pct} dimensions={dimensions} />
        </div>

        {/* Data Panel */}
        <div className="radar-data">
          <div className="radar-header">
            <span className="radar-eyebrow">GLOBAL THREAT RADAR</span>
            <div className="radar-score-row">
              <span className="radar-score" style={{ color: meta.color }}>{hasValue ? Math.round(pct) : '—'}</span>
              <span className="radar-badge" style={{ color: meta.color, borderColor: `${meta.color}33`, background: `${meta.color}0d` }}>{meta.text}</span>
            </div>
          </div>

          <div className="radar-dims">
            {dimensions.map(dim => (
              <div key={dim.key} className="radar-dim">
                <div className="radar-dim-dot" style={{ background: dim.color }} />
                <span className="radar-dim-label">{dim.fullLabel}</span>
                <div className="radar-dim-bar">
                  <div style={{ width: `${dim.score}%`, background: dim.color, boxShadow: `0 0 8px ${dim.color}40` }} />
                </div>
                <span className="radar-dim-val" style={{ color: dim.color }}>{dim.score}</span>
              </div>
            ))}
          </div>

          {worldPulse?.delta != null && (
            <span className={`radar-delta ${worldPulse.delta > 0 ? 'up' : 'down'}`}>
              {worldPulse.delta > 0 ? '↑' : '↓'} {Math.abs(worldPulse.delta)} from yesterday
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
