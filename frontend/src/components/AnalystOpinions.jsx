import { useState, useEffect } from 'react';
import { MessageSquare, ThumbsUp, ThumbsDown } from 'lucide-react';

const ALL_ANALYSTS = [
  { name: 'Isaac Chen', role: 'Senior Market Strategist', color: '#3b82f6', opinion: 'Markets are in full risk-on mode, pricing in a swift Middle East ceasefire. I watch reaction at geopolitical flashpoints carefully.', upvotes: 214, downvotes: 7 },
  { name: 'Sarah Kim', role: 'Asia-Pacific Desk Lead', color: '#10b981', opinion: 'South Korean semiconductor rally is sustainable if US tariff exemptions hold. Watch Samsung and SK Hynix closely.', upvotes: 156, downvotes: 12 },
  { name: 'Carlos Mendez', role: 'Energy Analyst', color: '#f59e0b', opinion: 'Oil volatility is far from over. Even with a ceasefire, supply chain disruptions in the Strait of Hormuz persist.', upvotes: 89, downvotes: 23 },
  { name: 'Priya Sharma', role: 'Climate Risk Analyst', color: '#06b6d4', opinion: 'The NOAA forecast is alarming. Insurance stocks will take a significant hit if hurricane predictions hold true.', upvotes: 67, downvotes: 5 },
];

export default function AnalystOpinions({ analysts = null }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [votes, setVotes] = useState(ALL_ANALYSTS.map(a => ({ up: a.upvotes, down: a.downvotes })));

  // Rotate analyst every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIdx(prev => (prev + 1) % ALL_ANALYSTS.length);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Simulate vote changes every 8 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setVotes(prev => prev.map(v => ({
        up: v.up + Math.floor(Math.random() * 3),
        down: v.down + (Math.random() > 0.7 ? 1 : 0),
      })));
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const analyst = ALL_ANALYSTS[currentIdx];
  const v = votes[currentIdx];

  return (
    <div className="analyst-opinions-panel">
      <div className="analyst-opinions-header">
        <MessageSquare size={13} />
        <span>ANALYST OPINIONS</span>
      </div>

      <div className="analyst-opinions-list">
        <div className="analyst-opinion-card" style={{ transition: 'all 0.5s', borderLeft: `3px solid ${analyst.color}`, background: `linear-gradient(90deg, ${analyst.color}15 0%, rgba(255,255,255,0.02) 100%)` }}>
          <div className="analyst-card-header">
            <div className="analyst-avatar">
              <img src={`https://ui-avatars.com/api/?name=${analyst.name.replace(' ', '+')}&background=${analyst.color.slice(1)}&color=fff`} alt={analyst.name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
            </div>
            <div className="analyst-info">
              <div className="analyst-name">{analyst.name}</div>
              <div className="analyst-role">{analyst.role}</div>
            </div>
            <span style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: '700', color: '#10b981' }}>+{v.up}</span>
          </div>

          <p className="analyst-opinion-text">{analyst.opinion}</p>

          <div className="analyst-opinion-actions">
            <button className="analyst-vote-btn" onClick={() => setVotes(prev => { const n = [...prev]; n[currentIdx] = { ...n[currentIdx], up: n[currentIdx].up + 1 }; return n; })}>
              <ThumbsUp size={12} /><span>{v.up}</span>
            </button>
            <button className="analyst-vote-btn" onClick={() => setVotes(prev => { const n = [...prev]; n[currentIdx] = { ...n[currentIdx], down: n[currentIdx].down + 1 }; return n; })}>
              <ThumbsDown size={12} /><span>{v.down}</span>
            </button>
            <span className="analyst-view-more" style={{ fontSize: '10px', color: '#64748b' }}>
              {currentIdx + 1}/{ALL_ANALYSTS.length} · auto-rotating
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
