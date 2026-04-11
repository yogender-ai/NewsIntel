import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Zap, Newspaper, RotateCcw, Search, Database, Brain, Sparkles,
  CheckCircle, Loader, AlertTriangle, Globe, Clock, RefreshCw,
  BarChart3, Filter, ArrowUpRight, Shield, TrendingUp,
  Bookmark, Timer, Share2, ChevronRight, MapPin, Check
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
import SentimentGauge from '../components/SentimentGauge';
import SimilarStories from '../components/SimilarStories';
import AnalystOpinions from '../components/AnalystOpinions';
import TrendsSidebar from '../components/TrendsSidebar';

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
    
    const timers = [
      setTimeout(() => setActiveStep(1), 2000),
      setTimeout(() => setActiveStep(2), 5000),
      setTimeout(() => setActiveStep(3), 8000),
    ];
    
    const quoteInterval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % PREMIUM_QUOTES.length);
    }, 4000);
    
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

  // Compute sentiment score for gauge — neutral=50, positive pushes higher, negative lower
  const sentimentData = results?.sentiment_chart || [];
  const posCount = sentimentData.find(s => s.name === 'positive')?.value || 0;
  const negCount = sentimentData.find(s => s.name === 'negative')?.value || 0;
  const neuCount = sentimentData.find(s => s.name === 'neutral')?.value || 0;
  const totalSent = posCount + negCount + neuCount || 1;
  const rawScore = ((posCount * 100 + neuCount * 50 + negCount * 0) / totalSent);
  const sentimentScore = Math.max(10, Math.min(100, Math.round(rawScore)));

  const countdownProgress = ((AUTO_REFRESH_SECONDS - countdown) / AUTO_REFRESH_SECONDS) * 100;

  // ── LOADING ──
  if (view === 'loading') {
    return (
      <div className="results-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        {/* Animated Background */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {Array.from({ length: 40 }, (_, i) => (
            <div key={i} style={{
              position: 'absolute',
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${2 + Math.random() * 4}px`,
              height: `${2 + Math.random() * 4}px`,
              borderRadius: '50%',
              background: `rgba(99, 102, 241, ${0.1 + Math.random() * 0.2})`,
              animation: `loadParticle ${6 + Math.random() * 10}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 8}s`,
            }} />
          ))}
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: '500px', height: '500px', borderRadius: '50%',
            border: '1px solid rgba(99, 102, 241, 0.08)',
            animation: 'spinSlow 30s linear infinite',
          }} />
        </div>

        <div style={{ textAlign: 'center', position: 'relative', zIndex: 1, maxWidth: '480px' }}>
          <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto 32px' }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid transparent', borderTopColor: '#6366f1', animation: 'spin 1s linear infinite' }} />
            <div style={{ position: 'absolute', inset: '8px', borderRadius: '50%', border: '2px solid transparent', borderRightColor: '#8b5cf6', animation: 'spin 1.5s linear infinite reverse' }} />
            <div style={{ position: 'absolute', inset: '16px', borderRadius: '50%', border: '2px solid transparent', borderBottomColor: '#06b6d4', animation: 'spin 2s linear infinite' }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={20} color="#8b5cf6" style={{ animation: 'pulse 2s ease-in-out infinite' }} />
            </div>
          </div>

          <h3 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '8px', letterSpacing: '-0.5px' }}>
            Analyzing "{decodedTopic}"
          </h3>
          <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '32px' }}>
            Curating top articles from trusted sources...
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
            {PIPELINE_STEPS.map((step, i) => {
              const Icon = step.icon;
              let status = 'pending';
              if (i < activeStep) status = 'done';
              else if (i === activeStep) status = 'active';

              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '12px 16px', borderRadius: '12px',
                  background: status === 'active' ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                  transition: 'all 0.4s',
                  opacity: status === 'done' ? 0.5 : 1,
                }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: status === 'done' ? 'rgba(52,211,153,0.15)' : status === 'active' ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${status === 'done' ? 'rgba(52,211,153,0.4)' : status === 'active' ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)'}`,
                    color: status === 'done' ? '#34d399' : status === 'active' ? '#818cf8' : '#64748b',
                    transition: 'all 0.4s',
                  }}>
                    {status === 'done' ? <CheckCircle size={16} /> : status === 'active' ? <Loader size={16} className="spin" /> : <Icon size={16} />}
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{step.label}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>{step.detail}</div>
                  </div>
                  {status === 'active' && (
                    <div style={{ marginLeft: 'auto', width: '100px', height: '4px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: '4px', background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', animation: 'progressSlide 2s ease-in-out infinite' }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '40px', padding: '0 20px' }}>
            <p key={quoteIndex} style={{
              fontSize: '14px', color: '#64748b', fontStyle: 'italic', lineHeight: 1.6,
              animation: 'fadeIn 0.6s ease',
            }}>
              "{PREMIUM_QUOTES[quoteIndex]}"
            </p>
          </div>

          {showSlowMessage && (
            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#94a3b8', fontSize: '12px' }}>
              <Clock size={14} className="spin-slow" />
              <span>Deep analysis may take up to 60 seconds...</span>
            </div>
          )}
        </div>

        <style>{`
          @keyframes loadParticle {
            0%, 100% { transform: translateY(0) translateX(0); opacity: 0.15; }
            50% { transform: translateY(-20px) translateX(10px); opacity: 0.4; }
          }
          @keyframes progressSlide {
            0% { width: 0%; }
            50% { width: 80%; }
            100% { width: 30%; }
          }
          @keyframes spin { 100% { transform: rotate(360deg); } }
          @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        `}</style>
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

  // ── RESULTS — Two-Column Layout ──
  return (
    <div className="results-page-v2">
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

      {/* Two Column Layout */}
      <div className="results-v2-layout">
        {/* ── LEFT: Main Content ── */}
        <div className="results-v2-main">
          {/* Hero Headline */}
          {headline && (
            <section className="results-v2-hero scroll-reveal">
              <h1 className="results-v2-headline">{headline.title}</h1>
              <div className="results-v2-meta-row">
                <span className="results-v2-source">{headline.source}</span>
                <span className="results-v2-time">
                  <Clock size={11} /> {headline.time_ago || '1 hour ago'}
                </span>
                {headline.is_trusted && (
                  <span className="results-v2-verified">
                    <Check size={10} /> Verified
                  </span>
                )}
              </div>

              {/* Geopolitical Map Image Placeholder */}
              {headline.image_url && (
                <div className="results-v2-geo-image">
                  <img
                    src={headline.image_url}
                    alt={headline.title}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                  <div className="results-v2-geo-overlay" />
                </div>
              )}

              <p className="results-v2-summary">
                {headline.summary || headline.full_text_preview || ''}
              </p>
            </section>
          )}

          {/* ── Action Bar: PDF + TTS ── */}
          <div className="scroll-reveal" style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '10px 0 4px' }}>
            <PDFExport results={results} topic={decodedTopic} />
            <TextToSpeech text={results?.ai_analysis?.overview || ''} />
          </div>

          {/* Why This Matters / AI Brief */}
          <div className="scroll-reveal">
            <TopicOverview analysis={results?.ai_analysis} onThemeSearch={handleThemeSearch} />
          </div>

          {/* Market Reaction */}
          {(results?.entity_chart?.length > 0 || results?.sentiment_chart?.length > 0) && (
            <section className="results-v2-market scroll-reveal">
              <h3 className="results-v2-section-title">
                <BarChart3 size={15} /> Market Reaction
              </h3>
              <div className="results-v2-charts">
                {results.sentiment_chart?.length > 0 && <SentimentPie data={results.sentiment_chart} />}
                {results.entity_chart?.length > 0 && <EntityChart data={results.entity_chart} />}
                {results.source_chart?.length > 0 && <SourceChart data={results.source_chart} />}
              </div>
              <SentimentTrend topic={decodedTopic} />
            </section>
          )}

          {/* Key Facts */}
          <section className="results-v2-keyfacts scroll-reveal">
            <h3 className="results-v2-section-title">
              <Check size={15} /> KEY FACTS
            </h3>
            <ul className="results-v2-facts-list">
              {allArticles.slice(0, 3).map((a, i) => (
                <li key={i} className="results-v2-fact">
                  <Check size={12} className="fact-check" />
                  <span>{a.title}</span>
                </li>
              ))}
            </ul>
            <button
              className="results-v2-share-btn"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: results?.topic, url: window.location.href });
                } else {
                  navigator.clipboard.writeText(window.location.href);
                }
              }}
            >
              <Share2 size={13} /> SHARE THIS ARTICLE
            </button>
          </section>

          {/* News Timeline */}
          <div className="scroll-reveal">
            <NewsTimeline articles={allArticles} />
          </div>

          {/* More Stories */}
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
        </div>

        {/* ── RIGHT: Sidebar ── */}
        <aside className="results-v2-sidebar">
          {/* Sentiment Gauge */}
          <div className="results-v2-gauge-card scroll-reveal">
            <SentimentGauge
              sentiment={sentimentScore >= 60 ? 'positive' : sentimentScore >= 40 ? 'neutral' : 'negative'}
              score={sentimentScore}
            />
          </div>

          {/* Global Trends */}
          <div className="results-v2-trends scroll-reveal">
            <TrendsSidebar />
          </div>

          {/* Similar Stories */}
          <div className="scroll-reveal">
            <SimilarStories articles={allArticles.slice(3, 7)} topic={decodedTopic} />
          </div>

          {/* Analyst Opinions */}
          <div className="scroll-reveal">
            <AnalystOpinions />
          </div>

          {/* Actions */}
          <div className="results-v2-actions scroll-reveal">
            <div className="results-v2-action-row">
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
        </aside>
      </div>

      {/* NLP Pipeline Footer */}
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
