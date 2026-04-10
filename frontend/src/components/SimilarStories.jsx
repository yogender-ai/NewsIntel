import { Eye, Clock, Bookmark } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function SimilarStories({ articles = [], topic = '' }) {
  const navigate = useNavigate();

  if (!articles || articles.length === 0) return null;

  const stories = articles.slice(0, 4);

  const getGradient = (idx) => {
    const gradients = [
      'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
      'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      'linear-gradient(135deg, #171717 0%, #262626 100%)',
    ];
    return gradients[idx % gradients.length];
  };

  return (
    <div className="similar-stories-panel">
      <div className="similar-stories-header">
        <Eye size={13} />
        <span>SIMILAR STORIES</span>
      </div>

      <div className="similar-stories-list">
        {stories.map((story, idx) => (
          <div
            key={idx}
            className="similar-story-card"
            onClick={() => navigate(`/search/${encodeURIComponent(story.title?.split(' ').slice(0, 5).join(' ') || topic)}`)}
          >
            <div className="similar-story-image" style={{ background: getGradient(idx) }}>
              {story.image_url ? (
                <img
                  src={story.image_url}
                  alt=""
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <div className="similar-story-placeholder">
                  {(story.source || 'N')[0]}
                </div>
              )}
              {story.region && (
                <span className="similar-story-region">{story.region}</span>
              )}
            </div>
            <div className="similar-story-content">
              <h4 className="similar-story-title">
                {story.title?.length > 60 ? story.title.slice(0, 60) + '...' : story.title}
              </h4>
              <div className="similar-story-meta">
                {story.tags?.slice(0, 3).map((tag, i) => (
                  <span key={i} className="similar-story-tag">{tag}</span>
                )) || (
                  <>
                    <span className="similar-story-tag">{story.source}</span>
                    {story.sentiment?.label && (
                      <span className="similar-story-tag">{story.sentiment.label}</span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
