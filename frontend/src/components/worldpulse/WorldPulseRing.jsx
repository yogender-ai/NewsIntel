import { useEffect, useRef, useMemo } from 'react';

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

/* ── Premium Radar Canvas ── */
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
    const maxR = size * 0.38;

    // Blips from dimension data
    const blips = dimensions.map((d, i) => {
      const angle = (i / dimensions.length) * Math.PI * 2 - Math.PI / 2;
      const dist = (d.score / 100) * maxR * 0.85;
      return {
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        labelX: cx + Math.cos(angle) * (maxR + 16),
        labelY: cy + Math.sin(angle) * (maxR + 16),
        color: d.color,
        score: d.score,
        label: d.label,
        pulse: 0,
        trail: [],
      };
    });

    let sweepAngle = 0;
    // Sweep trail buffer
    const trailCanvas = document.createElement('canvas');
    trailCanvas.width = canvas.width;
    trailCanvas.height = canvas.height;
    const trailCtx = trailCanvas.getContext('2d');
    trailCtx.scale(dpr, dpr);

    function draw() {
      sweepAngle += 0.01 * (0.8 + intensity * 0.6);
      ctx.clearRect(0, 0, size, size);

      // Fade trail
      trailCtx.fillStyle = 'rgba(3,7,17,0.04)';
      trailCtx.fillRect(0, 0, size, size);

      // Concentric rings
      [0.2, 0.4, 0.6, 0.8, 1.0].forEach((r, i) => {
        ctx.beginPath();
        ctx.arc(cx, cy, maxR * r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(139,92,246,${0.03 + i * 0.008})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      });

      // Axis lines (pentagon)
      dimensions.forEach((_, i) => {
        const a = (i / dimensions.length) * Math.PI * 2 - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * maxR, cy + Math.sin(a) * maxR);
        ctx.strokeStyle = 'rgba(139,92,246,0.04)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      });

      // Data polygon fill
      ctx.beginPath();
      dimensions.forEach((d, i) => {
        const a = (i / dimensions.length) * Math.PI * 2 - Math.PI / 2;
        const dist = (d.score / 100) * maxR * 0.85;
        const px = cx + Math.cos(a) * dist;
        const py = cy + Math.sin(a) * dist;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.fillStyle = `rgba(139,92,246,${0.04 * intensity})`;
      ctx.strokeStyle = `rgba(139,92,246,${0.15 * intensity})`;
      ctx.lineWidth = 1;
      ctx.fill();
      ctx.stroke();

      // Sweep beam with gradient tail
      const sweepGrad = ctx.createConicGradient(sweepAngle, cx, cy);
      sweepGrad.addColorStop(0, `rgba(94,234,212,${0.15 * intensity})`);
      sweepGrad.addColorStop(0.06, `rgba(94,234,212,${0.08 * intensity})`);
      sweepGrad.addColorStop(0.12, 'transparent');
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
      ctx.strokeStyle = `rgba(94,234,212,${0.35 * intensity})`;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = 'rgba(94,234,212,0.4)';
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw sweep dot on trail canvas for persistence effect
      trailCtx.beginPath();
      trailCtx.arc(sx, sy, 2, 0, Math.PI * 2);
      trailCtx.fillStyle = `rgba(94,234,212,0.15)`;
      trailCtx.fill();

      // Render trail
      ctx.drawImage(trailCanvas, 0, 0, size, size);

      // Blips
      blips.forEach(blip => {
        const blipAngle = Math.atan2(blip.y - cy, blip.x - cx);
        const diff = ((sweepAngle - blipAngle + Math.PI * 3) % (Math.PI * 2));
        if (diff < 0.12) blip.pulse = 1;
        blip.pulse *= 0.96;

        const sz = 3 + blip.pulse * 5;
        ctx.beginPath();
        ctx.arc(blip.x, blip.y, sz, 0, Math.PI * 2);
        ctx.fillStyle = blip.color;
        ctx.shadowColor = blip.color;
        ctx.shadowBlur = 8 + blip.pulse * 14;
        ctx.globalAlpha = 0.5 + blip.pulse * 0.5;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        // Blip glow ring when active
        if (blip.pulse > 0.3) {
          ctx.beginPath();
          ctx.arc(blip.x, blip.y, sz + 6 * blip.pulse, 0, Math.PI * 2);
          ctx.strokeStyle = `${blip.color}${Math.round(blip.pulse * 40).toString(16).padStart(2,'0')}`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });

      // Dimension labels around edge
      ctx.font = `700 ${size * 0.04}px var(--mono, monospace)`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      blips.forEach(blip => {
        ctx.fillStyle = `${blip.color}99`;
        ctx.fillText(blip.label, blip.labelX, blip.labelY);
      });

      // Center dot
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(94,234,212,0.6)';
      ctx.shadowColor = 'rgba(94,234,212,0.5)';
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Center value text
      ctx.font = `950 ${size * 0.12}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(226,232,240,${0.6 + intensity * 0.4})`;
      ctx.fillText(Math.round(pulseValue) || '—', cx, cy - 4);
      ctx.font = `700 ${size * 0.035}px var(--mono, monospace)`;
      ctx.fillStyle = 'rgba(148,163,184,0.6)';
      ctx.fillText('GLOBAL PULSE', cx, cy + size * 0.07);

      frameRef.current = requestAnimationFrame(draw);
    }

    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [size, intensity, dimensions, pulseValue]);

  return <canvas ref={canvasRef} className="threat-radar-canvas" />;
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

  const SIZE = 280;

  return (
    <section className="world-pulse-card radar-card">
      <div className="radar-layout-v2">
        <div className="radar-visual-v2" style={{ width: SIZE, height: SIZE }}>
          <ThreatRadar size={SIZE} pulseValue={pct} dimensions={dimensions} />
        </div>
        <div className="radar-aside">
          <div className="radar-score-block">
            <span className="radar-badge-v2" style={{ color: meta.color, borderColor: `${meta.color}33`, background: `${meta.color}0d` }}>
              {meta.text}
            </span>
          </div>
          <div className="radar-dims-v2">
            {dimensions.map(dim => (
              <div key={dim.key} className="radar-dim-v2">
                <div className="radar-dim-dot" style={{ background: dim.color, boxShadow: `0 0 6px ${dim.color}40` }} />
                <span className="radar-dim-label-v2">{dim.fullLabel}</span>
                <div className="radar-dim-bar-v2">
                  <div style={{ width: `${dim.score}%`, background: `linear-gradient(90deg, ${dim.color}22, ${dim.color})`, boxShadow: `0 0 10px ${dim.color}30` }} />
                </div>
                <span className="radar-dim-val-v2" style={{ color: dim.color }}>{dim.score}</span>
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
