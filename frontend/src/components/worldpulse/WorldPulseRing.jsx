import { useEffect, useRef, useMemo } from 'react';

/* ── Heartbeat Pulse Canvas — beats then ripples radiate outward ── */
function HeartbeatPulse({ size, pulseValue }) {
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  const ripplesRef = useRef([]);

  const intensity = useMemo(() => {
    if (!pulseValue || pulseValue <= 0) return 0.3;
    return Math.max(0.3, Math.min(1, pulseValue / 100));
  }, [pulseValue]);

  /* Beat interval: higher pulse = faster heartbeat */
  const beatMs = useMemo(() => {
    return 2800 - intensity * 1200; // 2800ms (calm) → 1600ms (intense)
  }, [intensity]);

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
    const baseR = size * 0.34;
    let lastBeat = 0;

    function tick(now) {
      ctx.clearRect(0, 0, size, size);

      /* === HEARTBEAT: spawn a ripple on each beat === */
      if (now - lastBeat > beatMs) {
        lastBeat = now;
        ripplesRef.current.push({ born: now });
      }

      /* === Draw dotted orbit rings (static, subtle) === */
      const orbits = [
        { r: baseR * 1.15, dots: 64, dotR: 1.0, alpha: 0.08 },
        { r: baseR * 1.32, dots: 80, dotR: 0.8, alpha: 0.05 },
        { r: baseR * 1.48, dots: 100, dotR: 0.6, alpha: 0.035 },
      ];

      orbits.forEach((orbit) => {
        for (let i = 0; i < orbit.dots; i++) {
          const angle = (i / orbit.dots) * Math.PI * 2;
          const dx = cx + Math.cos(angle) * orbit.r;
          const dy = cy + Math.sin(angle) * orbit.r;
          ctx.beginPath();
          ctx.arc(dx, dy, orbit.dotR, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(139, 92, 246, ${orbit.alpha})`;
          ctx.fill();
        }
      });

      /* === Process ripples === */
      const RIPPLE_LIFE = 2200;
      ripplesRef.current = ripplesRef.current.filter((ripple) => {
        const age = now - ripple.born;
        if (age > RIPPLE_LIFE) return false;
        const t = age / RIPPLE_LIFE; // 0→1

        /* Ripple ring expands outward from the arc */
        const rippleR = baseR + t * (size * 0.22);
        const fadeAlpha = (1 - t) * 0.35 * intensity;
        const lineWidth = (1 - t) * 2.5;

        /* Main ripple ring */
        ctx.beginPath();
        ctx.arc(cx, cy, rippleR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(167, 139, 250, ${fadeAlpha})`;
        ctx.lineWidth = lineWidth;
        ctx.stroke();

        /* Second fainter ripple slightly behind */
        if (t > 0.1) {
          const r2 = baseR + (t - 0.1) * (size * 0.22);
          const a2 = (1 - t) * 0.15 * intensity;
          ctx.beginPath();
          ctx.arc(cx, cy, r2, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(94, 234, 212, ${a2})`;
          ctx.lineWidth = lineWidth * 0.5;
          ctx.stroke();
        }

        /* Light up dots near the ripple wave */
        orbits.forEach((orbit) => {
          const distToRipple = Math.abs(orbit.r - rippleR);
          if (distToRipple < 12) {
            const glowStrength = (1 - distToRipple / 12) * fadeAlpha * 2;
            for (let i = 0; i < orbit.dots; i++) {
              const angle = (i / orbit.dots) * Math.PI * 2;
              const dx = cx + Math.cos(angle) * orbit.r;
              const dy = cy + Math.sin(angle) * orbit.r;
              ctx.beginPath();
              ctx.arc(dx, dy, orbit.dotR + glowStrength * 3, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(196, 181, 253, ${glowStrength})`;
              ctx.fill();
            }
          }
        });

        return true;
      });

      /* === Subtle inner glow on beat (flash) === */
      const timeSinceBeat = now - lastBeat;
      if (timeSinceBeat < 300) {
        const flash = (1 - timeSinceBeat / 300) * 0.08 * intensity;
        const grad = ctx.createRadialGradient(cx, cy, baseR * 0.6, cx, cy, baseR);
        grad.addColorStop(0, `rgba(167, 139, 250, ${flash})`);
        grad.addColorStop(1, `rgba(139, 92, 246, 0)`);
        ctx.beginPath();
        ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      frameRef.current = requestAnimationFrame(tick);
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frameRef.current);
      ripplesRef.current = [];
    };
  }, [size, intensity, beatMs]);

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
        <HeartbeatPulse size={SIZE} pulseValue={pct} />
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
