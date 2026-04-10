import { ThumbsUp, MessageCircle, Share2, Shield, CheckCircle, Clock, BarChart3, Image as ImageIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function CommunityPost({ post }) {
  const navigate = useNavigate();

  const {
    author = 'Anonymous',
    role = 'Analyst',
    verified = false,
    avatar = null,
    timestamp = '3 hours ago',
    title = '',
    content = '',
    tags = [],
    votes = 0,
    comments = 0,
    image = null,
    chartData = null,
    discussion = null,
  } = post || {};

  return (
    <div className="community-post-card">
      {/* Author Row */}
      <div className="cpost-header">
        <div className="cpost-author-section">
          <div className="cpost-avatar">
            {avatar ? (
              <img src={avatar} alt={author} />
            ) : (
              <div className="cpost-avatar-placeholder">
                {author.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
            )}
          </div>
          <div className="cpost-author-info">
            <div className="cpost-author-name">
              {author}
              {verified && (
                <span className="cpost-verified-badge">
                  <CheckCircle size={10} /> VERIFIED
                </span>
              )}
            </div>
            <div className="cpost-author-role">
              {role}
              <span className="cpost-dot">·</span>
              <Clock size={10} />
              <span>{timestamp}</span>
            </div>
          </div>
        </div>
        <div className="cpost-votes">
          <span className="cpost-vote-icon">▲</span>
          <span className="cpost-vote-count">{votes.toLocaleString()}</span>
        </div>
      </div>

      {/* Title */}
      <h3 className="cpost-title" onClick={() => navigate(`/search/${encodeURIComponent(title.split(' ').slice(0, 5).join(' '))}`)}>
        {title}
      </h3>

      {/* Content */}
      {content && <p className="cpost-content">{content}</p>}

      {/* Tags */}
      <div className="cpost-tags">
        {tags.map((tag, i) => (
          <span
            key={i}
            className={`cpost-tag ${tag.type || ''}`}
            onClick={() => navigate(`/search/${encodeURIComponent(tag.label || tag)}`)}
          >
            {tag.icon && <span className="cpost-tag-icon">{tag.icon}</span>}
            {tag.label || tag}
          </span>
        ))}
      </div>

      {/* Discussion Prompt */}
      {discussion && (
        <div className="cpost-discussion">
          <MessageCircle size={12} />
          <span>{discussion}</span>
          <span className="cpost-discussion-count">
            {comments > 0 && `${comments} in this discussion`}
          </span>
        </div>
      )}

      {/* Chart inline */}
      {chartData && (
        <div className="cpost-chart-embed">
          <div className="cpost-chart-header">
            <BarChart3 size={12} />
            <span>{chartData.label}</span>
            <span className={`cpost-chart-change ${chartData.change > 0 ? 'positive' : 'negative'}`}>
              {chartData.change > 0 ? '+' : ''}{chartData.change}%
            </span>
          </div>
          <div className="cpost-chart-sparkline">
            {/* Sparkline bars */}
            {Array.from({ length: 20 }, (_, i) => (
              <div
                key={i}
                className="spark-bar"
                style={{
                  height: `${20 + Math.random() * 60}%`,
                  background: chartData.change > 0
                    ? `rgba(52, 211, 153, ${0.3 + Math.random() * 0.5})`
                    : `rgba(244, 63, 94, ${0.3 + Math.random() * 0.5})`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="cpost-footer">
        <button className="cpost-action">
          <ThumbsUp size={13} /> Like
        </button>
        <button className="cpost-action">
          <MessageCircle size={13} /> Discuss
        </button>
        <button className="cpost-action">
          <Share2 size={13} /> Share
        </button>
      </div>
    </div>
  );
}
