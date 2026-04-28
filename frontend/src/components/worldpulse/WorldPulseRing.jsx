import { useEffect, useRef, useMemo } from 'react';

/* ── Premium Particle Sphere with Aurora Waves ── */
function AuroraSphere({ size, pulseValue }) {
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
    const radius = size * 0.34;

    // Multiple particle layers for depth
    const layers = [
      { count: 80, rMul: 1.0, speed: 0.008, baseAlpha: 0.6, color: [94, 234, 212] },
      { count: 60, rMul: 0.85, speed: 0.012, baseAlpha: 0.4, color: [139, 92, 246] },
      { count: 40, rMul: 1.15, speed: 0.005, baseAlpha: 0.3, color: [192, 132, 252] },
    ];

    const allPoints = layers.flatMap(layer =>
      Array.from({ length: layer.count }, () => ({
        theta: Math.random() * Math.PI * 2,
        phi: Math.acos(Math.random() * 2 - 1),
        basePhi: Math.acos(Math.random() * 2 - 1),
        speed: layer.speed + Math.random() * 0.01,
        rMul: layer.rMul,
        baseAlpha: layer.baseAlpha,
        color: layer.color,
      }))
    );

    // Aurora wave rings
    const rings = Array.from({ length: 5 }, (_, i) => ({
      phase: (i / 5) * Math.PI * 2,
      speed: 0.02 + i * 0.005,
      radius: radius * (0.9 + i * 0.12),
      alpha: 0.15 - i * 0.02,
    }));

    let time = 0;

    function tick() {
      time += 0.008 * (1 + intensity * 1.5);
      ctx.clearRect(0, 0, size, size);

      // Deep ambient glow
      const amb1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.6);
      amb1.addColorStop(0, `rgba(139,92,246,${0.06 * intensity})`);
      amb1.addColorStop(0.4, `rgba(94,234,212,${0.03 * intensity})`);
      amb1.addColorStop(1, 'transparent');
      ctx.fillStyle = amb1;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Aurora wave rings
      rings.forEach(ring => {
        ctx.beginPath();
        for (let a = 0; a < Math.PI * 2; a += 0.02) {
          const wave = Math.sin(a * 3 + time * ring.speed * 60 + ring.phase) * 6 * intensity;
          const r = ring.radius + wave;
          const px = cx + Math.cos(a) * r;
          const py = cy + Math.sin(a) * r;
          a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.strokeStyle = `rgba(139,92,246,${ring.alpha * intensity})`;
        ctx.lineWidth = 1;
        ctx.shadowColor = 'rgba(139,92,246,0.3)';
        ctx.shadowBlur = 8 * intensity;
        ctx.stroke();
        ctx.shadowBlur = 0;
      });

      // 3D sphere particles
      ctx.shadowBlur = 0;
      allPoints.forEach(p => {
        p.theta += p.speed * (0.5 + intensity * 0.8);
        const wave = Math.sin(p.theta * 2 + time * 4) * 0.08 * intensity;
        const currentPhi = p.basePhi + wave;

        const r = radius * p.rMul;
        const x = r * Math.sin(currentPhi) * Math.cos(p.theta);
        const y = r * Math.sin(currentPhi) * Math.sin(p.theta);
        const z = r * Math.cos(currentPhi);

        const perspective = 1 / (1 + z / (r * 2.5));
        const px = cx + x * perspective;
        const py = cy + y * perspective;

        const zNorm = (z + r) / (r * 2);
        const alpha = p.baseAlpha * (0.2 + (1 - zNorm) * 0.8);
        const ptSize = 0.8 + (1 - zNorm) * 2.5 * (0.8 + intensity * 0.4);

        ctx.beginPath();
        ctx.arc(px, py, ptSize, 0, Math.PI * 2);
        const [cr, cg, cb] = p.color;
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`;

        if (zNorm < 0.4) {
          ctx.shadowColor = `rgba(${cr},${cg},${cb},0.6)`;
          ctx.shadowBlur = 4 * intensity;
        }
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Heartbeat pulse rings
      const beat = Math.pow((Math.sin(time * 6) + 1) / 2, 3);
      if (beat > 0.3) {
        const expand = (beat - 0.3) * 1.4;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * (1 + expand * 0.15 * intensity), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(94,234,212,${expand * 0.2 * intensity})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, radius * (1 + expand * 0.25 * intensity), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(139,92,246,${expand * 0.1 * intensity})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      frameRef.current = requestAnimationFrame(tick);
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [size, intensity]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'screen' }}
      aria-hidden="true"
    />
  );
}

/* ── Premium Arc Ring SVG with gradient glow ── */
function ArcRing({ value, size }) {
  const center = size / 2;
  const radius = size * 0.38;
  const circ = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const offset = circ - (pct / 100) * circ;
  const stroke = size * 0.028;

  return (
    <svg
      width={size} height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ position: 'absolute', inset: 0 }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="wp-arc-grad-v2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5eead4" />
          <stop offset="40%" stopColor="#8b5cf6" />
          <stop offset="70%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#5eead4" />
        </linearGradient>
        <filter id="wp-arc-glow-v2" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Outer faint ring */}
      <circle cx={center} cy={center} r={radius + 12} fill="none" stroke="rgba(139,92,246,0.03)" strokeWidth="0.5" />
      {/* Track */}
      <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(139,92,246,0.05)" strokeWidth={stroke} />
      {/* Value arc */}
      <circle
        cx={center} cy={center} r={radius} fill="none"
        stroke="url(#wp-arc-grad-v2)" strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        transform={`rotate(-90 ${center} ${center})`}
        filter="url(#wp-arc-glow-v2)"
        style={{ transition: 'stroke-dashoffset 2s cubic-bezier(0.22,1,0.36,1)' }}
      />
      {/* Tip glow dot */}
      {pct > 0 && (
        <circle
          cx={center + radius * Math.cos((-90 + pct * 3.6) * Math.PI / 180)}
          cy={center + radius * Math.sin((-90 + pct * 3.6) * Math.PI / 180)}
          r="4" fill="#5eead4"
          filter="url(#wp-arc-glow-v2)"
        >
          <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.8;1;0.8" dur="2s" repeatCount="indefinite" />
        </circle>
      )}
    </svg>
  );
}

/* ── Delta Arrow ── */
function DeltaArrow({ delta }) {
  if (delta === null || delta === undefined) return null;
  const up = delta > 0;
  const dn = delta < 0;
  const cls = up ? 'wp-ring-up' : dn ? 'wp-ring-down' : 'wp-ring-neutral';
  const sym = up ? '↑' : dn ? '↓' : '—';
  return (
    <span className={`wp-ring-delta ${cls}`}>
      {sym} {Math.abs(delta)} from yesterday
    </span>
  );
}

/* ── Main World Pulse Ring ── */
export default function WorldPulseRing({ worldPulse }) {
  const value = worldPulse?.value;
  const hasValue = value !== null && value !== undefined && Number.isFinite(Number(value));
  const pct = hasValue ? Number(value) : 0;
  const SIZE = 320;

  return (
    <section className="world-pulse-card wp-ring-card">
      <div className="wp-ring-scene" style={{ width: SIZE, height: SIZE }}>
        <AuroraSphere size={SIZE} pulseValue={pct} />
        <ArcRing value={pct} size={SIZE} />
        <div className="wp-ring-center">
          <span className="wp-ring-eyebrow">WORLD PULSE</span>
          <span className="wp-ring-value">
            {hasValue ? Math.round(value) : '—'}
          </span>
          <span className="wp-ring-label">
            {hasValue ? (worldPulse?.label || 'Calibrating') : 'Awaiting data'}
          </span>
          <DeltaArrow delta={worldPulse?.delta} />
        </div>
      </div>
      <p className="wp-ring-copy">
        {hasValue
          ? <>Overall global intensity of events<br />across all key dimensions.</>
          : <>Waiting for backend pulse data.</>
        }
      </p>
    </section>
  );
}
