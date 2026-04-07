import { useState, useEffect } from 'react';
import { Bookmark, X, ExternalLink, Clock, Trash2 } from 'lucide-react';

const STORAGE_KEY = 'newsintel_reading_list';

function getReadingList() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveReadingList(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Storage full or unavailable
  }
}

export function useReadingList() {
  const [list, setList] = useState(getReadingList);

  const addArticle = (article) => {
    setList(prev => {
      if (prev.some(a => a.title === article.title)) return prev;
      const updated = [{ ...article, savedAt: new Date().toISOString() }, ...prev];
      saveReadingList(updated);
      return updated;
    });
  };

  const removeArticle = (title) => {
    setList(prev => {
      const updated = prev.filter(a => a.title !== title);
      saveReadingList(updated);
      return updated;
    });
  };

  const isBookmarked = (title) => {
    return list.some(a => a.title === title);
  };

  const clearAll = () => {
    setList([]);
    saveReadingList([]);
  };

  return { list, addArticle, removeArticle, isBookmarked, clearAll };
}

/* ── Animated bookmark SVG for empty state ── */
function AnimatedBookmark() {
  return (
    <div className="reading-list-anim-wrap">
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="reading-list-anim-svg">
        {/* Floating circles */}
        <circle cx="20" cy="20" r="3" fill="var(--accent-blue)" opacity="0.3" className="rl-float-circle rl-fc-1" />
        <circle cx="60" cy="15" r="2" fill="var(--accent-purple)" opacity="0.3" className="rl-float-circle rl-fc-2" />
        <circle cx="15" cy="55" r="2.5" fill="var(--accent-cyan)" opacity="0.3" className="rl-float-circle rl-fc-3" />
        <circle cx="65" cy="60" r="2" fill="var(--accent-amber)" opacity="0.3" className="rl-float-circle rl-fc-4" />
        
        {/* Bookmark shape */}
        <g transform="translate(22, 12)" className="rl-bookmark-float">
          <path 
            d="M4 0h28a4 4 0 014 4v52l-18-12-18 12V4a4 4 0 014-4z" 
            fill="url(#rlGrad)" 
            stroke="var(--accent-blue)" 
            strokeWidth="1.5"
            opacity="0.9"
          />
          {/* Lines inside bookmark */}
          <line x1="10" y1="16" x2="26" y2="16" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" className="rl-line rl-l1" />
          <line x1="10" y1="24" x2="22" y2="24" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" className="rl-line rl-l2" />
          <line x1="10" y1="32" x2="18" y2="32" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeLinecap="round" className="rl-line rl-l3" />
        </g>
        
        <defs>
          <linearGradient id="rlGrad" x1="0" y1="0" x2="36" y2="56">
            <stop stopColor="var(--accent-blue)" />
            <stop offset="1" stopColor="var(--accent-purple)" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

export default function ReadingList({ isOpen, onClose, list, onRemove, onClearAll }) {
  if (!isOpen) return null;

  return (
    <div className="reading-list-overlay" onClick={onClose}>
      <div className="reading-list-panel glass" onClick={e => e.stopPropagation()} id="reading-list">
        <div className="reading-list-header">
          <div className="reading-list-title">
            <Bookmark size={16} />
            <h3>Reading List</h3>
            <span className="reading-list-count">{list.length}</span>
          </div>
          <div className="reading-list-actions">
            {list.length > 0 && (
              <button className="reading-list-clear" onClick={onClearAll}>
                <Trash2 size={12} />
                Clear All
              </button>
            )}
            <button className="reading-list-close" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="reading-list-body">
          {list.length === 0 ? (
            <div className="reading-list-empty">
              <AnimatedBookmark />
              <p>No saved articles yet</p>
              <span>Click the bookmark icon on any article to save it for later</span>
            </div>
          ) : (
            list.map((article, i) => (
              <div key={i} className="reading-list-item rl-item-enter" style={{ animationDelay: `${i * 0.06}s` }}>
                <div className="reading-list-item-content">
                  <a href={article.link} target="_blank" rel="noopener noreferrer" className="reading-list-item-title">
                    {article.title}
                    <ExternalLink size={10} />
                  </a>
                  <div className="reading-list-item-meta">
                    <span className="reading-list-item-source">{article.source}</span>
                    <span className="reading-list-item-time">
                      <Clock size={9} />
                      {article.time_ago || 'recently'}
                    </span>
                  </div>
                </div>
                <button
                  className="reading-list-item-remove"
                  onClick={() => onRemove(article.title)}
                  title="Remove from reading list"
                >
                  <X size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
