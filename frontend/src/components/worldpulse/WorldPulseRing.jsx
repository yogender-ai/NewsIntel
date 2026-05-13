import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Info, ChevronDown, Activity } from 'lucide-react';
import * as d3 from 'd3-geo';
import * as topojson from 'topojson-client';

let worldDataPromise = null;
let cachedWorldData = null;
let cachedLandDots = null;

/* ── Animated counter hook ── */
function useCountUp(target, duration = 1400) {
  const [value, setValue] = useState(0);
  const targetRef = useRef(target);
  useEffect(() => {
    targetRef.current = target;
    const num = Number(target);
    if (!Number.isFinite(num)) { setValue(target); return; }
    let start = null;
    function step(ts) {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setValue(Math.round(eased * num));
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, [target, duration]);
  return value;
}

/* ── Threat level from value ── */
function getThreatLevel(value) {
  if (value >= 76) return { label: 'Extreme', color: '#DC2626', glow: '0 0 40px rgba(220, 38, 38, 0.5)', shadowColor: 'rgba(220,38,38,0.3)' };
  if (value >= 61) return { label: 'High', color: '#EF4444', glow: '0 0 40px rgba(239, 68, 68, 0.4)', shadowColor: 'rgba(239,68,68,0.25)' };
  if (value >= 46) return { label: 'Elevated', color: '#8B5CF6', glow: '0 0 40px rgba(139, 92, 246, 0.4)', shadowColor: 'rgba(139,92,246,0.25)' };
  if (value >= 26) return { label: 'Watch', color: '#F59E0B', glow: '0 0 40px rgba(245, 158, 11, 0.4)', shadowColor: 'rgba(245,158,11,0.2)' };
  return { label: 'Calm', color: '#00E5A0', glow: '0 0 40px rgba(0, 229, 160, 0.4)', shadowColor: 'rgba(0,229,160,0.2)' };
}

/* ── 3D Dotted Globe ── */
function DottedGlobe() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [worldData, setWorldData] = useState(null);
  const visibleRef = useRef(true);

  useEffect(() => {
    if (cachedWorldData) {
      setWorldData(cachedWorldData);
      return;
    }
    if (!worldDataPromise) {
      worldDataPromise = fetch('https://unpkg.com/world-atlas@2.0.2/countries-110m.json')
        .then(r => r.json())
        .then(data => topojson.feature(data, data.objects.countries));
    }
    let cancelled = false;
    worldDataPromise
      .then((data) => {
        cachedWorldData = data;
        if (!cancelled) setWorldData(data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || !('IntersectionObserver' in window)) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      visibleRef.current = Boolean(entry?.isIntersecting);
    }, { rootMargin: '160px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !worldData) return;
    const ctx = canvas.getContext('2d');
    const size = 280;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    if (!cachedLandDots) {
      cachedLandDots = [];
      for (let lat = -90; lat <= 90; lat += 5.5) {
        for (let lon = -180; lon <= 180; lon += 5.5) {
          if (d3.geoContains(worldData, [lon, lat])) {
            cachedLandDots.push({
              phi: (90 - lat) * (Math.PI / 180),
              theta: (lon + 180) * (Math.PI / 180),
            });
          }
        }
      }
    }
    const landDots = cachedLandDots;

    // Orbiting data particles — reduced count for perf
    const particles = Array.from({ length: 8 }, () => ({
      theta: Math.random() * Math.PI * 2,
      phi: Math.acos((Math.random() * 2) - 1),
      speed: (Math.random() - 0.5) * 0.025,
      h: 1.05 + Math.random() * 0.12,
      life: Math.random(),
    }));

    let angle = 0;
    let t = 0;
    let raf = 0;
    let last = 0;
    const cx = size / 2, cy = size / 2, r = size * 0.38;

    function draw(ts = 0) {
      raf = requestAnimationFrame(draw);
      if (!visibleRef.current || document.visibilityState === 'hidden') return;
      if (ts - last < 50) return;
      last = ts;
      angle += 0.002;
      t += 0.015;
      ctx.clearRect(0, 0, size, size);

      // Atmospheric glow
      const grd = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 1.4);
      grd.addColorStop(0, 'rgba(139,92,246,0.08)');
      grd.addColorStop(0.5, 'rgba(0,229,160,0.03)');
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, size, size);

      // Orbit rings
      [0.95, 1.1, 1.25].forEach((scale, i) => {
        ctx.beginPath();
        ctx.arc(cx, cy, r * scale, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(139,92,246,${0.035 - i * 0.01})`;
        ctx.lineWidth = 0.5;
        ctx.setLineDash([2, 6]);
        ctx.stroke();
        ctx.setLineDash([]);
      });

      const points = [];

      // Land dots
      landDots.forEach(dot => {
        const th = dot.theta + angle;
        const x = r * Math.sin(dot.phi) * Math.cos(th);
        const y = r * Math.cos(dot.phi);
        const z = r * Math.sin(dot.phi) * Math.sin(th);
        if (z > -r * 0.15) {
          const d = (z + r) / (r * 2);
          points.push({ x: cx + x, y: cy + y, z, d, type: 'land' });
        }
      });

      // Particles
      particles.forEach(p => {
        const th = p.theta + angle * 1.8 + (t * p.speed);
        const pr = r * p.h;
        const x = pr * Math.sin(p.phi) * Math.cos(th);
        const y = pr * Math.cos(p.phi);
        const z = pr * Math.sin(p.phi) * Math.sin(th);
        p.life = (p.life + 0.002) % 1;
        if (z > -pr * 0.1) {
          points.push({ x: cx + x, y: cy + y, z, d: (z + pr) / (pr * 2), type: 'particle', life: p.life });
        }
      });

      points.sort((a, b) => a.z - b.z);

      // Particle connections removed for performance (O(n²) per frame was expensive)

      // Draw all points
      points.forEach(p => {
        ctx.beginPath();
        if (p.type === 'land') {
          const s = p.d * 0.6 + 0.4;
          ctx.arc(p.x, p.y, 1.1 * s, 0, Math.PI * 2);
          // Color by hemisphere for visual richness
          const hue = (p.x > cx) ? `rgba(0,229,160,${p.d * 0.65})` : `rgba(139,92,246,${p.d * 0.55})`;
          ctx.fillStyle = p.y < cy ? hue : `rgba(6,182,212,${p.d * 0.6})`;
        } else {
          ctx.arc(p.x, p.y, 1.8 + Math.sin(p.life * Math.PI * 2) * 0.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0,229,160,${p.d * 0.8})`;
          ctx.shadowBlur = 6;
          ctx.shadowColor = '#00E5A0';
        }
        ctx.fill();
        ctx.shadowBlur = 0;
      });
    }

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [worldData]);

  return (
    <div className="wpr-globe-container" ref={containerRef}>
      <div className="wpr-globe-halo" />
      <div className="wpr-globe-halo-secondary" />
      <canvas ref={canvasRef} className="wpr-globe-canvas" />
    </div>
  );
}

/* ── Neon Segmented Arc Ring ── */
function NeonRing({ score, threat }) {
  const size = 330;
  const r = 148;
  const cx = size / 2;
  const cy = size / 2;
  const totalArc = 280; // degrees of arc
  const startAngle = 130; // start from bottom-left
  const segments = 60;
  const segmentArc = totalArc / segments;
  const gap = 0.8;

  const filled = Math.round((score / 100) * segments);

  const arcs = [];
  for (let i = 0; i < segments; i++) {
    const angle = startAngle + i * segmentArc;
    const a1 = (angle + gap / 2) * (Math.PI / 180);
    const a2 = (angle + segmentArc - gap / 2) * (Math.PI / 180);

    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2);
    const y2 = cy + r * Math.sin(a2);

    const isActive = i < filled;
    let color = 'rgba(255,255,255,0.04)';
    if (isActive) {
      const pct = (i / segments) * 100;
      if (pct < 25) color = '#00E5A0';
      else if (pct < 45) color = '#06B6D4';
      else if (pct < 60) color = '#8B5CF6';
      else if (pct < 80) color = '#EF4444';
      else color = '#DC2626';
    }

    arcs.push(
      <path
        key={i}
        d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`}
        fill="none"
        stroke={color}
        strokeWidth={isActive ? 5 : 3}
        strokeLinecap="round"
        style={{
          opacity: isActive ? 1 : 0.4,
        }}
      />
    );
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="wpr-ring-svg">
      <defs>
        <filter id="wprGlow"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      {arcs}
    </svg>
  );
}

/* ── Main Component ── */
export default function WorldPulseRing({ worldPulse }) {
  const rawValue = worldPulse?.value;
  const value = rawValue != null ? rawValue : 0;
  const delta = worldPulse?.delta || 0;
  const animatedValue = useCountUp(value);
  const threat = getThreatLevel(value);

  const tierColors = useMemo(() => [
    { label: 'Calm', color: '#00E5A0' },
    { label: 'Watch', color: '#F59E0B' },
    { label: 'Elevated', color: '#8B5CF6' },
    { label: 'High', color: '#EF4444' },
    { label: 'Extreme', color: '#DC2626' },
  ], []);

  return (
    <section className="wp-card world-pulse-main-card wpr-card">
      <div className="wpr-header">
        <div className="wpr-header-left">
          <Activity size={16} className="wpr-header-icon" />
          <span className="wpr-title">WORLD PULSE</span>
          <Info size={13} className="wpr-info-icon" />
        </div>
        <button className="wpr-period-btn">24H <ChevronDown size={13} /></button>
      </div>

      <div className="wpr-center-area">
        <DottedGlobe />
        <NeonRing score={value} threat={threat} />

        <div className="wpr-value-display">
          <div className="wpr-value" style={{ textShadow: threat.glow }}>{animatedValue}</div>
          <div className="wpr-label" style={{ color: threat.color }}>{threat.label}</div>
          {delta !== 0 && delta != null && (
            <div className={`wpr-delta ${delta > 0 ? 'wpr-delta-up' : 'wpr-delta-down'}`}>
              {delta > 0 ? '▲' : '▼'} {Math.abs(delta)} from yesterday
            </div>
          )}
        </div>
      </div>

      <div className="wpr-scale">
        <div className="wpr-scale-labels-top">
          <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
        </div>
        <div className="wpr-scale-bars">
          {tierColors.map(tier => (
            <div
              key={tier.label}
              className={`wpr-scale-bar ${tier.label === threat.label ? 'wpr-scale-active' : ''}`}
              style={{ background: tier.color }}
            />
          ))}
        </div>
        <div className="wpr-scale-labels-bottom">
          {tierColors.map(tier => (
            <span key={tier.label} style={{ color: tier.color }}>{tier.label}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
