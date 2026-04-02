import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Star, X, CheckCircle, Send, Heart, Lightbulb, Frown, GitFork, Eye, ExternalLink, Sparkles, ArrowRight } from 'lucide-react';
import { fetchGitHubStars, fetchGitHubStats, submitFeedback, fetchFeedbackList } from '../api';

const REPO_URL = 'https://github.com/yogender-ai/News-Intel-Feedback';

export default function GithubWidget() {
  const [stars, setStars] = useState(null);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('feedback'); // Mobile view still uses tabs
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [feedbackList, setFeedbackList] = useState([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [starPulse, setStarPulse] = useState(false);
  const prevStars = useRef(null);

  const [formData, setFormData] = useState({
    author: "",
    text: "",
    emotion: "positive",
    rating: 5
  });

  // Fetch stars on mount and poll every 2 minutes
  useEffect(() => {
    const fetchStats = async () => {
      const fullStats = await fetchGitHubStats();
      if (fullStats) {
        setStats(fullStats);
        if (fullStats.stars !== null && fullStats.stars !== undefined) {
          // Animate if stars changed
          if (prevStars.current !== null && fullStats.stars > prevStars.current) {
            setStarPulse(true);
            setTimeout(() => setStarPulse(false), 2000);
          }
          prevStars.current = fullStats.stars;
          setStars(fullStats.stars);
        }
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 120000); // 2 min
    return () => clearInterval(interval);
  }, []);

  // Fetch feedback wall on mount
  useEffect(() => {
    loadFeedback();
  }, []);

  const loadFeedback = async () => {
    setFeedbackLoading(true);
    const data = await fetchFeedbackList();
    setFeedbackList(data.feedback || []);
    setFeedbackLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.author || !formData.text) return;
    
    setIsSubmitting(true);
    setError("");
    
    const res = await submitFeedback(formData.author, formData.text, formData.emotion, formData.rating);
    
    setIsSubmitting(false);
    
    if (res.status === "error") {
      setError(res.message);
    } else {
      setSuccess(true);
      // Reload feedback wall
      loadFeedback();
      setTimeout(() => {
        setSuccess(false);
        setActiveTab('wall');
        setFormData({ author: "", text: "", emotion: "positive", rating: 5 });
      }, 2500);
    }
  };

  const handleOpenRepo = () => {
    window.open(REPO_URL, '_blank');
  };

  const emotionConfig = {
    positive: { icon: Heart, label: 'Love it', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.3)' },
    idea: { icon: Lightbulb, label: 'Idea', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.3)' },
    negative: { icon: Frown, label: 'Issue', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.1)', border: 'rgba(244, 63, 94, 0.3)' },
  };

  const getEmotionEmoji = (emotion) => {
    const map = { positive: '💚', idea: '💡', negative: '🔴', neutral: '💬' };
    return map[emotion] || '💬';
  };

  return (
    <section className="premium-feedback-section" id="feedback-section">
      <div className="feedback-section-inner">
        {/* ── Section Header ── */}
        <div className="feedback-header">
          <div className="feedback-title-group">
            <div className="feedback-title-icon heartbeat">
              <Heart size={24} color="#ec4899" />
            </div>
            <div>
              <h2>Community Hub</h2>
              <p className="feedback-subtitle">Your voice shapes NewsIntel v5.0</p>
            </div>
          </div>

              {/* GitHub Stats Bar */}
              <div className="github-stats-bar">
                <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="github-stat-item" id="repo-link">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{opacity: 0.7}}>
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  <span>Repository</span>
                  <ExternalLink size={10} />
                </a>
                <div className="stats-divider" />
                <div className="github-stat-item">
                  <Star size={13} className="stat-star" />
                  <span>{stats?.stars ?? '—'}</span>
                </div>
                <div className="github-stat-item">
                  <GitFork size={13} />
                  <span>{stats?.forks ?? '—'}</span>
                </div>
                <div className="github-stat-item">
                  <Eye size={13} />
                  <span>{stats?.watchers ?? '—'}</span>
                </div>
              </div>
        </div>

        {/* Mobile Tabs */}
        <div className="feedback-mobile-tabs">
          <button className={`feedback-tab ${activeTab === 'feedback' ? 'active' : ''}`} onClick={() => setActiveTab('feedback')}>
            <Send size={14} /> Send Feedback
          </button>
          <button className={`feedback-tab ${activeTab === 'wall' ? 'active' : ''}`} onClick={() => setActiveTab('wall')}>
            <MessageSquare size={14} /> Live Wall
            {feedbackList.length > 0 && <span className="wall-count">{feedbackList.length}</span>}
          </button>
        </div>

        {/* ── Split Content Area ── */}
        <div className="feedback-split-content">
          
          {/* Left: Feedback Form */}
          <div className={`feedback-form-container ${activeTab === 'feedback' ? 'active-mobile' : ''}`}>
              { success ? (
                  <div className="feedback-success">
                    <div className="success-animation">
                      <CheckCircle size={48} className="success-icon" />
                      <div className="success-rings">
                        <div className="ring ring-1" />
                        <div className="ring ring-2" />
                        <div className="ring ring-3" />
                      </div>
                    </div>
                    <h3>Thank you! 🎉</h3>
                    <p>Your feedback is now live on our GitHub repository.</p>
                    <p className="success-hint">Switching to Live Wall...</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="feedback-form" id="feedback-form">
                    {error && <div className="feedback-error">{error}</div>}

                    <div className="form-group">
                      <label>Name / Handle</label>
                      <input 
                        type="text" 
                        placeholder="e.g. @janedoe" 
                        value={formData.author} 
                        onChange={e => setFormData({...formData, author: e.target.value})}
                        required
                        maxLength={50}
                        id="feedback-author"
                      />
                    </div>

                    <div className="form-group">
                      <label>How do you feel?</label>
                      <div className="emotion-selector">
                        {Object.entries(emotionConfig).map(([key, config]) => {
                          const Icon = config.icon;
                          return (
                            <button 
                              key={key}
                              type="button" 
                              className={`emotion-btn ${formData.emotion === key ? 'active' : ''}`}
                              onClick={() => setFormData({...formData, emotion: key})}
                              style={formData.emotion === key ? { background: config.bg, borderColor: config.border, color: config.color } : {}}
                            >
                              <Icon size={15} />
                              {config.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Rating</label>
                      <div className="star-rating-input">
                        {[1,2,3,4,5].map(n => (
                          <button
                            key={n}
                            type="button"
                            className={`star-rating-btn ${n <= formData.rating ? 'active' : ''}`}
                            onClick={() => setFormData({...formData, rating: n})}
                          >
                            <Star size={20} className={n <= formData.rating ? 'filled-star' : ''} />
                          </button>
                        ))}
                        <span className="rating-label">{formData.rating}/5</span>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Message</label>
                      <textarea 
                        placeholder="Share your thoughts, ideas, or report issues..." 
                        value={formData.text} 
                        onChange={e => setFormData({...formData, text: e.target.value})}
                        required
                        rows={4}
                        maxLength={1000}
                        id="feedback-message"
                      />
                      <div className="char-count">{formData.text.length}/1000</div>
                    </div>

                    <div className="form-actions">
                      <button type="submit" className="submit-feedback-btn" disabled={isSubmitting || !formData.text.trim() || !formData.author.trim()} id="submit-feedback">
                        {isSubmitting ? (
                          <span className="submitting-spinner">
                            <span className="spinner-dot" />
                            Posting to GitHub...
                          </span>
                        ) : (
                          <>
                            <Send size={14} />
                            Post Live
                            <ArrowRight size={14} />
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
          </div>

          {/* Right: Live Wall */}
          <div className={`feedback-wall-container ${activeTab === 'wall' ? 'active-mobile' : ''}`} id="feedback-wall">
             {feedbackLoading ? (
                    <div className="wall-loading">
                      <div className="wall-loading-spinner" />
                      <p>Loading live feedback...</p>
                    </div>
                  ) : feedbackList.length === 0 ? (
                    <div className="wall-empty">
                      <MessageSquare size={40} style={{ opacity: 0.3 }} />
                      <p>No feedback yet. Be the first!</p>
                      <button className="wall-cta-btn" onClick={() => setActiveTab('feedback')}>
                        <Send size={14} /> Send Feedback
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="wall-header">
                        <div className="wall-live-indicator">
                          <span className="wall-live-dot" />
                          Live from GitHub Issues
                        </div>
                        <button className="wall-refresh-btn" onClick={loadFeedback}>↻ Refresh</button>
                      </div>
                      <div className="wall-scroll">
                        {feedbackList.map((item, i) => (
                          <div key={item.id || i} className={`wall-card wall-card-${item.emotion}`} style={{ animationDelay: `${i * 0.08}s` }}>
                            <div className="wall-card-header">
                              <div className="wall-avatar">
                                {item.author?.[0]?.toUpperCase() || '?'}
                              </div>
                              <div className="wall-card-meta">
                                <span className="wall-author">{item.author}</span>
                                <span className="wall-time">{item.time_ago}</span>
                              </div>
                              <div className="wall-emotion-badge">
                                {getEmotionEmoji(item.emotion)}
                              </div>
                            </div>
                            <p className="wall-message">{item.message}</p>
                            <div className="wall-card-footer">
                              <div className="wall-rating">
                                {Array.from({ length: item.rating || 0 }).map((_, j) => (
                                  <Star key={j} size={11} className="filled-star" />
                                ))}
                              </div>
                              {item.url && (
                                <a href={item.url} target="_blank" rel="noopener noreferrer" className="wall-issue-link">
                                  #{item.id} <ExternalLink size={10} />
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
          </div>
        </div>

        {/* ── Footer CTA ── */}
        <div className="feedback-section-footer">
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="star-cta-btn" id="star-repo-btn">
            <Star size={16} className="cta-star" />
            <span className="cta-text">Star the Feedback Repository on GitHub</span>
            <ExternalLink size={14} className="cta-external" />
          </a>
        </div>
      </div>
    </section>
  );
}
