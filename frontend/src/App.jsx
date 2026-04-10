import { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Loader, Zap, Bookmark, Globe, Users, Bell } from 'lucide-react';
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
  const { list: readingList, removeArticle, clearAll } = useReadingList();
  const { t } = useLanguage();

  useEffect(() => { pingHealth(); }, []);

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
          <a href="/" className="app-logo">
            <div className="app-logo-icon"><Zap size={16} color="white" /></div>
            <div>
              <h1>NewsIntel</h1>
              <span>{t('aiIntelligence')}</span>
            </div>
          </a>

          <div className="header-center">
            <LiveClock />
          </div>

          <div className="header-right">
            {/* Language Switcher */}
            <LanguageSwitcher />

            {/* Community Link */}
            <a href="/community" className="header-community-link" title="Community">
              <Users size={14} />
            </a>

            {/* Notification Bell */}
            <button className="header-notification-btn" title="Notifications">
              <Bell size={14} />
              <span className="notification-dot" />
            </button>

            {/* Reading List Toggle */}
            <button
              className={`header-bookmark-btn ${readingList.length > 0 ? 'has-items' : ''}`}
              onClick={() => setShowReadingList(true)}
              title={t('readingList')}
            >
              <Bookmark size={14} />
              {readingList.length > 0 && <span className="bookmark-count">{readingList.length}</span>}
            </button>

            <a href="/weather" className="header-weather-link" title={t('weatherDashboard')}>
              🌤️
            </a>

            <div className="header-badge"><span className="dot" />{t('live')}</div>
          </div>
        </header>

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
        <AppShell />
      </LanguageProvider>
    </BrowserRouter>
  );
}
