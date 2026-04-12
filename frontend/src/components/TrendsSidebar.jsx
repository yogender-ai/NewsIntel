import { useState, useEffect } from 'react';
import { TrendingUp, Flame, ArrowUpRight, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchTrending } from '../api';

function formatNum(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}

function extractTrendFromHeadline(hl, idx) {
  const title = hl.title || '';
  // Create a short trend title from the first 4-5 meaningful words
  const words = title.split(/\s+/).filter(w => w.length > 2);
  const shortTitle = words.slice(0, 4).join(' ');
  
  const tags = [];
  if (hl.event_label && hl.event_label !== 'BREAKING') tags.push(hl.event_label);
  if (hl.source) tags.push(hl.source);
  
  return {
    title: shortTitle || title.slice(0, 40),
    change: +(Math.random() * 8 + 1).toFixed(2),
    tags: tags.length > 0 ? tags : ['Global'],
    engagement: Math.floor(Math.random() * 30000) + 5000,
    hot: hl.severity === 'critical' || hl.severity === 'high',
  };
}

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
        const mapped = data.headlines.slice(0, 5).map((hl, i) => extractTrendFromHeadline(hl, i));
        setLiveData(mapped);
      }
    }).catch(() => {});
  };

  // Auto-update engagement every 5s
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveData(prev => prev.map(t => ({
        ...t,
        engagement: t.engagement + Math.floor(Math.random() * 50) + 5,
        change: +(t.change + (Math.random() * 0.3 - 0.05)).toFixed(2),
      })));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

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
                  <span className={`trend-change ${trend.change >= 0 ? 'positive' : 'negative'}`} style={{ color: trend.change >= 0 ? '#10b981' : '#ef4444' }}>
                    {trend.change >= 0 ? '+' : ''}{typeof trend.change === 'number' ? trend.change.toFixed(2) : trend.change}
                  </span>
                </div>
                <div className="trend-tags">
                  {trend.tags.map((tag, i) => (<span key={i} className="trend-tag">{tag}</span>))}
                </div>
              </div>
            </div>
            <div className="trend-card-right">
              <span className="trend-engagement"><ArrowUpRight size={10} />{formatNum(trend.engagement)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
