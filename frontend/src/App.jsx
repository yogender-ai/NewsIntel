import React, { useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Onboarding from './pages/Onboarding';
import StoryView from './pages/StoryView';
import './index.css';

/* ── Particle Field Background ─────────────────────────────────── */
function ParticleField() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;
    let w, h;
    const particles = [];
    const COUNT = 50;
    const CONNECT_DIST = 140;

    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };

    const init = () => {
      resize();
      particles.length = 0;
      for (let i = 0; i < COUNT; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          r: Math.random() * 1.5 + 0.5,
          a: Math.random() * 0.3 + 0.1,
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECT_DIST) {
            const alpha = (1 - dist / CONNECT_DIST) * 0.08;
            ctx.strokeStyle = `rgba(0, 212, 255, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw & move particles
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 212, 255, ${p.a})`;
        ctx.fill();

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }

      raf = requestAnimationFrame(draw);
    };

    init();
    draw();
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} id="particle-canvas" />;
}

/* ── Mouse Glow Tracker (for cards) ────────────────────────────── */
function useMouseGlow() {
  useEffect(() => {
    const handler = (e) => {
      const cards = document.querySelectorAll('.glass');
      cards.forEach(card => {
        const rect = card.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        card.style.setProperty('--mouse-x', `${x}%`);
        card.style.setProperty('--mouse-y', `${y}%`);
      });
    };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);
}

/* ── Nav Bar ───────────────────────────────────────────────────── */
function NavBar() {
  const location = useLocation();
  const isStory = location.pathname === '/story';

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 32px', height: 52,
      background: 'rgba(2, 4, 9, 0.7)',
      backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
      borderBottom: '1px solid var(--border)',
    }}>
      <NavLink to="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'linear-gradient(135deg, #00d4ff, #6366f1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 16px rgba(0, 212, 255, 0.25)',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
        </div>
        <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.3px', color: 'var(--t1)' }}>
          News<span style={{ color: 'var(--accent)' }}>Intel</span>
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
                borderRadius: 8,
                color: isActive ? 'var(--t1)' : 'var(--t3)',
                background: isActive ? 'rgba(255,255,255,0.04)' : 'transparent',
                textDecoration: 'none', transition: 'all 0.2s',
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
  useMouseGlow();

  return (
    <Router>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <ParticleField />
        <div className="ambient-layer" />
        <div className="scanline" />

        <NavBar />
        <main style={{ flex: 1, padding: '28px 32px', maxWidth: 1300, margin: '0 auto', width: '100%' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/story" element={<StoryView />} />
          </Routes>
        </main>
        <footer style={{
          padding: '14px 32px', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between',
          fontSize: 10, color: 'var(--t4)', letterSpacing: '0.3px',
        }}>
          <span>News-Intel v3.0</span>
          <span className="mono">Gateway → Gemini 2.5 Flash Lite + HF Space</span>
        </footer>
      </div>
    </Router>
  );
}

export default App;
