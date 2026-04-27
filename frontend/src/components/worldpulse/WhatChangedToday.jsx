import { Activity, ArrowDown, ArrowRight, ArrowUp, TrendingUp, TrendingDown, Radio } from 'lucide-react';
import EmptyState from './EmptyState';

const DirectionIcon = ({ direction }) => {
  if (direction === 'Rising') return <TrendingUp size={14} />;
  if (direction === 'Cooling') return <TrendingDown size={14} />;
  return <ArrowRight size={14} />;
};

function BottomSparkline({ current, previous }) {
  if (current === null || current === undefined) return null;
  const prev = previous ?? current;
  const max = Math.max(current, prev, 1);
  const w = Math.max(10, Math.min(100, Math.round((current / max) * 100)));
  const color = current > prev ? '#ff9ba9' : current < prev ? '#7ee7c4' : '#8da2ff';
  
  return (
    <div style={{ position: 'absolute', bottom: 0, left: 24, width: '60px', height: '2px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px' }}>
      <div style={{ width: `${w}%`, height: '100%', background: color, borderRadius: '2px', boxShadow: `0 0 8px ${color}` }} />
    </div>
  );
}

export default function WhatChangedToday({ changes, selectedTopic, onSelect }) {
  return (
    <section className="wp-card what-changed-advanced">
      <div className="wca-header">
        <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
          <Activity size={16} color="#a5b4fc" />
          <span style={{fontSize: '12px', fontWeight: 800, letterSpacing: '0.08em'}}>WHAT CHANGED TODAY</span>
        </div>
        <span style={{fontSize: '12px', color: '#94a3b8'}}>Key global shifts in the last 24 hours</span>
      </div>
      
      {changes?.length ? (
        <div className="wca-list">
          {changes.map((item) => (
            <button key={item.id} className="wca-row" onClick={() => onSelect(selectedTopic === item.id ? null : item.id)}>
              <div className="wca-left">
                <div className="wca-icon-circle">
                  <ArrowRight size={16} />
                </div>
                <span className="wca-topic">{item.topic}</span>
              </div>
              
              <div className="wca-right">
                <span className="wca-reason">{item.reason?.slice(0, 40) || 'Live movement across...'}</span>
                <div className={`wca-pill ${(item.direction || 'stable').toLowerCase().replace(/\s/g, '-')}`}>
                  <DirectionIcon direction={item.direction} />
                  <span>{item.severityLabel || 'Medium'}</span>
                </div>
              </div>
              
              <BottomSparkline current={item.current} previous={item.previous} />
            </button>
          ))}
        </div>
      ) : (
        <EmptyState title="Movement baseline is building." body="Daily delta will appear after backend pulse snapshots are available." />
      )}
    </section>
  );
}
