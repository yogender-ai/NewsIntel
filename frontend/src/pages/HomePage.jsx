import { useState, useEffect } from 'react';
import { fetchTrending } from '../api';
import WorldMap from '../components/WorldMap';
import LiveNewsStream from '../components/LiveNewsStream';
import SplitFlapDisplay from '../components/SplitFlapDisplay';
import StockTicker from '../components/StockTicker';
import TrendsSidebar from '../components/TrendsSidebar';
import AlertsPanel from '../components/AlertsPanel';
import IntelligenceFeed from '../components/IntelligenceFeed';
import VoiceAnalystAI from '../components/VoiceAnalystAI';
import { useLanguage } from '../context/LanguageContext';
import {
  Search, CloudLightning, ShieldAlert, Cpu, Flame, Trophy,
  Globe, Activity, Stethoscope, Zap, Target, ArrowRight,
  TrendingUp, Radio
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const MAP_FILTERS = [
  { label: 'Trending', icon: Flame, color: '#ef4444' },
  { label: 'Economy', icon: TrendingUp, color: '#10b981' },
  { label: 'Geo', icon: Globe, color: '#8b5cf6' },
  { label: 'Iran Ceasefire', icon: Target, color: '#f59e0b' },
];

export default function HomePage() {
  const [trending, setTrending] = useState(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMapFilter, setActiveMapFilter] = useState('Trending');
  const { t } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchTrending();
        setTrending(data);
      } catch { /* silent */ }
    })();
  }, []);

  const headlines = trending?.headlines || [];
  const heroHeadlines = headlines.slice(0, 5);
  const breakingHeadline = heroHeadlines[0];

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/search/${encodeURIComponent(searchQuery)}`);
  };

  const filteredSuggestions = headlines
    .map(h => h.title)
    .filter(title => title.toLowerCase().includes(searchQuery.toLowerCase()))
    .slice(0, 4);

  if (searchQuery && filteredSuggestions.length === 0) {
    filteredSuggestions.push(`Search global database for "${searchQuery}"...`);
  }

  return (
    <div className="command-center-v2">
      {/* ── TOP COMMAND BAR ── */}
      <div className="cmd-bar">
        {/* Weather pill */}
        <div className="cmd-weather-pill" onClick={() => navigate('/weather')}>
          <CloudLightning size={14} className="cmd-weather-icon" />
          <span className="cmd-weather-temp">72°F</span>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="cmd-search-form">
          <Search size={14} className={`cmd-search-icon ${searchFocused ? 'focused' : ''}`} />
          <input
            type="text"
            placeholder="Search on Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
            className="cmd-search-input"
          />
          {searchFocused && searchQuery && filteredSuggestions.length > 0 && (
            <div className="cmd-search-dropdown">
              <div className="cmd-search-label">LIVE SUGGESTIONS</div>
              {filteredSuggestions.map((s, i) => (
                <div
                  key={i}
                  className="cmd-search-suggestion"
                  onClick={() => {
                    const text = s.startsWith('Search global database for') ? searchQuery : s;
                    setSearchQuery(text);
                    navigate(`/search/${encodeURIComponent(text)}`);
                  }}
                >
                  <Search size={11} /> {s}
                </div>
              ))}
            </div>
          )}
        </form>

        {/* Voice AI */}
        <VoiceAnalystAI />
      </div>

      {/* ── STOCK TICKER ── */}
      <div className="cmd-ticker-bar">
        <StockTicker mode="all" />
      </div>

      {/* ── MAIN GRID: Breaking + Stream ── */}
      <div className="cmd-hero-grid">
        {/* LEFT: Breaking News with SplitFlap */}
        <div className="cmd-breaking-panel">
          <div className="cmd-breaking-badge">
            <div className="cmd-breaking-dot" />
            <span>BREAKING</span>
            {breakingHeadline && (
              <span className="cmd-breaking-engagement">+91.6k</span>
            )}
          </div>

          <div className="cmd-breaking-headline">
            {breakingHeadline ? (
              <>
                <h1 className="cmd-headline-text">
                  {breakingHeadline.title.toUpperCase()}
                  <span className="cmd-headline-emoji">🎯</span>
                </h1>
                <p className="cmd-headline-summary">
                  {breakingHeadline.summary || breakingHeadline.title}
                </p>
              </>
            ) : (
              <h1 className="cmd-headline-text">CONNECTING TO GLOBAL INTELLIGENCE NETWORK...</h1>
            )}
          </div>

          <button
            className="cmd-analyze-btn"
            onClick={() => {
              if (breakingHeadline) {
                navigate(`/search/${encodeURIComponent(breakingHeadline.title.split(' ').slice(0, 6).join(' '))}`);
              }
            }}
          >
            Analyze This Story <ArrowRight size={14} />
          </button>

          {/* SplitFlap at bottom of breaking panel */}
          <div className="cmd-splitflap-wrap">
            <SplitFlapDisplay
              headlines={heroHeadlines.length > 0 ? heroHeadlines : [{ title: "CONNECTING TO GLOBAL INTELLIGENCE NETWORK..." }, { title: "AWAITING LIVE DATA FEED..." }]}
              interval={15000}
            />
          </div>
        </div>

        {/* RIGHT: Live Stream */}
        <div className="cmd-stream-panel">
          <LiveNewsStream />
        </div>
      </div>

      {/* ── MAIN GRID: Globe + Sidebar ── */}
      <div className="cmd-intel-grid">
        {/* LEFT: Globe/Map */}
        <div className="cmd-globe-panel">
          <div className="cmd-globe-header">
            <div className="cmd-globe-title">
              <Zap size={14} className="cmd-globe-icon" />
              <span>GLOBAL INTELLIGENCE</span>
              <div className="cmd-globe-progress" />
            </div>
            <div className="cmd-map-filters">
              {MAP_FILTERS.map((f, i) => {
                const Icon = f.icon;
                return (
                  <button
                    key={i}
                    className={`cmd-map-filter ${activeMapFilter === f.label ? 'active' : ''}`}
                    onClick={() => setActiveMapFilter(f.label)}
                    style={{ '--filter-color': f.color }}
                  >
                    <span className="cmd-filter-plus">+</span>
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="cmd-globe-container">
            <WorldMap />
          </div>
        </div>

        {/* RIGHT: Trends + Alerts stacked */}
        <div className="cmd-sidebar-panel">
          <TrendsSidebar />
          <AlertsPanel />
        </div>
      </div>

      {/* ── BOTTOM: Intelligence Feed ── */}
      <div className="cmd-feed-section">
        <IntelligenceFeed headlines={headlines} />
      </div>
    </div>
  );
}
