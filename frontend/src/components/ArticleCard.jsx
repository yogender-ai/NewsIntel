import { ExternalLink, Clock, MapPin, Globe, Shield, ArrowUpRight, Bookmark, BookmarkCheck, Play } from 'lucide-react';

// Google News image domain patterns to filter out
const BLOCKED_IMAGE_DOMAINS = [
  'news.google.com',
  'lh3.googleusercontent.com/proxy',
  'encrypted-tbn',
  'gstatic.com',
];

function isValidImage(url) {
  if (!url) return false;
  if (url.length < 20) return false;
  const lower = url.toLowerCase();
  return !BLOCKED_IMAGE_DOMAINS.some(domain => lower.includes(domain));
}

// Generate a gradient placeholder based on source name
function getPlaceholderGradient(source) {
  const gradients = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
    'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)',
    'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
  ];
  const hash = (source || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return gradients[hash % gradients.length];
}

/**
 * ArticleCard v5.0 — No more generic cards. Multiple premium layouts:
 * - "hero": Full-width cinematic banner
 * - "feature": Magazine side-by-side
 * - "wire": Bloomberg terminal compact row
 * - "compact": Numbered list item
 */
export default function ArticleCard({ article, index, variant = 'wire', isBookmarked, onToggleBookmark }) {
  const {
    title, link, source, summary, sentiment = {},
    entities = [], time_ago, region, published,
    is_trusted, image_url, full_text_preview,
  } = article;

  const sentimentLabel = sentiment.label || 'neutral';
  const sentimentScore = sentiment.score ? Math.round(sentiment.score * 100) : null;
  const hasValidImage = isValidImage(image_url);

  const handleClick = (e) => {
    e.preventDefault();
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
  };

  const handleBookmark = (e) => {
    e.stopPropagation();
    onToggleBookmark?.(article);
  };

  // ── HERO VARIANT — Full-width cinematic banner ──
  if (variant === 'hero') {
    return (
      <div className="article-hero" id="article-hero" onClick={handleClick}>
        {hasValidImage ? (
          <div className="hero-image-container">
            <img
              src={image_url}
              alt={title}
              className="hero-image"
              onError={(e) => {
                e.target.parentElement.style.background = getPlaceholderGradient(source);
                e.target.style.display = 'none';
              }}
              loading="eager"
            />
            <div className="hero-image-overlay" />
          </div>
        ) : (
          <div className="hero-image-container hero-gradient" style={{ background: getPlaceholderGradient(source) }}>
            <div className="hero-gradient-pattern" />
            <div className="hero-image-overlay" />
          </div>
        )}
        <div className="hero-content">
          <div className="hero-badges">
            {is_trusted && (
              <span className="badge-trusted"><Shield size={10} /> TRUSTED SOURCE</span>
            )}
            <span className={`badge-sentiment ${sentimentLabel}`}>
              {sentimentLabel.toUpperCase()}
              {sentimentScore && sentimentScore !== 50 && <span> {sentimentScore}%</span>}
            </span>
            <button className="bookmark-btn-hero" onClick={handleBookmark}>
              {isBookmarked ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
            </button>
          </div>
          <h1 className="hero-title">{title}</h1>
          <p className="hero-summary">{summary || full_text_preview}</p>
          <div className="hero-meta">
            <span className="hero-source">{source}</span>
            {time_ago && <span className="hero-time"><Clock size={11} /> {time_ago}</span>}
            {region && <span className="hero-region"><Globe size={11} /> {region}</span>}
          </div>
          {entities.length > 0 && (
            <div className="hero-entities">
              {entities.slice(0, 5).map((e, i) => (
                <span key={i} className="hero-entity">
                  <span className="entity-type-dot">{e.entity}</span>
                  {e.word}
                </span>
              ))}
            </div>
          )}
          <span className="hero-cta">
            Read Full Article <ArrowUpRight size={14} />
          </span>
        </div>
      </div>
    );
  }

  // ── FEATURE VARIANT — Magazine side-by-side ──
  if (variant === 'feature') {
    return (
      <div className={`article-feature stagger-${(index % 6) + 1}`} id={`article-feature-${index}`} onClick={handleClick}>
        {hasValidImage ? (
          <div className="feature-image-wrap">
            <img
              src={image_url}
              alt=""
              className="feature-image"
              onError={(e) => {
                e.target.parentElement.style.background = getPlaceholderGradient(source);
                e.target.style.display = 'none';
              }}
              loading="lazy"
            />
          </div>
        ) : (
          <div className="feature-image-wrap feature-gradient" style={{ background: getPlaceholderGradient(source) }}>
            <div className="feature-gradient-text">{source[0]}</div>
          </div>
        )}
        <div className="feature-body">
          <div className="feature-top">
            <span className={`badge-sentiment mini ${sentimentLabel}`}>{sentimentLabel}</span>
            {is_trusted && <Shield size={10} className="trusted-icon" />}
            <button className="bookmark-btn-mini" onClick={handleBookmark}>
              {isBookmarked ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
            </button>
          </div>
          <h3 className="feature-title">{title}</h3>
          <p className="feature-summary">{summary}</p>
          <div className="feature-meta">
            <span>{source}</span>
            <span>·</span>
            <span>{time_ago || 'recently'}</span>
          </div>
        </div>
      </div>
    );
  }

  // ── WIRE VARIANT — Bloomberg terminal compact row ──
  if (variant === 'wire') {
    return (
      <div className={`article-wire stagger-${(index % 8) + 1}`} id={`article-wire-${index}`} onClick={handleClick}>
        <div className="wire-time">{time_ago || 'now'}</div>
        <div className={`wire-sentiment-dot ${sentimentLabel}`} />
        <div className="wire-body">
          <span className="wire-title">{title}</span>
          <div className="wire-meta">
            {is_trusted && <Shield size={8} className="trusted-icon" />}
            <span className="wire-source">{source}</span>
            {region && <span className="wire-region">{region}</span>}
          </div>
        </div>
        <div className="wire-actions">
          <button className="bookmark-btn-mini" onClick={handleBookmark}>
            {isBookmarked ? <BookmarkCheck size={11} /> : <Bookmark size={11} />}
          </button>
          <ArrowUpRight size={12} className="wire-arrow" />
        </div>
      </div>
    );
  }

  // ── COMPACT VARIANT — Numbered list ──
  return (
    <div className={`article-compact stagger-${(index % 8) + 1}`} id={`article-compact-${index}`} onClick={handleClick}>
      <div className="compact-rank">{String(index + 1).padStart(2, '0')}</div>
      <div className="compact-body">
        <span className="compact-title">{title}</span>
        <div className="compact-meta">
          {is_trusted && <Shield size={8} className="trusted-icon" />}
          <span>{source}</span>
          <span>·</span>
          <span>{time_ago || 'recently'}</span>
          <span className={`compact-sentiment ${sentimentLabel}`}>{sentimentLabel}</span>
        </div>
      </div>
      <button className="bookmark-btn-mini" onClick={handleBookmark}>
        {isBookmarked ? <BookmarkCheck size={11} /> : <Bookmark size={11} />}
      </button>
    </div>
  );
}
