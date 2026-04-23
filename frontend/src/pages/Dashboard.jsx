import React, { useEffect, useState, useCallback, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { AppContext } from '../App';
import { useAuth } from '../context/AuthContext';

/* ── Components: World Heatmap ── */
const WorldHeatmap = ({ tension }) => {
  // Rough coordinates for major regions
  const regions = {
    "Middle East": { x: 55, y: 45 },
    "Asia": { x: 75, y: 40 },
    "Europe": { x: 50, y: 35 },
    "North America": { x: 20, y: 35 },
    "South America": { x: 30, y: 65 },
    "Africa": { x: 50, y: 60 },
    "Russia": { x: 65, y: 25 },
    "China": { x: 75, y: 45 },
    "India": { x: 70, y: 55 },
  };

  return (
    <div className="panel" style={{ height: 200, padding: 0, position: 'relative', background: '#000' }}>
      <div className="label" style={{ position: 'absolute', top: 10, left: 10, zIndex: 2 }}>Geopolitical Tension Map</div>
      {/* Abstract World Map SVG */}
      <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', opacity: 0.2 }}>
        <path d="M10,40 Q25,30 40,45 T70,35 T90,50 L90,80 Q70,90 50,75 T10,80 Z" fill="var(--text-3)" />
      </svg>
      {Object.entries(tension).map(([name, score]) => {
        const pos = regions[name] || { x: 50, y: 50 };
        return (
          <div key={name} className="pulse-dot" style={{
            left: `${pos.x}%`, top: `${pos.y}%`,
            width: 4 + (score / 20), height: 4 + (score / 20),
            background: score > 70 ? 'var(--neg)' : score > 40 ? 'var(--warn)' : 'var(--pos)',
            boxShadow: `0 0 15px ${score > 70 ? 'var(--neg)' : 'var(--pos)'}`
          }} title={`${name}: ${score}`} />
        );
      })}
    </div>
  );
};

/* ── Components: Story Graph ── */
const StoryGraph = ({ articles }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '8px 0' }}>
      {articles.map((_, i) => (
        <React.Fragment key={i}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--theme-main)' }} />
          {i < articles.length - 1 && <div style={{ width: 12, height: 1, background: 'var(--theme-border)' }} />}
        </React.Fragment>
      ))}
      <span className="mono" style={{ fontSize: 9, color: 'var(--text-3)', marginLeft: 8 }}>SIGNAL THREAD</span>
    </div>
  );
};

/* ── Hook: Typewriter (Fixed) ── */
function useTypewriter(text, speed = 20) {
  const [displayed, setDisplayed] = useState('');
  const [typing, setTyping] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    if (!text) return;
    setDisplayed('');
    setTyping(true);
    let i = 0;
    timer.current = setInterval(() => {
      // Use function to ensure we don't skip chars
      setDisplayed(prev => text.slice(0, i + 1));
      i++;
      if (i >= text.length) {
        clearInterval(timer.current);
        setTyping(false);
      }
    }, speed);
    return () => clearInterval(timer.current);
  }, [text, speed]);

  return { displayed, typing };
}

export default function Dashboard() {
  const { user } = useAuth();
  const { setHeadlines } = useContext(AppContext);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTheme, setActiveTheme] = useState('tech');
  const navigate = useNavigate();

  const load = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const res = await api.getDashboard([], [], force);
      setData(res);
      
      // Update Ticker
      if (res.articles) setHeadlines(res.articles.slice(0, 8).map(a => a.title));
      
      // Dynamic Theming based on majority category
      if (res.articles?.length) {
        // Simple logic: if many "Markets" in titles, go markets
        const txt = JSON.stringify(res.articles).toLowerCase();
        if (txt.includes('market') || txt.includes('stock')) setActiveTheme('markets');
        else if (txt.includes('trump') || txt.includes('china') || txt.includes('nato')) setActiveTheme('politics');
        else if (txt.includes('ai') || txt.includes('intelligence')) setActiveTheme('ai');
        else setActiveTheme('tech');
      }
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [setHeadlines]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    document.body.className = `theme-${activeTheme}`;
  }, [activeTheme]);

  const { displayed: briefText, typing } = useTypewriter(data?.daily_brief);

  if (loading && !data) return (
    <div style={{ display: 'flex', height: '80vh', alignItems: 'center', justifyContent: 'center' }}>
      <div className="label pulse-glow">Synchronizing Intelligence Stream...</div>
    </div>
  );

  return (
    <div className="dashboard-grid">
      
      {/* ── Zone 1: Status & Map ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="panel" style={{ padding: 20 }}>
          <div className="label" style={{ marginBottom: 12 }}>Operator Profile</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <img src={user?.photoURL} style={{ width: 40, height: 40, border: '1px solid var(--theme-main)' }} alt="" />
            <div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>{user?.displayName}</div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--pos)' }}>SECURE_SESSION_ACTIVE</div>
            </div>
          </div>
        </div>

        <WorldHeatmap tension={data?.tension_index || {}} />

        <div className="panel" style={{ flex: 1, padding: 20 }}>
          <div className="label" style={{ marginBottom: 16 }}>Intelligence Metrics</div>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-2)' }}>SOURCES</span>
              <span className="mono" style={{ color: 'var(--theme-main)' }}>{data?.articles?.length || 0}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-2)' }}>CLUSTERS</span>
              <span className="mono" style={{ color: 'var(--theme-main)' }}>{data?.clusters?.length || 0}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-2)' }}>AI PROVIDER</span>
              <span className="mono" style={{ color: 'var(--pos)', fontSize: 10 }}>OPENROUTER_V1</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Zone 2: Intelligence Feed ── */}
      <div style={{ overflowY: 'auto', paddingRight: 8 }}>
        <div className="ticker-wrap" style={{ marginBottom: 16 }}>
          <div className="ticker-tag">FLASH</div>
          <div className="ticker-move">
            {data?.articles?.slice(0, 5).map((a, i) => (
              <span key={i} className="mono" style={{ marginRight: 40, fontSize: 11 }}>
                <span style={{ color: 'var(--theme-main)' }}>//</span> {a.title.toUpperCase()}
              </span>
            ))}
          </div>
        </div>

        {(data?.clusters || []).map((c, ci) => {
          const arts = c.article_ids.map(id => data.articles.find(a => a.id === id)).filter(Boolean);
          const avgSent = arts[0]?.sentiment?.label || 'NEUTRAL';
          
          return (
            <div key={ci} className="panel" style={{ marginBottom: 16, padding: 0 }}>
              <div style={{ padding: 20, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className="label" style={{ color: 'var(--text-3)', marginBottom: 8 }}>Thread 0{ci+1} // Pulse {c.pulse_score || 50}</div>
                  <div className={`badge ${avgSent.toLowerCase() === 'negative' ? 'neg' : avgSent.toLowerCase() === 'positive' ? 'pos' : 'neu'}`}>{avgSent}</div>
                </div>
                <h2 style={{ fontSize: 18, marginBottom: 8 }}>{c.thread_title}</h2>
                <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>{c.summary}</p>
                <StoryGraph articles={arts} />
              </div>
              <div style={{ background: 'rgba(0,0,0,0.2)' }}>
                {arts.map((a, i) => (
                  <div key={i} className="wire-strip" onClick={() => navigate('/story', { state: { article: a } })} style={{ cursor: 'pointer' }}>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--theme-main)', width: 100, flexShrink: 0 }}>{a.source.toUpperCase()}</div>
                    <div style={{ fontSize: 12, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.title}</div>
                    <div className="mono" style={{ fontSize: 9, color: 'var(--text-3)' }}>{a.published?.split('T')[1]?.substring(0,5)}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Zone 3: Synthesis ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="panel" style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column' }}>
          <div className="label" style={{ marginBottom: 20 }}>Strategic Brief</div>
          <div className="typewriter" style={{ flex: 1 }}>
            {briefText}
            {typing && <span className="typewriter-cursor" />}
          </div>
          <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--theme-border)' }}>
            <div className="label" style={{ marginBottom: 12 }}>Executive Impact</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{data?.impact?.headline}</div>
            <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>{data?.impact?.why_it_matters}</p>
          </div>
        </div>

        <div className="panel" style={{ padding: 20 }}>
          <div className="label" style={{ marginBottom: 12 }}>Direct Action</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {data?.impact?.actions?.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--text-1)' }}>
                <span style={{ color: 'var(--theme-main)' }}>▶</span> {a}
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
