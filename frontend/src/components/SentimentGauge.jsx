import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function SentimentGauge({ sentiment = 'positive', score = 84 }) {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = score;
    const duration = 1200;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setAnimatedScore(Math.round(start + (end - start) * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [score]);

  const getLabel = (s) => {
    if (s >= 80) return 'VERY BULLISH';
    if (s >= 60) return 'BULLISH';
    if (s >= 45) return 'NEUTRAL';
    if (s >= 25) return 'BEARISH';
    return 'VERY BEARISH';
  };

  const getColor = (s) => {
    if (s >= 80) return '#34d399';
    if (s >= 60) return '#6ee7b7';
    if (s >= 45) return '#fbbf24';
    if (s >= 25) return '#f97316';
    return '#ef4444';
  };

  const getIcon = (s) => {
    if (s >= 60) return <TrendingUp size={18} />;
    if (s >= 45) return <Minus size={18} />;
    return <TrendingDown size={18} />;
  };

  const label = getLabel(animatedScore);
  const color = getColor(animatedScore);
  const circumference = 2 * Math.PI * 54;
  const dashOffset = circumference - (animatedScore / 100) * circumference;

  return (
    <div className="sentiment-gauge-container">
      <div className="sentiment-gauge-label">{label}</div>
      <div className="sentiment-gauge-ring-wrapper">
        <svg viewBox="0 0 120 120" className="sentiment-gauge-svg">
          {/* Background track */}
          <circle
            cx="60" cy="60" r="54"
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="8"
          />
          {/* Glow track */}
          <circle
            cx="60" cy="60" r="54"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform="rotate(-90 60 60)"
            style={{
              transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
              filter: `drop-shadow(0 0 8px ${color})`
            }}
          />
          {/* Center content */}
          <text x="60" y="55" textAnchor="middle" className="gauge-score-text" fill={color}>
            {animatedScore}%
          </text>
          <text x="60" y="72" textAnchor="middle" className="gauge-sublabel" fill="rgba(255,255,255,0.4)">
            sentiment
          </text>
        </svg>

        {/* Trend icon */}
        <div className="gauge-trend-icon" style={{ color }}>
          {getIcon(animatedScore)}
        </div>
      </div>
    </div>
  );
}
