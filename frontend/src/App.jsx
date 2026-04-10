import { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Loader, Zap, Bookmark, Globe, Users, Bell, Search, CloudLightning } from 'lucide-react';
import './App.css';
import './overhaul.css';
import { pingHealth } from './api';
import StockTicker from './components/StockTicker';
import LiveClock from './components/LiveClock';
import ReadingList, { useReadingList } from './components/ReadingList';
import { LanguageProvider, useLanguage } from './context/LanguageContext';

// Lazy load pages for performance
const HomePage = lazy(() => import('./pages/HomePage'));
const ResultsPage = lazy(() => import('./pages/ResultsPage'));
const WeatherPage = lazy(() => import('./pages/WeatherPage'));
const CommunityPage = lazy(() => import('./pages/CommunityPage'));
import LoginModal from './components/LoginModal';
import ParticleBackground from './components/ParticleBackground';

/* ── Premium Page Loader (Suspense fallback) ── */
function PageLoader() {
  return (
    <div className="page-loader">
      <div className="page-loader-spinner">
        <div className="loader-ring" />
        <div className="loader-ring" />
        <div className="loader-ring" />
      </div>
      <div className="page-loader-text">
        <span className="loader-dot-1">·</span>
        <span className="loader-dot-2">·</span>
        <span className="loader-dot-3">·</span>
      </div>
    </div>
  );
}

/* ── Animated Routes — re-triggers entrance animation on location change ── */
function AnimatedRoutes() {
  const location = useLocation();
  return (
    <div className="route-transition" key={location.pathname}>
      <Routes location={location}>
        <Route path="/" element={<HomePage />} />
        <Route path="/search/:topic" element={<ResultsPage />} />
        <Route path="/weather" element={<WeatherPage />} />
        <Route path="/community" element={<CommunityPage />} />
      </Routes>
    </div>
  );
}

/* ── Language Switcher ── */
function LanguageSwitcher() {
  const { lang, setLanguage, LANGUAGES } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <div className="lang-switcher">
      <button className="lang-toggle" onClick={() => setOpen(!open)} title="Language">
        <Globe size={13} />
        <span>{LANGUAGES.find(l => l.code === lang)?.label || 'EN'}</span>
      </button>
      {open && (
        <>
          <div className="lang-backdrop" onClick={() => setOpen(false)} />
          <div className="lang-dropdown">
            {LANGUAGES.map(l => (
              <button
                key={l.code}
                className={`lang-option ${lang === l.code ? 'active' : ''}`}
                onClick={() => { setLanguage(l.code); setOpen(false); }}
              >
                <span className="lang-flag">{l.flag}</span>
                <span className="lang-name">{l.full}</span>
                <span className="lang-code">{l.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AppShell() {
  const [showReadingList, setShowReadingList] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const { list: readingList, removeArticle, clearAll } = useReadingList();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { pingHealth(); }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/search/${encodeURIComponent(searchQuery)}`);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        const active = document.activeElement;
        if (active?.tagName !== 'INPUT' && active?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          const searchInput = document.getElementById('header-search-input');
          if (searchInput) searchInput.focus();
        }
      }
      if (e.key === 'Escape') {
        setShowReadingList(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Scroll-reveal observer for homepage sections
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
          }
        });
      },
      { threshold: 0.06, rootMargin: '0px 0px -30px 0px' }
    );
    const observe = () => {
      document.querySelectorAll('.scroll-reveal').forEach((el) => observer.observe(el));
    };
    observe();
    // Re-observe on route change via MutationObserver
    const mo = new MutationObserver(() => observe());
    mo.observe(document.getElementById('root'), { childList: true, subtree: true });
    return () => { observer.disconnect(); mo.disconnect(); };
  }, []);

  return (
    <>
      <div className="app">
        {/* ── Header ──────────────────── */}
        <header className="app-header">
          <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <a href="/" className="app-logo">
              <div className="app-logo-icon"><Zap size={16} color="white" /></div>
              <div>
                <h1>NewsIntel</h1>
                <span style={{color: '#64748b'}}>{t('aiIntelligence')}</span>
              </div>
            </a>

            <div className="cmd-weather-pill" onClick={() => navigate('/weather')}>
              <CloudLightning size={14} className="cmd-weather-icon" style={{color: '#f59e0b'}} />
              <span className="cmd-weather-temp">72°F</span>
            </div>
          </div>

          <div className="header-center" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <form onSubmit={handleSearch} className="cmd-search-form" style={{ width: '260px' }}>
              <Search size={14} className={`cmd-search-icon ${searchFocused ? 'focused' : ''}`} />
              <input
                type="text"
                placeholder="Search global intelligence..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                className="cmd-search-input"
              />
            </form>
            <LiveClock />
          </div>

          <div className="header-right">
            <LanguageSwitcher />

            <button className="header-notification-btn" title="Sign In" onClick={() => setIsLoginOpen(true)} style={{ marginLeft: '8px' }}>
              <Users size={14} />
            </button>

            <button className="header-notification-btn" title="Notifications">
              <Bell size={14} />
              <div className="notification-badge" style={{position: 'absolute', top: '2px', right: '2px', background: '#ef4444', color: 'white', fontSize: '8px', fontWeight: 'bold', width: '12px', height: '12px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>1</div>
            </button>

            <div className="header-badge"><span className="dot" />{t('live')}</div>
          </div>
        </header>

        <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />

        {/* ── Stock Ticker ──────── */}
        <StockTicker />

        {/* ── Main Content (Routes) ──────── */}
        <main className="app-main">
          <Suspense fallback={<PageLoader />}>
            <AnimatedRoutes />
          </Suspense>
        </main>

        {/* Reading List Panel */}
        <ReadingList
          isOpen={showReadingList}
          onClose={() => setShowReadingList(false)}
          list={readingList}
          onRemove={removeArticle}
          onClearAll={clearAll}
        />

        <footer className="app-footer">
          <div className="footer-content">
            <span>{t('footerMain')}</span>
            <span className="footer-tech">{t('footerTech')}</span>
          </div>
        </footer>
      </div>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <ParticleBackground />
        <AppShell />
      </LanguageProvider>
    </BrowserRouter>
  );
}
