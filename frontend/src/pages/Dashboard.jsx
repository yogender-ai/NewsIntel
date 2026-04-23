import React, { useEffect, useState, useCallback, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { AppContext } from '../App';
import { useAuth } from '../context/AuthContext';

/* ── Typewriter ──────────────────────────────── */
function useTypewriter(text, speed = 14) {
  const [displayed, setDisplayed] = useState('');
  const [typing, setTyping] = useState(false);
  const timer = useRef(null);
  useEffect(() => {
    if (!text) { setDisplayed(''); return; }
    setDisplayed(''); setTyping(true);
    let i = 0;
    timer.current = setInterval(() => {
      i++; setDisplayed(text.slice(0, i));
      if (i >= text.length) { clearInterval(timer.current); setTyping(false); }
    }, speed);
    return () => clearInterval(timer.current);
  }, [text, speed]);
  return { displayed, typing };
}

function timeAgo(d) {
  if (!d) return '';
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 0) return 'now'; if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.floor(m / 60)}h`; return `${Math.floor(m / 1440)}d`;
}

/* ── Signal Badge ────────────────────────────── */
const SignalBadge = ({ tier }) => {
  const cls = `tier-badge tier-${(tier || 'NOISE').toLowerCase()}`;
  return <span className={cls}>{tier === 'CRITICAL' ? '🔴 CRITICAL' : tier}</span>;
};

/* ── Dashboard Component ─────────────────────── */
export default function Dashboard() {
  const { user } = useAuth();
  const { setHeadlines, mode } = useContext(AppContext);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedWatch, setExpandedWatch] = useState(false);
  const navigate = useNavigate();
  const fetched = useRef(false);

  const load = useCallback(async (force = false) => {
    if (fetched.current && !force) return;
    fetched.current = true;
    setLoading(true); setError(null);
    try {
      const res = await api.getDashboard([], [], force);
      setData(res);
      if (res.clusters?.length) setHeadlines(res.clusters.map(c => c.thread_title).filter(Boolean));
      else if (res.articles?.length) setHeadlines(res.articles.slice(0, 6).map(a => a.title));
      
      if (res.articles?.length) {
        const txt = JSON.stringify(res.articles.map(a => a.title)).toLowerCase();
        const el = document.querySelector('.app-container');
        if (el) {
          el.className = `app-container ${mode === 'calm' ? 'calm-mode ' : ''}theme-tech`;
        }
      }
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [setHeadlines, mode]);

  useEffect(() => { load(); }, [load]);

  const articles = data?.articles || [];
  const clusters = data?.clusters || [];
  const topSignals = clusters.filter(c => c.signal_tier === 'CRITICAL' || c.signal_tier === 'SIGNAL').slice(0, 3);
  const watchSignals = clusters.filter(c => c.signal_tier === 'WATCH');
  const delta = data?.daily_delta || [];
  const exposure = data?.exposure_score || 50;
  const radar = data?.opportunity_radar || {};
  const queue = data?.monitoring_queue || [];
  const { displayed: briefText, typing } = useTypewriter(data?.daily_brief);

  if (loading && !data) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '70vh', gap: 20 }}>
      <div className="pulse-glow" style={{ width: 16, height: 16, background: 'var(--accent)', borderRadius: '50%' }} />
      <span className="mono" style={{ fontSize: 11, color: 'var(--accent)', letterSpacing: 3 }}>SYNCHRONIZING INTELLIGENCE...</span>
    </div>
  );

  return (
    <div className={`dashboard-grid ${mode === 'calm' ? 'calm-mode' : ''}`}>
      
      {/* ═══════ LEFT PANEL ═══════ */}
      <div className="left-panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="panel fin" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div className="label">COMMAND</div>
            <button onClick={() => load(true)} disabled={loading} className="wire-btn">⟳ REFRESH</button>
          </div>
          {user && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {user.photoURL && <img src={user.photoURL} alt="" style={{ width: 32, height: 32, borderRadius: '50%' }} />}
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{user.displayName}</div>
                <div className="mono" style={{ fontSize: 9, color: 'var(--pos)' }}>● LIVE SESSION</div>
              </div>
            </div>
          )}
        </div>
        
        {data && (
          <div className="panel panel-accent fin fin-d1" style={{ padding: 18 }}>
            <div className="label" style={{ marginBottom: 14 }}>FEED METRICS</div>
            <div className="stat-row"><span className="stat-label">Sources</span><span className="stat-value">{data.sources_count}</span></div>
            <div className="stat-row"><span className="stat-label">Threads</span><span className="stat-value">{clusters.length}</span></div>
          </div>
        )}
      </div>

      {/* ═══════ CENTER FEED ═══════ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        
        {/* Delta Strip */}
        {delta.length > 0 && (
          <div className="delta-strip fin">
            {delta.map((d, i) => (
              <div key={i} className="delta-card">
                <span className="delta-topic">{d.label}</span>
                <span className={`delta-value ${d.delta > 0 ? 'delta-up' : d.delta < 0 ? 'delta-down' : 'delta-flat'}`}>
                  {d.delta > 0 ? '▲+' : d.delta < 0 ? '▼' : '—'}{Math.abs(d.delta)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Exposure Score */}
        <div className="exposure-card fin fin-d1">
          <div>
            <div className="exposure-label">YOUR EXPOSURE</div>
            <div className="exposure-number">{exposure}<span style={{ fontSize: 14, color: 'var(--text-3)' }}>/100</span></div>
          </div>
          <div className="exposure-bar">
            <div className="exposure-fill" style={{ width: `${exposure}%` }} />
          </div>
        </div>

        {/* Ticker */}
        {articles.length > 0 && (
          <div className="ticker-wrap" style={{ borderRadius: 'var(--br)' }}>
            <div className="ticker-tag">LIVE</div>
            <div className="ticker-move">
              {[...articles, ...articles].map((a, i) => (
                <div key={i} className="ticker-item"><span className="ticker-sep">//</span> {a.title.toUpperCase()}</div>
              ))}
            </div>
          </div>
        )}

        {/* Top 3 Signals */}
        <div className="label" style={{ margin: '8px 0 4px' }}>TOP SIGNALS</div>
        {topSignals.length > 0 ? topSignals.map((cluster, i) => (
          <div key={i} className={`signal-card tier-${cluster.signal_tier?.toLowerCase()}-card fin`} style={{ animationDelay: `${i * 0.05}s` }}
               onClick={() => navigate('/story', { state: { article: { title: cluster.thread_title, text: cluster.summary, source: 'Intelligence Synthesis' } } })}>
            <div className="signal-card-header">
              <div style={{ flex: 1 }}>
                <SignalBadge tier={cluster.signal_tier} />
                <h3 style={{ fontSize: 16, marginTop: 8, color: 'var(--text-0)', lineHeight: 1.3 }}>{cluster.thread_title}</h3>
                <p className="signal-impact">{cluster.impact_line || cluster.summary}</p>
              </div>
            </div>
            <div className="signal-card-meta">
              <span className="badge pulse">Pulse: {cluster.pulse_score}</span>
              <span className="badge sources">{cluster.source_count} Sources</span>
              <span className="mono" style={{ fontSize: 9, color: 'var(--text-3)' }}>Exposure: {cluster.exposure_score}</span>
            </div>
          </div>
        )) : <div className="panel" style={{ textAlign: 'center', padding: 30 }}><span className="mono">NO CRITICAL SIGNALS</span></div>}

        {/* Developing (Watch) */}
        {watchSignals.length > 0 && (
          <div className="fin fin-d3" style={{ marginTop: 10 }}>
            <div className="label" style={{ marginBottom: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }} onClick={() => setExpandedWatch(!expandedWatch)}>
              <span>DEVELOPING (WATCH TIER)</span>
              <span>{expandedWatch ? '▼' : '▶'}</span>
            </div>
            {expandedWatch && watchSignals.map((cluster, i) => (
              <div key={i} className="signal-card tier-watch-card" style={{ padding: '12px 16px', marginBottom: 8 }}
                   onClick={() => navigate('/story', { state: { article: { title: cluster.thread_title, text: cluster.summary, source: 'Watch' } } })}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{cluster.thread_title}</span>
                  <SignalBadge tier="WATCH" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Monitoring Queue */}
        {queue.length > 0 && mode !== 'calm' && (
          <div className="panel fin fin-d4" style={{ padding: '16px 0', marginTop: 10 }}>
            <div className="label" style={{ padding: '0 16px', marginBottom: 8 }}>MONITORING QUEUE</div>
            {queue.slice(0, 3).map((q, i) => (
              <div key={i} className="monitoring-item">
                <span className="monitoring-title">{q.thread_title}</span>
                <span className="monitoring-eta">Next eval: 2h</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══════ RIGHT PANEL ═══════ */}
      <div className="right-panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        
        {/* Strategic Brief */}
        <div className="panel panel-accent fin fin-d1" style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', minHeight: 200 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div className="label">STRATEGIC BRIEF</div>
            <span className="mono" style={{ fontSize: 9, color: 'var(--text-3)' }}>AI SYNTHESIS</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {data?.daily_brief ? (
              <div className="typewriter">{briefText}{typing && <span className="typewriter-cursor" />}</div>
            ) : <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>[Awaiting synthesis...]</span>}
          </div>
        </div>

        {/* Opportunity Radar */}
        {(radar.top_risk || radar.top_opportunity) && (
          <div className="radar-split fin fin-d2">
            <div className="radar-half">
              <div className="radar-label risk">TOP RISK</div>
              <div className="radar-text">{radar.top_risk}</div>
            </div>
            <div className="radar-half">
              <div className="radar-label opp">OPPORTUNITY</div>
              <div className="radar-text">{radar.top_opportunity || "Monitoring for counter-signals..."}</div>
            </div>
          </div>
        )}

        {/* Executive Impact */}
        {data?.impact?.headline && (
          <div className="panel fin fin-d3" style={{ padding: 20 }}>
            <div className="label" style={{ marginBottom: 12 }}>EXECUTIVE IMPACT</div>
            <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--text-0)' }}>{data.impact.headline}</p>
            {data.impact.why_it_matters && <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.65 }}>{data.impact.why_it_matters}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
