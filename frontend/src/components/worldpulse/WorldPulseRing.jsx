import React, { useEffect, useRef, useState } from 'react';
import { Info, ChevronDown, Activity } from 'lucide-react';
import * as d3 from 'd3-geo';
import * as topojson from 'topojson-client';

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
    const size = 260;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    let angleOffset = 0;
    
    // Generate points that fall on landmass
    const dots = [];
    const numDots = 2500; // More dots to outline countries
    
    for (let i = 0; i < numDots; i++) {
      // Random lat/lon
      const lon = Math.random() * 360 - 180;
      const lat = Math.asin(Math.random() * 2 - 1) * (180 / Math.PI);
      
      // Check if land
      if (d3.geoContains(worldData, [lon, lat])) {
        // Convert to spherical coords
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lon + 180) * (Math.PI / 180);
        dots.push({ theta, phi, size: Math.random() * 1.5 + 0.5 });
      }
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
  
  // Create an arch: from 140 degrees to 40 degrees (260 degree arc)
  // Let's do from 150 deg to 30 deg (240 deg arc)
  const startArch = 140;
  const endArch = 40;
  const archRange = 360 - startArch + endArch; // 260 degrees
  
  const segments = 24;
  const gap = 2; // degrees gap
  
  const arcs = [];
  
  let currentAngle = startArch;
  
  for (let i = 0; i < segments; i++) {
    // Make segments at the top (near 270 degrees) longer, and sides shorter.
    // Calculate how close this segment is to the top (270)
    let distFromTop = Math.abs(currentAngle - 270);
    if (distFromTop > 180) distFromTop = 360 - distFromTop;
    
    // Closer to 0 distFromTop = longer arc. 
    // Max length at top ~ 18 deg, min length at sides ~ 5 deg
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
        strokeLinecap="round"
        style={{ filter: isActive ? `drop-shadow(0 0 4px ${color})` : 'none' }}
      />
    );
    
    currentAngle = (currentAngle + arcLength + gap) % 360;
    
    // Break if we exceeded the arch
    if (currentAngle > endArch && currentAngle < startArch) {
      break;
    }
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
