import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Onboarding from './pages/Onboarding';
import StoryView from './pages/StoryView';
import './index.css';

function NavBar() {
  const location = useLocation();
  const isStory = location.pathname === '/story';

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 32px', height: 52,
      background: 'rgba(4, 6, 11, 0.75)',
      backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
      borderBottom: '1px solid var(--border)',
    }}>
      <NavLink to="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 7,
          background: 'linear-gradient(135deg, #00d4ff, #6366f1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 12px rgba(0, 212, 255, 0.2)',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.2px', color: 'var(--t1)' }}>
          News-Intel
        </span>
      </NavLink>

      {!isStory && (
        <div style={{ display: 'flex', gap: 2 }}>
          {[
            { to: '/dashboard', label: 'Dashboard' },
            { to: '/onboarding', label: 'Profile' },
          ].map(link => (
            <NavLink key={link.to} to={link.to}
              style={({ isActive }) => ({
                padding: '6px 14px', fontSize: 12, fontWeight: 600,
                borderRadius: 7,
                color: isActive ? 'var(--t1)' : 'var(--t3)',
                background: isActive ? 'rgba(255,255,255,0.05)' : 'transparent',
                textDecoration: 'none', transition: 'all 0.15s',
                letterSpacing: '0.3px',
              })}
            >{link.label}</NavLink>
          ))}
        </div>
      )}
    </nav>
  );
}

function App() {
  return (
    <Router>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Animated background */}
        <div className="ambient-bg" />

        <NavBar />
        <main style={{ flex: 1, padding: '28px 32px', maxWidth: 1280, margin: '0 auto', width: '100%' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/story" element={<StoryView />} />
          </Routes>
        </main>
        <footer style={{
          padding: '16px 32px', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between',
          fontSize: 11, color: 'var(--t4)',
        }}>
          <span>News-Intel v3.0 — AI Intelligence Platform</span>
          <span className="mono">Cloud Command Gateway</span>
        </footer>
      </div>
    </Router>
  );
}

export default App;
