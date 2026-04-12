import { useState, useEffect } from 'react';
import { MessageSquare, ThumbsUp, ThumbsDown, ExternalLink } from 'lucide-react';
import { fetchTrending } from '../api';

export default function AnalystOpinions() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [opinionsData, setOpinionsData] = useState([]);
  const [votes, setVotes] = useState([]);

  useEffect(() => {
    fetchTrending().then(data => {
      if(data?.headlines?.length > 0) {
        const colors = ['#8b5cf6', '#10b981', '#f59e0b', '#06b6d4', '#eab308'];
        const mapped = data.headlines.slice(0, 5).map((h, i) => ({
           name: h.source || 'Intelligence Desk',
           role: h.event_label || 'Analysis',
           color: colors[i % colors.length],
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

  // Rotate every 6 seconds
  useEffect(() => {
    if(opinionsData.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIdx(prev => (prev + 1) % opinionsData.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [opinionsData]);

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

  if (opinionsData.length === 0) return null;

  const analyst = opinionsData[currentIdx] || opinionsData[0];
  const v = votes[currentIdx] || votes[0];

  return (
    <div className="analyst-opinions-panel">
      <div className="analyst-opinions-header">
        <MessageSquare size={13} />
        <span>SOURCE HIGHLIGHTS</span>
      </div>

      <div className="analyst-opinions-list">
        <div key={currentIdx} className="analyst-opinion-card" style={{ animation: 'fadeIn 0.5s', borderLeft: `3px solid ${analyst.color}`, background: `linear-gradient(90deg, ${analyst.color}15 0%, rgba(255,255,255,0.02) 100%)` }}>
          <div className="analyst-card-header">
            <div className="analyst-avatar">
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: analyst.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '12px' }}>
                {analyst.name.slice(0, 2).toUpperCase()}
              </div>
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
