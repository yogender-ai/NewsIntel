import React, { useState, useEffect, createContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, NavLink } from 'react-router-dom';
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
  const { mode, setMode } = React.useContext(AppContext);
  const [time, setTime] = useState('');

  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="top-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: '-0.5px' }}>
          NEWS<span style={{ color: 'var(--accent)' }}>INTEL</span>
        </div>
        
        {/* Mode Toggle */}
        <div className="mode-toggle" style={{ marginLeft: 16 }}>
          <button className={`mode-btn ${mode === 'calm' ? 'active' : ''}`} onClick={() => setMode('calm')}>CALM</button>
          <button className={`mode-btn ${mode === 'command' ? 'active' : ''}`} onClick={() => setMode('command')}>COMMAND</button>
        </div>
      </div>

      <div className="nav-links">
        <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>DASHBOARD</NavLink>
        <span className="nav-link" style={{opacity: 0.4, cursor: 'not-allowed'}}>DIGEST</span>
        <span className="nav-link" style={{opacity: 0.4, cursor: 'not-allowed'}}>GRAPH</span>
        <span className="nav-link" style={{opacity: 0.4, cursor: 'not-allowed'}}>HEATMAP</span>
        <span className="nav-link" style={{opacity: 0.4, cursor: 'not-allowed'}}>ALERTS</span>
        <NavLink to="/settings" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>SETTINGS</NavLink>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span className="mono" style={{ fontSize: 11, color: 'var(--text-2)' }}>
          <span style={{ color: 'var(--accent)', fontWeight: 700 }}>UTC</span> {time}
        </span>
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderLeft: '1px solid var(--accent-border)', paddingLeft: 16 }}>
            {user.photoURL && <img src={user.photoURL} alt="" style={{ width: 22, height: 22, borderRadius: '50%', border: '1px solid var(--accent-border)' }} />}
            <div>
              <div className="mono" style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-1)' }}>{user.displayName?.toUpperCase()}</div>
              <button onClick={logout} style={{
                background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 8,
                fontFamily: 'var(--mono)', cursor: 'pointer', padding: 0,
              }}>LOGOUT</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ── App Root ────────────────────────────────────────────────────────── */
function App() {
  const [headlines, setHeadlines] = useState([]);
  const [mode, setModeState] = useState(localStorage.getItem('ni_mode') || 'command');

  const setMode = (m) => {
    setModeState(m);
    localStorage.setItem('ni_mode', m);
  };

  return (
    <AuthProvider>
      <AppContext.Provider value={{ headlines, setHeadlines, mode, setMode }}>
        <Router>
          <div className={`app-container theme-tech ${mode === 'calm' ? 'calm-mode' : ''}`}>
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
