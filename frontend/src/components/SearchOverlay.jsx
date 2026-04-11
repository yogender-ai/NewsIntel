import { useState, useEffect, useRef } from 'react';
import { Search, X, TrendingUp, Globe, MapPin, Activity, Film } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchTrending } from '../api';

const CATEGORIES = [
  { label: 'Technology', icon: Activity, color: '#3b82f6' },
  { label: 'Finance & Markets', icon: TrendingUp, color: '#10b981' },
  { label: 'World Politics', icon: Globe, color: '#8b5cf6' },
  { label: 'Sports', icon: Activity, color: '#ef4444' },
  { label: 'Entertainment', icon: Film, color: '#f59e0b' },
];

export default function SearchOverlay({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [trending, setTrending] = useState([]);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      document.body.style.overflow = 'hidden';
      if(trending.length === 0) {
        fetchTrending().then(data => {
          if (data?.headlines) {
            setTrending(data.headlines.slice(0, 5));
          }
        }).catch(() => {});
      }
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
      // Ctrl+K to open
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        onClose(); // Invert handled by parent or toggle
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSearch = (searchQuery) => {
    if (!searchQuery.trim()) return;
    onClose();
    // Assuming search logic navigates to results
    navigate(`/search/${encodeURIComponent(searchQuery.trim())}`);
  };

  const getDynamicSuggestions = () => {
    const q = query.toLowerCase();
    if (!q) return null;
    
    // Simple dynamic generator logic without hardcoded "Iran"
    const suggestions = [
      `Latest news ${query}`,
      `${query} breaking updates`,
      `Global impact of ${query}`
    ];
    
    return (
      <div className="search-suggestions-list" style={{ marginTop: '20px' }}>
        <h4 style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>AI Recommended Searches</h4>
        {suggestions.map((s, i) => (
          <div 
            key={i} 
            className="search-suggestion-item"
            onClick={() => handleSearch(s)}
            style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', cursor: 'pointer', marginBottom: '8px', transition: 'background 0.2s' }}
            onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
            onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
          >
            <Search size={14} color="#a855f7" />
            <span style={{ fontSize: '14px', color: '#e2e8f0' }}>{s}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="search-overlay" style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(5, 2, 10, 0.9)', backdropFilter: 'blur(8px)',
      display: 'flex', justifyContent: 'center', paddingTop: '10vh',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div className="search-modal" style={{
        width: '100%', maxWidth: '640px', padding: '24px',
        animation: 'slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        {/* Input Bar */}
        <div style={{ position: 'relative' }}>
          <Search size={22} color="#a855f7" style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            ref={inputRef}
            type="text" 
            placeholder="What are you looking for?" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
            style={{
              width: '100%', padding: '20px 20px 20px 56px',
              background: 'rgba(30, 20, 60, 0.8)', border: '1px solid rgba(139, 92, 246, 0.5)',
              borderRadius: '16px', color: '#fff', fontSize: '18px',
              outline: 'none', boxShadow: '0 10px 40px rgba(139, 92, 246, 0.2)'
            }}
          />
          <button 
            onClick={onClose}
            style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>
            ESC
          </button>
        </div>

        {query.trim() ? getDynamicSuggestions() : (
          <div className="search-modal-content" style={{ marginTop: '32px', display: 'flex', gap: '32px' }}>
            <div style={{ flex: 1 }}>
              <h4 style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Categories</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {CATEGORIES.map(c => (
                  <div key={c.label} onClick={() => handleSearch(c.label)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', cursor: 'pointer', borderRadius: '8px', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: `${c.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <c.icon size={14} color={c.color} />
                    </div>
                    <span style={{ fontSize: '14px', color: '#cbd5e1' }}>{c.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <h4 style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Trending Intel</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {trending.length > 0 ? trending.map((item, i) => (
                  <div key={i} onClick={() => handleSearch(item.title)} style={{ display: 'flex', gap: '12px', cursor: 'pointer' }}>
                    <span style={{ fontSize: '12px', color: '#8b5cf6', fontWeight: 'bold' }}>{i + 1}</span>
                    <span style={{ fontSize: '13px', color: '#94a3b8', lineHeight: '1.4' }}>{item.title}</span>
                  </div>
                )) : (
                  [1,2,3].map(i => <div key={i} style={{ height: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', width: `${Math.random() * 40 + 40}%` }} />)
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      <style>{`
        @keyframes slideDown { from { transform: translateY(-40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
}
