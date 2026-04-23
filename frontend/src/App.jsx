import React, { useEffect, useState, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Onboarding from './pages/Onboarding';
import StoryView from './pages/StoryView';
import './index.css';

/* ── Shared Context: ticker gets headlines from Dashboard data ──────── */
export const AppContext = createContext({ headlines: [], setHeadlines: () => {} });

/* ── Headline Ticker ────────────────────────────────────────────────── */
const HeadlineTicker = () => {
  const { headlines } = useContext(AppContext);
  const items = headlines.length > 0
    ? headlines
    : ["AWAITING INTELLIGENCE FEED...", "ESTABLISHING GATEWAY CONNECTION..."];

  return (
    <div className="ticker-wrap">
      <div className="ticker-tag">LIVE</div>
      <div className="ticker-move">
        {[...items, ...items].map((text, i) => (
          <div key={i} className="ticker-item">
            <span className="ticker-sep">//</span> {text}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── Top Navigation Bar ─────────────────────────────────────────────── */
const TopBar = () => {
  const [time, setTime] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <div className="top-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '0.5px' }}>
            NEWS<span style={{ color: 'var(--theme-main)' }}>INTEL</span>
          </div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '1px' }}>
            v9 // COMMAND CENTER
          </div>
        </div>

        <div className="nav-links">
          <NavLink to="/onboarding" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>SETUP</NavLink>
          <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>DASHBOARD</NavLink>
        </div>

        <div className="mono" style={{ fontSize: 11, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--theme-main)', fontWeight: 700 }}>UTC</span>
          {time}
        </div>
      </div>
      <HeadlineTicker />
    </>
  );
};

/* ── App Root ────────────────────────────────────────────────────────── */
function App() {
  const [headlines, setHeadlines] = useState([]);

  return (
    <AppContext.Provider value={{ headlines, setHeadlines }}>
      <Router>
        <div className="app-container theme-tech">
          <div className="ambient-layer" />
          <div className="scanline" />
          <TopBar />
          <div className="main-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/story" element={<StoryView />} />
            </Routes>
          </div>
        </div>
      </Router>
    </AppContext.Provider>
  );
}

export default App;
