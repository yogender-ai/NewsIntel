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
    const size = 300;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    // Pre-calculate fixed land grid for high accuracy
    const landDots = [];
    // 3.5 degree grid for nice dense particle layout
    for (let lat = -90; lat <= 90; lat += 3.5) {
      for (let lon = -180; lon <= 180; lon += 3.5) {
        if (d3.geoContains(worldData, [lon, lat])) {
          const phi = (90 - lat) * (Math.PI / 180);
          const theta = (lon + 180) * (Math.PI / 180);
          landDots.push({ theta, phi, isLand: true });
        }
      }
    }
    
    // Add some random "noise" dots that will act as network nodes/satellites
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

      // Deep navy/purple center glow
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.5);
      grad.addColorStop(0, 'rgba(30,27,75,0.4)'); // deep violet
      grad.addColorStop(0.5, 'rgba(14,12,38,0.2)');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      
      // Orbit rings behind globe
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.15, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(139,92,246,0.1)';
      ctx.lineWidth = 1;
      ctx.stroke();

      const renderPoints = [];

      // Project land dots
      landDots.forEach(dot => {
        const theta = dot.theta + angleOffset;
        const x = radius * Math.sin(dot.phi) * Math.cos(theta);
        const y = radius * Math.cos(dot.phi);
        const z = radius * Math.sin(dot.phi) * Math.sin(theta);

        // Only process front face
        if (z > -radius * 0.1) {
          const depth = (z + radius) / (radius * 2);
          const scale = depth * 0.7 + 0.3;
          renderPoints.push({
            x: cx + x, y: cy + y, z, depth, scale,
            type: 'land'
          });
        }
      });
      
      // Project network nodes
      networkNodes.forEach(node => {
        const theta = node.theta + angleOffset * 1.5 + (time * node.speed);
        const r = radius * node.height;
        const x = r * Math.sin(node.phi) * Math.cos(theta);
        const y = r * Math.cos(node.phi);
        const z = r * Math.sin(node.phi) * Math.sin(theta);
        
        if (z > -r * 0.1) {
          renderPoints.push({
            x: cx + x, y: cy + y, z, 
            depth: (z + r) / (r * 2),
            type: 'node'
          });
        }
      });

      // Sort by depth to draw back to front
      renderPoints.sort((a, b) => a.z - b.z);
      
      // Draw connecting lines for network nodes
      const nodesOnly = renderPoints.filter(p => p.type === 'node');
      ctx.strokeStyle = 'rgba(94,234,212,0.15)';
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

      // Draw points
      renderPoints.forEach(p => {
        ctx.beginPath();
        if (p.type === 'land') {
          ctx.arc(p.x, p.y, 1.2 * p.scale, 0, Math.PI * 2);
          // Neon accents in purple, blue, pink depending on position
          if (p.x > cx && p.y > cy) ctx.fillStyle = `rgba(244,114,182,${p.depth * 0.8})`; // Pink
          else if (p.x < cx) ctx.fillStyle = `rgba(94,234,212,${p.depth * 0.9})`; // Cyan
          else ctx.fillStyle = `rgba(167,139,250,${p.depth * 0.8})`; // Purple
        } else {
          ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${p.depth})`;
          ctx.shadowBlur = 8;
          ctx.shadowColor = '#5eead4';
        }
        ctx.fill();
        ctx.shadowBlur = 0;
      });
    }
    
    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [worldData]);

  return (
    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '300px', height: '300px', pointerEvents: 'none' }}>
      {/* Soft gradient halo light beams behind the globe */}
      <div style={{ position: 'absolute', inset: '-20%', background: 'radial-gradient(circle, rgba(167,139,250,0.15) 0%, transparent 60%)', filter: 'blur(20px)' }} />
      <div style={{ position: 'absolute', top: '20%', left: '10%', width: '150px', height: '150px', background: 'radial-gradient(circle, rgba(94,234,212,0.1) 0%, transparent 70%)', filter: 'blur(24px)' }} />
      <div style={{ position: 'absolute', bottom: '10%', right: '10%', width: '180px', height: '180px', background: 'radial-gradient(circle, rgba(244,114,182,0.1) 0%, transparent 70%)', filter: 'blur(30px)' }} />
      
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', position: 'relative', zIndex: 2 }} />
    </div>
  );
}

function SegmentedRing({ score }) {
  const [isHovered, setIsHovered] = useState(false);
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
    <svg 
      width={size} height={size} viewBox={`0 0 ${size} ${size}`} 
      style={{ position: 'absolute', top: '50%', left: '50%', transform: isHovered ? 'translate(-50%, -50%) scale(1.05)' : 'translate(-50%, -50%) scale(1)', transition: 'all 0.3s ease-out', cursor: 'crosshair', filter: isHovered ? 'brightness(1.5) drop-shadow(0 0 15px rgba(167, 139, 250, 0.4))' : 'none' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
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
