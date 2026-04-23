import React, { useState, useEffect, createContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Dashboard from './pages/Dashboard';
import Onboarding from './pages/Onboarding';
import StoryView from './pages/StoryView';
import './index.css';

export const AppContext = createContext({ headlines: [], setHeadlines: () => {} });

/* ── Loading Screen (shown while Firebase initializes) ─────────────── */
const AuthLoading = () => (
  <div className="auth-loading">
    <div className="pulse-glow" style={{ width: 16, height: 16, background: 'var(--theme-main)', borderRadius: '50%' }} />
    <span className="mono" style={{ fontSize: 11, color: 'var(--theme-main)', letterSpacing: 2 }}>
      INITIALIZING SECURE SESSION...
    </span>
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
            NEWS<span style={{ color: 'var(--theme-main)' }}>INTEL</span>
          </div>
          <div className="label" style={{ color: 'var(--text-3)', marginBottom: 24 }}>Strategic Intelligence Command</div>
          <p style={{ color: 'var(--text-2)', fontSize: 13, lineHeight: 1.6 }}>
            Real-time geopolitical monitoring powered by AI.
            Sign in to access the command center.
          </p>
        </div>
        <button onClick={login} className="btn-premium" style={{ width: '100%' }}>
          ▸ Authorize with Google
        </button>
        <p className="mono" style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 16 }}>
          ENCRYPTED // END-TO-END FIREBASE AUTH
        </p>
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
    <>
      <div className="top-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: '-0.5px' }}>
            NEWS<span style={{ color: 'var(--theme-main)' }}>INTEL</span>
          </div>
          <div className="mono" style={{ fontSize: 9, color: 'var(--text-3)', letterSpacing: 1 }}>
            v10 // COMMAND CENTER
          </div>
        </div>

        <div className="nav-links">
          <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>DASHBOARD</NavLink>
          <NavLink to="/onboarding" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>SETUP</NavLink>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-2)' }}>
            <span style={{ color: 'var(--theme-main)', fontWeight: 700 }}>UTC</span> {time}
          </span>
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderLeft: '1px solid var(--theme-border)', paddingLeft: 16 }}>
              {user.photoURL && <img src={user.photoURL} alt="" style={{ width: 22, height: 22, borderRadius: '50%', border: '1px solid var(--theme-border)' }} />}
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

      {/* Headline Ticker */}
      <HeadlineTicker />
    </>
  );
};

/* ── Headline Ticker ───────────────────────────────────────────────── */
const HeadlineTicker = () => {
  // This will be fed by Dashboard via AppContext
  return null; // Rendered inside Dashboard instead for proper data flow
};

/* ── App Root ────────────────────────────────────────────────────────── */
function App() {
  const [headlines, setHeadlines] = useState([]);

  return (
    <AuthProvider>
      <AppContext.Provider value={{ headlines, setHeadlines }}>
        <Router>
          <div className="app-container theme-tech">
            <div className="scanline" />
            <TopBar />
            <div className="main-content">
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<Protected><Dashboard /></Protected>} />
                <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
                <Route path="/onboarding" element={<Protected><Onboarding /></Protected>} />
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
