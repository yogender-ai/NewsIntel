import { useEffect, useRef, useMemo } from 'react';

/* ── Heartbeat Wave Ring — draws N ripple circles that pulse outward ── */
function HeartbeatCanvas({ size, pulseValue }) {
  const canvasRef = useRef(null);
  const stateRef  = useRef({ rings: [], frame: null, last: 0 });

  /* spawn timing: faster when pulse is higher */
  const spawnInterval = useMemo(() => {
    const t = Math.max(0, Math.min(1, (pulseValue - 20) / 80));
    return 2400 - t * 1200; // 2400ms (quiet) → 1200ms (intense)
  }, [pulseValue]);

  useEffect(() => {
    const canvas  = canvasRef.current;
    if (!canvas) return;
    const ctx     = canvas.getContext('2d');
    const dpr     = window.devicePixelRatio || 1;
    const pxSize  = size * dpr;
    canvas.width  = pxSize;
    canvas.height = pxSize;
    canvas.style.width  = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;

    /* ring lifecycle:  r grows 0→maxR, alpha fades 1→0 */
    const maxR = size * 0.48;
    const DURATION = 2800; // ms per ring

    const spawnRing = (now) => {
      stateRef.current.rings.push({ born: now });
      stateRef.current.last = now;
    };

    const tick = (now) => {
      /* auto-spawn */
      if (now - stateRef.current.last >= spawnInterval) spawnRing(now);

      ctx.clearRect(0, 0, size, size);

      stateRef.current.rings = stateRef.current.rings.filter(ring => {
        const age = now - ring.born;
        if (age > DURATION) return false;

        const t     = age / DURATION;           /* 0 → 1 */
        const r     = maxR * easeOut(t);
        const alpha = (1 - t) * 0.55;

        /* purple→blue gradient stroke */
        const grad = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r);
        grad.addColorStop(0, `rgba(139, 92, 246, ${alpha})`);   /* violet */
        grad.addColorStop(0.5, `rgba(99, 102, 241, ${alpha * 0.7})`); /* indigo */
        grad.addColorStop(1, `rgba(59, 130, 246, 0)`);           /* blue fade */

        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = grad;
        ctx.lineWidth   = Math.max(1, (1 - t) * 3.5);
        ctx.stroke();

        /* subtle dot cluster around ring perimeter */
        if (r > maxR * 0.2) {
          const dotCount = 24;
          const dotAlpha = alpha * 0.6;
          for (let d = 0; d < dotCount; d++) {
            const angle = (d / dotCount) * Math.PI * 2 + t * 0.4;
            const dx    = cx + Math.cos(angle) * r;
            const dy    = cy + Math.sin(angle) * r;
            ctx.beginPath();
            ctx.arc(dx, dy, (1 - t) * 1.6, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(167, 139, 250, ${dotAlpha})`;
            ctx.fill();
          }
        }
        return true;
      });

      stateRef.current.frame = requestAnimationFrame(tick);
    };

    /* kick off with two staggered rings */
    const now = performance.now();
    spawnRing(now - spawnInterval * 0.5);
    stateRef.current.frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(stateRef.current.frame);
      stateRef.current.rings = [];
    };
  }, [size, spawnInterval]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      aria-hidden="true"
    />
  );
}

function easeOut(t) {
  return 1 - Math.pow(1 - t, 2.2);
}

/* ── Arc Ring SVG ────────────────────────────── */
function ArcRing({ value, size }) {
  const id      = 'wp-ring-grad';
  const filterId = 'wp-glow';
  const center  = size / 2;
  const radius  = size * 0.345; // slightly inside canvas
  const circ    = 2 * Math.PI * radius;
  const pct     = Math.max(0, Math.min(100, Number(value) || 0));
  const offset  = circ - (pct / 100) * circ;
  const stroke  = size * 0.042;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ position: 'absolute', inset: 0 }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#7c3aed" />
          <stop offset="45%"  stopColor="#818cf8" />
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

      {/* track */}
      <circle
        cx={center} cy={center} r={radius}
        fill="none"
        stroke="rgba(139,92,246,0.12)"
        strokeWidth={stroke}
      />

      {/* value arc */}
      <circle
        cx={center} cy={center} r={radius}
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${center} ${center})`}
        filter={`url(#${filterId})`}
        style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }}
      />

      {/* inner dotted orbit */}
      <circle
        cx={center} cy={center} r={radius * 1.18}
        fill="none"
        stroke="rgba(139,92,246,0.18)"
        strokeWidth="1"
        strokeDasharray="3 9"
        style={{ transformOrigin: 'center', animation: 'orbitSpin 42s linear infinite' }}
      />
    </svg>
  );
}

/* ── Delta Arrow ─────────────────────────────── */
function DeltaArrow({ delta }) {
  if (delta === null || delta === undefined) return null;
  const up  = delta > 0;
  const dn  = delta < 0;
  const cls = up ? 'wp-ring-up' : dn ? 'wp-ring-down' : 'wp-ring-neutral';
  const sym = up ? '↑' : dn ? '↓' : '—';
  const abs = Math.abs(delta);
  return (
    <span className={`wp-ring-delta ${cls}`}>
      {sym} {abs} from yesterday
    </span>
  );
}

/* ── Main Component ──────────────────────────── */
export default function WorldPulseRing({ worldPulse }) {
  const value = worldPulse?.value;
  const pct   = value === null || value === undefined ? 0 : Number(value);
  const SIZE  = 300;

  return (
    <section className="world-pulse-card wp-ring-card">
      <div className="wp-ring-scene" style={{ width: SIZE, height: SIZE }}>
        {/* Layer 0: heartbeat ripple canvas */}
        <HeartbeatCanvas size={SIZE} pulseValue={pct} />

        {/* Layer 1: gradient arc SVG */}
        <ArcRing value={pct} size={SIZE} />

        {/* Layer 2: center content */}
        <div className="wp-ring-center">
          <span className="wp-ring-eyebrow">WORLD PULSE</span>
          <span className="wp-ring-value">
            {value === null || value === undefined ? '—' : Math.round(value)}
          </span>
          <span className="wp-ring-label">
            {worldPulse?.label || 'Calibrating'}
          </span>
          <DeltaArrow delta={worldPulse?.delta} />
        </div>
      </div>

      <p className="wp-ring-copy">
        Overall global intensity of events<br />across all key dimensions.
      </p>
    </section>
  );
}
