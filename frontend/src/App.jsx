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
  ExternalLink,
  Shield,
  TrendingUp,
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

  useEffect(() => { pingHealth(); }, []);

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

  // Scroll-reveal animation
  useEffect(() => {
    if (view !== VIEW.RESULTS) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );
    const els = document.querySelectorAll('.scroll-reveal');
    els.forEach((el) => observer.observe(el));
    return () => els.forEach((el) => observer.unobserve(el));
  }, [view, results]);

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
    } catch { /* silent */ }
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
    return lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const headline = results?.headline;
  const tickerHeadlines = results?.ticker_headlines || [];

  return (
    <div className="app">
      {/* ── Header ──────────────────── */}
      <header className="app-header">
        <div className="app-logo" onClick={handleReset}>
          <div className="app-logo-icon"><Zap size={16} color="white" /></div>
          <div>
            <h1>NewsIntel</h1>
            <span>AI Intelligence</span>
          </div>
        </div>
        <div className="header-right">
          {view === VIEW.RESULTS && (
            <button className={`refresh-btn ${isRefreshing ? 'spinning' : ''}`} onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw size={13} />
              {isRefreshing ? 'Updating...' : 'Refresh'}
            </button>
          )}
          <div className="header-badge"><span className="dot" />Live</div>
        </div>
      </header>

      {/* ── Scrolling Headline Ticker ──────── */}
      {view === VIEW.RESULTS && tickerHeadlines.length > 0 && (
        <div className="news-ticker">
          <div className="ticker-label">
            <Zap size={10} />
            LIVE
          </div>
          <div className="ticker-track">
            <div className="ticker-scroll">
              {tickerHeadlines.concat(tickerHeadlines).map((h, i) => (
                <span key={i} className="ticker-item">
                  <span className="ticker-dot" />
                  {h}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Main ──────────────── */}
      <main className="app-main">
        {view === VIEW.SEARCH && <SearchBar onSearch={handleSearch} isLoading={false} />}

        {/* Loading */}
        {view === VIEW.LOADING && (
          <div className="loading-screen">
            <div className="loading-spinner">
              <div className="ring" /><div className="ring" /><div className="ring" />
            </div>
            <div className="loading-text">
              <h3>Analyzing "{currentTopic}"</h3>
              <p>Curating top articles from trusted sources...</p>
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
                      {status === 'done' ? <CheckCircle size={13} /> : status === 'active' ? <Loader size={13} className="spin" /> : <Icon size={13} />}
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
            <div className="error-icon"><AlertTriangle size={28} color="var(--accent-rose)" /></div>
            <h3>Analysis Failed</h3>
            <p>{error}</p>
            <button className="error-btn" onClick={handleReset}><RotateCcw size={14} />Try Another Topic</button>
          </div>
        )}

        {/* ═══ RESULTS ═══ */}
        {view === VIEW.RESULTS && results && (
          <div className="results-screen">

            {/* ── NEWSPAPER HEADER ── */}
            <div className="newspaper-header scroll-reveal">
              <div className="newspaper-masthead">
                <div className="masthead-line" />
                <h2 className="newspaper-title">{results.topic}</h2>
                <div className="masthead-meta">
                  <span>{results.region_flag} {results.region_name}</span>
                  <span className="masthead-sep">|</span>
                  <span>{results.article_count} Sources Analyzed</span>
                  <span className="masthead-sep">|</span>
                  <span>{lastUpdated ? formatTime() : 'Live'}</span>
                </div>
                <div className="masthead-line" />
              </div>
              <div className="newspaper-actions">
                <button className="new-search-btn" onClick={handleReset}><Search size={13} />New Search</button>
              </div>
            </div>

            {/* ── HERO HEADLINE ── */}
            {headline && (
              <section className="hero-headline scroll-reveal">
                <div className="hero-content">
                  <div className="hero-main">
                    {headline.is_trusted && (
                      <div className="hero-source-badge">
                        <Shield size={10} />
                        {headline.source}
                      </div>
                    )}
                    <h2 className="hero-title">
                      <a href={headline.link} target="_blank" rel="noopener noreferrer">
                        {headline.title}
                      </a>
                    </h2>
                    <p className="hero-summary">{headline.summary || headline.full_text_preview}</p>
                    <div className="hero-meta">
                      <span className={`hero-sentiment ${headline.sentiment?.label || 'neutral'}`}>
                        {headline.sentiment?.label || 'neutral'}
                        {headline.sentiment?.score && headline.sentiment.score !== 0.5 && (
                          <span className="hero-score"> {Math.round(headline.sentiment.score * 100)}%</span>
                        )}
                      </span>
                      <span className="hero-time">
                        <Clock size={12} /> {headline.time_ago}
                      </span>
                      {!headline.is_trusted && (
                        <span className="hero-source-text">{headline.source}</span>
                      )}
                    </div>
                    <a href={headline.link} target="_blank" rel="noopener noreferrer" className="hero-read-btn">
                      Read Full Article <ArrowUpRight size={14} />
                    </a>
                  </div>
                  <div className="hero-aside">
                    {headline.entities?.length > 0 && (
                      <div className="hero-entities">
                        <span className="hero-entities-label">Key Entities</span>
                        {headline.entities.map((e, i) => (
                          <span key={i} className="hero-entity">{e.word}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* ── AI INTELLIGENCE BRIEF ── */}
            <div className="scroll-reveal">
              <TopicOverview analysis={results.ai_analysis} />
            </div>

            {/* ── ANALYTICS ── */}
            {(results.entity_chart?.length > 0 || results.sentiment_chart?.length > 0 || results.source_chart?.length > 0) && (
              <section className="analytics-section scroll-reveal">
                <h3 className="section-title">
                  <BarChart3 size={16} />
                  Analytics Dashboard
                </h3>
                <div className="charts-section">
                  {results.sentiment_chart?.length > 0 && <SentimentPie data={results.sentiment_chart} />}
                  {results.entity_chart?.length > 0 && <EntityChart data={results.entity_chart} />}
                  {results.source_chart?.length > 0 && <SourceChart data={results.source_chart} />}
                </div>
              </section>
            )}

            {/* ── ARTICLES GRID ── */}
            <section className="articles-section scroll-reveal">
              <div className="articles-header">
                <h3 className="section-title">
                  <Newspaper size={15} />
                  More Stories
                  <span className="article-count-badge">{filteredArticles.length}</span>
                </h3>
                <div className="sentiment-filter">
                  <Filter size={11} />
                  {['all', 'positive', 'negative', 'neutral'].map((f) => (
                    <button key={f} className={`filter-chip ${sentimentFilter === f ? 'active' : ''} ${f}`} onClick={() => setSentimentFilter(f)}>
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
                  <div className="no-articles"><p>No articles match the selected filter.</p></div>
                )}
              </div>
            </section>

            {/* ── NLP PIPELINE INFO ── */}
            <section className="nlp-info scroll-reveal">
              <div className="nlp-badge">
                <Brain size={14} />
                <span>NLP Pipeline</span>
              </div>
              <div className="nlp-tags">
                <span className="nlp-tag">Summarization <span className="nlp-model">distilBART</span></span>
                <span className="nlp-tag">Sentiment <span className="nlp-model">RoBERTa</span></span>
                <span className="nlp-tag">NER <span className="nlp-model">BERT-NER</span></span>
                <span className="nlp-tag">Analysis <span className="nlp-model">Gemini 2.0</span></span>
              </div>
            </section>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          <span>NewsIntel v3.0 — AI-Powered News Intelligence Platform</span>
          <span className="footer-tech">FastAPI · HuggingFace NLP · Google Gemini · React</span>
        </div>
      </footer>
    </div>
  );
}
