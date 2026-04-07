import { useState, useEffect, useRef } from 'react';
import { Search, Globe, ChevronDown, TrendingUp, Zap, Clock, MapPin, ArrowUpRight, Shield, Loader, Flame } from 'lucide-react';
import { fetchRegions, fetchTrending } from '../api';
import WeatherWidget from './WeatherWidget';

const SUGGESTIONS = [
  { label: 'Artificial Intelligence', emoji: '🤖' },
  { label: 'Climate Change', emoji: '🌍' },
  { label: 'Stock Market', emoji: '📈' },
  { label: 'Space Exploration', emoji: '🚀' },
  { label: 'Cybersecurity', emoji: '🔒' },
  { label: 'World Politics', emoji: '🏛️' },
  { label: 'Technology', emoji: '💻' },
  { label: 'Cryptocurrency', emoji: '₿' },
  { label: 'IPL Cricket', emoji: '🏏' },
  { label: 'Bollywood', emoji: '🎬' },
];

const CITY_PICKS = [
  { name: 'Delhi', emoji: '🏛️' },
  { name: 'Mumbai', emoji: '🌊' },
  { name: 'Bangalore', emoji: '💻' },
  { name: 'Rohtak', emoji: '🌾' },
  { name: 'Chandigarh', emoji: '🌳' },
  { name: 'Hyderabad', emoji: '🏰' },
  { name: 'Kolkata', emoji: '🌉' },
  { name: 'Pune', emoji: '📚' },
  { name: 'Chennai', emoji: '🎭' },
  { name: 'Jaipur', emoji: '🏰' },
];

export default function SearchBar({ onSearch, isLoading }) {
  const [regions, setRegions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState({ code: 'global', name: 'Global', flag: '🌍' });
  const [showDropdown, setShowDropdown] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [trending, setTrending] = useState(null);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const dropdownRef = useRef(null);
  const searchWrapperRef = useRef(null);

  const ALL_SUGGESTIONS = [
    ...SUGGESTIONS,
    ...CITY_PICKS.map(c => ({ label: c.name + ' news', emoji: c.emoji }))
  ];

  const filteredRecommendations = inputValue.trim()
    ? ALL_SUGGESTIONS.filter(s => s.label.toLowerCase().includes(inputValue.toLowerCase()))
    : ALL_SUGGESTIONS.slice(0, 6);

  useEffect(() => {
    fetchRegions().then((data) => {
      if (data?.regions) setRegions(data.regions);
    });
  }, []);

  // Auto-fetch trending headlines on mount
  useEffect(() => {
    (async () => {
      try {
        const data = await fetchTrending();
        setTrending(data);
      } catch {
        // Silent fail
      }
      setTrendingLoading(false);
    })();
  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target)) {
        setShowRecommendations(false);
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

  const handleCitySearch = (cityName) => {
    setInputValue(`${cityName} news`);
    onSearch(`${cityName} news`, 'in');
  };

  const headlines = trending?.headlines || [];
  const heroHeadline = headlines[0];
  const sideHeadlines = headlines.slice(1, 6);
  const tickerHeadlines = headlines.slice(0, 12);
  const hasBreaking = trending?.has_breaking;

  return (
    <div className="landing-page">
      {/* Animated background particles */}
      <div className="landing-particles">
        <div className="particle p1" />
        <div className="particle p2" />
        <div className="particle p3" />
        <div className="particle p4" />
        <div className="particle p5" />
        <div className="particle p6" />
      </div>

      {/* Breaking news ticker at top */}
      {tickerHeadlines.length > 0 && (
        <div className="landing-ticker">
          <div className="landing-ticker-label">
            <Zap size={9} />
            {hasBreaking ? 'BREAKING' : 'LIVE'}
          </div>
          <div className="landing-ticker-track">
            <div className="landing-ticker-scroll">
              {tickerHeadlines.concat(tickerHeadlines).map((h, i) => (
                <span key={i} className="landing-ticker-item">
                  <span className="landing-ticker-dot" />
                  {h.title} — <em>{h.source}</em>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── SEARCH SECTION ── */}
      <section className="landing-search-section">
        <div className="hero-orbs">
          <div className="orb orb-1" />
          <div className="orb orb-2" />
          <div className="orb orb-3" />
        </div>

        <div className="search-hero">
          <div className="hero-badge">
            <Zap size={11} />
            <span>AI-Powered Intelligence v4.0</span>
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
                        onClick={() => { setSelectedRegion(r); setShowDropdown(false); }}
                      >
                        <span className="region-option-flag">{r.flag}</span>
                        <span className="region-option-name">{r.name}</span>
                        {r.code === selectedRegion.code && <span className="region-check">✓</span>}
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

          <div className="search-input-wrapper" ref={searchWrapperRef} style={{ position: 'relative' }}>
            <Search size={18} className="search-icon" />
            <input
              id="search-input"
              name="topic"
              type="text"
              className="search-input"
              placeholder={`Search news in ${selectedRegion.name}... (try "Rohtak news" or "AI")`}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setShowRecommendations(true);
              }}
              onFocus={() => setShowRecommendations(true)}
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
            
            {showRecommendations && filteredRecommendations.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '8px',
                background: 'rgba(15, 15, 24, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(16px)',
                borderRadius: '12px',
                zIndex: 50,
                padding: '8px',
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
                animation: 'fadeInUp 0.2s ease-out backwards'
              }}>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', padding: '4px 8px 8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Recommendations
                </div>
                {filteredRecommendations.map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setInputValue(r.label);
                      setShowRecommendations(false);
                      onSearch(r.label, selectedRegion.code);
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      background: 'transparent',
                      border: 'none',
                      color: '#f5f5f5',
                      fontSize: '14px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      borderRadius: '8px',
                      transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <span>{r.emoji}</span>
                    <span>{r.label}</span>
                    <ArrowUpRight size={14} style={{ marginLeft: 'auto', opacity: 0.3 }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </form>

        {/* Suggestions */}
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

        {/* City Quick Picks */}
        <div className="city-picks-section">
          <div className="city-picks-label">
            <MapPin size={12} />
            <span>City News</span>
          </div>
          <div className="city-picks">
            {CITY_PICKS.map((city) => (
              <button
                key={city.name}
                className="city-pick-chip"
                onClick={() => handleCitySearch(city.name)}
                disabled={isLoading}
              >
                <span>{city.emoji}</span>
                {city.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRENDING NEWS + WEATHER ── */}
      <section className="landing-content-section">
        <div className="landing-content-grid">
          {/* Left: Trending News */}
          <div className="landing-trending">
            <div className="trending-section-header">
              <div className="trending-section-title">
                <Flame size={16} />
                <h3>Trending Now</h3>
                <div className="trending-live-dot" />
              </div>
              {trendingLoading && (
                <div className="trending-loading-indicator">
                  <Loader size={12} className="spin" /> Loading...
                </div>
              )}
            </div>

            {trendingLoading ? (
              <div className="trending-skeleton">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="skeleton-card">
                    <div className="skeleton-line long" />
                    <div className="skeleton-line short" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {/* Hero trending story */}
                {heroHeadline && (
                  <div className="trending-hero" onClick={() => handleSuggestion(heroHeadline.title.split(' ').slice(0, 4).join(' '))}>
                    <div className="trending-hero-badges">
                      {hasBreaking && (
                        <span className="trending-breaking-badge">
                          <Zap size={9} /> BREAKING
                        </span>
                      )}
                      {heroHeadline.is_trusted && (
                        <span className="trending-trusted-badge">
                          <Shield size={9} /> Trusted
                        </span>
                      )}
                    </div>
                    <h3 className="trending-hero-title">{heroHeadline.title}</h3>
                    <p className="trending-hero-desc">{heroHeadline.description}</p>
                    <div className="trending-hero-meta">
                      <span className="trending-hero-source">{heroHeadline.source}</span>
                      <span className="trending-hero-time">
                        <Clock size={10} /> {heroHeadline.time_ago}
                      </span>
                      <span className="trending-hero-action">
                        Analyze <ArrowUpRight size={11} />
                      </span>
                    </div>
                  </div>
                )}

                {/* Side headlines */}
                <div className="trending-side-list">
                  {sideHeadlines.map((h, i) => (
                    <div
                      key={i}
                      className="trending-side-item"
                      onClick={() => handleSuggestion(h.title.split(' ').slice(0, 4).join(' '))}
                    >
                      <span className="trending-side-number">{i + 2}</span>
                      <div className="trending-side-content">
                        <span className="trending-side-title">{h.title}</span>
                        <div className="trending-side-meta">
                          <span>{h.source}</span>
                          <span>·</span>
                          <span>{h.time_ago}</span>
                        </div>
                      </div>
                      <ArrowUpRight size={12} className="trending-side-arrow" />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Right: Weather + Stats */}
          <div className="landing-sidebar">
            <WeatherWidget />

            {/* Stats */}
            <div className="landing-stats glass">
              <div className="landing-stat">
                <span className="landing-stat-value">14+</span>
                <span className="landing-stat-label">Countries</span>
              </div>
              <div className="landing-stat-divider" />
              <div className="landing-stat">
                <span className="landing-stat-value">12</span>
                <span className="landing-stat-label">Articles</span>
              </div>
              <div className="landing-stat-divider" />
              <div className="landing-stat">
                <span className="landing-stat-value">4</span>
                <span className="landing-stat-label">AI Models</span>
              </div>
              <div className="landing-stat-divider" />
              <div className="landing-stat">
                <span className="landing-stat-value live-pulse">Live</span>
                <span className="landing-stat-label">Real-time</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
