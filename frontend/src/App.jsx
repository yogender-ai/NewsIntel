import { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Loader, Zap, Bookmark } from 'lucide-react';
import './App.css';
import { pingHealth } from './api';
import StockTicker from './components/StockTicker';
import LiveClock from './components/LiveClock';
import ReadingList, { useReadingList } from './components/ReadingList';

// Lazy load pages for performance
const HomePage = lazy(() => import('./pages/HomePage'));
const ResultsPage = lazy(() => import('./pages/ResultsPage'));
const WeatherPage = lazy(() => import('./pages/WeatherPage'));

function AppShell() {
  const [showReadingList, setShowReadingList] = useState(false);
  const { list: readingList, removeArticle, clearAll } = useReadingList();

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

  return (
    <>
      <div className="app">
        {/* ── Header ──────────────────── */}
        <header className="app-header">
          <a href="/" className="app-logo">
            <div className="app-logo-icon"><Zap size={16} color="white" /></div>
            <div>
              <h1>NewsIntel</h1>
              <span>AI Intelligence v5.0</span>
            </div>
          </a>

          <div className="header-center">
            <LiveClock />
          </div>

          <div className="header-right">
            {/* Reading List Toggle */}
            <button
              className={`header-bookmark-btn ${readingList.length > 0 ? 'has-items' : ''}`}
              onClick={() => setShowReadingList(true)}
              title="Reading List"
            >
              <Bookmark size={14} />
              {readingList.length > 0 && <span className="bookmark-count">{readingList.length}</span>}
            </button>

            <a href="/weather" className="header-weather-link" title="Weather Dashboard">
              🌤️
            </a>

            <div className="header-badge"><span className="dot" />Live</div>
          </div>
        </header>

        {/* ── Stock Ticker ──────── */}
        <StockTicker />

        {/* ── Main Content (Routes) ──────── */}
        <main className="app-main">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/search/:topic" element={<ResultsPage />} />
              <Route path="/weather" element={<WeatherPage />} />
            </Routes>
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
            <span>NewsIntel v5.0 — AI-Powered News Intelligence Platform</span>
            <span className="footer-tech">FastAPI · HuggingFace NLP · Google Gemini · React</span>
          </div>
        </footer>
      </div>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
