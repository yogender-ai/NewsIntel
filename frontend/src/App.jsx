import React, { useState, useEffect, createContext } from 'react';
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
import './index.css';

export const AppContext = createContext({ headlines: [], setHeadlines: () => {}, mode: 'command', setMode: () => {} });

/* ── Pipeline Loading Screen ─────────────── */
const PipelineLoading = () => {
  const [step, setStep] = useState(0);
  const steps = ['ESTABLISHING SECURE UPLINK...', 'FETCHING LIVE SIGNALS...', 'ANALYZING GLOBAL SHIFTS...', 'INITIALIZING PIPELINE...'];
  
  useEffect(() => {
    const int = setInterval(() => {
      setStep(s => (s < steps.length - 1 ? s + 1 : s));
    }, 800);
    return () => clearInterval(int);
  }, []);

  return (
    <div style={{ 
      width: '100vw', height: '100vh', background: '#05060f', 
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      color: '#e7ebf5', zIndex: 9999, position: 'fixed', top: 0, left: 0
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
        background: 'linear-gradient(rgba(141, 162, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(141, 162, 255, 0.03) 1px, transparent 1px)',
        backgroundSize: '40px 40px', maskImage: 'radial-gradient(circle at center, black, transparent 70%)',
        animation: 'wpRadarSpin 100s linear infinite'
      }} />
      <div style={{
        width: 12, height: 12, borderRadius: '50%', background: '#7ee7c4',
        boxShadow: '0 0 20px #7ee7c4', animation: 'pulseGlow 1.5s ease-in-out infinite',
        marginBottom: 24, zIndex: 1
      }} />
      <span className="mono" style={{ 
        fontSize: 10, color: '#8da2ff', letterSpacing: 3, fontWeight: 800,
        zIndex: 1, textShadow: '0 0 10px rgba(141,162,255,0.5)'
      }}>
        {steps[step]}
      </span>
    </div>
  );
};

/* ── Login Page ────────────────────────────────────────────────────── */
const Login = () => {
  const { login, user, loading } = useAuth();
  if (loading) return <PipelineLoading />;
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
          ▸ Authorize with Google
        </button>
      </div>
    </div>
  );
};

/* ── Protected Route ───────────────────────────────────────────────── */
const Protected = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <PipelineLoading />;
  return user ? children : <Navigate to="/login" />;
};

/* ── Top Bar ───────────────────────────────────────────────────────── */
const TopBar = () => {
  const { user, logout } = useAuth();
  const [time, setTime] = useState('');

  // Try to get alert count from personalization context (only available inside Protected routes)
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
  const [mode, setModeState] = useState(localStorage.getItem('ni_mode') || 'command');
  const [themeSeed] = useState(() => {
    const next = Number(localStorage.getItem('ni_theme_spin') || '0') + 1;
    localStorage.setItem('ni_theme_spin', String(next));
    return next;
  });

  const setMode = (m) => {
    setModeState(m);
    localStorage.setItem('ni_mode', m);
  };

  return (
    <AuthProvider>
      <AppContext.Provider value={{ headlines, setHeadlines, mode, setMode }}>
        <Router>
          <div className={`app-container ${['theme-tech', 'theme-cyber', 'theme-aurora'][themeSeed % 3]} ${mode === 'calm' ? 'calm-mode' : ''}`}>
            <div className="scanline" />
            <AppRoutes />
          </div>
        </Router>
      </AppContext.Provider>
    </AuthProvider>
  );
}

function AppRoutes() {
  const location = useLocation();
  const isWorldPulse = ['/', '/dashboard', '/orbit', '/map', '/simulator', '/story'].includes(location.pathname) || location.pathname.startsWith('/dashboard/event/');
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
