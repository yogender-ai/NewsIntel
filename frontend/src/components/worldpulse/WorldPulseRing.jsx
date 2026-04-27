import { useEffect, useRef, useMemo } from 'react';

/* ── ECG Heartbeat Canvas — real medical-style waveform ── */
function HeartbeatCanvas({ size, pulseValue }) {
  const canvasRef = useRef(null);
  const frameRef = useRef(null);

  const bpm = useMemo(() => {
    if (!pulseValue || pulseValue <= 0) return 40;
    const t = Math.max(0, Math.min(1, (pulseValue - 10) / 90));
    return 40 + t * 80; // 40bpm (quiet) → 120bpm (intense)
  }, [pulseValue]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const pxSize = size * dpr;
    canvas.width = pxSize;
    canvas.height = pxSize;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const radius = size * 0.38;
    let phase = 0;

    /* ECG-style waveform shape */
    function ecgSample(t) {
      t = t % 1;
      if (t < 0.1) return 0;
      if (t < 0.15) return Math.sin((t - 0.1) / 0.05 * Math.PI) * 0.15;
      if (t < 0.2) return 0;
      if (t < 0.24) return -0.1;
      if (t < 0.28) return ((t - 0.24) / 0.04) * 1.0;
      if (t < 0.32) return 1.0 - ((t - 0.28) / 0.04) * 1.3;
      if (t < 0.36) return -0.3 + ((t - 0.32) / 0.04) * 0.3;
      if (t < 0.42) return Math.sin((t - 0.36) / 0.06 * Math.PI) * 0.2;
      if (t < 0.48) return Math.sin((t - 0.42) / 0.06 * Math.PI) * 0.12;
      return 0;
    }

    function tick(now) {
      const beatDuration = 60000 / bpm;
      phase = (now % beatDuration) / beatDuration;

      ctx.clearRect(0, 0, size, size);

      /* Ripple rings that pulse with heartbeat */
      const beatPhase = phase;
      const rippleAlpha = Math.max(0, 0.3 - beatPhase * 0.35);
      const rippleScale = 1 + beatPhase * 0.3;

      for (let i = 0; i < 3; i++) {
        const rPhase = (beatPhase + i * 0.33) % 1;
        const rAlpha = Math.max(0, 0.25 - rPhase * 0.3);
        const rScale = 1 + rPhase * 0.35;
        if (rAlpha > 0.01) {
          ctx.beginPath();
          ctx.arc(cx, cy, radius * rScale, 0, Math.PI * 2);
          const grad = ctx.createRadialGradient(cx, cy, radius * rScale * 0.8, cx, cy, radius * rScale);
          grad.addColorStop(0, `rgba(139, 92, 246, ${rAlpha})`);
          grad.addColorStop(1, `rgba(139, 92, 246, 0)`);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      /* Draw ECG waveform around the ring */
      const totalPoints = 180;
      ctx.beginPath();
      for (let i = 0; i <= totalPoints; i++) {
        const angle = (i / totalPoints) * Math.PI * 2 - Math.PI / 2;
        const sampleT = ((i / totalPoints) + phase * 2) % 1;
        const amplitude = ecgSample(sampleT) * (size * 0.06);
        const r = radius + amplitude;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = `rgba(167, 139, 250, 0.6)`;
      ctx.lineWidth = 1.8;
      ctx.shadowColor = 'rgba(139, 92, 246, 0.5)';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;

      /* Glowing dot that traces the waveform */
      const dotAngle = phase * Math.PI * 2 - Math.PI / 2;
      const dotSample = ecgSample(phase * 2 % 1);
      const dotR = radius + dotSample * (size * 0.06);
      const dotX = cx + Math.cos(dotAngle) * dotR;
      const dotY = cy + Math.sin(dotAngle) * dotR;

      ctx.beginPath();
      ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#c084fc';
      ctx.shadowColor = 'rgba(192, 132, 252, 0.8)';
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;

      frameRef.current = requestAnimationFrame(tick);
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [size, bpm]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      aria-hidden="true"
    />
  );
}

/* ── Arc Ring SVG ────────────────────────────── */
function ArcRing({ value, size }) {
  const id = 'wp-ring-grad';
  const filterId = 'wp-glow';
  const center = size / 2;
  const radius = size * 0.345;
  const circ = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const offset = circ - (pct / 100) * circ;
  const stroke = size * 0.042;

  return (
    <svg
      width={size} height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ position: 'absolute', inset: 0 }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="45%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#c084fc" />
        </linearGradient>
        <filter id={filterId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(139,92,246,0.08)" strokeWidth={stroke} />
      <circle
        cx={center} cy={center} r={radius} fill="none"
        stroke={`url(#${id})`} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        transform={`rotate(-90 ${center} ${center})`}
        filter={`url(#${filterId})`}
        style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }}
      />
      <circle
        cx={center} cy={center} r={radius * 1.18} fill="none"
        stroke="rgba(139,92,246,0.12)" strokeWidth="1" strokeDasharray="3 9"
        style={{ transformOrigin: 'center', animation: 'orbitSpin 42s linear infinite' }}
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
  const abs = Math.abs(delta);
  return (
    <span className={`wp-ring-delta ${cls}`}>
      {sym} {abs} from yesterday
    </span>
  );
}

/* ── Main Component — NO hardcoded values ────── */
export default function WorldPulseRing({ worldPulse }) {
  const value = worldPulse?.value;
  const hasValue = value !== null && value !== undefined && Number.isFinite(Number(value));
  const pct = hasValue ? Number(value) : 0;
  const SIZE = 300;

  return (
    <section className="world-pulse-card wp-ring-card">
      <div className="wp-ring-scene" style={{ width: SIZE, height: SIZE }}>
        <HeartbeatCanvas size={SIZE} pulseValue={pct} />
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
          ? <>Live global intensity of events<br />across all key dimensions.</>
          : <>Waiting for backend pulse data.<br />No fallback values used.</>
        }
      </p>
    </section>
  );
}
