import { ExternalLink, Clock, MapPin, Globe, Shield, ArrowUpRight } from 'lucide-react';

export default function ArticleCard({ article, index }) {
  const {
    title,
    link,
    source,
    summary,
    sentiment = {},
    entities = [],
    time_ago,
    region,
    published,
    is_trusted,
  } = article;

  const sentimentLabel = sentiment.label || 'neutral';
  const sentimentScore = sentiment.score ? Math.round(sentiment.score * 100) : null;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  // Open article in new tab
  const handleClick = (e) => {
    e.preventDefault();
    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      className={`article-card glass stagger-${(index % 8) + 1}`}
      id={`article-${index}`}
    >
      {/* Source badges */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {is_trusted && (
          <div className="article-trusted-badge">
            <Shield size={8} />
            Trusted Source
          </div>
        )}
        {index < 3 && (
          <div className="article-breaking-indicator">
            <span className="breaking-dot" />
            Latest
          </div>
        )}
      </div>

      <div className="article-card-header">
        <div className="article-card-title">
          <a href={link} onClick={handleClick} title={`Read: ${title}`}>
            {title}
          </a>
        </div>
        <div className="sentiment-badge-wrapper">
          <span className={`sentiment-badge ${sentimentLabel}`}>
            {sentimentLabel}
          </span>
          {sentimentScore && sentimentScore !== 50 && (
            <span className="sentiment-score">{sentimentScore}%</span>
          )}
        </div>
      </div>

      <p className="article-card-summary">{summary}</p>

      <div className="article-card-meta">
        <div className="meta-left">
          <span className="article-source">
            <MapPin size={10} />
            {source}
          </span>
          {time_ago && (
            <span className="article-time">
              <Clock size={10} />
              {time_ago}
            </span>
          )}
          {region && (
            <span className="article-region">
              <Globe size={10} />
              {region}
            </span>
          )}
        </div>
      </div>

      <div className="article-card-footer">
        <div className="article-entities">
          {entities.slice(0, 3).map((e, i) => (
            <span key={i} className="entity-chip">
              <span className="entity-type">{e.entity}</span>
              {e.word}
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {published && (
            <span className="article-date">{formatDate(published)}</span>
          )}
          <a
            href={link}
            onClick={handleClick}
            className="article-read-more"
            title="Read full article"
          >
            Read
            <ArrowUpRight size={12} />
          </a>
        </div>
      </div>
    </div>
  );
}
