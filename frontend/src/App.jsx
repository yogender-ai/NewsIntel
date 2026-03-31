import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Zap,
  Newspaper,
  RotateCcw,
  Search,
  Database,
  Brain,
  Sparkles,
  CheckCircle,
  Loader,
  AlertTriangle,
  Globe,
  Clock,
  RefreshCw,
  BarChart3,
  Filter,
  ArrowUpRight,
} from 'lucide-react';

import './App.css';
import { analyzeTopic, pingHealth } from './api';
import SearchBar from './components/SearchBar';
import TopicOverview from './components/TopicOverview';
import ArticleCard from './components/ArticleCard';
import EntityChart from './components/EntityChart';
import SentimentPie from './components/SentimentPie';
import SourceChart from './components/SourceChart';

const VIEW = {
  SEARCH: 'search',
  LOADING: 'loading',
  RESULTS: 'results',
  ERROR: 'error',
};

const PIPELINE_STEPS = [
  { label: 'Scanning live news feeds', icon: Search, detail: 'Google News RSS · Trusted Sources' },
  { label: 'Extracting article content', icon: Database, detail: 'Full-text parsing · URL resolution' },
  { label: 'Running NLP analysis', icon: Brain, detail: 'Summarization · Sentiment · NER' },
  { label: 'Generating intelligence brief', icon: Sparkles, detail: 'Gemini 2.0 Flash' },
];

export default function App() {
  const [view, setView] = useState(VIEW.SEARCH);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [currentTopic, setCurrentTopic] = useState('');
  const [currentRegion, setCurrentRegion] = useState('global');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sentimentFilter, setSentimentFilter] = useState('all');

  // Warm up backend
  useEffect(() => {
    pingHealth();
  }, []);

  // Loading pipeline animation
  useEffect(() => {
    if (view !== VIEW.LOADING) return;
    setActiveStep(0);
    const timers = [
      setTimeout(() => setActiveStep(1), 2000),
      setTimeout(() => setActiveStep(2), 5000),
      setTimeout(() => setActiveStep(3), 8000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [view]);

  const handleSearch = useCallback(async (topic, region = 'global') => {
    setCurrentTopic(topic);
    setCurrentRegion(region);
    setView(VIEW.LOADING);
    setError('');
    setResults(null);
    setSentimentFilter('all');

    try {
      const data = await analyzeTopic(topic, region);
      setResults(data);
      setLastUpdated(new Date());
      setView(VIEW.RESULTS);
    } catch (err) {
      setError(err.message || 'Analysis failed. Please try again.');
      setView(VIEW.ERROR);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing || !currentTopic) return;
    setIsRefreshing(true);
    try {
      const data = await analyzeTopic(currentTopic, currentRegion);
      setResults(data);
      setLastUpdated(new Date());
    } catch {
      // silent fail on refresh
    }
    setIsRefreshing(false);
  }, [currentTopic, currentRegion, isRefreshing]);

  const handleReset = () => {
    setView(VIEW.SEARCH);
    setResults(null);
    setError('');
    setCurrentTopic('');
    setCurrentRegion('global');
    setLastUpdated(null);
    setSentimentFilter('all');
  };

  const filteredArticles = results?.articles?.filter((a) => {
    if (sentimentFilter === 'all') return true;
    return a.sentiment?.label === sentimentFilter;
  }) || [];

  const formatTime = () => {
    if (!lastUpdated) return '';
    return lastUpdated.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="app">
      {/* ── Header ──────────────────────────────────── */}
      <header className="app-header">
        <div className="app-logo" onClick={handleReset}>
          <div className="app-logo-icon">
            <Zap size={16} color="white" />
          </div>
          <div>
            <h1>NewsIntel</h1>
            <span>AI Intelligence</span>
          </div>
        </div>

        <div className="header-right">
          {view === VIEW.RESULTS && (
            <button
              className={`refresh-btn ${isRefreshing ? 'spinning' : ''}`}
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw size={13} />
              {isRefreshing ? 'Updating...' : 'Refresh'}
            </button>
          )}
          <div className="header-badge">
            <span className="dot" />
            Live
          </div>
        </div>
      </header>

      {/* ── Breaking Ticker ────────────────────────── */}
      {view === VIEW.RESULTS && results?.ai_analysis?.breaking && (
        <div className="ticker-bar">
          <div className="ticker-content">
            <span className="ticker-badge">
              <Zap size={10} />
              BREAKING
            </span>
            <span className="ticker-text">
              {results.ai_analysis.overview?.slice(0, 150)}
            </span>
          </div>
        </div>
      )}

      {/* ── Main ───────────────────────────────────── */}
      <main className="app-main">
        {/* Search */}
        {view === VIEW.SEARCH && (
          <SearchBar onSearch={handleSearch} isLoading={false} />
        )}

        {/* Loading */}
        {view === VIEW.LOADING && (
          <div className="loading-screen">
            <div className="loading-spinner">
              <div className="ring" />
              <div className="ring" />
              <div className="ring" />
            </div>
            <div className="loading-text">
              <h3>Analyzing "{currentTopic}"</h3>
              <p>Curating top articles through the NLP pipeline...</p>
            </div>
            <div className="loading-steps">
              {PIPELINE_STEPS.map((step, i) => {
                const Icon = step.icon;
                let status = 'pending';
                if (i < activeStep) status = 'done';
                else if (i === activeStep) status = 'active';
                return (
                  <div key={i} className={`loading-step ${status}`}>
                    <div className={`step-icon ${status}`}>
                      {status === 'done' ? (
                        <CheckCircle size={13} />
                      ) : status === 'active' ? (
                        <Loader size={13} className="spin" />
                      ) : (
                        <Icon size={13} />
                      )}
                    </div>
                    <div className="step-info">
                      <span className="step-label">{step.label}</span>
                      <span className="step-detail">{step.detail}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Error */}
        {view === VIEW.ERROR && (
          <div className="error-screen">
            <div className="error-icon">
              <AlertTriangle size={28} color="var(--accent-rose)" />
            </div>
            <h3>Analysis Failed</h3>
            <p>{error}</p>
            <button className="error-btn" onClick={handleReset}>
              <RotateCcw size={14} />
              Try Another Topic
            </button>
          </div>
        )}

        {/* Results */}
        {view === VIEW.RESULTS && results && (
          <div className="results-screen">
            {/* Header */}
            <div className="results-header">
              <div>
                <h2>
                  <span className="results-flag">{results.region_flag}</span>
                  {results.topic}
                </h2>
                <div className="results-meta">
                  <span className="meta-tag">
                    <Newspaper size={11} />
                    {results.article_count} articles
                  </span>
                  <span className="meta-tag">
                    <Globe size={11} />
                    {results.region_name}
                  </span>
                  {lastUpdated && (
                    <span className="meta-tag time">
                      <Clock size={11} />
                      {formatTime()}
                    </span>
                  )}
                </div>
              </div>
              <div className="results-actions">
                <button className="new-search-btn" onClick={handleReset}>
                  <Search size={13} />
                  New Search
                </button>
              </div>
            </div>

            {/* AI Overview */}
            <TopicOverview analysis={results.ai_analysis} />

            {/* Analytics Dashboard — above articles for visual impact */}
            {(results.entity_chart?.length > 0 || results.sentiment_chart?.length > 0 || results.source_chart?.length > 0) && (
              <section className="analytics-section">
                <h3 className="analytics-title">
                  <BarChart3 size={16} style={{ color: 'var(--accent-cyan)' }} />
                  Analytics
                </h3>
                <div className="charts-section">
                  {results.sentiment_chart?.length > 0 && (
                    <SentimentPie data={results.sentiment_chart} />
                  )}
                  {results.entity_chart?.length > 0 && (
                    <EntityChart data={results.entity_chart} />
                  )}
                  {results.source_chart?.length > 0 && (
                    <SourceChart data={results.source_chart} />
                  )}
                </div>
              </section>
            )}

            {/* Articles */}
            <section className="articles-section">
              <div className="articles-header">
                <h3>
                  <Newspaper size={15} style={{ color: 'var(--accent-blue)' }} />
                  Curated Articles
                  <span className="article-count-badge">{filteredArticles.length}</span>
                </h3>
                <div className="sentiment-filter">
                  <Filter size={11} />
                  {['all', 'positive', 'negative', 'neutral'].map((f) => (
                    <button
                      key={f}
                      className={`filter-chip ${sentimentFilter === f ? 'active' : ''} ${f}`}
                      onClick={() => setSentimentFilter(f)}
                    >
                      {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="articles-grid">
                {filteredArticles.map((article, i) => (
                  <ArticleCard key={i} article={article} index={i} />
                ))}
                {filteredArticles.length === 0 && (
                  <div className="no-articles">
                    <p>No articles match the selected filter.</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <div className="footer-content">
          <span>NewsIntel v3.0 — Premium AI News Intelligence</span>
          <span className="footer-tech">FastAPI · HuggingFace · Gemini · React</span>
        </div>
      </footer>
    </div>
  );
}
