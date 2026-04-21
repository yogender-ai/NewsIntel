import { useState, useEffect } from 'react';
import { TrendingUp, Flame, ArrowUpRight, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchTrending } from '../api';

export default function TrendsSidebar({ trends = null }) {
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);
  const [liveData, setLiveData] = useState([]);

  useEffect(() => {
    loadTrends();
  }, []);

  const loadTrends = () => {
    fetchTrending().then(data => {
      if (data?.headlines?.length > 0) {
        const mapped = data.headlines.slice(0, 5).map((hl, i) => {
          const title = hl.title || '';
          const words = title.split(/\s+/).filter(w => w.length > 2);
          const shortTitle = words.slice(0, 4).join(' ');
          
          const tags = [];
          if (hl.event_label && hl.event_label !== 'BREAKING') tags.push(hl.event_label);
          if (hl.source) tags.push(hl.source);
          
          return {
            title: shortTitle || title.slice(0, 40),
            tags: tags.length > 0 ? tags : ['Global'],
            hot: hl.severity === 'critical' || hl.severity === 'high',
            time_ago: hl.time_ago || '',
            link: hl.link,
          };
        });
        setLiveData(mapped);
      }
    }).catch(() => {});
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadTrends();
    setTimeout(() => setRefreshing(false), 1500);
  };

  const displayTrends = trends || liveData;

  if (displayTrends.length === 0) return null;

  return (
    <div className="trends-sidebar">
      <div className="trends-header">
        <div className="trends-title">
          <Flame size={14} className="trends-fire-icon" />
          <span>TRENDS</span>
        </div>
        <button className={`trends-refresh ${refreshing ? 'spinning' : ''}`} onClick={handleRefresh}>
          <RefreshCw size={12} />
        </button>
      </div>

      <div className="trends-list">
        {displayTrends.map((trend, idx) => (
          <div key={idx} className="trend-card" onClick={() => navigate(`/search/${encodeURIComponent(trend.title)}`)}>
            <div className="trend-card-left">
              <div className="trend-avatar-placeholder">{trend.title.charAt(0)}</div>
              <div className="trend-info">
                <div className="trend-name">
                  {trend.title}
                  {trend.hot && <span className="trend-hot-badge">🔥</span>}
                </div>
                <div className="trend-tags">
                  {trend.tags.map((tag, i) => (<span key={i} className="trend-tag">{tag}</span>))}
                </div>
              </div>
            </div>
            <div className="trend-card-right">
              {trend.time_ago && <span className="trend-engagement" style={{ fontSize: '10px', color: '#64748b' }}>{trend.time_ago}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
