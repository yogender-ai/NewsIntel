import { ExternalLink, Clock, MapPin, Globe, Shield, ArrowUpRight, Bookmark, BookmarkCheck, Image } from 'lucide-react';

/**
 * ArticleCard — Three variants:
 * - "hero": Massive card with image, full summary
 * - "sidebar": Medium card with thumbnail
 * - "compact": Row/list style
 */
export default function ArticleCard({ article, index, variant = 'default', isBookmarked, onToggleBookmark }) {
  const {
    title, link, source, summary, sentiment = {},
    entities = [], time_ago, region, published,
    is_trusted, image_url, full_text_preview,
  } = article;

  const sentimentLabel = sentiment.label || 'neutral';
  const sentimentScore = sentiment.score ? Math.round(sentiment.score * 100) : null;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch { return ''; }
  };

  const handleClick = (e) => {
    e.preventDefault();
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
  };

  const handleBookmark = (e) => {
    e.stopPropagation();
    onToggleBookmark?.(article);
  };

  // ── HERO VARIANT ──
  if (variant === 'hero') {
    return (
      <div className={`article-hero-card glass stagger-1`} id="article-hero">
        {image_url && (
          <div className="article-hero-image-wrapper">
            <img
              src={image_url}
              alt={title}
              className="article-hero-image"
              onError={(e) => { e.target.style.display = 'none'; }}
              loading="lazy"
            />
            <div className="article-hero-image-overlay" />
          </div>
        )}
        <div className="article-hero-body">
          <div className="article-hero-badges">
            {is_trusted && (
              <span className="badge-trusted"><Shield size={9} /> Trusted Source</span>
            )}
            <span className={`badge-sentiment ${sentimentLabel}`}>
              {sentimentLabel}
              {sentimentScore && sentimentScore !== 50 && <span className="score-append"> {sentimentScore}%</span>}
            </span>
            <button className="bookmark-btn" onClick={handleBookmark} title={isBookmarked ? 'Remove bookmark' : 'Save for later'}>
              {isBookmarked ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
            </button>
          </div>
          <h2 className="article-hero-title">
            <a href={link} onClick={handleClick}>{title}</a>
          </h2>
          <p className="article-hero-summary">{summary || full_text_preview}</p>
          <div className="article-hero-meta">
            <span className="article-hero-source"><MapPin size={10} /> {source}</span>
            {time_ago && <span className="article-hero-time"><Clock size={10} /> {time_ago}</span>}
            {region && <span className="article-hero-region"><Globe size={10} /> {region}</span>}
          </div>
          {entities.length > 0 && (
            <div className="article-hero-entities">
              {entities.slice(0, 4).map((e, i) => (
                <span key={i} className="entity-chip-v4">
                  <span className="entity-type-badge">{e.entity}</span>
                  {e.word}
                </span>
              ))}
            </div>
          )}
          <a href={link} onClick={handleClick} className="article-hero-cta">
            Read Full Article <ArrowUpRight size={14} />
          </a>
        </div>
      </div>
    );
  }

  // ── SIDEBAR VARIANT ──
  if (variant === 'sidebar') {
    return (
      <div className={`article-sidebar-card glass stagger-${(index % 8) + 1}`} id={`article-sidebar-${index}`}>
        {image_url && (
          <div className="article-sidebar-thumb">
            <img
              src={image_url}
              alt=""
              onError={(e) => { e.target.parentElement.style.display = 'none'; }}
              loading="lazy"
            />
          </div>
        )}
        <div className="article-sidebar-body">
          <div className="article-sidebar-top-row">
            <span className={`badge-sentiment tiny ${sentimentLabel}`}>{sentimentLabel}</span>
            <button className="bookmark-btn mini" onClick={handleBookmark}>
              {isBookmarked ? <BookmarkCheck size={11} /> : <Bookmark size={11} />}
            </button>
          </div>
          <a href={link} onClick={handleClick} className="article-sidebar-title">{title}</a>
          <p className="article-sidebar-summary">{summary}</p>
          <div className="article-sidebar-meta">
            {is_trusted && <Shield size={8} className="trusted-icon" />}
            <span>{source}</span>
            <span>·</span>
            <span>{time_ago || 'recently'}</span>
          </div>
        </div>
      </div>
    );
  }

  // ── COMPACT / LIST VARIANT ──
  if (variant === 'compact') {
    return (
      <div className={`article-compact-row stagger-${(index % 8) + 1}`} id={`article-compact-${index}`}>
        <div className="compact-number">{index + 1}</div>
        <div className="compact-body">
          <a href={link} onClick={handleClick} className="compact-title">{title}</a>
          <div className="compact-meta">
            {is_trusted && <Shield size={8} className="trusted-icon" />}
            <span className="compact-source">{source}</span>
            <span className="compact-sep">·</span>
            <span className="compact-time">{time_ago || 'recently'}</span>
            <span className={`compact-sentiment ${sentimentLabel}`}>{sentimentLabel}</span>
          </div>
        </div>
        <button className="bookmark-btn mini" onClick={handleBookmark}>
          {isBookmarked ? <BookmarkCheck size={11} /> : <Bookmark size={11} />}
        </button>
        <a href={link} onClick={handleClick} className="compact-arrow" title="Read">
          <ArrowUpRight size={13} />
        </a>
      </div>
    );
  }

  // ── DEFAULT (backwards compat) ──
  return (
    <div className={`article-card glass stagger-${(index % 8) + 1}`} id={`article-${index}`}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {is_trusted && (
            <div className="article-trusted-badge"><Shield size={8} /> Trusted Source</div>
          )}
          {index < 3 && (
            <div className="article-breaking-indicator"><span className="breaking-dot" /> Latest</div>
          )}
        </div>
        <button className="bookmark-btn mini" onClick={handleBookmark}>
          {isBookmarked ? <BookmarkCheck size={11} /> : <Bookmark size={11} />}
        </button>
      </div>
      <div className="article-card-header">
        <div className="article-card-title">
          <a href={link} onClick={handleClick} title={`Read: ${title}`}>{title}</a>
        </div>
        <div className="sentiment-badge-wrapper">
          <span className={`sentiment-badge ${sentimentLabel}`}>{sentimentLabel}</span>
          {sentimentScore && sentimentScore !== 50 && <span className="sentiment-score">{sentimentScore}%</span>}
        </div>
      </div>
      <p className="article-card-summary">{summary}</p>
      <div className="article-card-meta">
        <div className="meta-left">
          <span className="article-source"><MapPin size={10} /> {source}</span>
          {time_ago && <span className="article-time"><Clock size={10} /> {time_ago}</span>}
          {region && <span className="article-region"><Globe size={10} /> {region}</span>}
        </div>
      </div>
      <div className="article-card-footer">
        <div className="article-entities">
          {entities.slice(0, 3).map((e, i) => (
            <span key={i} className="entity-chip"><span className="entity-type">{e.entity}</span> {e.word}</span>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {published && <span className="article-date">{formatDate(published)}</span>}
          <a href={link} onClick={handleClick} className="article-read-more" title="Read full article">
            Read <ArrowUpRight size={12} />
          </a>
        </div>
      </div>
    </div>
  );
}
