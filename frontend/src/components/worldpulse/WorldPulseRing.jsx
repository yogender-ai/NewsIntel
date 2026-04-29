import React, { useEffect, useRef } from 'react';
import { Info, ChevronDown, Activity } from 'lucide-react';

function DottedGlobe() {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = 260;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    let angleOffset = 0;
    
    const dots = [];
    const numDots = 800;
    for (let i = 0; i < numDots; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      dots.push({ theta, phi, size: Math.random() * 1.5 + 0.5 });
    }

    function draw() {
      angleOffset += 0.002;
      ctx.clearRect(0, 0, size, size);
      const cx = size / 2;
      const cy = size / 2;
      const radius = size * 0.45;

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      grad.addColorStop(0, 'rgba(139,92,246,0.15)');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);

      dots.forEach(dot => {
        const theta = dot.theta + angleOffset;
        const x = radius * Math.sin(dot.phi) * Math.cos(theta);
        const y = radius * Math.cos(dot.phi);
        const z = radius * Math.sin(dot.phi) * Math.sin(theta);

        if (z > -radius * 0.2) {
          const depth = (z + radius) / (radius * 2);
          const scale = depth * 0.8 + 0.2;
          
          const px = cx + x;
          const py = cy + y;
          
          ctx.beginPath();
          ctx.arc(px, py, dot.size * scale, 0, Math.PI * 2);
          
          if (x > 0 && y < 0) {
            ctx.fillStyle = `rgba(244,114,182,${depth * 0.8})`; 
          } else if (x < 0 && y > 0) {
            ctx.fillStyle = `rgba(94,234,212,${depth * 0.6})`; 
          } else {
            ctx.fillStyle = `rgba(167,139,250,${depth * 0.7})`; 
          }
          
          ctx.fill();
        }
      });
      requestAnimationFrame(draw);
    }
    
    const animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' }} />;
}

function SegmentedRing({ score }) {
  const size = 320;
  const radius = 140;
  const cx = size / 2;
  const cy = size / 2;
  const segments = 40;
  const gap = 3;
  const arcPerSegment = (360 - gap * segments) / segments;
  
  const arcs = [];
  for (let i = 0; i < segments; i++) {
    const startAngle = (i * (arcPerSegment + gap) - 90) * (Math.PI / 180);
    const endAngle = (startAngle + arcPerSegment * (Math.PI / 180));
    
    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);
    
    const segmentPct = (i / segments) * 100;
    const isActive = segmentPct <= score;
    
    let color = 'rgba(255,255,255,0.05)';
    if (isActive) {
      if (segmentPct < 25) color = '#3b82f6';
      else if (segmentPct < 50) color = '#8b5cf6';
      else if (segmentPct < 75) color = '#f43f5e';
      else color = '#ef4444';
    }
    
    arcs.push(
      <path 
        key={i}
        d={`M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="butt"
      />
    );
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
      {arcs}
    </svg>
  );
}

export default function WorldPulseRing({ worldPulse }) {
  const value = worldPulse?.value || 58;
  const delta = worldPulse?.delta || 5;

  return (
    <section className="wp-card world-pulse-main-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '24px' }}>
      <div className="wp-section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={18} color="#fff" />
          <span style={{ fontSize: '14px', fontWeight: '800', letterSpacing: '0.05em', color: '#fff' }}>WORLD PULSE</span>
          <Info size={14} color="#64748b" />
        </div>
        <button style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '8px', color: '#e2e8f0', fontSize: '12px', fontWeight: '600' }}>
          24H <ChevronDown size={14} />
        </button>
      </div>

      <div style={{ position: 'relative', width: '100%', height: '340px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '10px' }}>
        <DottedGlobe />
        <SegmentedRing score={value} />
        
        <div style={{ position: 'absolute', textAlign: 'center', zIndex: 10 }}>
          <div style={{ fontSize: '84px', fontWeight: '900', lineHeight: '1', color: '#fff', textShadow: '0 0 20px rgba(255,255,255,0.3)' }}>
            {value}
          </div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#c084fc', marginTop: '4px' }}>
            Elevated
          </div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#34d399', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
            ↑ {Math.abs(delta)} from yesterday
          </div>
        </div>
      </div>

      <div className="pulse-scale" style={{ marginTop: 'auto', paddingTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '11px', color: '#64748b', fontWeight: '600', padding: '0 4px' }}>
          <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
        </div>
        <div style={{ display: 'flex', gap: '4px', height: '6px', width: '100%' }}>
          <div style={{ flex: 1, background: '#1e3a8a', borderRadius: '4px' }}></div>
          <div style={{ flex: 1, background: '#312e81', borderRadius: '4px' }}></div>
          <div style={{ flex: 1, background: '#a855f7', borderRadius: '4px', position: 'relative', boxShadow: '0 0 10px rgba(168, 85, 247, 0.5)' }}>
             <div style={{ position: 'absolute', inset: '-1px', borderRadius: '5px', background: 'rgba(255,255,255,0.8)' }}></div>
             <div style={{ position: 'absolute', inset: '1px', borderRadius: '4px', background: '#a855f7' }}></div>
          </div>
          <div style={{ flex: 1, background: '#9f1239', borderRadius: '4px' }}></div>
          <div style={{ flex: 1, background: '#7f1d1d', borderRadius: '4px' }}></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '12px', fontWeight: '700' }}>
          <span style={{ color: '#60a5fa', flex: 1, textAlign: 'left' }}>Calm</span>
          <span style={{ color: '#818cf8', flex: 1, textAlign: 'center' }}>Watch</span>
          <span style={{ color: '#c084fc', flex: 1, textAlign: 'center' }}>Elevated</span>
          <span style={{ color: '#fb7185', flex: 1, textAlign: 'center' }}>High</span>
          <span style={{ color: '#f87171', flex: 1, textAlign: 'right' }}>Extreme</span>
        </div>
        <p style={{ textAlign: 'center', fontSize: '12px', color: '#94a3b8', marginTop: '24px', marginBottom: '0' }}>
          Global intensity of events across all key dimensions.
        </p>
      </div>
    </section>
  );
}
