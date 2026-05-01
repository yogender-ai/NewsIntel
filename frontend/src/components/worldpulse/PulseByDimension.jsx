import React, { useState, useEffect } from 'react';
import EmptyState from './EmptyState';

function Gauge({ score, color, label }) {
  const [isHovered, setIsHovered] = useState(false);
  const [animatedScore, setAnimatedScore] = useState(0);
  const radius = 36;
  const circumference = radius * Math.PI;
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference;

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedScore(score), 200);
    return () => clearTimeout(timer);
  }, [score]);

  const angle = (animatedScore / 100) * Math.PI;
  const dotX = 40 - Math.cos(angle) * radius;
  const dotY = 40 - Math.sin(angle) * radius;
  const gradId = `dim-grad-${label.replace(/\s+/g, '-')}`;

  return (
    <div 
      className={`dim-gauge-wrap ${isHovered ? 'dim-gauge-hovered' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <svg width="80" height="45" viewBox="0 0 80 45" className="dim-gauge-svg">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
          <filter id={`dim-glow-${label.replace(/\s+/g, '-')}`}>
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <path
          d="M 4 40 A 36 36 0 0 1 76 40"
          fill="none"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M 4 40 A 36 36 0 0 1 76 40"
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          filter={`url(#dim-glow-${label.replace(/\s+/g, '-')})`}
          className="dim-gauge-arc"
        />
      </svg>
      <div 
        className="dim-gauge-dot"
        style={{
          left: `${dotX}px`,
          top: `${dotY}px`,
          boxShadow: `0 0 ${isHovered ? '16px 3px' : '8px 2px'} ${color}`,
        }}
      />
      <div className={`dim-gauge-value ${isHovered ? 'dim-gauge-value-glow' : ''}`}>
        {animatedScore}
      </div>
    </div>
  );
}

export default function PulseByDimension({ dimensions }) {
  // Accept dimensions as prop; if not available, show empty state
  if (!dimensions || !dimensions.length) {
    return (
      <section className="wp-card pulse-by-dimension pbd-card">
        <div className="pbd-header">
          <span className="pbd-title">PULSE BY DIMENSION</span>
          <span className="pbd-period">24H</span>
        </div>
        <EmptyState title="Dimensional data loading." body="Pulse breakdown by category will appear when available." />
      </section>
    );
  }

  return (
    <section className="wp-card pulse-by-dimension pbd-card">
      <div className="pbd-header">
        <span className="pbd-title">PULSE BY DIMENSION</span>
        <span className="pbd-period">24H</span>
      </div>
      <div className="pbd-grid">
        {dimensions.map((d, i) => (
          <React.Fragment key={d.key || d.label}>
            <div className="pbd-item">
              <span className="pbd-label">{d.label}</span>
              <Gauge score={d.score} color={d.color} label={d.label} />
              <span className="pbd-status" style={{ color: d.color }}>{d.status}</span>
            </div>
            {i < dimensions.length - 1 && <div className="pbd-divider" />}
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}
