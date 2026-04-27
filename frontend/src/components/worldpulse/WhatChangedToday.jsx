import { Activity, ArrowDown, ArrowRight, ArrowUp, TrendingUp, TrendingDown } from 'lucide-react';
import EmptyState from './EmptyState';

const DirectionIcon = ({ direction }) => {
  if (direction === 'Rising') return <TrendingUp size={15} />;
  if (direction === 'Cooling') return <TrendingDown size={15} />;
  return <ArrowRight size={15} />;
};

function MiniSparkline({ current, previous }) {
  if (current === null || current === undefined) return null;
  const prev = previous ?? current;
  const max = Math.max(current, prev, 1);
  const h1 = Math.round((prev / max) * 22);
  const h2 = Math.round((current / max) * 22);
  const mid = Math.round(((prev + current) / 2 / max) * 22);
  return (
    <svg width="48" height="26" viewBox="0 0 48 26" className="wc-sparkline">
      <polyline
        points={`2,${26 - h1} 16,${26 - mid} 32,${26 - h2} 46,${26 - h2 + 2}`}
        fill="none"
        stroke={current > prev ? '#ff9ba9' : current < prev ? '#7ee7c4' : '#8da2ff'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="46" cy={26 - h2 + 2} r="2.5"
        fill={current > prev ? '#ff9ba9' : current < prev ? '#7ee7c4' : '#8da2ff'} />
    </svg>
  );
}

export default function WhatChangedToday({ changes, selectedTopic, onSelect }) {
  return (
    <section className="wp-card what-changed">
      <div className="wp-section-head">
        <span><Activity size={16} /> What Changed Today</span>
        <small className="wc-sub">Key global shifts in the last 24 hours</small>
      </div>
      {changes?.length ? (
        <div className="change-list">
          {changes.map((item) => (
            <button key={item.id} className={selectedTopic === item.id ? 'selected' : ''} onClick={() => onSelect(selectedTopic === item.id ? null : item.id)}>
              <i><DirectionIcon direction={item.direction} /></i>
              <strong>{item.topic}</strong>
              <small>{item.reason}</small>
              <em className={(item.direction || 'stable').toLowerCase().replace(/\s/g, '-')}>
                <DirectionIcon direction={item.direction} />
                {' '}{item.severityLabel || 'Medium'}
              </em>
              <MiniSparkline current={item.current} previous={item.previous} />
            </button>
          ))}
        </div>
      ) : (
        <EmptyState title="Movement baseline is building." body="Daily delta will appear after backend pulse snapshots are available." />
      )}
    </section>
  );
}
