import { useEffect, useRef, useState } from 'react';
import EmptyState from './EmptyState';

export default function PulseTrendChart({ history }) {
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
        <div className="wp-section-head"><span>Live World Pulse Chart</span></div>
        <EmptyState title="Pulse history building." body="Check back after refresh cycles." />
      </section>
    );
  }

  const max = Math.max(...history.map((p) => p.value), 100);
  const min = Math.min(...history.map((p) => p.value), 0);
  const range = Math.max(max - min, 1);

  const points = history.map((point, index) => {
    const x = (index / Math.max(history.length - 1, 1)) * 280;
    const y = 120 - ((point.value - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  // Find max point for glow indicator
  const maxIdx = history.reduce((best, p, i) => p.value > history[best].value ? i : best, 0);
  const maxX = (maxIdx / Math.max(history.length - 1, 1)) * 280;
  const maxY = 120 - ((history[maxIdx].value - min) / range) * 100;

  return (
    <section className="wp-card pulse-chart-card">
      <div className="wp-section-head"><span>Live World Pulse Chart</span></div>
      <svg
        ref={svgRef}
        className="pulse-trend"
        viewBox="0 0 280 130"
        role="img"
        aria-label="24 hour pulse trend"
      >
        {/* Gradient definition */}
        <defs>
          <linearGradient id="pulseGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(141,162,255,0.25)" />
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

        {/* Area fill */}
        <polygon
          points={`0,130 ${points} 280,130`}
          fill="url(#pulseGrad)"
        />

        {/* Main line */}
        <polyline
          points={points}
          style={{
            strokeDasharray: drawn ? 0 : 600,
            strokeDashoffset: drawn ? 0 : 600,
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
      </svg>
    </section>
  );
}
