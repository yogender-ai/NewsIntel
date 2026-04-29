import React, { useState } from 'react';

const DIMENSIONS = [
  { key: 'tech', label: 'Tech', score: 72, status: 'High', color: '#fb7185' },
  { key: 'education', label: 'Education', score: 48, status: 'Watch', color: '#fbbf24' },
  { key: 'entertainment', label: 'Entertainment', score: 61, status: 'Elevated', color: '#a78bfa' },
  { key: 'politics', label: 'Politics', score: 66, status: 'High', color: '#fb7185' },
  { key: 'economy', label: 'Economy', score: 41, status: 'Watch', color: '#fbbf24' },
  { key: 'security', label: 'Security', score: 74, status: 'High', color: '#fb7185' }
];

function Gauge({ score, color, label }) {
  const [isHovered, setIsHovered] = useState(false);
  const radius = 36;
  const circumference = radius * Math.PI;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  // Calculate position of the glowing dot
  const angle = (score / 100) * Math.PI;
  // Center is 40, 40. Arc goes from PI to 0.
  const dotX = 40 - Math.cos(angle) * radius;
  const dotY = 40 - Math.sin(angle) * radius;

  return (
    <div 
      className="dim-gauge-container" 
      style={{ 
        position: 'relative', width: '80px', height: '45px', margin: '0 auto 12px',
        transform: isHovered ? 'scale(1.15)' : 'scale(1)',
        transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        cursor: 'pointer'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <svg width="80" height="45" viewBox="0 0 80 45">
        <path
          d="M 4 40 A 36 36 0 0 1 76 40"
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M 4 40 A 36 36 0 0 1 76 40"
          fill="none"
          stroke={`url(#gradient-${color.replace('#','')})`}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
        <defs>
          <linearGradient id={`gradient-${color.replace('#','')}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>
      </svg>
      <div 
        style={{
          position: 'absolute',
          left: `${dotX}px`,
          top: `${dotY}px`,
          width: isHovered ? '8px' : '6px',
          height: isHovered ? '8px' : '6px',
          borderRadius: '50%',
          backgroundColor: '#fff',
          boxShadow: `0 0 ${isHovered ? '20px 4px' : '10px 2px'} ${color}`,
          transform: 'translate(-50%, -50%)',
          transition: 'all 0.3s ease-out'
        }}
      />
      <div className="dim-score-val" style={{ 
        position: 'absolute', bottom: '0', left: '0', right: '0', textAlign: 'center', 
        fontSize: '24px', fontWeight: '800', lineHeight: '1', 
        color: isHovered ? '#fff' : 'rgba(255,255,255,0.9)',
        textShadow: isHovered ? `0 0 12px ${color}` : 'none',
        transition: 'all 0.3s ease'
      }}>
        {score}
      </div>
    </div>
  );
}

export default function PulseByDimension() {
  return (
    <section className="wp-card pulse-by-dimension" style={{ gridColumn: '1 / -1', padding: '24px' }}>
      <div className="wp-section-head" style={{ marginBottom: '24px' }}>
        <span style={{ fontSize: '12px', fontWeight: '800', letterSpacing: '0.05em' }}>PULSE BY DIMENSION</span>
        <span style={{ color: '#a78bfa', fontSize: '12px', fontWeight: '700' }}>24H</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {DIMENSIONS.map((d, i) => (
          <React.Fragment key={d.key}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              <span style={{ color: '#cbd5e1', fontSize: '13px', fontWeight: '600', marginBottom: '16px' }}>{d.label}</span>
              <Gauge score={d.score} color={d.color} label={d.label} />
              <span style={{ color: d.color, fontSize: '12px', fontWeight: '700' }}>{d.status}</span>
            </div>
            {i < DIMENSIONS.length - 1 && (
              <div style={{ width: '1px', height: '60px', backgroundColor: 'rgba(255,255,255,0.06)' }} />
            )}
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}
