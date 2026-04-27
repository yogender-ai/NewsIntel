import { useEffect, useRef, useMemo } from 'react';

/* ── Breathing Ripple Canvas — slow pulsing rings that fade like a heartbeat ── */
function BreathingRipple({ size, pulseValue }) {
  const canvasRef = useRef(null);
  const frameRef = useRef(null);

  const intensity = useMemo(() => {
    if (!pulseValue || pulseValue <= 0) return 0.3;
    return Math.max(0.3, Math.min(1, pulseValue / 100));
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
    const baseRadius = size * 0.34;

    function tick(now) {
      ctx.clearRect(0, 0, size, size);

      /* Slow breathing cycle — 4 seconds per full breath */
      const breathCycle = 4000;
      const breathPhase = (now % breathCycle) / breathCycle;
      /* Smooth sine breathing */
      const breath = Math.sin(breathPhase * Math.PI * 2) * 0.5 + 0.5;

      /* Draw 3 concentric dotted orbit rings */
      const rings = [
        { r: baseRadius * 1.18, dots: 60, dotSize: 1.2, speed: 0.00003, alpha: 0.15 },
        { r: baseRadius * 1.35, dots: 80, dotSize: 1.0, speed: -0.00002, alpha: 0.10 },
        { r: baseRadius * 1.52, dots: 100, dotSize: 0.8, speed: 0.000015, alpha: 0.07 },
      ];

      rings.forEach((ring) => {
        const rotation = now * ring.speed;
        /* Ripple: some dots glow brighter in a wave pattern */
        for (let i = 0; i < ring.dots; i++) {
          const angle = rotation + (i / ring.dots) * Math.PI * 2;
          const dx = cx + Math.cos(angle) * ring.r;
          const dy = cy + Math.sin(angle) * ring.r;

          /* Wave effect — a "pulse" of brightness travels around the ring */
          const wavePos = (now * 0.0004 * intensity) % 1;
          const dotPos = i / ring.dots;
          const dist = Math.abs(dotPos - wavePos);
          const waveDist = Math.min(dist, 1 - dist); // wrap-around distance
          const waveGlow = Math.max(0, 1 - waveDist * 8); // sharp falloff

          const dotAlpha = ring.alpha + waveGlow * 0.5 * intensity;
          const dotR = ring.dotSize + waveGlow * 1.5 * intensity;

          ctx.beginPath();
          ctx.arc(dx, dy, dotR, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(167, 139, 250, ${dotAlpha})`;
          ctx.fill();

          /* Extra glow on wave peak */
          if (waveGlow > 0.3) {
            ctx.beginPath();
            ctx.arc(dx, dy, dotR * 2.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(139, 92, 246, ${waveGlow * 0.15 * intensity})`;
            ctx.fill();
          }
        }
      });

      /* Breathing ripple — a single soft ring that expands/contracts */
      const rippleR = baseRadius * (1.05 + breath * 0.12);
      const rippleAlpha = (1 - breath) * 0.12 * intensity;
      ctx.beginPath();
      ctx.arc(cx, cy, rippleR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(139, 92, 246, ${rippleAlpha})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      /* Second ripple slightly delayed */
      const breath2 = Math.sin((breathPhase + 0.3) * Math.PI * 2) * 0.5 + 0.5;
      const rippleR2 = baseRadius * (1.1 + breath2 * 0.15);
      const rippleAlpha2 = (1 - breath2) * 0.08 * intensity;
      ctx.beginPath();
      ctx.arc(cx, cy, rippleR2, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(94, 234, 212, ${rippleAlpha2})`;
      ctx.lineWidth = 1;
      ctx.stroke();

      frameRef.current = requestAnimationFrame(tick);
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [size, intensity]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      aria-hidden="true"
    />
  );
}

/* ── Arc Ring SVG — the main value arc ────────────────── */
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

      {/* Track ring */}
      <circle
        cx={center} cy={center} r={radius}
        fill="none" stroke="rgba(139,92,246,0.06)" strokeWidth={stroke}
      />

      {/* Value arc */}
      <circle
        cx={center} cy={center} r={radius}
        fill="none" stroke="url(#wp-arc-grad)"
        strokeWidth={stroke} strokeLinecap="round"
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
        {/* Layer 0: breathing dotted orbits + ripple */}
        <BreathingRipple size={SIZE} pulseValue={pct} />

        {/* Layer 1: gradient arc */}
        <ArcRing value={pct} size={SIZE} />

        {/* Layer 2: center content */}
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
