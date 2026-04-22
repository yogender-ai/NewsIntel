import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Onboarding from './pages/Onboarding';
import StoryView from './pages/StoryView';
import './index.css';

function App() {
  return (
    <Router>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* ── Navbar ────────────────────────────────────────────── */}
        <nav style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 32px',
          height: '56px',
          background: 'rgba(6, 7, 10, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--border)',
        }}>
          <NavLink to="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, var(--cyan), #0080ff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#06070a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
            </div>
            <span style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--text-primary)' }}>
              News-Intel
            </span>
          </NavLink>

          <div style={{ display: 'flex', gap: '4px' }}>
            {[
              { to: '/dashboard', label: 'Dashboard' },
              { to: '/onboarding', label: 'Profile' },
            ].map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                style={({ isActive }) => ({
                  padding: '6px 14px',
                  fontSize: '13px',
                  fontWeight: 500,
                  borderRadius: '8px',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                  textDecoration: 'none',
                  transition: 'all 0.15s',
                })}
              >
                {link.label}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* ── Main Content ──────────────────────────────────────── */}
        <main style={{ flex: 1, padding: '32px', maxWidth: '1320px', margin: '0 auto', width: '100%' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/story" element={<StoryView />} />
          </Routes>
        </main>

        {/* ── Footer ────────────────────────────────────────────── */}
        <footer style={{
          padding: '20px 32px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px',
          color: 'var(--text-tertiary)',
        }}>
          <span>News-Intel v2.0 — AI Intelligence Pipeline</span>
          <span className="mono" style={{ fontSize: '11px' }}>
            Gateway: Cloud Command
          </span>
        </footer>
      </div>
    </Router>
  );
}

export default App;
