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
      // Avoid duplicates
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
              <Bookmark size={32} />
              <p>No saved articles yet</p>
              <span>Click the bookmark icon on any article to save it for later</span>
            </div>
          ) : (
            list.map((article, i) => (
              <div key={i} className="reading-list-item">
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
