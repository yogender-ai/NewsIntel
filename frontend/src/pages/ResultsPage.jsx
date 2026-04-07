import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Zap, Newspaper, RotateCcw, Search, Database, Brain, Sparkles,
  CheckCircle, Loader, AlertTriangle, Globe, Clock, RefreshCw,
  BarChart3, Filter, ArrowUpRight, Shield, TrendingUp,
  Bookmark, Timer,
} from 'lucide-react';

import { analyzeTopic } from '../api';
import TopicOverview from '../components/TopicOverview';
import ArticleCard from '../components/ArticleCard';
import EntityChart from '../components/EntityChart';
import SentimentPie from '../components/SentimentPie';
import SourceChart from '../components/SourceChart';
import NewsTimeline from '../components/NewsTimeline';
import PDFExport from '../components/PDFExport';
import TextToSpeech from '../components/TextToSpeech';
import ReadingList, { useReadingList } from '../components/ReadingList';
import SentimentTrend from '../components/SentimentTrend';

const PIPELINE_STEPS = [
  { label: 'Scanning live news feeds', icon: Search, detail: 'Google News RSS · 14 Regions · Trusted Sources' },
  { label: 'Extracting article content & images', icon: Database, detail: 'Full-text parsing · Image extraction · URL resolution' },
  { label: 'Running NLP analysis', icon: Brain, detail: 'Summarization · Sentiment · NER · distilBART · RoBERTa' },
  { label: 'Generating intelligence brief', icon: Sparkles, detail: 'Gemini 2.0 Flash · Deep Analysis' },
];

const PREMIUM_QUOTES = [
  "Information is the oil of the 21st century, and analytics is the combustion engine.",
  "The news is a conversation, not a broadcast.",
  "AI will not replace humans, but humans using AI will replace those who don't.",
  "An investment in knowledge pays the best interest.",
  "We are drowning in information but starved for wisdom.",
  "The function of journalism is to hold a mirror up to society.",
  "Intelligence is the ability to adapt to change.",
  "Future belongs to those who learn more skills and combine them in creative ways."
];

const AUTO_REFRESH_SECONDS = 45;

export default function ResultsPage() {
  const { topic } = useParams();
  const navigate = useNavigate();
  const decodedTopic = decodeURIComponent(topic || '');

  const [view, setView] = useState('loading');
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [currentRegion, setCurrentRegion] = useState('global');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sentimentFilter, setSentimentFilter] = useState('all');
  const [showReadingList, setShowReadingList] = useState(false);
  const [countdown, setCountdown] = useState(AUTO_REFRESH_SECONDS);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [showSlowMessage, setShowSlowMessage] = useState(false);
  const countdownRef = useRef(null);

  const { list: readingList, addArticle, removeArticle, isBookmarked, clearAll } = useReadingList();

  // Loading animation & Quotes
  useEffect(() => {
    if (view !== 'loading') {
      setShowSlowMessage(false);
      return;
    }
    setActiveStep(0);
    setQuoteIndex(0);
    setShowSlowMessage(false);
    
    // Animate pipeline steps down
    const timers = [
      setTimeout(() => setActiveStep(1), 2000),
      setTimeout(() => setActiveStep(2), 5000),
      setTimeout(() => setActiveStep(3), 8000),
    ];
    
    // Rotate quotes every 4 seconds
    const quoteInterval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % PREMIUM_QUOTES.length);
    }, 4000);
    
    // Show polite timeout message after 12 seconds
    const slowTimer = setTimeout(() => {
      setShowSlowMessage(true);
    }, 12000);

    return () => {
      timers.forEach(clearTimeout);
      clearInterval(quoteInterval);
      clearTimeout(slowTimer);
    };
  }, [view]);

  // Scroll reveal
  useEffect(() => {
    if (view !== 'results') return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('revealed');
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );
    const els = document.querySelectorAll('.scroll-reveal');
    els.forEach((el) => observer.observe(el));
    return () => els.forEach((el) => observer.unobserve(el));
  }, [view, results]);

  // Initial search
  useEffect(() => {
    if (decodedTopic) {
      performSearch(decodedTopic);
    }
  }, [decodedTopic]);

  // Auto-refresh
  useEffect(() => {
    if (view !== 'results' || !autoRefreshEnabled) {
      setCountdown(AUTO_REFRESH_SECONDS);
      return;
    }

    setCountdown(AUTO_REFRESH_SECONDS);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          handleRefresh();
          return AUTO_REFRESH_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [view, autoRefreshEnabled, decodedTopic, currentRegion]);

  const performSearch = async (searchTopic, region = 'global') => {
    setCurrentRegion(region);
    setView('loading');
    setError('');
    setResults(null);
    setSentimentFilter('all');
    try {
      const data = await analyzeTopic(searchTopic, region);
      setResults(data);
      setLastUpdated(new Date());
      setView('results');
    } catch (err) {
      setError(err.message || 'Analysis failed. Please try again.');
      setView('error');
    }
  };

  const handleRefresh = useCallback(async () => {
    if (isRefreshing || !decodedTopic) return;
    setIsRefreshing(true);
    try {
      const data = await analyzeTopic(decodedTopic, currentRegion, true);
      setResults(data);
      setLastUpdated(new Date());
      setCountdown(AUTO_REFRESH_SECONDS);
    } catch { /* silent */ }
    setIsRefreshing(false);
  }, [decodedTopic, currentRegion, isRefreshing]);

  const handleReset = () => navigate('/');

  const handleThemeSearch = (theme) => {
    navigate(`/search/${encodeURIComponent(theme)}`);
  };

  const handleToggleBookmark = (article) => {
    if (isBookmarked(article.title)) {
      removeArticle(article.title);
    } else {
      addArticle(article);
    }
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
  const allArticles = results?.all_articles || [];
  const featureArticles = filteredArticles.slice(0, 3);
  const wireArticles = filteredArticles.slice(3);

  const countdownProgress = ((AUTO_REFRESH_SECONDS - countdown) / AUTO_REFRESH_SECONDS) * 100;

  // ── LOADING ──
  if (view === 'loading') {
    return (
      <div className="results-page">
        <div className="loading-screen premium-loading">
          <div className="loading-content-wrapper">
            <div className="loading-spinner">
              <div className="ring" /><div className="ring" /><div className="ring" />
            </div>
            
            <div className="loading-text">
              <h3>Analyzing "{decodedTopic}"</h3>
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
          
          <div className="loading-extras">
            <div className="loading-quote-container">
              <p key={quoteIndex} className="loading-quote">
                "{PREMIUM_QUOTES[quoteIndex]}"
              </p>
            </div>
            
            <div className={`slow-message ${showSlowMessage ? 'visible' : ''}`}>
              <Clock size={14} className="spin-slow" />
              <span>Deep analysis may take up to 60 seconds... have a wonderful day!</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── ERROR ──
  if (view === 'error') {
    return (
      <div className="results-page">
        <div className="error-screen">
          <div className="error-icon"><AlertTriangle size={28} color="var(--accent-rose)" /></div>
          <h3>Analysis Failed</h3>
          <p>{error}</p>
          <button className="error-btn" onClick={handleReset}><RotateCcw size={14} />Try Another Topic</button>
        </div>
      </div>
    );
  }

  // ── RESULTS ──
  return (
    <div className="results-page">
      {/* Headline Ticker */}
      {tickerHeadlines.length > 0 && (
        <div className="news-ticker">
          <div className="ticker-label"><Zap size={10} /> LIVE</div>
          <div className="ticker-track">
            <div className="ticker-scroll">
              {tickerHeadlines.concat(tickerHeadlines).concat(tickerHeadlines).map((h, i) => (
                <span key={i} className="ticker-item">
                  <span className="ticker-dot" />{h}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Results Actions Bar */}
      <div className="results-actions-bar">
        <div className="results-meta">
          <h2 className="results-topic">{results?.topic}</h2>
          <div className="results-info">
            <span>{results?.region_flag} {results?.region_name}</span>
            <span>·</span>
            <span>{results?.article_count} Sources</span>
            <span>·</span>
            <span>{lastUpdated ? formatTime() : 'Live'}</span>
            <span className="results-countdown">
              <Timer size={10} /> {countdown}s
            </span>
          </div>
        </div>
        <div className="results-action-btns">
          <div className="countdown-ring-wrapper" title={`Auto-refresh in ${countdown}s`}>
            <svg viewBox="0 0 36 36" className="countdown-ring">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
              <circle
                cx="18" cy="18" r="15.5" fill="none"
                stroke="var(--accent-emerald)" strokeWidth="2"
                strokeDasharray={`${countdownProgress * 0.975} 97.5`}
                strokeLinecap="round" transform="rotate(-90 18 18)"
              />
            </svg>
            <span className="countdown-number">{countdown}</span>
          </div>
          <button className={`action-btn ${isRefreshing ? 'spinning' : ''}`} onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw size={13} /> {isRefreshing ? 'Updating...' : 'Refresh'}
          </button>
          <PDFExport results={results} />
          <TextToSpeech headlines={allArticles} />
          <button className="action-btn" onClick={handleReset}>
            <Search size={13} /> New Search
          </button>
        </div>
      </div>

      {/* ── HERO HEADLINE ── */}
      {headline && (
        <section className="results-hero scroll-reveal">
          <ArticleCard
            article={headline}
            index={0}
            variant="hero"
            isBookmarked={isBookmarked(headline.title)}
            onToggleBookmark={handleToggleBookmark}
          />
        </section>
      )}

      {/* ── AI BRIEF ── */}
      <div className="scroll-reveal">
        <TopicOverview analysis={results?.ai_analysis} onThemeSearch={handleThemeSearch} />
      </div>

      {/* ── NEWS TIMELINE ── */}
      <div className="scroll-reveal">
        <NewsTimeline articles={allArticles} />
      </div>

      {/* ── ANALYTICS ── */}
      {(results?.entity_chart?.length > 0 || results?.sentiment_chart?.length > 0 || results?.source_chart?.length > 0) && (
        <section className="analytics-section scroll-reveal">
          <h3 className="section-header"><BarChart3 size={16} /> Analytics Dashboard</h3>
          <div className="charts-grid">
            {results.sentiment_chart?.length > 0 && <SentimentPie data={results.sentiment_chart} />}
            {results.entity_chart?.length > 0 && <EntityChart data={results.entity_chart} />}
            {results.source_chart?.length > 0 && <SourceChart data={results.source_chart} />}
          </div>
          {/* Sentiment Over Time */}
          <SentimentTrend topic={decodedTopic} />
        </section>
      )}

      {/* ── MORE STORIES ── */}
      <section className="stories-section scroll-reveal">
        <div className="stories-header">
          <h3 className="section-header">
            <Newspaper size={15} /> More Stories
            <span className="story-count">{filteredArticles.length}</span>
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

        {/* Feature articles (magazine side-by-side) */}
        {featureArticles.length > 0 && (
          <div className="feature-grid">
            {featureArticles.map((article, i) => (
              <ArticleCard
                key={i}
                article={article}
                index={i}
                variant="feature"
                isBookmarked={isBookmarked(article.title)}
                onToggleBookmark={handleToggleBookmark}
              />
            ))}
          </div>
        )}

        {/* Wire articles (terminal style) */}
        {wireArticles.length > 0 && (
          <div className="wire-list">
            {wireArticles.map((article, i) => (
              <ArticleCard
                key={i}
                article={article}
                index={i + 3}
                variant="wire"
                isBookmarked={isBookmarked(article.title)}
                onToggleBookmark={handleToggleBookmark}
              />
            ))}
          </div>
        )}

        {filteredArticles.length === 0 && (
          <div className="no-articles"><p>No articles match the selected filter.</p></div>
        )}
      </section>

      {/* ── NLP PIPELINE INFO ── */}
      <section className="nlp-footer scroll-reveal">
        <div className="nlp-badge"><Brain size={14} /><span>NLP Pipeline v5.0</span></div>
        <div className="nlp-tags">
          <span className="nlp-tag">Summarization <span className="nlp-model">distilBART</span></span>
          <span className="nlp-tag">Sentiment <span className="nlp-model">RoBERTa</span></span>
          <span className="nlp-tag">NER <span className="nlp-model">BERT-NER</span></span>
          <span className="nlp-tag">Analysis <span className="nlp-model">Gemini 2.0</span></span>
        </div>
      </section>

      {/* Reading List */}
      <ReadingList
        isOpen={showReadingList}
        onClose={() => setShowReadingList(false)}
        list={readingList}
        onRemove={removeArticle}
        onClearAll={clearAll}
      />
    </div>
  );
}
