import React, { useEffect, useRef, useState } from 'react';
import { Info, ChevronDown, Activity } from 'lucide-react';
import * as d3 from 'd3-geo';
import * as topojson from 'topojson-client';

/* Animated counter hook */
function useCountUp(target, duration = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const num = Number(target);
    if (!Number.isFinite(num)) { setValue(target); return; }
    let start = null;
    const from = 0;
    function step(ts) {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setValue(Math.round(from + (num - from) * eased));
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, [target, duration]);
  return value;
}

/* Threat level from value */
function getThreatLevel(value) {
  if (value >= 76) return { label: 'Extreme', color: 'var(--alert-extreme)', glow: 'rgba(220, 38, 38, 0.4)' };
  if (value >= 61) return { label: 'High', color: 'var(--alert-high)', glow: 'rgba(239, 68, 68, 0.3)' };
  if (value >= 46) return { label: 'Elevated', color: 'var(--alert-elevated)', glow: 'rgba(139, 92, 246, 0.3)' };
  if (value >= 26) return { label: 'Watch', color: 'var(--alert-watch)', glow: 'rgba(245, 158, 11, 0.3)' };
  return { label: 'Calm', color: 'var(--alert-calm)', glow: 'rgba(16, 185, 129, 0.3)' };
}

function DottedGlobe() {
  const canvasRef = useRef(null);
  const [worldData, setWorldData] = useState(null);

  useEffect(() => {
    fetch('https://unpkg.com/world-atlas@2.0.2/countries-110m.json')
      .then(res => res.json())
      .then(data => {
        const feature = topojson.feature(data, data.objects.countries);
        setWorldData(feature);
      });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !worldData) return;
    const ctx = canvas.getContext('2d');
    const size = 300;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const landDots = [];
    for (let lat = -90; lat <= 90; lat += 3.5) {
      for (let lon = -180; lon <= 180; lon += 3.5) {
        if (d3.geoContains(worldData, [lon, lat])) {
          const phi = (90 - lat) * (Math.PI / 180);
          const theta = (lon + 180) * (Math.PI / 180);
          landDots.push({ theta, phi });
        }
      }
    }
    
    const networkNodes = [];
    for (let i = 0; i < 40; i++) {
       networkNodes.push({
         theta: Math.random() * Math.PI * 2,
         phi: Math.acos((Math.random() * 2) - 1),
         speed: (Math.random() - 0.5) * 0.02,
         height: 1.05 + Math.random() * 0.15 
       });
    }

    let angleOffset = 0;
    let time = 0;
    let rafId = 0;
    let lastDrawAt = 0;

    function draw(timestamp = 0) {
      rafId = requestAnimationFrame(draw);
      if (timestamp - lastDrawAt < 66) return;
      lastDrawAt = timestamp;
      angleOffset += 0.0015;
      time += 0.01;
      ctx.clearRect(0, 0, size, size);
      const cx = size / 2;
      const cy = size / 2;
      const radius = size * 0.42;

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.5);
      grad.addColorStop(0, 'rgba(139,92,246,0.15)');
      grad.addColorStop(0.5, 'rgba(10,11,15,0.1)');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.15, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(139,92,246,0.06)';
      ctx.lineWidth = 1;
      ctx.stroke();

      const renderPoints = [];

      landDots.forEach(dot => {
        const theta = dot.theta + angleOffset;
        const x = radius * Math.sin(dot.phi) * Math.cos(theta);
        const y = radius * Math.cos(dot.phi);
        const z = radius * Math.sin(dot.phi) * Math.sin(theta);

        if (z > -radius * 0.1) {
          const depth = (z + radius) / (radius * 2);
          const scale = depth * 0.7 + 0.3;
          renderPoints.push({ x: cx + x, y: cy + y, z, depth, scale, type: 'land' });
        }
      });
      
      networkNodes.forEach(node => {
        const theta = node.theta + angleOffset * 1.5 + (time * node.speed);
        const r = radius * node.height;
        const x = r * Math.sin(node.phi) * Math.cos(theta);
        const y = r * Math.cos(node.phi);
        const z = r * Math.sin(node.phi) * Math.sin(theta);
        
        if (z > -r * 0.1) {
          renderPoints.push({ x: cx + x, y: cy + y, z, depth: (z + r) / (r * 2), type: 'node' });
        }
      });

      renderPoints.sort((a, b) => a.z - b.z);
      
      const nodesOnly = renderPoints.filter(p => p.type === 'node');
      ctx.strokeStyle = 'rgba(0,229,160,0.12)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i < nodesOnly.length; i++) {
        for (let j = i + 1; j < nodesOnly.length; j++) {
          const dx = nodesOnly[i].x - nodesOnly[j].x;
          const dy = nodesOnly[i].y - nodesOnly[j].y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < 60) {
            ctx.beginPath();
            ctx.moveTo(nodesOnly[i].x, nodesOnly[i].y);
            ctx.lineTo(nodesOnly[j].x, nodesOnly[j].y);
            ctx.stroke();
          }
        }
      }

      renderPoints.forEach(p => {
        ctx.beginPath();
        if (p.type === 'land') {
          ctx.arc(p.x, p.y, 1.2 * p.scale, 0, Math.PI * 2);
          // Emerald / Violet / Cyan based on position
          if (p.x > cx && p.y > cy) ctx.fillStyle = `rgba(0,229,160,${p.depth * 0.7})`;
          else if (p.x < cx) ctx.fillStyle = `rgba(139,92,246,${p.depth * 0.6})`;
          else ctx.fillStyle = `rgba(6,182,212,${p.depth * 0.7})`;
        } else {
          ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${p.depth})`;
          ctx.shadowBlur = 8;
          ctx.shadowColor = '#00E5A0';
        }
        ctx.fill();
        ctx.shadowBlur = 0;
      });
    }
    
    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [worldData]);

  return (
    <div className="wpr-globe-container">
      <div className="wpr-globe-halo" />
      <div className="wpr-globe-halo-secondary" />
      <canvas ref={canvasRef} className="wpr-globe-canvas" />
    </div>
  );
}

function SegmentedRing({ score }) {
  const [isHovered, setIsHovered] = useState(false);
  const size = 320;
  const radius = 140;
  const cx = size / 2;
  const cy = size / 2;
  
  const startArch = 140;
  const endArch = 40;
  
  const segments = 24;
  const gap = 2;
  
  const arcs = [];
  let currentAngle = startArch;
  
  for (let i = 0; i < segments; i++) {
    let distFromTop = Math.abs(currentAngle - 270);
    if (distFromTop > 180) distFromTop = 360 - distFromTop;
    
    const factor = 1 - (distFromTop / 130); 
    const arcLength = 4 + (factor * 12);
    
    const startA = (currentAngle) * (Math.PI / 180);
    const endA = (currentAngle + arcLength) * (Math.PI / 180);
    
    const x1 = cx + radius * Math.cos(startA);
    const y1 = cy + radius * Math.sin(startA);
    const x2 = cx + radius * Math.cos(endA);
    const y2 = cy + radius * Math.sin(endA);
    
    const segmentPct = (i / segments) * 100;
    const isActive = segmentPct <= score;
    
    let color = 'rgba(255,255,255,0.03)';
    if (isActive) {
      if (segmentPct < 25) color = '#10B981';
      else if (segmentPct < 50) color = '#8B5CF6';
      else if (segmentPct < 75) color = '#EF4444';
      else color = '#DC2626';
    }
    
    arcs.push(
      <path 
        key={i}
        d={`M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        style={{ filter: isActive ? `drop-shadow(0 0 6px ${color})` : 'none', transition: 'all 0.4s ease' }}
      />
    );
    
    currentAngle = (currentAngle + arcLength + gap) % 360;
    if (currentAngle > endArch && currentAngle < startArch) break;
  }

  return (
    <svg 
      width={size} height={size} viewBox={`0 0 ${size} ${size}`} 
      className={`wpr-ring-svg ${isHovered ? 'wpr-ring-hovered' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <defs>
        <filter id="ringGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {arcs}
    </svg>
  );
}

export default function WorldPulseRing({ worldPulse }) {
  const rawValue = worldPulse?.value;
  const value = rawValue != null ? rawValue : 0;
  const delta = worldPulse?.delta || 0;
  const animatedValue = useCountUp(value);
  const threat = getThreatLevel(value);

  const tierColors = [
    { label: 'Calm', color: 'var(--alert-calm)' },
    { label: 'Watch', color: 'var(--alert-watch)' },
    { label: 'Elevated', color: 'var(--alert-elevated)' },
    { label: 'High', color: 'var(--alert-high)' },
    { label: 'Extreme', color: 'var(--alert-extreme)' },
  ];

  return (
    <section className="wp-card world-pulse-main-card wpr-card">
      <div className="wpr-header">
        <div className="wpr-header-left">
          <Activity size={16} className="wpr-header-icon" />
          <span className="wpr-title">WORLD PULSE</span>
          <Info size={13} className="wpr-info-icon" />
        </div>
        <button className="wpr-period-btn">
          24H <ChevronDown size={13} />
        </button>
      </div>

      <div className="wpr-center-area">
        <DottedGlobe />
        <SegmentedRing score={value} />
        
        <div className="wpr-value-display">
          <div className="wpr-value" style={{ filter: `drop-shadow(0 0 20px ${threat.glow})` }}>
            {animatedValue}
          </div>
          <div className="wpr-label" style={{ color: threat.color }}>
            {threat.label}
          </div>
          {delta !== 0 && delta != null && (
            <div className={`wpr-delta ${delta > 0 ? 'wpr-delta-up' : 'wpr-delta-down'}`}>
              {delta > 0 ? '↑' : '↓'} {Math.abs(delta)} from yesterday
            </div>
          )}
        </div>
      </div>

      <div className="wpr-scale">
        <div className="wpr-scale-labels-top">
          <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
        </div>
        <div className="wpr-scale-bars">
          {tierColors.map((tier, i) => (
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
        <p className="wpr-description">Global intensity of events across all key dimensions.</p>
      </div>
    </section>
  );
}
