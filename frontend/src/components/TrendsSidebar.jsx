import { useState, useEffect } from 'react';
import { TrendingUp, Flame, ArrowUpRight, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const MOCK_TRENDS = [
  { title: 'Iran Ceasefire', change: 1.2, tags: ['Middle East Tensions'], engagement: 37400, hot: true },
  { title: 'Trump Iran-Deal', change: 5.59, tags: ['Russia Ukraine'], engagement: 5302, hot: false },
  { title: 'Global Markets Rally', change: 3.41, tags: ['Economy', 'Bulls'], engagement: 12100, hot: true },
  { title: 'AI Regulation EU', change: 2.87, tags: ['Technology', 'Policy'], engagement: 8400, hot: false },
  { title: 'Sudan Crisis', change: 4.12, tags: ['Africa', 'Conflict'], engagement: 6700, hot: true },
];

function formatNum(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}

export default function TrendsSidebar({ trends = null }) {
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);
  const [liveData, setLiveData] = useState(MOCK_TRENDS);

  // Auto-update engagement and change values every 5s
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
    setLiveData(prev => prev.map(t => ({
      ...t,
      engagement: t.engagement + Math.floor(Math.random() * 200) + 50,
      change: +(t.change + Math.random() * 0.5).toFixed(2),
    })));
    setTimeout(() => setRefreshing(false), 1500);
  };

  const displayTrends = trends || liveData;

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
