import { useState, useEffect } from 'react';
import { MessageSquare, ThumbsUp, ThumbsDown, ExternalLink } from 'lucide-react';
import { fetchTrending } from '../api';

const DEFAULT_ANALYSTS = [
  { name: 'Yash', role: 'Head of Analytics', color: '#8b5cf6', opinion: 'Markets are in full risk-on mode, pricing in a swift Middle East ceasefire.', upvotes: 214, downvotes: 7, link: '#' },
];

export default function AnalystOpinions({ analysts = null }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [opinionsData, setOpinionsData] = useState(DEFAULT_ANALYSTS);
  const [votes, setVotes] = useState([{ up: 214, down: 7 }]);

  useEffect(() => {
    fetchTrending().then(data => {
      if(data?.headlines?.length > 0) {
        const mapped = data.headlines.slice(0, 5).map((h, i) => ({
           name: ['Yash', 'Sarah Kim', 'Carlos Mendez', 'Priya Sharma', 'Michael Gaki'][i] || 'Analyst',
           role: h.source || 'Intelligence Desk',
           color: ['#8b5cf6', '#10b981', '#f59e0b', '#06b6d4', '#eab308'][i] || '#a855f7',
           opinion: h.title,
           link: h.link || '#',
           upvotes: 100 + Math.floor(Math.random() * 200),
           downvotes: Math.floor(Math.random() * 20)
        }));
        setOpinionsData(mapped);
        setVotes(mapped.map(a => ({ up: a.upvotes, down: a.downvotes })));
      }
    }).catch(() => {});
  }, []);

  // Rotate analyst every 6 seconds
  useEffect(() => {
    if(opinionsData.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIdx(prev => (prev + 1) % opinionsData.length);
    }, 6000);
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

  const analyst = opinionsData[currentIdx] || opinionsData[0];
  const v = votes[currentIdx] || votes[0];

  return (
    <div className="analyst-opinions-panel">
      <div className="analyst-opinions-header">
        <MessageSquare size={13} />
        <span>ANALYST OPINIONS</span>
      </div>

      <div className="analyst-opinions-list">
        <div key={currentIdx} className="analyst-opinion-card" style={{ animation: 'fadeIn 0.5s', borderLeft: `3px solid ${analyst.color}`, background: `linear-gradient(90deg, ${analyst.color}15 0%, rgba(255,255,255,0.02) 100%)` }}>
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
          {analyst.link !== '#' && (
            <div style={{ marginTop: '10px' }}>
              <a href={analyst.link} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: analyst.color, display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontWeight: '600' }}>
                Read Source <ExternalLink size={10} />
              </a>
            </div>
          )}

          <div className="analyst-opinion-actions">
            <button className="analyst-vote-btn" onClick={() => setVotes(prev => { const n = [...prev]; n[currentIdx] = { ...n[currentIdx], up: n[currentIdx].up + 1 }; return n; })}>
              <ThumbsUp size={12} /><span>{v.up}</span>
            </button>
            <button className="analyst-vote-btn" onClick={() => setVotes(prev => { const n = [...prev]; n[currentIdx] = { ...n[currentIdx], down: n[currentIdx].down + 1 }; return n; })}>
              <ThumbsDown size={12} /><span>{v.down}</span>
            </button>
            <span className="analyst-view-more" style={{ fontSize: '10px', color: '#64748b' }}>
              {currentIdx + 1}/{opinionsData.length} · auto-rotating
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
