import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Flame, Search, Clock, Loader, ArrowUpRight, BarChart3 } from 'lucide-react';
import { fetchPopularTopics } from '../api';

export default function PopularTopics() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const result = await fetchPopularTopics();
        setData(result);
      } catch { /* silent */ }
      setLoading(false);
    })();
  }, []);

  const topics = data?.top_topics || [];
  const recentActivity = data?.recent_activity || [];

  if (loading) {
    return (
      <div className="popular-topics-widget">
        <div className="popular-topics-header">
          <Flame size={15} className="popular-icon" />
          <h3>Popular Searches</h3>
        </div>
        <div className="popular-loading">
          <Loader size={16} className="spin" />
          <span>Loading analytics...</span>
        </div>
      </div>
    );
  }

  if (topics.length === 0 && recentActivity.length === 0) {
    return (
      <div className="popular-topics-widget">
        <div className="popular-topics-header">
          <Flame size={15} className="popular-icon" />
          <h3>Popular Searches</h3>
        </div>
        <div className="popular-empty">
          <Search size={20} style={{ opacity: 0.3 }} />
          <p>Search a topic to start building analytics!</p>
        </div>
      </div>
    );
  }

  const maxCount = topics.length > 0 ? topics[0].count : 1;

  return (
    <div className="popular-topics-widget">
      <div className="popular-topics-header">
        <Flame size={15} className="popular-icon" />
        <h3>Popular Searches</h3>
        <span className="popular-badge">
          <BarChart3 size={10} /> Live
        </span>
      </div>

      {/* Top Topics */}
      {topics.length > 0 && (
        <div className="popular-list">
          {topics.slice(0, 6).map((t, i) => (
            <button
              key={t.topic}
              className="popular-topic-item"
              onClick={() => navigate(`/search/${encodeURIComponent(t.topic)}`)}
            >
              <span className="popular-rank">{String(i + 1).padStart(2, '0')}</span>
              <div className="popular-topic-info">
                <span className="popular-topic-name">{t.topic}</span>
                <div className="popular-bar-bg">
                  <div
                    className="popular-bar-fill"
                    style={{ width: `${Math.max(12, (t.count / maxCount) * 100)}%` }}
                  />
                </div>
              </div>
              <span className="popular-count">{t.count}×</span>
              <ArrowUpRight size={11} className="popular-arrow" />
            </button>
          ))}
        </div>
      )}

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <div className="popular-recent">
          <div className="popular-recent-header">
            <Clock size={11} />
            <span>Recent</span>
          </div>
          {recentActivity.slice(0, 3).map((r, i) => (
            <div key={i} className="popular-recent-item" onClick={() => navigate(`/search/${encodeURIComponent(r.topic)}`)}>
              <span className="recent-dot" />
              <span className="recent-topic">{r.topic}</span>
              <span className="recent-region">{r.region?.toUpperCase()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
