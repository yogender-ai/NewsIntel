import { useState, useEffect, useRef } from 'react';
import { Search, Globe, ChevronDown, TrendingUp, Zap, Clock } from 'lucide-react';
import { fetchRegions } from '../api';

const SUGGESTIONS = [
  { label: 'Artificial Intelligence', emoji: '🤖' },
  { label: 'Climate Change', emoji: '🌍' },
  { label: 'Stock Market', emoji: '📈' },
  { label: 'Space Exploration', emoji: '🚀' },
  { label: 'Cybersecurity', emoji: '🔒' },
  { label: 'World Politics', emoji: '🏛️' },
  { label: 'Technology', emoji: '💻' },
  { label: 'Cryptocurrency', emoji: '₿' },
];

const QUICK = [
  'Breaking News',
  'Sports',
  'Science',
  'Health',
  'Entertainment',
  'Business',
];

export default function SearchBar({ onSearch, isLoading }) {
  const [regions, setRegions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState({ code: 'global', name: 'Global', flag: '🌍' });
  const [showDropdown, setShowDropdown] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchRegions().then((data) => {
      if (data?.regions) setRegions(data.regions);
    });
  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const topic = inputValue.trim();
    if (topic) onSearch(topic, selectedRegion.code);
  };

  const handleSuggestion = (label) => {
    setInputValue(label);
    onSearch(label, selectedRegion.code);
  };

  return (
    <div className="search-screen">
      <div className="hero-orbs">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      <div className="search-hero">
        <div className="hero-badge">
          <Zap size={11} />
          <span>AI-Powered Intelligence</span>
        </div>
        <h2>News<br />Intelligence</h2>
        <p>
          Real-time AI analysis from <strong>trusted global sources</strong>.
          Instant summaries, sentiment, entities, and trend insights.
        </p>
      </div>

      <form className="search-container" onSubmit={handleSubmit}>
        <div className="region-selector-row">
          <div className="region-selector" ref={dropdownRef}>
            <button
              type="button"
              className="region-trigger"
              onClick={() => setShowDropdown(!showDropdown)}
              id="region-selector"
            >
              <Globe size={13} />
              <span className="region-flag">{selectedRegion.flag}</span>
              <span className="region-name">{selectedRegion.name}</span>
              <ChevronDown size={12} className={`chevron ${showDropdown ? 'open' : ''}`} />
            </button>

            {showDropdown && (
              <div className="region-dropdown">
                <div className="region-dropdown-header">
                  <Globe size={11} />
                  Select Region
                </div>
                <div className="region-dropdown-list">
                  {regions.map((r) => (
                    <button
                      key={r.code}
                      type="button"
                      className={`region-option ${r.code === selectedRegion.code ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedRegion(r);
                        setShowDropdown(false);
                      }}
                    >
                      <span className="region-option-flag">{r.flag}</span>
                      <span className="region-option-name">{r.name}</span>
                      {r.code === selectedRegion.code && (
                        <span className="region-check">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="live-indicator">
            <span className="live-dot" />
            <Clock size={10} />
            <span>Live Feed</span>
          </div>
        </div>

        <div className="search-input-wrapper">
          <Search size={18} className="search-icon" />
          <input
            id="search-input"
            name="topic"
            type="text"
            className="search-input"
            placeholder={`Search news in ${selectedRegion.name}...`}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            autoFocus
            autoComplete="off"
            disabled={isLoading}
          />
          <button
            id="search-btn"
            type="submit"
            className="search-btn"
            disabled={isLoading || !inputValue.trim()}
          >
            <Search size={14} />
            Analyze
          </button>
        </div>
      </form>

      <div className="suggestions-section">
        <div className="suggestions-label">
          <TrendingUp size={12} />
          <span>Popular Topics</span>
        </div>
        <div className="search-suggestions">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.label}
              className="suggestion-chip"
              onClick={() => handleSuggestion(s.label)}
              disabled={isLoading}
            >
              <span className="chip-emoji">{s.emoji}</span>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="trending-section">
        <div className="trending-label">Quick Access</div>
        <div className="trending-tags">
          {QUICK.map((t) => (
            <button
              key={t}
              className="trending-tag"
              onClick={() => handleSuggestion(t)}
              disabled={isLoading}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="stats-bar">
        <div className="stat-item">
          <span className="stat-value">14+</span>
          <span className="stat-label">Countries</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-value">8</span>
          <span className="stat-label">Curated Articles</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-value">4</span>
          <span className="stat-label">AI Models</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-value">Live</span>
          <span className="stat-label">Real-time</span>
        </div>
      </div>
    </div>
  );
}
