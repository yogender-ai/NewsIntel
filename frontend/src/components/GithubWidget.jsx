import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Star, X, CheckCircle, Send, Heart, Lightbulb, Frown, GitFork, Eye, ExternalLink, Sparkles, ArrowRight, Clock, LogIn, User, LogOut } from 'lucide-react';
import { fetchGitHubStars, fetchGitHubStats, submitFeedback, fetchFeedbackList, API_BASE } from '../api';
import './GithubWidget.css';

const REPO_URL = 'https://github.com/yogender-ai/News-Intel-Feedback';
const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID || '';

// ── GitHub OAuth helpers ──
function getGitHubUser() {
  try {
    const data = localStorage.getItem('github_user');
    return data ? JSON.parse(data) : null;
  } catch { return null; }
}

function setGitHubUser(user) {
  localStorage.setItem('github_user', JSON.stringify(user));
}

function clearGitHubUser() {
  localStorage.removeItem('github_user');
  localStorage.removeItem('feedback_submitted');
}

function hasFeedbackSubmitted() {
  return localStorage.getItem('feedback_submitted') === 'true';
}

function markFeedbackSubmitted() {
  localStorage.setItem('feedback_submitted', 'true');
}

// ── Validation helpers ──
const validateMessage = (v) => {
  v = v.trim();
  if (v.length < 10) return `Need ${10 - v.length} more characters (min 10)`;
  if (v.length > 1000) return 'Message too long (max 1000)';
  if (/(.)(\1{4,})/.test(v)) return 'Please avoid repeated characters';
  const words = v.split(/\s+/).filter(w => w.length >= 3);
  if (words.length < 2) return 'Please write a more descriptive message';
  return '';
};

export default function GithubWidget() {
  const [stars, setStars] = useState(null);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('feedback');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [feedbackList, setFeedbackList] = useState([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [starPulse, setStarPulse] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [fieldErrors, setFieldErrors] = useState({ text: '' });
  const [honeypot, setHoneypot] = useState('');
  const [ghUser, setGhUser] = useState(getGitHubUser());
  const [alreadySubmitted, setAlreadySubmitted] = useState(hasFeedbackSubmitted());
  const prevStars = useRef(null);
  const cooldownRef = useRef(null);

  const [formData, setFormData] = useState({
    text: "",
    emotion: "positive",
    rating: 5
  });

  // Handle GitHub OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (code && state === 'github_oauth') {
      // Exchange code for user info via backend
      (async () => {
        try {
          const resp = await fetch(`${API_BASE}/auth/github?code=${code}`);
          if (resp.ok) {
            const user = await resp.json();
            if (user.login) {
              setGitHubUser(user);
              setGhUser(user);
            }
          }
        } catch (e) {
          console.error('GitHub auth failed:', e);
        }
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname);
      })();
    }
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(cooldownRef.current);
  }, [cooldown > 0]);

  // Fetch stars on mount and poll every 2 minutes
  useEffect(() => {
    const fetchStatsData = async () => {
      const fullStats = await fetchGitHubStats();
      if (fullStats) {
        setStats(fullStats);
        if (fullStats.stars !== null && fullStats.stars !== undefined) {
          if (prevStars.current !== null && fullStats.stars > prevStars.current) {
            setStarPulse(true);
            setTimeout(() => setStarPulse(false), 2000);
          }
          prevStars.current = fullStats.stars;
          setStars(fullStats.stars);
        }
      }
    };
    fetchStatsData();
    const interval = setInterval(fetchStatsData, 120000);
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

  const handleTextChange = (e) => {
    const val = e.target.value;
    setFormData({ ...formData, text: val });
    if (val.trim().length > 0) setFieldErrors(prev => ({ ...prev, text: validateMessage(val) }));
  };

  const handleGitHubLogin = () => {
    if (!GITHUB_CLIENT_ID) {
      // Fallback: simple name-based login
      const name = prompt('Enter your GitHub username:');
      if (name && name.trim()) {
        const user = { login: name.trim(), avatar_url: `https://github.com/${name.trim()}.png`, name: name.trim() };
        setGitHubUser(user);
        setGhUser(user);
      }
      return;
    }
    const redirectUri = window.location.origin + window.location.pathname;
    const url = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=github_oauth&scope=read:user`;
    window.location.href = url;
  };

  const handleLogout = () => {
    clearGitHubUser();
    setGhUser(null);
    setAlreadySubmitted(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (honeypot) return;
    if (!ghUser) return;
    if (alreadySubmitted) return;

    const textErr = validateMessage(formData.text);
    setFieldErrors({ text: textErr });
    if (textErr) return;
    if (cooldown > 0) return;
    
    setIsSubmitting(true);
    setError("");
    
    const authorName = ghUser.name || ghUser.login;
    const res = await submitFeedback(authorName, formData.text, formData.emotion, formData.rating);
    
    setIsSubmitting(false);
    
    if (res.status === "error") {
      setError(res.message);
    } else {
      setSuccess(true);
      markFeedbackSubmitted();
      setAlreadySubmitted(true);
      setCooldown(60);
      
      // Optimistic update — add new feedback to the top of list immediately
      const newFeedback = {
        id: Date.now(),
        author: authorName,
        message: formData.text,
        emotion: formData.emotion,
        rating: formData.rating,
        time_ago: 'Just now',
        avatar_url: ghUser.avatar_url,
      };
      setFeedbackList(prev => [newFeedback, ...prev]);
      
      setTimeout(() => {
        setSuccess(false);
        setActiveTab('wall');
        setFormData({ text: "", emotion: "positive", rating: 5 });
        setFieldErrors({ text: '' });
      }, 2500);
    }
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

              {/* Stats Bar + GitHub Login */}
              <div className="github-stats-bar">
                {ghUser ? (
                  <div className="github-stat-item github-user-info">
                    <img src={ghUser.avatar_url} alt="" className="gh-avatar-mini" />
                    <span>{ghUser.login}</span>
                    <button className="gh-logout-btn" onClick={handleLogout} title="Sign out">
                      <LogOut size={12} />
                    </button>
                  </div>
                ) : (
                  <button className="github-login-btn" onClick={handleGitHubLogin} id="github-login-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                    <span>Sign in with GitHub</span>
                  </button>
                )}
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
        <div className="feedback-split-content dashboard-layout">
          
          {/* Left: Feedback Form */}
          <div className={`feedback-form-container ${activeTab === 'feedback' ? 'active-mobile' : ''}`}>
            {!ghUser ? (
              /* Not logged in — show GitHub login prompt */
              <div className="feedback-login-prompt">
                <div className="login-prompt-icon">
                  <User size={48} style={{ opacity: 0.2 }} />
                </div>
                <h3>Sign in to share feedback</h3>
                <p>Login with your GitHub account to post feedback. One feedback per user.</p>
                <button className="github-login-btn-large" onClick={handleGitHubLogin}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  Sign in with GitHub
                  <ArrowRight size={14} />
                </button>
              </div>
            ) : alreadySubmitted || success ? (
              <div className="feedback-success">
                <div className="success-animation">
                  <CheckCircle size={48} className="success-icon" />
                  <div className="success-rings">
                    <div className="ring ring-1" />
                    <div className="ring ring-2" />
                    <div className="ring ring-3" />
                  </div>
                </div>
                <h3>{success ? 'Thank you! 🎉' : 'Already Submitted ✓'}</h3>
                <p>{success ? 'Your feedback is now live on the Community Wall.' : 'You have already submitted your feedback. Thank you!'}</p>
                {success && <p className="success-hint">Switching to Live Wall...</p>}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="feedback-form" id="feedback-form">
                {error && <div className="feedback-error">{error}</div>}

                {/* Honeypot */}
                <div style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, overflow: 'hidden' }} aria-hidden="true">
                  <label>Leave this empty</label>
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={e => setHoneypot(e.target.value)} />
                </div>

                {/* Logged in user display */}
                <div className="form-user-display">
                  <img src={ghUser.avatar_url} alt="" className="gh-avatar-form" />
                  <div>
                    <span className="form-user-name">{ghUser.name || ghUser.login}</span>
                    <span className="form-user-handle">@{ghUser.login}</span>
                  </div>
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
                    placeholder="Share your thoughts, ideas, or report issues... (min 10 chars, 2+ words)" 
                    value={formData.text} 
                    onChange={handleTextChange}
                    onBlur={() => setFieldErrors(prev => ({ ...prev, text: validateMessage(formData.text) }))}
                    required
                    rows={4}
                    maxLength={1000}
                    id="feedback-message"
                    className={fieldErrors.text ? 'input-error' : ''}
                  />
                  <div className="char-count-row">
                    {fieldErrors.text && <span className="field-error-msg">{fieldErrors.text}</span>}
                    <span className="char-count">{formData.text.length}/1000</span>
                  </div>
                </div>

                <div className="form-actions">
                  <button type="submit" className="submit-feedback-btn" disabled={isSubmitting || cooldown > 0 || !formData.text.trim()} id="submit-feedback">
                    {isSubmitting ? (
                      <span className="submitting-spinner">
                        <span className="spinner-dot" />
                        Posting...
                      </span>
                    ) : cooldown > 0 ? (
                      <>
                        <Clock size={14} />
                        Wait {cooldown}s
                      </>
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

          {/* Right: Live Wall — SCROLLABLE */}
          <div className={`feedback-wall-container ${activeTab === 'wall' ? 'active-mobile' : ''}`} id="feedback-wall">
             {feedbackLoading ? (
                    <div className="wall-loading">
                      <div className="wall-loading-spinner" />
                      <p>Loading community feedback...</p>
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
                          Community Feedback ({feedbackList.length})
                        </div>
                        <button className="wall-refresh-btn" onClick={loadFeedback}>↻ Refresh</button>
                      </div>
                      <div className="wall-scroll wall-scroll-fixed" style={{ maxHeight: '280px', overflowY: 'scroll' }}>
                        {feedbackList.map((item, i) => (
                          <div key={item.id || i} className={`wall-card wall-card-${item.emotion}`} style={{ animationDelay: `${i * 0.08}s` }}>
                            <div className="wall-card-header">
                              <div className="wall-avatar">
                                {item.avatar_url ? (
                                  <img src={item.avatar_url} alt="" className="wall-avatar-img" />
                                ) : (
                                  item.author?.[0]?.toUpperCase() || '?'
                                )}
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
