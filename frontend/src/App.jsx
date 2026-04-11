import { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Loader, Zap, Bookmark, Globe, Users, Bell, Search, CloudLightning, TrendingUp } from 'lucide-react';
import './App.css';
import './overhaul.css';
import { pingHealth, detectLocation, fetchWeather } from './api';
import StockTicker from './components/StockTicker';
import LiveClock from './components/LiveClock';
import ReadingList, { useReadingList } from './components/ReadingList';
import SearchOverlay from './components/SearchOverlay';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { AuthProvider, useAuth } from './context/AuthContext';

// Lazy load pages for performance
const HomePage = lazy(() => import('./pages/HomePage'));
const ResultsPage = lazy(() => import('./pages/ResultsPage'));
const WeatherPage = lazy(() => import('./pages/WeatherPage'));
const CommunityPage = lazy(() => import('./pages/CommunityPage'));
const MarketsPage = lazy(() => import('./pages/MarketsPage'));
const CountryProfilePage = lazy(() => import('./pages/CountryProfilePage'));
const MyIntelPage = lazy(() => import('./pages/MyIntelPage'));
import React from 'react';
import LoginModal from './components/LoginModal';
import ParticleBackground from './components/ParticleBackground';

class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("App Crash Caught:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: 'white', padding: '50px', textAlign: 'center', height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <h2>System Offline: Core Render Error</h2>
          <p style={{ color: '#ef4444' }}>{this.state.error?.message}</p>
          <button onClick={() => window.location.href='/'} style={{ padding: '10px 20px', background: '#3b82f6', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', marginTop: '20px' }}>
            Reboot Command Center
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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
        <Route path="/markets" element={<MarketsPage />} />
        <Route path="/country/:country" element={<CountryProfilePage />} />
        <Route path="/my-intel" element={<MyIntelPage />} />
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
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { user, logout } = useAuth();
  const [headerTemp, setHeaderTemp] = useState(null);

  useEffect(() => {
    pingHealth();
    (async () => {
      try {
        const loc = await detectLocation();
        if (loc?.city) {
          const w = await fetchWeather(loc.city);
          if (w && w.temp_c !== undefined) {
            setHeaderTemp(w.temp_c);
          }
        }
      } catch (e) { /* silent */ }
    })();
  }, []);

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
    <GlobalErrorBoundary>
      <div className="app">
        {/* ── Header ──────────────────── */}
        <header className="app-header">
          <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <a href="/" className="app-logo">
              <div className="app-logo-icon"><Zap size={16} color="white" /></div>
              <div>
                <h1 style={{ fontSize: '18px', margin: 0, padding: 0 }}>NewsIntel</h1>
              </div>
            </a>

            <div className="cmd-weather-pill" onClick={() => navigate('/weather')}>
              <CloudLightning size={14} className="cmd-weather-icon" style={{color: '#f59e0b'}} />
              <span className="cmd-weather-temp">{headerTemp !== null ? `${headerTemp}°C` : '...'}</span>
            </div>

            <div className="cmd-weather-pill" onClick={() => navigate('/markets')} style={{ marginLeft: '0px' }}>
              <TrendingUp size={14} className="cmd-weather-icon" style={{color: '#10b981'}} />
              <span className="cmd-weather-temp" style={{ color: '#10b981' }}>MARKETS</span>
            </div>
          </div>

          <div className="header-center" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button onClick={() => setIsSearchOpen(true)} className="cmd-search-form" style={{ width: '40px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', padding: 0, justifyContent: 'center' }}>
              <Search size={16} className="cmd-search-icon" />
            </button>
            <LiveClock />
          </div>

          <div className="header-right">
            <LanguageSwitcher />

            <button className="header-notification-btn" title={user ? "Dashboard" : "Sign In"} onClick={() => {
              if(user) {
                navigate('/my-intel');
              } else {
                setIsLoginOpen(true);
              }
            }} style={{ marginLeft: '8px' }}>
              {user ? (
                <img src={user.photoURL} alt="Profile" style={{ width: '18px', height: '18px', borderRadius: '50%' }} />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                </div>
              )}
            </button>

            <button className="header-notification-btn" title="Sign Out" onClick={() => {
              if(user) {
                if(window.confirm('Do you want to sign out?')) logout();
              } else {
                alert("Please add an account first.");
                setIsLoginOpen(true);
              }
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            </button>

            <div style={{ position: 'relative' }}>
              <button className="header-notification-btn" title="Alerts" onClick={() => {
                const el = document.getElementById('notif-panel');
                if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
              }}>
                <Bell size={14} />
                <div style={{position: 'absolute', top: '2px', right: '2px', background: '#ef4444', color: 'white', fontSize: '8px', fontWeight: 'bold', width: '10px', height: '10px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>3</div>
              </button>
              <div id="notif-panel" style={{ display: 'none', position: 'absolute', right: 0, top: '44px', width: '300px', background: 'rgba(10,5,25,0.98)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '12px', padding: '16px', zIndex: 999, backdropFilter: 'blur(20px)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
                <div style={{ fontSize: '11px', color: '#8b5cf6', fontWeight: 700, letterSpacing: '1px', marginBottom: '12px' }}>INTELLIGENCE ALERTS</div>
                {[
                  { icon: '🔴', text: 'Breaking: Iran ceasefire talks enter final phase', time: '2m ago' },
                  { icon: '🟡', text: 'Market Alert: DOW surges 1,200 points on geopolitical relief', time: '18m ago' },
                  { icon: '🟢', text: 'Weather Advisory: Monsoon season approaching South Asia', time: '1h ago' },
                ].map((n, i) => (
                  <div key={i} style={{ padding: '10px', marginBottom: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', borderLeft: '2px solid rgba(139,92,246,0.4)' }}>
                    <div style={{ fontSize: '12px', color: '#e2e8f0' }}>{n.icon} {n.text}</div>
                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>{n.time}</div>
                  </div>
                ))}
              </div>
            </div>
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

        {/* Search Overlay */}
        <SearchOverlay isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      </div>
    </GlobalErrorBoundary>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LanguageProvider>
          <ParticleBackground />
          <AppShell />
        </LanguageProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
