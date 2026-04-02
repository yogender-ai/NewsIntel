import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, TrendingUp, Flame, Clock, ArrowUpRight, Shield, Loader, MapPin, Sparkles, Search } from 'lucide-react';
import { fetchTrending } from '../api';
import SplitFlapDisplay from '../components/SplitFlapDisplay';
import WeatherWidget from '../components/WeatherWidget';

const QUICK_TOPICS = [
  { label: 'Artificial Intelligence', emoji: '🤖' },
  { label: 'Stock Market', emoji: '📈' },
  { label: 'IPL Cricket', emoji: '🏏' },
  { label: 'World Politics', emoji: '🏛️' },
  { label: 'Technology', emoji: '💻' },
  { label: 'Bollywood', emoji: '🎬' },
  { label: 'Space Exploration', emoji: '🚀' },
  { label: 'Cryptocurrency', emoji: '₿' },
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

export default function HomePage() {
  const navigate = useNavigate();
  const [trending, setTrending] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchTrending();
        setTrending(data);
      } catch { /* silent */ }
      setLoading(false);
    })();
  }, []);

  const handleSearch = (topic) => {
    navigate(`/search/${encodeURIComponent(topic)}`);
  };

  const headlines = trending?.headlines || [];
  const heroHeadlines = headlines.slice(0, 8);
  const sideHeadlines = headlines.slice(0, 10);
  const hasBreaking = trending?.has_breaking;

  return (
    <div className="home-page">
      {/* ── Breaking/Live Ticker ── */}
      {headlines.length > 0 && (
        <div className="home-ticker">
          <div className="home-ticker-label">
            <Zap size={9} />
            {hasBreaking ? 'BREAKING' : 'LIVE'}
          </div>
          <div className="home-ticker-track">
            <div className="home-ticker-scroll">
              {headlines.concat(headlines).concat(headlines).map((h, i) => (
                <span key={i} className="home-ticker-item" onClick={() => handleSearch(h.title.split(' ').slice(0, 5).join(' '))}>
                  <span className="home-ticker-dot" />
                  {h.title} — <em>{h.source}</em>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── SPLIT-FLAP HERO ── */}
      <section className="home-hero-section">
        <div className="home-hero-bg">
          <div className="hero-grid-overlay" />
        </div>
        <div className="home-hero-content">
          <div className="home-hero-label">
            <Sparkles size={12} />
            <span>AI-Powered News Intelligence v5.0</span>
          </div>
          <SplitFlapDisplay 
            headlines={heroHeadlines.length > 0 ? heroHeadlines : [{title: "CONNECTING TO GLOBAL INTELLIGENCE NETWORK..."}, {title: "AWAITING LIVE DATA FEED..."}]} 
            interval={15000} 
          />
          {heroHeadlines.length > 0 && (
            <button className="home-hero-cta" onClick={() => handleSearch(heroHeadlines[0]?.title?.split(' ').slice(0, 5).join(' '))}>
              Analyze This Story <ArrowUpRight size={14} />
            </button>
          )}


        </div>
      </section>

      {/* ── MAIN CONTENT GRID ── */}
      <section className="home-content">
        <div className="home-grid">
          {/* Left: Trending Wire Feed */}
          <div className="home-trending-feed">
            <div className="feed-header">
              <div className="feed-header-left">
                <Flame size={16} className="feed-icon" />
                <h2>Trending Now</h2>
                <div className="feed-live-dot" />
              </div>
              {loading && (
                <div className="feed-loading">
                  <Loader size={12} className="spin" /> Loading...
                </div>
              )}
              {!loading && sideHeadlines.length === 0 && (
                <div className="feed-error" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  ⚠️ Backend Connection Offline.
                </div>
              )}
            </div>

            {loading ? (
              <div className="feed-skeleton">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="skeleton-wire">
                    <div className="skeleton-line w60" />
                    <div className="skeleton-line w40" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="wire-feed">
                {sideHeadlines.map((h, i) => (
                  <div
                    key={i}
                    className="wire-feed-item"
                    onClick={() => handleSearch(h.title.split(' ').slice(0, 5).join(' '))}
                  >
                    <div className="wire-feed-rank">{String(i + 1).padStart(2, '0')}</div>
                    <div className="wire-feed-body">
                      <div className="wire-feed-badges">
                        {h.is_trusted && <span className="wire-trusted"><Shield size={8} /> Trusted</span>}
                        <span className="wire-time-badge"><Clock size={8} /> {h.time_ago}</span>
                      </div>
                      <h3 className="wire-feed-title">{h.title}</h3>
                      {h.description && (
                        <p className="wire-feed-desc">{h.description.slice(0, 120)}...</p>
                      )}
                      <div className="wire-feed-meta">
                        <span className="wire-feed-source">{h.source}</span>
                        <span className="wire-feed-action">Analyze <ArrowUpRight size={10} /></span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Sidebar */}
          <div className="home-sidebar">
            
            {/* ── GLOBAL SEARCH BAR ── */}
            <div className="search-container sidebar-search">
              <form onSubmit={(e) => {
                e.preventDefault();
                const input = e.target.elements.topic.value;
                const region = e.target.elements.region.value;
                if (input.trim()) {
                   navigate(`/search/${encodeURIComponent(input.trim())}?region=${region}`);
                }
              }}>
                <h3 className="sidebar-title"><Search size={14} /> Global Search</h3>
                
                <div className="search-input-wrapper" style={{ marginBottom: '10px' }}>
                  <Search className="search-icon" size={18} />
                  <input 
                    type="text" 
                    name="topic"
                    className="search-input" 
                    placeholder="Search any topic..." 
                    required
                  />
                  <button type="submit" className="search-btn">
                    <ArrowUpRight size={14} />
                  </button>
                </div>

                <div className="region-selector-row" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className="live-indicator"><span className="live-dot" /> Region:</span>
                  <select name="region" className="region-trigger" defaultValue="global" style={{ background: 'var(--bg-glass)', outline: 'none', appearance: 'none', paddingRight: '25px', cursor: 'pointer', flex: 1 }}>
                    <option value="global">🌍 Global</option>
                    <option value="us">🇺🇸 United States</option>
                    <option value="in">🇮🇳 India</option>
                    <option value="gb">🇬🇧 United Kingdom</option>
                  </select>
                </div>
              </form>
            </div>
            {/* Quick Topics */}
            <div className="sidebar-section">
              <h3 className="sidebar-title">
                <TrendingUp size={14} />
                Quick Topics
              </h3>
              <div className="quick-topics">
                {QUICK_TOPICS.map((t) => (
                  <button
                    key={t.label}
                    className="quick-topic-btn"
                    onClick={() => handleSearch(t.label)}
                  >
                    <span>{t.emoji}</span>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* City News */}
            <div className="sidebar-section">
              <h3 className="sidebar-title">
                <MapPin size={14} />
                City News
              </h3>
              <div className="city-grid">
                {CITY_PICKS.map((city) => (
                  <button
                    key={city.name}
                    className="city-btn"
                    onClick={() => handleSearch(`${city.name} news`)}
                  >
                    <span>{city.emoji}</span>
                    {city.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Weather Mini */}
            <WeatherWidget />

            {/* Stats */}
            <div className="home-stats">
              <div className="home-stat">
                <span className="stat-value">14+</span>
                <span className="stat-label">Countries</span>
              </div>
              <div className="stat-divider" />
              <div className="home-stat">
                <span className="stat-value">12</span>
                <span className="stat-label">Articles</span>
              </div>
              <div className="stat-divider" />
              <div className="home-stat">
                <span className="stat-value">4</span>
                <span className="stat-label">AI Models</span>
              </div>
              <div className="stat-divider" />
              <div className="home-stat">
                <span className="stat-value live-pulse">Live</span>
                <span className="stat-label">Real-time</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
