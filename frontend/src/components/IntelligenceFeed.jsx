import { useState } from 'react';
import { Radio, ChevronRight, Shield, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function IntelligenceFeed({ headlines = [] }) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');

  const displayHeadlines = headlines.length > 0 ? headlines : [];

  if (displayHeadlines.length === 0) return null;

  return (
    <div className="intelligence-feed">
      <div className="intel-feed-header">
        <div className="intel-feed-title">
          <Radio size={12} className="pulse-animation" />
          <span>INTELLIGENCE FEED</span>
          <div className="intel-feed-progress">
            <div className="intel-feed-progress-bar" />
          </div>
        </div>
        <div className="intel-feed-filters">
          <button
            className={`intel-filter ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Elastic Sources
          </button>
          <button
            className={`intel-filter ${filter === 'insights' ? 'active' : ''}`}
            onClick={() => setFilter('insights')}
          >
            Closer Insights
          </button>
        </div>
      </div>

      <div className="intel-feed-list">
        {displayHeadlines.slice(0, 8).map((item, idx) => (
          <div
            key={idx}
            className="intel-feed-item"
            onClick={() => navigate(`/search/${encodeURIComponent(item.title.split(' ').slice(0, 5).join(' '))}`)}
          >
            <div className="intel-feed-item-avatar">
              {item.image_url ? (
                <img src={item.image_url} alt="" onError={(e) => { e.target.style.display = 'none'; }} />
              ) : (
                <div className="intel-avatar-placeholder">
                  {(item.source || 'N')[0]}
                </div>
              )}
            </div>
            <div className="intel-feed-item-content">
              <div className="intel-feed-item-title">{item.title}</div>
              <div className="intel-feed-item-meta">
                <span className="intel-source">{item.source || 'Unknown'}</span>
                {item.time_ago && <span className="intel-time">{item.time_ago}</span>}
              </div>
            </div>
            <div className="intel-feed-item-badges">
              {item.is_trusted ? (
                <span className="intel-badge verified">
                  <Shield size={9} /> VERIFIED
                </span>
              ) : (
                <span className="intel-badge verifying">
                  <AlertTriangle size={9} /> VERIFYING
                </span>
              )}
              {item.entities?.slice(0, 2).map((e, i) => (
                <span key={i} className="intel-entity-tag">{e.word || e}</span>
              ))}
            </div>
            <ChevronRight size={14} className="intel-feed-arrow" />
          </div>
        ))}
      </div>
    </div>
  );
}
