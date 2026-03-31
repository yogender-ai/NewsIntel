import { Clock } from 'lucide-react';

export default function NewsTimeline({ articles = [] }) {
  if (!articles.length) return null;

  // Sort by time (most recent first)
  const sorted = [...articles]
    .filter(a => a.published)
    .sort((a, b) => {
      try {
        return new Date(b.published) - new Date(a.published);
      } catch {
        return 0;
      }
    })
    .slice(0, 10);

  if (sorted.length < 2) return null;

  const formatTimeShort = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return '';
    }
  };

  const formatDate = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div className="news-timeline" id="news-timeline">
      <div className="timeline-header">
        <Clock size={14} />
        <h3>Story Timeline</h3>
        <span className="timeline-subtitle">How this story evolved</span>
      </div>
      <div className="timeline-scroll">
        <div className="timeline-track">
          <div className="timeline-line" />
          {sorted.map((article, i) => (
            <div key={i} className={`timeline-node ${i === 0 ? 'latest' : ''}`}>
              <div className="timeline-dot-wrapper">
                <div className={`timeline-dot ${i === 0 ? 'pulse' : ''}`} />
              </div>
              <div className="timeline-time">
                <span className="timeline-time-value">{formatTimeShort(article.published)}</span>
                <span className="timeline-date-value">{formatDate(article.published)}</span>
              </div>
              <div className="timeline-card glass">
                <a href={article.link} target="_blank" rel="noopener noreferrer" className="timeline-card-title">
                  {article.title}
                </a>
                <div className="timeline-card-source">
                  {article.source}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
