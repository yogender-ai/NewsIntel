import { useEffect, useRef, useMemo } from 'react';

/* ── HoloSpherePulse Canvas — premium 3D-like abstract sphere ── */
function HoloSpherePulse({ size, pulseValue }) {
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
    const radius = size * 0.38;
    
    // Generate particles for a sphere
    const numPoints = 120;
    const points = [];
    for (let i = 0; i < numPoints; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      points.push({ theta, phi, basePhi: phi, speed: 0.005 + Math.random() * 0.015 });
    }

    let time = 0;

    function tick() {
      time += 0.01 * (1 + intensity * 2);
      ctx.clearRect(0, 0, size, size);

      // Draw glowing background orb
      const grad = ctx.createRadialGradient(cx, cy, radius * 0.4, cx, cy, radius * 1.2);
      grad.addColorStop(0, `rgba(139, 92, 246, ${0.1 * intensity})`);
      grad.addColorStop(0.5, `rgba(94, 234, 212, ${0.05 * intensity})`);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Render 3D points
      points.forEach(p => {
        // Add wave effect based on intensity
        p.theta += p.speed * (0.5 + intensity);
        const wave = Math.sin(p.theta * 3 + time * 5) * 0.1 * intensity;
        const currentPhi = p.basePhi + wave;

        const x = radius * Math.sin(currentPhi) * Math.cos(p.theta);
        const y = radius * Math.sin(currentPhi) * Math.sin(p.theta);
        const z = radius * Math.cos(currentPhi);

        // Simple perspective
        const perspective = 1 / (1 + z / (radius * 3));
        const px = cx + x * perspective;
        const py = cy + y * perspective;
        
        // Depth-based fading and sizing
        const zNorm = (z + radius) / (radius * 2); // 0 to 1
        const alpha = 0.1 + (1 - zNorm) * 0.7;
        const ptSize = 0.5 + (1 - zNorm) * 2.5 * (1 + intensity);

        ctx.beginPath();
        ctx.arc(px, py, ptSize, 0, Math.PI * 2);
        
        if (zNorm < 0.5) {
          ctx.fillStyle = `rgba(94, 234, 212, ${alpha})`;
          ctx.shadowColor = 'rgba(94, 234, 212, 0.8)';
          ctx.shadowBlur = 5 * intensity;
        } else {
          ctx.fillStyle = `rgba(167, 139, 250, ${alpha * 0.5})`;
          ctx.shadowBlur = 0;
        }
        ctx.fill();
      });

      // Add intense heartbeat ring
      const beat = (Math.sin(time * 8) + 1) / 2; // 0 to 1
      if (beat > 0.8) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius * (1 + (beat - 0.8) * intensity), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(94, 234, 212, ${(beat - 0.8) * intensity})`;
        ctx.lineWidth = 2;
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

/* ── Arc Ring SVG ────────────────────────────── */
function ArcRing({ value, size }) {
  const center = size / 2;
  const radius = size * 0.345;
  const circ = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const offset = circ - (pct / 100) * circ;
  const stroke = size * 0.038;

  return (
    <svg
      width={size} height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ position: 'absolute', inset: 0 }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="wp-arc-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="50%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#c084fc" />
        </linearGradient>
        <filter id="wp-arc-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Track */}
      <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(139,92,246,0.06)" strokeWidth={stroke} />
      {/* Value arc */}
      <circle
        cx={center} cy={center} r={radius} fill="none"
        stroke="url(#wp-arc-grad)" strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        transform={`rotate(-90 ${center} ${center})`}
        filter="url(#wp-arc-glow)"
        style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.22,1,0.36,1)' }}
      />
    </svg>
  );
}

/* ── Delta Arrow ─────────────────────────────── */
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

/* ── Main Component ──────────────────────────── */
export default function WorldPulseRing({ worldPulse }) {
  const value = worldPulse?.value;
  const hasValue = value !== null && value !== undefined && Number.isFinite(Number(value));
  const pct = hasValue ? Number(value) : 0;
  const SIZE = 300;

  return (
    <section className="world-pulse-card wp-ring-card">
      <div className="wp-ring-scene" style={{ width: SIZE, height: SIZE }}>
        <HoloSpherePulse size={SIZE} pulseValue={pct} />
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
