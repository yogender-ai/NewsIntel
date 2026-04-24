import React, { useState, useEffect, createContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { Bell, Building2, ChevronsUpDown, CircleDot, Settings as SettingsIcon, SlidersHorizontal, Sun, User, Zap } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Dashboard from './pages/Dashboard';
import Onboarding from './pages/Onboarding';
import StoryView from './pages/StoryView';
import Settings from './pages/Settings';
import './index.css';

export const AppContext = createContext({ headlines: [], setHeadlines: () => {}, mode: 'command', setMode: () => {} });

/* ── Loading Screen ─────────────── */
const AuthLoading = () => (
  <div className="auth-loading">
    <div className="pulse-glow" style={{ width: 16, height: 16, background: 'var(--accent)', borderRadius: '50%' }} />
    <span className="mono" style={{ fontSize: 11, color: 'var(--accent)', letterSpacing: 2 }}>INITIALIZING SECURE SESSION...</span>
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
          ▸ Authorize with Google
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
        <span className="nav-link muted"><ChevronsUpDown size={16} />Movers</span>
        <span className="nav-link muted"><Building2 size={16} />Watchlist</span>
        <span className="nav-link muted"><Bell size={16} />Alerts <b>3</b></span>
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
            <TopBar />
            <div className="main-content">
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<Protected><Dashboard /></Protected>} />
                <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
                <Route path="/onboarding" element={<Protected><Onboarding /></Protected>} />
                <Route path="/settings" element={<Protected><Settings /></Protected>} />
                <Route path="/story" element={<Protected><StoryView /></Protected>} />
              </Routes>
            </div>
          </div>
        </Router>
      </AppContext.Provider>
    </AuthProvider>
  );
}

export default App;
