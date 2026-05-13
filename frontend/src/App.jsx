import React, { useState, useEffect, useRef, createContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import { Bell, Building2, ChevronsUpDown, CircleDot, Settings as SettingsIcon, SlidersHorizontal, Sun, User, Zap } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PersonalizationProvider, usePersonalization } from './context/PersonalizationContext';
import HomePage from './pages/HomePage';
import Onboarding from './pages/Onboarding';
import StoryView from './pages/StoryView';
import Settings from './pages/Settings';
import WatchlistPage from './pages/WatchlistPage';
import AlertsPage from './pages/AlertsPage';
import MoversPage from './pages/MoversPage';
import OrbitPage from './pages/OrbitPage';
import MapPage from './pages/MapPage';
import SimulatorPage from './pages/SimulatorPage';
import EventDetail from './pages/EventDetail';
import StoriesPage from './pages/StoriesPage';
import ThreeBackground from './components/ThreeBackground';
import './index.css';

export const AppContext = createContext({
  headlines: [],
  setHeadlines: () => {},
  mode: 'command',
  setMode: () => {},
  worldPulseValue: 0,
  setWorldPulseValue: () => {},
  dashboardCache: null,
  setDashboardCache: () => {},
});

/* ── Minimal auth loading ── */
const AuthLoading = () => (
  <div style={{
    width: '100vw', height: '100vh', background: '#050811',
    display: 'grid', placeItems: 'center', position: 'fixed', inset: 0, zIndex: 9999,
  }}>
    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#8b5cf6',
      boxShadow: '0 0 16px rgba(139,92,246,0.5)', animation: 'authPulse 1.5s ease-in-out infinite',
    }} />
    <style>{`@keyframes authPulse { 0%,100% { opacity:.3; transform:scale(1); } 50% { opacity:1; transform:scale(1.8); } }`}</style>
  </div>
);

/* ── Login Page ────────────────────────────────────────────────────── */
const Login = () => {
  const { login, user, loading } = useAuth();
  if (loading) return <AuthLoading />;
  if (user) return <Navigate to="/dashboard" />;

  return (
    <div className="auth-overlay">
      <div className="login-card panel">
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-2px', marginBottom: 8 }}>
            NEWS<span style={{ color: 'var(--accent)' }}>INTEL</span>
          </div>
          <div className="label" style={{ color: 'var(--text-3)', marginBottom: 24 }}>Signal Intelligence Command</div>
          <p style={{ color: 'var(--text-2)', fontSize: 13, lineHeight: 1.6 }}>
            Convert global complexity into daily decision signals.<br/>
            Sign in to access your intelligence feed.
          </p>
        </div>
        <button onClick={login} className="btn-premium" style={{ width: '100%' }}>
          Authorize with Google
        </button>
      </div>
    </div>
  );
};

/* ── Protected Route ───────────────────────────────────────────────── */
const Protected = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <AuthLoading />;
  return user ? children : <Navigate to="/login" />;
};

/* ── Top Bar ───────────────────────────────────────────────────────── */
const TopBar = () => {
  const { user, logout } = useAuth();
  const [time, setTime] = useState('');

  let alertCount = 0;
  try {
    const p = usePersonalization();
    alertCount = p?.unreadAlertCount || 0;
  } catch { /* Not inside provider yet */ }

  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="top-bar">
      <div className="brand-mark">
        <div>
          NEWS<span style={{ color: 'var(--accent)' }}>INTEL</span>
        </div>
      </div>

      <div className="nav-links">
        <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}><Zap size={16} />Signals</NavLink>
        <NavLink to="/movers" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}><ChevronsUpDown size={16} />Movers</NavLink>
        <NavLink to="/watchlist" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}><Building2 size={16} />Watchlist</NavLink>
        <NavLink to="/alerts" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          <Bell size={16} />Alerts {alertCount > 0 && <b>{alertCount}</b>}
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}><SettingsIcon size={16} />Settings</NavLink>
      </div>

      <div className="top-actions">
        <Sun size={17} />
        <span className="clock-readout">
          {time.slice(0, 5)} UTC <CircleDot size={8} />
        </span>
        {user && (
          <button className="user-pill" onClick={logout} title="Logout">
            {user.photoURL ? <img src={user.photoURL} alt="" /> : <User size={18} />}
            <span>{user.displayName?.split(' ')[0] || 'User'}</span>
            <SlidersHorizontal size={13} />
          </button>
        )}
      </div>
    </div>
  );
};

function GlobalLiveCursor() {
  const cursorRef = useRef(null);
  const ringRef = useRef(null);
  const dotRef = useRef(null);
  const trailRef = useRef(null);
  
  const mouse = useRef({ x: window.innerWidth/2, y: window.innerHeight/2 });
  const smoothMouse = useRef({ x: window.innerWidth/2, y: window.innerHeight/2 });
  const stateRef = useRef('idle');
  const cssMouseRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef(0);
  const idleTimerRef = useRef(0);
  const lastCssUpdateRef = useRef(0);
  const lastTrailUpdateRef = useRef(0);
  const scrollingRef = useRef(false);

  useEffect(() => {
    let angle = 0;

    const stopLoopSoon = () => {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = window.setTimeout(() => {
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = 0;
        }
      }, 1800);
    };

    const tick = (now = 0) => {
      smoothMouse.current.x += (mouse.current.x - smoothMouse.current.x) * 0.15;
      smoothMouse.current.y += (mouse.current.y - smoothMouse.current.y) * 0.15;
      angle += 1;

      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${mouse.current.x}px, ${mouse.current.y}px, 0)`;
      }

      if (!scrollingRef.current && now - lastCssUpdateRef.current > 160) {
        const cssX = Math.round(mouse.current.x);
        const cssY = Math.round(mouse.current.y);
        const movedEnough = Math.abs(cssMouseRef.current.x - cssX) + Math.abs(cssMouseRef.current.y - cssY) > 24;
        if (movedEnough) {
          document.documentElement.style.setProperty('--cursor-x', `${cssX}px`);
          document.documentElement.style.setProperty('--cursor-y', `${cssY}px`);
          cssMouseRef.current = { x: cssX, y: cssY };
        }
        lastCssUpdateRef.current = now;
      }

      if (ringRef.current) {
        const speedMultiplier = stateRef.current === 'satellite' ? 3 : 1;
        ringRef.current.style.transform = `translate(-50%, -50%) rotate(${angle * speedMultiplier}deg)`;
      }
      if (trailRef.current && now - lastTrailUpdateRef.current > 32) {
        trailRef.current.style.transform = `translate3d(${smoothMouse.current.x}px, ${smoothMouse.current.y}px, 0)`;
        lastTrailUpdateRef.current = now;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    const ensureLoop = () => {
      if (!rafRef.current && document.visibilityState === 'visible') {
        rafRef.current = requestAnimationFrame(tick);
      }
      stopLoopSoon();
    };

    const move = (e) => {
      mouse.current = { x: e.clientX, y: e.clientY };
      ensureLoop();
    };
    
    const handleMouseOver = (e) => {
      const target = e.target;
      let state = 'idle';
      
      const tag = target.tagName?.toLowerCase();
      const isButton = tag === 'button' || tag === 'a' || target.closest('button,a,[role="button"]');
      const isAlert = target.closest('.alert-card,.qg-stat,.wpr-scale-active');
      const isPulseRing = target.closest('.world-pulse-main-card');
      
      if (isPulseRing) state = 'satellite';
      else if (isButton && isAlert) state = 'alert';
      else if (isButton) state = 'hover';
      
      stateRef.current = state;
      
      if (cursorRef.current) {
        cursorRef.current.className = `cyber-cursor state-${state}`;
      }
      ensureLoop();
    };

    let scrollTimer = 0;
    const handleScroll = () => {
      scrollingRef.current = true;
      window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(() => { scrollingRef.current = false; }, 140);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden' && rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };

    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerover', handleMouseOver, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('visibilitychange', handleVisibility);
    ensureLoop();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.clearTimeout(idleTimerRef.current);
      window.clearTimeout(scrollTimer);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerover', handleMouseOver);
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return (
    <>
      <style>{`
        .cyber-cursor {
          position: fixed; top: 0; left: 0; z-index: 99999;
          pointer-events: none; mix-blend-mode: screen;
          will-change: transform;
        }
        
        .cyber-dot {
          position: absolute; top: -3px; left: -3px;
          width: 6px; height: 6px; border-radius: 50%;
          background: #00E5A0;
          box-shadow: 0 0 12px 3px rgba(0, 229, 160, 0.6);
          transition: background 0.3s ease, box-shadow 0.3s ease, transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
        }
        
        .cyber-ring {
          position: absolute; top: 0; left: 0;
          width: 28px; height: 28px; border-radius: 50%;
          border: 1.5px solid rgba(0, 229, 160, 0.25);
          border-top-color: rgba(0, 229, 160, 0.7);
          border-right-color: transparent;
          transition: width 0.3s ease, height 0.3s ease, border-color 0.3s ease, border-style 0.3s ease, opacity 0.3s ease;
        }
        
        .cyber-trail {
          position: fixed; top: -100px; left: -100px; z-index: 99998;
          width: 200px; height: 200px; border-radius: 50%;
          background: radial-gradient(circle, rgba(0, 229, 160, 0.04) 0%, rgba(139, 92, 246, 0.02) 40%, transparent 65%);
          pointer-events: none; will-change: transform;
          transition: background 0.5s ease;
        }

        .cyber-cursor.state-hover .cyber-dot {
          background: #00E5A0;
          box-shadow: 0 0 18px 5px rgba(0, 229, 160, 0.8);
          transform: scale(1.6);
        }
        .cyber-cursor.state-hover .cyber-ring {
          width: 40px; height: 40px;
          border-color: rgba(0, 229, 160, 0.3);
          border-top-color: rgba(0, 229, 160, 0.9);
          border-bottom-color: rgba(0, 229, 160, 0.9);
        }
        
        .cyber-cursor.state-alert .cyber-dot {
          background: #EF4444;
          box-shadow: 0 0 18px 5px rgba(239, 68, 68, 0.8);
          transform: scale(2);
        }
        .cyber-cursor.state-alert .cyber-ring {
          width: 36px; height: 36px;
          border-style: dashed;
          border-color: rgba(239, 68, 68, 0.6);
        }

        .cyber-cursor.state-satellite .cyber-dot {
          background: #fff;
          box-shadow: 0 0 20px 4px rgba(139, 92, 246, 0.8);
        }
        .cyber-cursor.state-satellite .cyber-ring {
          width: 56px; height: 56px;
          border: 1px dotted rgba(139, 92, 246, 0.4);
          border-top: 2px solid #8B5CF6;
          border-bottom: 2px solid #00E5A0;
        }
      `}</style>
      
      <div ref={trailRef} className="cyber-trail" />
      <div ref={cursorRef} className="cyber-cursor state-idle">
        <div ref={ringRef} className="cyber-ring" />
        <div ref={dotRef} className="cyber-dot" />
      </div>
    </>
  );
}

function CursorWrapper() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    setIsMobile(mq.matches);
  }, []);
  if (isMobile) return null;
  return <GlobalLiveCursor />;
}

/* ── Toast (global) ──────────────────────────────────────────────── */
const GlobalToast = () => {
  try {
    const { toast } = usePersonalization();
    if (!toast) return null;
    return <div className="phase5-toast">{toast}</div>;
  } catch {
    return null;
  }
};

/* ── App Root ────────────────────────────────────────────────────────── */
function App() {
  const [headlines, setHeadlines] = useState([]);
  const [worldPulseValue, setWorldPulseValue] = useState(0);
  const [dashboardCache, setDashboardCache] = useState(null);
  const [mode, setModeState] = useState(localStorage.getItem('ni_mode') || 'command');

  const setMode = (m) => {
    setModeState(m);
    localStorage.setItem('ni_mode', m);
  };

  useEffect(() => {
    const pulse = Math.max(0, Math.min(100, Number(worldPulseValue) || 0));
    document.documentElement.style.setProperty('--pulse-intensity', (pulse / 100).toFixed(3));
    document.documentElement.style.setProperty('--pulse-level', String(Math.round(pulse)));
  }, [worldPulseValue]);

  return (
    <AuthProvider>
      <AppContext.Provider value={{ headlines, setHeadlines, mode, setMode, worldPulseValue, setWorldPulseValue, dashboardCache, setDashboardCache }}>
        <Router>
          <div className={`app-container ${mode === 'calm' ? 'calm-mode' : ''}`}>
            <ThreeBackground />
            <div className="scanline" />
            <CursorWrapper />
            <AppRoutes />
          </div>
        </Router>
      </AppContext.Provider>
    </AuthProvider>
  );
}

function AppRoutes() {
  const location = useLocation();
  const isWorldPulse = ['/', '/dashboard', '/orbit', '/map', '/simulator', '/story', '/stories', '/watchlist', '/alerts', '/settings'].includes(location.pathname) || location.pathname.startsWith('/dashboard/event/');
  return (
    <>
      {!isWorldPulse && <TopBar />}
      <div className={isWorldPulse ? 'world-pulse-content' : 'main-content'}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Protected><HomePage /></Protected>} />
          <Route path="/dashboard" element={<Protected><HomePage /></Protected>} />
          <Route path="/dashboard/event/:id" element={<Protected><EventDetail /></Protected>} />
          <Route path="/orbit" element={<Protected><OrbitPage /></Protected>} />
          <Route path="/map" element={<Protected><MapPage /></Protected>} />
          <Route path="/simulator" element={<Protected><SimulatorPage /></Protected>} />
          <Route path="/stories" element={<Protected><StoriesPage /></Protected>} />
          <Route path="/onboarding" element={<Protected><Onboarding /></Protected>} />
          <Route path="/settings" element={<Protected><Settings /></Protected>} />
          <Route path="/story" element={<Protected><StoryView /></Protected>} />
          <Route path="/watchlist" element={<Protected><PersonalizationProvider><WatchlistPage /></PersonalizationProvider></Protected>} />
          <Route path="/alerts" element={<Protected><PersonalizationProvider><AlertsPage /></PersonalizationProvider></Protected>} />
          <Route path="/movers" element={<Protected><PersonalizationProvider><MoversPage /></PersonalizationProvider></Protected>} />
        </Routes>
        <GlobalToast />
      </div>
    </>
  );
}

export default App;
