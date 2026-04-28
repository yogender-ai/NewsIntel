import { Activity, ArrowRight, TrendingUp, TrendingDown, Globe, Building, Cpu, Coins, ShieldAlert, Zap } from 'lucide-react';
import EmptyState from './EmptyState';

const DirectionIcon = ({ direction }) => {
  if (direction === 'Rising') return <TrendingUp size={14} />;
  if (direction === 'Cooling') return <TrendingDown size={14} />;
  return <ArrowRight size={14} />;
};

const TopicIcon = ({ topic }) => {
  const t = (topic || '').toLowerCase();
  if (t.includes('tech') || t.includes('cyber')) return <Cpu size={16} />;
  if (t.includes('econ') || t.includes('market') || t.includes('finance')) return <Coins size={16} />;
  if (t.includes('geopol') || t.includes('secur') || t.includes('politic')) return <ShieldAlert size={16} />;
  if (t.includes('energy') || t.includes('climate')) return <Zap size={16} />;
  if (t.includes('corp') || t.includes('business')) return <Building size={16} />;
  return <Globe size={16} />;
};

function directionColor(direction) {
  if (direction === 'Rising') return '#f43f5e';
  if (direction === 'Cooling') return '#34d399';
  return '#a5b4fc';
}

function BottomSparkline({ current, previous }) {
  if (current === null || current === undefined) return null;
  const prev = previous ?? current;
  const max = Math.max(current, prev, 1);
  const w = Math.max(10, Math.min(100, Math.round((current / max) * 100)));
  const color = current > prev ? '#ff9ba9' : current < prev ? '#7ee7c4' : '#8da2ff';

  return (
    <div className="wca-sparkline-track">
      <div className="wca-sparkline-fill" style={{ width: `${w}%`, background: color, boxShadow: `0 0 12px ${color}40` }} />
    </div>
  );
}

export default function WhatChangedToday({ changes, selectedTopic, onSelect }) {
  return (
    <section className="wp-card what-changed-advanced wca-container">
      <div className="wca-header">
        <div className="wca-header-left">
          <Activity size={16} className="wca-header-icon" />
          <span className="wca-title">WHAT CHANGED TODAY</span>
        </div>
        <span className="wca-subtitle">Key global shifts in the last 24 hours</span>
      </div>

      {changes?.length ? (
        <div className="wca-list">
          {changes.map((item, idx) => {
            const direction = item.direction;
            const color = directionColor(direction);
            const deltaText = item.delta !== null && item.delta !== undefined
              ? `${item.delta > 0 ? '+' : ''}${Math.round(item.delta)} shift`
              : direction || item.severityLabel || null;
            const eventInfo = item.reason;

            return (
              <button
                key={item.id}
                className={`wca-row ${selectedTopic === item.id ? 'wca-row-selected' : ''}`}
                onClick={() => onSelect(selectedTopic === item.id ? null : item.id)}
                style={{ animationDelay: `${idx * 0.07}s` }}
              >
                <div className="wca-left">
                  <div className="wca-icon-circle">
                    <TopicIcon topic={item.topic} />
                  </div>
                  <span className="wca-topic">{item.topic}</span>
                </div>

                <div className="wca-right">
                  {eventInfo && (
                    <span className="wca-reason">{eventInfo}</span>
                  )}
                  {deltaText && (
                    <div className="wca-pill" style={{ '--wca-color': color }}>
                      <DirectionIcon direction={direction} />
                      <span>{deltaText}</span>
                    </div>
                  )}
                </div>

                <BottomSparkline current={item.current} previous={item.previous} />
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyState title="Movement baseline is building." body="Daily delta will appear after backend pulse snapshots are available." />
      )}
    </section>
  );
}
