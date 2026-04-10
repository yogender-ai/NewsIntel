import { useState } from 'react';
import { TrendingUp, Flame, ArrowUpRight, RefreshCw, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const MOCK_TRENDS = [
  {
    title: 'Iran Ceasefire',
    change: '+1.2K',
    tags: ['Middle East Tensions', '+9.86'],
    engagement: '37.4k',
    hot: true,
    image: null,
  },
  {
    title: 'Trump Iran-Deal',
    change: '+5.59',
    tags: ['Russia Ukraine', '+4.28'],
    engagement: '5,302',
    hot: false,
    image: null,
  },
  {
    title: 'Global Markets Rally',
    change: '+3.41',
    tags: ['Economy', 'Bulls'],
    engagement: '12.1k',
    hot: true,
    image: null,
  },
  {
    title: 'AI Regulation EU',
    change: '+2.87',
    tags: ['Technology', 'Policy'],
    engagement: '8.4k',
    hot: false,
    image: null,
  },
];

export default function TrendsSidebar({ trends = null }) {
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);
  const displayTrends = trends || MOCK_TRENDS;

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  };

  return (
    <div className="trends-sidebar">
      <div className="trends-header">
        <div className="trends-title">
          <Flame size={14} className="trends-fire-icon" />
          <span>TRENDS</span>
        </div>
        <button
          className={`trends-refresh ${refreshing ? 'spinning' : ''}`}
          onClick={handleRefresh}
        >
          <RefreshCw size={12} />
        </button>
      </div>

      <div className="trends-list">
        {displayTrends.map((trend, idx) => (
          <div
            key={idx}
            className="trend-card"
            onClick={() => navigate(`/search/${encodeURIComponent(trend.title)}`)}
          >
            <div className="trend-card-left">
              <div className="trend-rank-avatar">
                {trend.image ? (
                  <img src={trend.image} alt="" />
                ) : (
                  <div className="trend-avatar-placeholder">
                    {trend.title.charAt(0)}
                  </div>
                )}
              </div>
              <div className="trend-info">
                <div className="trend-name">
                  {trend.title}
                  {trend.hot && <span className="trend-hot-badge">🔥</span>}
                  <span className="trend-change positive">{trend.change}</span>
                </div>
                <div className="trend-tags">
                  {trend.tags.map((tag, i) => (
                    <span key={i} className="trend-tag">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="trend-card-right">
              <span className="trend-engagement">
                <ArrowUpRight size={10} />
                {trend.engagement}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
