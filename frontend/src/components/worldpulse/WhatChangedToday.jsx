import { Activity, ArrowDown, ArrowRight, ArrowUp } from 'lucide-react';
import EmptyState from './EmptyState';

const DirectionIcon = ({ direction }) => {
  if (direction === 'Rising') return <ArrowUp size={15} />;
  if (direction === 'Cooling') return <ArrowDown size={15} />;
  return <ArrowRight size={15} />;
};

export default function WhatChangedToday({ changes, selectedTopic, onSelect }) {
  return (
    <section className="wp-card what-changed">
      <div className="wp-section-head">
        <span><Activity size={16} /> What Changed Today</span>
      </div>
      {changes?.length ? (
        <div className="change-list">
          {changes.map((item) => (
            <button key={item.id} className={selectedTopic === item.id ? 'selected' : ''} onClick={() => onSelect(item.id)}>
              <i><DirectionIcon direction={item.direction} /></i>
              <strong>{item.topic}</strong>
              <small>{item.reason || 'Establishing baseline'}</small>
              <em className={item.direction.toLowerCase().replace(/\s/g, '-')}>
                {item.delta === null ? item.direction : `${item.delta > 0 ? '+' : ''}${item.delta}`}
              </em>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState title="Movement baseline is building." body="Daily delta will appear after backend pulse snapshots are available." />
      )}
    </section>
  );
}

