import { useState, useEffect } from 'react';
import { Github, MessageSquare, Star, X, CheckCircle, Send, Heart, Lightbulb, Frown } from 'lucide-react';
import { fetchGitHubStars, submitFeedback } from '../api';

export default function GithubWidget() {
  const [stars, setStars] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    author: "",
    text: "",
    emotion: "positive"
  });

  useEffect(() => {
    // Fetch live stars on mount
    fetchGitHubStars().then(s => {
      if (s !== null) setStars(s);
    });
    // Refresh stars every 5 minutes
    const interval = setInterval(() => {
      fetchGitHubStars().then(s => { if (s !== null) setStars(s); });
    }, 300000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.author || !formData.text) return;
    
    setIsSubmitting(true);
    setError("");
    
    const res = await submitFeedback(formData.author, formData.text, formData.emotion);
    
    setIsSubmitting(false);
    
    if (res.status === "error") {
      setError(res.message);
    } else {
      setSuccess(true);
      setTimeout(() => {
        setIsOpen(false);
        setSuccess(false);
        setFormData({ author: "", text: "", emotion: "positive" });
      }, 3000);
    }
  };

  const handleOpenRepo = () => {
    window.open('https://github.com/yogender-ai/NewsIntel', '_blank');
  };

  return (
    <>
      {/* Floating Widget */}
      <div className="github-floating-widget">
        <button className="github-stars-btn" onClick={handleOpenRepo} aria-label="View on GitHub">
          <Github size={16} />
          <span className="star-count">
            <Star size={14} className={stars > 0 ? "filled-star" : ""} />
            {stars !== null ? stars : "..."}
          </span>
        </button>
        <button className="feedback-trigger-btn" onClick={() => setIsOpen(true)} aria-label="Give Feedback">
          <MessageSquare size={16} />
          <span>Feedback</span>
        </button>
      </div>

      {/* Feedback Modal */}
      {isOpen && (
        <div className="feedback-modal-overlay">
          <div className="feedback-modal">
            <button className="feedback-close" onClick={() => setIsOpen(false)}><X size={18} /></button>
            
            {success ? (
              <div className="feedback-success">
                <CheckCircle size={40} className="success-icon" />
                <h3>Thank you!</h3>
                <p>Your feedback is now live on our GitHub repository.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="feedback-form">
                <h3><MessageSquare size={18} style={{ transform: 'translateY(3px)', marginRight: '6px' }}/> Send Feedback</h3>
                <p className="feedback-subtitle">Your thoughts help us improve News Intelligence, and are posted live to GitHub.</p>
                
                {error && <div className="feedback-error">{error}</div>}

                <div className="form-group">
                  <label>Name / GitHub handle</label>
                  <input 
                    type="text" 
                    placeholder="e.g. @janedoe" 
                    value={formData.author} 
                    onChange={e => setFormData({...formData, author: e.target.value})}
                    required
                    maxLength={50}
                  />
                </div>

                <div className="form-group">
                  <label>Feedback Type</label>
                  <div className="emotion-selector">
                    <button type="button" className={`emotion-btn ${formData.emotion === 'positive' ? 'active pos' : ''}`} onClick={() => setFormData({...formData, emotion: 'positive'})}><Heart size={14}/> Love it</button>
                    <button type="button" className={`emotion-btn ${formData.emotion === 'idea' ? 'active id' : ''}`} onClick={() => setFormData({...formData, emotion: 'idea'})}><Lightbulb size={14}/> Idea</button>
                    <button type="button" className={`emotion-btn ${formData.emotion === 'negative' ? 'active neg' : ''}`} onClick={() => setFormData({...formData, emotion: 'negative'})}><Frown size={14}/> Issue</button>
                  </div>
                </div>

                <div className="form-group">
                  <label>Message</label>
                  <textarea 
                    placeholder="What's on your mind?" 
                    value={formData.text} 
                    onChange={e => setFormData({...formData, text: e.target.value})}
                    required
                    rows={4}
                    maxLength={1000}
                  />
                </div>

                <div className="form-actions">
                  <button type="button" className="cancel-btn" onClick={() => setIsOpen(false)}>Cancel</button>
                  <button type="submit" className="submit-feedback-btn" disabled={isSubmitting || !formData.text.trim() || !formData.author.trim()}>
                    {isSubmitting ? "Sending..." : <><Send size={14} /> Send to GitHub</>}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
