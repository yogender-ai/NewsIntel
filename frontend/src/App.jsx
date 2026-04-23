import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Dashboard from './pages/Dashboard';
import Onboarding from './pages/Onboarding';
import StoryView from './pages/StoryView';
import './index.css';

/* ── Global State ── */
export const AppContext = createContext();

const Login = () => {
  const { login, user } = useAuth();
  if (user) return <Navigate to="/dashboard" />;

  return (
    <div className="auth-overlay">
      <div className="login-card panel">
        <div className="label" style={{ marginBottom: 24 }}>System Authorization</div>
        <h1 style={{ marginBottom: 16 }}>NEWS<span style={{ color: 'var(--theme-main)' }}>INTEL</span></h1>
        <p style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 32 }}>Access the Global Intelligence Command Center</p>
        <button onClick={login} className="btn-premium" style={{ width: '100%' }}>
          Authorize with Google
        </button>
      </div>
    </div>
  );
};

const Protected = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? children : <Navigate to="/login" />;
};

const TopBar = () => {
  const { user, logout } = useAuth();
  const [time, setTime] = useState('');

  useEffect(() => {
    const it = setInterval(() => setTime(new Date().toLocaleTimeString('en-US', { hour12: false })), 1000);
    return () => clearInterval(it);
  }, []);

  return (
    <div className="top-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-1px' }}>
          NEWS<span style={{ color: 'var(--theme-main)' }}>INTEL</span>
        </div>
        <div className="label" style={{ opacity: 0.5 }}>v10 // STRATEGIC COMMAND</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <div className="mono" style={{ fontSize: 11, color: 'var(--text-2)' }}>{time} <span style={{ color: 'var(--theme-main)' }}>UTC</span></div>
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderLeft: '1px solid var(--theme-border)', paddingLeft: 24 }}>
            <img src={user.photoURL} alt="" style={{ width: 24, height: 24, borderRadius: '50%' }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="mono" style={{ fontSize: 10, fontWeight: 700 }}>{user.displayName?.toUpperCase()}</span>
              <button onClick={logout} style={{ background: 'none', border: 'none', color: 'var(--theme-main)', fontSize: 9, textAlign: 'left', padding: 0 }}>SIGNOUT</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

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
