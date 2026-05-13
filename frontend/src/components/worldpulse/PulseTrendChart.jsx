import { useEffect, useRef, useState } from 'react';
import EmptyState from './EmptyState';

export default function PulseTrendChart({ history, worldPulse }) {
  const [drawn, setDrawn] = useState(false);
  const [hoverIdx, setHoverIdx] = useState(null);
  const svgRef = useRef(null);

  useEffect(() => {
    if (history?.length) {
      const timer = setTimeout(() => setDrawn(true), 200);
      return () => clearTimeout(timer);
    }
  }, [history]);

  if (!history?.length) {
    return (
      <section className="wp-card pulse-chart-card">
        <div className="wp-section-head">
          <span>Live Pulse Trend</span>
          <em className="pulse-chart-badge">24H</em>
        </div>
        <EmptyState title="Pulse history building." body="No backend history available yet." />
      </section>
    );
  }

  const latestValue = worldPulse?.value ?? history[history.length - 1]?.value;
  const latestLabel = worldPulse?.label ?? 'Establishing baseline';
  const hasLatest = latestValue !== null && latestValue !== undefined && Number.isFinite(Number(latestValue));
  const latestColor = !hasLatest ? '#52525B'
    : latestValue >= 76 ? '#DC2626'
    : latestValue >= 56 ? '#F59E0B'
    : latestValue >= 31 ? '#8B5CF6'
    : '#00E5A0';

  const max = Math.max(...history.map((p) => p.value), 100);
  const min = Math.min(...history.map((p) => p.value), 0);
  const range = Math.max(max - min, 1);

  const W = 280;
  const H = 115;
  const padL = 22;
  const padR = 5;
  const padT = 14;
  const padB = 10;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const coords = history.map((point, index) => {
    const x = padL + (index / Math.max(history.length - 1, 1)) * chartW;
    const y = padT + (1 - (point.value - min) / range) * chartH;
    return { x, y, value: point.value, time: point.time || point.timestamp };
  });

  /* Smooth curve using cardinal spline */
  function cardinalSpline(pts, tension = 0.3) {
    if (pts.length < 2) return '';
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;
      d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return d;
  }

  const linePath = cardinalSpline(coords);
  const areaPath = linePath + ` L${coords[coords.length - 1].x},${padT + chartH} L${coords[0].x},${padT + chartH} Z`;

  const maxIdx = history.reduce((best, p, i) => p.value > history[best].value ? i : best, 0);
  const maxPt = coords[maxIdx];
  const lastPt = coords[coords.length - 1];

  const yLabels = [0, 25, 50, 75, 100].map(v => ({
    value: v,
    y: padT + (1 - (v - min) / range) * chartH,
  }));

  const totalLen = 1200;
  const hoveredPt = hoverIdx !== null ? coords[hoverIdx] : null;

  const hoverRaf = useRef(0);
  const handleMouseMove = (e) => {
    if (hoverRaf.current) return;
    hoverRaf.current = requestAnimationFrame(() => {
      hoverRaf.current = 0;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * W;
      let nearest = 0;
      let nearestDist = Infinity;
      coords.forEach((c, i) => {
        const d = Math.abs(c.x - mx);
        if (d < nearestDist) { nearestDist = d; nearest = i; }
      });
      setHoverIdx(nearest);
    });
  };

  return (
    <section className="wp-card pulse-chart-card">
      <div className="wp-section-head">
        <span>Live Pulse Trend</span>
        <em className="pulse-chart-badge">24H</em>
      </div>
      <div className="pulse-chart-hero">
        <span className="pulse-chart-value" style={{ color: latestColor }}>
          {hasLatest ? Math.round(latestValue) : '—'}
        </span>
        <span className="pulse-chart-label" style={{ color: latestColor }}>{latestLabel}</span>
      </div>
      <svg
        ref={svgRef}
        className="pulse-trend pulse-trend-interactive"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="24 hour pulse trend"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="ptLineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#00E5A0" />
            <stop offset="50%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
          <linearGradient id="ptAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(139,92,246,0.20)" />
            <stop offset="60%" stopColor="rgba(139,92,246,0.05)" />
            <stop offset="100%" stopColor="rgba(139,92,246,0)" />
          </linearGradient>
          <filter id="ptGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="ptDotGlow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Y-axis labels */}
        {yLabels.map(({ value, y }) => (
          <text key={value} x="2" y={y + 3} fill="rgba(255,255,255,0.18)" fontSize="7" fontFamily="var(--mono)">{value}</text>
        ))}

        {/* Grid lines */}
        {yLabels.map(({ value, y }) => (
          <line key={`g-${value}`} x1={padL} y1={y} x2={W - padR} y2={y} stroke="rgba(255,255,255,0.03)" strokeDasharray="2,4" />
        ))}

        {/* Area fill */}
        <path
          d={areaPath}
          fill="url(#ptAreaGrad)"
          opacity={drawn ? 1 : 0}
          style={{ transition: 'opacity 1s ease 0.5s' }}
        />

        {/* Main line with animated draw */}
        <path
          d={linePath}
          fill="none"
          stroke="url(#ptLineGrad)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#ptGlow)"
          strokeDasharray={totalLen}
          strokeDashoffset={drawn ? 0 : totalLen}
          style={{ transition: 'stroke-dashoffset 1.8s cubic-bezier(0.4,0,0.2,1)' }}
        />

        {/* Hover crosshair + tooltip */}
        {hoveredPt && drawn && (
          <>
            <line 
              x1={hoveredPt.x} y1={padT} 
              x2={hoveredPt.x} y2={padT + chartH} 
              stroke="rgba(167, 139, 250, 0.6)" 
              strokeWidth="1.5" 
              strokeDasharray="4,4" 
              filter="url(#ptGlow)"
            />
            <circle cx={hoveredPt.x} cy={hoveredPt.y} r="5" fill="#fff" filter="url(#ptDotGlow)" stroke="#c084fc" strokeWidth="2" />
            <circle cx={hoveredPt.x} cy={hoveredPt.y} r="12" fill="rgba(167, 139, 250, 0.2)" />
            
            <g transform={`translate(${Math.min(Math.max(hoveredPt.x - 24, padL), W - padR - 48)}, ${hoveredPt.y - 28})`}>
              <rect x="0" y="0" width="48" height="20" rx="6" fill="rgba(15,23,42,0.95)" stroke="rgba(167, 139, 250, 0.5)" strokeWidth="1" filter="url(#ptGlow)" />
              <text x="24" y="14" fill="#fff" fontSize="11" fontFamily="var(--mono)" fontWeight="800" textAnchor="middle">
                {Math.round(history[hoverIdx]?.value || 0)}
              </text>
            </g>
          </>
        )}

        {/* Peak indicator */}
        {!hoveredPt && (
          <>
            <circle
              cx={maxPt.x} cy={maxPt.y} r="3.5"
              fill="#a78bfa" filter="url(#ptDotGlow)"
              opacity={drawn ? 1 : 0}
              style={{ transition: 'opacity 0.4s ease 1.6s' }}
            />
            {drawn && (
              <text x={maxPt.x} y={maxPt.y - 7} fill="#c4b5fd" fontSize="7" fontFamily="var(--mono)" fontWeight="700" textAnchor="middle">
                {history[maxIdx].value}
              </text>
            )}
          </>
        )}

        {/* Live dot — pulsing at the end of the line */}
        {drawn && lastPt && (
          <>
            <circle cx={lastPt.x} cy={lastPt.y} r="6" fill="rgba(192,132,252,0.15)">
              <animate attributeName="r" values="4;8;4" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle cx={lastPt.x} cy={lastPt.y} r="3" fill="#c084fc" filter="url(#ptDotGlow)" />
          </>
        )}

        {/* Invisible hit areas for each data point */}
        {coords.map((c, i) => (
          <rect
            key={i}
            x={c.x - (chartW / coords.length) / 2}
            y={padT}
            width={chartW / coords.length}
            height={chartH}
            fill="transparent"
            style={{ cursor: 'crosshair' }}
          />
        ))}
      </svg>
    </section>
  );
}
