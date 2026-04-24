import React from 'react';

/* SVG Pulse history chart — renders area + line for a topic */
export default function PulseChart({ data = [], label = '', color = '#6c4df6', height = 120, width = '100%' }) {
  if (!data.length) {
    return (
      <div className="pulse-chart-empty">
        <span>No history for {label || 'this topic'} yet</span>
      </div>
    );
  }

  const values = data.map(d => typeof d === 'number' ? d : d.pulse_score || 0);
  const max = Math.max(...values, 100);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const svgWidth = 400;
  const svgHeight = height;
  const padding = { top: 10, right: 10, bottom: 24, left: 10 };
  const chartW = svgWidth - padding.left - padding.right;
  const chartH = svgHeight - padding.top - padding.bottom;

  const points = values.map((v, i) => {
    const x = padding.left + (i / Math.max(values.length - 1, 1)) * chartW;
    const y = padding.top + chartH - ((v - min) / range) * chartH;
    return { x, y, v };
  });

  const linePoints = points.map(p => `${p.x},${p.y}`).join(' ');
  const areaPoints = `${padding.left},${padding.top + chartH} ${linePoints} ${padding.left + chartW},${padding.top + chartH}`;

  // Grid lines
  const gridLines = [0, 25, 50, 75, 100].map(v => {
    const y = padding.top + chartH - ((Math.min(v, max) - min) / range) * chartH;
    return { v, y };
  });

  return (
    <div className="pulse-chart-container">
      {label && <div className="pulse-chart-label">{label}</div>}
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="none" style={{ width, height, display: 'block' }}>
        <defs>
          <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Grid */}
        {gridLines.map(g => (
          <g key={g.v}>
            <line x1={padding.left} y1={g.y} x2={padding.left + chartW} y2={g.y} stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
            <text x={padding.left - 2} y={g.y - 4} fontSize="8" fill="#9a96aa" textAnchor="start">{g.v}</text>
          </g>
        ))}
        {/* Area */}
        <polygon points={areaPoints} fill={`url(#grad-${label})`} />
        {/* Line */}
        <polyline points={linePoints} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Dots */}
        {points.length <= 30 && points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill="#fff" stroke={color} strokeWidth="2" />
        ))}
        {/* Latest value */}
        {points.length > 0 && (
          <text
            x={points[points.length - 1].x}
            y={points[points.length - 1].y - 10}
            fontSize="11" fontWeight="800" fill={color} textAnchor="middle"
          >
            {Math.round(points[points.length - 1].v)}
          </text>
        )}
      </svg>
    </div>
  );
}
