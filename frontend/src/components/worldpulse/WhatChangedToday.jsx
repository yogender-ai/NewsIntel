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
    <div style={{ position: 'absolute', bottom: 0, left: 24, width: '60px', height: '2px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px' }}>
      <div style={{ width: `${w}%`, height: '100%', background: color, borderRadius: '2px', boxShadow: `0 0 8px ${color}` }} />
    </div>
  );
}

export default function WhatChangedToday({ changes, selectedTopic, onSelect }) {
  return (
    <section className="wp-card what-changed-advanced" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="wca-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px' }}>
        <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
          <Activity size={16} color="#a5b4fc" />
          <span style={{fontSize: '12px', fontWeight: 800, letterSpacing: '0.08em'}}>WHAT CHANGED TODAY</span>
        </div>
        <span style={{fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap'}}>Key global shifts in the last 24 hours</span>
      </div>
      
      {changes?.length ? (
        <div className="wca-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', paddingRight: '4px' }}>
          {changes.map((item) => {
            const direction = item.direction || 'Stable';
            const color = directionColor(direction);
            /* Build a data-driven description instead of misleading labels */
            const deltaText = item.delta !== null && item.delta !== undefined
              ? `${item.delta > 0 ? '+' : ''}${Math.round(item.delta)} shift`
              : direction;
            const eventInfo = item.reason || 'Live movement across sources';

            return (
              <button key={item.id} className="wca-row" onClick={() => onSelect(selectedTopic === item.id ? null : item.id)} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', position: 'relative', cursor: 'pointer', transition: 'all 0.2s', gap: '12px', overflow: 'hidden' }}>
                <div className="wca-left" style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '140px' }}>
                  <div className="wca-icon-circle" style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(141,162,255,0.08)', color: '#a5b4fc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <TopicIcon topic={item.topic} />
                  </div>
                  <span className="wca-topic" style={{ fontSize: '14px', fontWeight: 800, color: '#f8fafc', textTransform: 'capitalize' }}>{item.topic}</span>
                </div>
                
                <div className="wca-right" style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, justifyContent: 'flex-end', minWidth: '0' }}>
                  <span className="wca-reason" style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, textAlign: 'right' }}>
                    {eventInfo}
                  </span>
                  <div className="wca-pill" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '999px', background: 'rgba(15,23,42,0.8)', border: `1px solid ${color}22`, fontSize: '11px', fontWeight: 800, flexShrink: 0 }}>
                    <DirectionIcon direction={direction} />
                    <span style={{ color }}>{deltaText}</span>
                  </div>
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
