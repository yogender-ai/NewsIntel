import { useEffect, useRef, useState } from 'react';
import EmptyState from './EmptyState';

export default function PulseTrendChart({ history, worldPulse }) {
  const [drawn, setDrawn] = useState(false);
  const svgRef = useRef(null);

  useEffect(() => {
    if (history?.length) {
      const timer = setTimeout(() => setDrawn(true), 100);
      return () => clearTimeout(timer);
    }
  }, [history]);

  if (!history?.length) {
    return (
      <section className="wp-card pulse-chart-card">
        <div className="wp-section-head">
          <span>Live World Pulse</span>
          <em className="pulse-chart-badge">24H</em>
        </div>
        <EmptyState title="Pulse history building." body="Check back after refresh cycles." />
      </section>
    );
  }

  const latestValue = worldPulse?.value ?? history[history.length - 1]?.value ?? 0;
  const latestLabel = worldPulse?.label ?? 'Establishing baseline';
  
  // Use generic colors based on value safely
  const latestColor = latestValue >= 76 ? '#ff9ba9' : latestValue >= 56 ? '#ffd38a' : latestValue >= 31 ? '#8da2ff' : '#7ee7c4';

  const max = Math.max(...history.map((p) => p.value), 100);
  const min = Math.min(...history.map((p) => p.value), 0);
  const range = Math.max(max - min, 1);

  const points = history.map((point, index) => {
    const x = 10 + (index / Math.max(history.length - 1, 1)) * 260;
    const y = 18 + (1 - (point.value - min) / range) * 85;
    return `${x},${y}`;
  }).join(' ');

  // Find max point for glow indicator
  const maxIdx = history.reduce((best, p, i) => p.value > history[best].value ? i : best, 0);
  const maxX = 10 + (maxIdx / Math.max(history.length - 1, 1)) * 260;
  const maxY = 18 + (1 - (history[maxIdx].value - min) / range) * 85;

  // Y-axis labels
  const yLabels = [0, 25, 50, 75, 100].map(v => ({
    value: v,
    y: 18 + (1 - (v - min) / range) * 85,
  }));

  return (
    <section className="wp-card pulse-chart-card">
      <div className="wp-section-head">
        <span>Live World Pulse</span>
        <em className="pulse-chart-badge">24H</em>
      </div>
      <div className="pulse-chart-hero">
        <span className="pulse-chart-value" style={{ color: latestColor }}>{Math.round(latestValue)}</span>
        <span className="pulse-chart-label" style={{ color: latestColor }}>{latestLabel}</span>
      </div>
      <svg
        ref={svgRef}
        className="pulse-trend"
        viewBox="0 0 280 115"
        role="img"
        aria-label="24 hour pulse trend"
      >
        <defs>
          <linearGradient id="pulseGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(141,162,255,0.25)" />
            <stop offset="55%" stopColor="rgba(126,231,196,0.08)" />
            <stop offset="100%" stopColor="rgba(141,162,255,0)" />
          </linearGradient>
          <filter id="glowFilter">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Y-axis labels */}
        {yLabels.map(({ value, y }) => (
          <text key={value} x="4" y={y + 3} fill="rgba(255,255,255,0.2)" fontSize="7" fontFamily="var(--mono)">{value}</text>
        ))}

        {/* Grid lines */}
        {yLabels.map(({ value, y }) => (
          <line key={`g-${value}`} x1="20" y1={y} x2="275" y2={y} stroke="rgba(255,255,255,0.04)" strokeDasharray="3,3" />
        ))}

        {/* Main sharp line with glow filter */}
        <polyline
          points={points}
          fill="none"
          stroke="#8da2ff"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="miter"
          filter="url(#glowFilter)"
          style={{
            transition: 'stroke-dashoffset 2s ease-in-out',
            strokeDasharray: 1000,
            strokeDashoffset: drawn ? 0 : 1000,
          }}
        />

        {/* Peak indicator */}
        <circle
          cx={maxX}
          cy={maxY}
          r="4"
          fill="#8da2ff"
          filter="url(#glowFilter)"
          opacity={drawn ? 1 : 0}
          style={{ transition: 'opacity 0.5s ease 1.5s' }}
        />

        {/* Peak label */}
        {drawn && (
          <text x={maxX} y={maxY - 8} fill="#8da2ff" fontSize="8" fontFamily="var(--mono)" fontWeight="700" textAnchor="middle">
            {history[maxIdx].value}
          </text>
        )}
      </svg>
    </section>
  );
}
