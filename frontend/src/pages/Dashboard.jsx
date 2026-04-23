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

/* ── Signal Badge ────────────────────────────── */
const SignalBadge = ({ tier }) => {
  const t = (tier || 'NOISE').toUpperCase();
  const cls = `tier-badge tier-${t.toLowerCase()}`;
  const labels = { CRITICAL: '● CRITICAL', SIGNAL: '◆ SIGNAL', WATCH: '○ WATCH', NOISE: '· NOISE' };
  const tips = {
    CRITICAL: 'High urgency — multiple sources, strong sentiment, directly relevant to your interests',
    SIGNAL: 'Notable story — worth paying attention to, moderate urgency',
    WATCH: 'Developing story — not urgent yet, being monitored for changes',
    NOISE: 'Low priority — limited sources or weak relevance to your interests',
  };
  return <span className={cls} title={tips[t] || ''}>{labels[t] || t}</span>;
};

/* ── Exposure Ring (SVG Gauge) ───────────────── */
const ExposureGauge = ({ score }) => {
  const r = 30;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const desc = score >= 70 ? 'Today\'s top stories are highly relevant to your tracked interests.'
    : score >= 40 ? 'Some of today\'s stories match your interests. Others are global signals.'
    : 'Most stories today are outside your tracked topics. Consider adding more interests.';

  return (
    <div className="exposure-gauge fin fin-d1">
      <div className="exposure-ring">
        <svg viewBox="0 0 72 72">
          <circle className="exposure-ring-bg" cx="36" cy="36" r={r} />
          <circle className="exposure-ring-fill" cx="36" cy="36" r={r}
            strokeDasharray={circ} strokeDashoffset={offset}
            style={{ stroke: score >= 70 ? 'var(--accent)' : score >= 40 ? 'var(--warn)' : 'var(--neg)' }}
          />
        </svg>
        <div className="exposure-ring-number">{score}</div>
      </div>
      <div className="exposure-info">
        <div className="exposure-title" title="How closely today's top stories match your selected topics and regions">RELEVANCE TO YOU</div>
        <div className="exposure-desc">{desc}</div>
      </div>
    </div>
  );
};

/* ── Sentiment Sparkline ─────────────────────── */
const SentimentSpark = ({ pos, neu, neg }) => {
  const total = pos + neu + neg || 1;
  return (
    <div style={{ display: 'flex', gap: 2, height: 32, alignItems: 'flex-end', padding: '4px 0' }}>
      {[
        { val: pos, color: 'var(--pos)', icon: '▲' },
        { val: neu, color: 'var(--text-3)', icon: '—' },
        { val: neg, color: 'var(--neg)', icon: '▼' },
      ].map(({ val, color, icon }, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: 3 }}>
          <div style={{ width: '100%', height: `${(val / total) * 100}%`, background: color, minHeight: 2, borderRadius: 2 }} />
          <span className="mono" style={{ fontSize: 8, color }}>{icon}{val}</span>
        </div>
      ))}
    </div>
  );
};

/* ── Tension Index ───────────────────────────── */
const TensionIndex = ({ tension }) => {
  const entries = Object.entries(tension).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!entries.length) return null;
  return (
    <div className="panel panel-accent fin fin-d3" style={{ padding: 20 }}>
      <div className="label" style={{ marginBottom: 14 }}>TENSION INDEX</div>
      {entries.map(([region, score]) => {
        const color = score > 65 ? 'var(--neg)' : score > 35 ? 'var(--warn)' : 'var(--pos)';
        return (
          <div key={region} className="tension-row">
            <span className="tension-name">{region}</span>
            <div className="tension-track">
              <div className="tension-fill" style={{ width: `${score}%`, background: color, color }} />
            </div>
            <span className="tension-score" style={{ color }}>{score}</span>
          </div>
        );
      })}
    </div>
  );
};

/* ── Loading Pipeline ────────────────────────── */
const PIPELINE_STAGES = [
  { key: 'rss', label: 'Connecting to Sources', icon: '📡', desc: 'Google News RSS' },
  { key: 'nlp', label: 'Reading & Analyzing', icon: '🔬', desc: 'AI Entity Detection' },
  { key: 'ai', label: 'Generating Intelligence', icon: '🧠', desc: 'AI Synthesis Engine' },
  { key: 'classify', label: 'Classifying Signals', icon: '⚡', desc: 'Priority Tiering' },
  { key: 'ready', label: 'Preparing Your Feed', icon: '✓', desc: 'Personalized' },
];

const PipelineLoader = () => {
  const [active, setActive] = useState(0);
  useEffect(() => {
    // Step through at 400ms each = 2 seconds total for 5 steps
    const t = setInterval(() => setActive(p => p < PIPELINE_STAGES.length - 1 ? p + 1 : p), 400);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '70vh', gap: 20 }}>
      <div className="pulse-glow" style={{ width: 16, height: 16, background: 'var(--accent)', borderRadius: '50%' }} />
      <span className="mono" style={{ fontSize: 11, color: 'var(--accent)', letterSpacing: 3 }}>BUILDING YOUR INTELLIGENCE FEED</span>
      <div className="pipeline-steps">
        {PIPELINE_STAGES.map((s, i) => (
          <div key={s.key} className={`pipeline-step ${i < active ? 'done' : i === active ? 'active' : 'pending'}`}>
            <div className="pipeline-step-icon">{i < active ? '✓' : i === active ? s.icon : '○'}</div>
            <span className="pipeline-step-label">{s.label}</span>
            <span className="mono" style={{ fontSize: 8, color: 'var(--text-3)' }}>{s.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════ */
export default function Dashboard() {
  const { user } = useAuth();
  const { setHeadlines, mode } = useContext(AppContext);
  const [data, setData] = useState(null);
  const [checkingPrefs, setCheckingPrefs] = useState(true); // Phase 1: quick prefs check
  const [loading, setLoading] = useState(false); // Phase 2: actual pipeline load
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [expandedWatch, setExpandedWatch] = useState(false);
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();
  const fetched = useRef(false);

  // Show toast for X seconds
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  };

  // Apply dynamic theme based on content
  const applyTheme = (res) => {
    if (!res?.articles?.length) return;
    const txt = JSON.stringify(res.articles.map(a => a.title)).toLowerCase();
    const el = document.querySelector('.app-container');
    if (!el) return;
    const calmCls = mode === 'calm' ? ' calm-mode' : '';
    if (txt.match(/market|stock|econom|financ|invest/)) el.className = `app-container theme-markets${calmCls}`;
    else if (txt.match(/trump|china|nato|election|politic|congress|senate/)) el.className = `app-container theme-politics${calmCls}`;
    else if (txt.match(/\bai\b|openai|deepseek|llm|neural|machine learn/)) el.className = `app-container theme-ai${calmCls}`;
    else if (txt.match(/military|war|defense|missile|army|weapon/)) el.className = `app-container theme-defense${calmCls}`;
    else el.className = `app-container theme-tech${calmCls}`;
  };

  // Process a response (update headlines, theme, etc.)
  const processResponse = (res) => {
    if (res.clusters?.length) setHeadlines(res.clusters.map(c => c.thread_title).filter(Boolean));
    else if (res.articles?.length) setHeadlines(res.articles.slice(0, 6).map(a => a.title));
    applyTheme(res);
  };

  // PHASE 1: Quick prefs check — runs instantly, no loading screen
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const prefsRes = await api.getPreferences();
        if (prefsRes.status === 'not_found' || !prefsRes.data?.onboarded) {
          navigate('/onboarding');
          return;
        }
      } catch (e) {
        // Prefs check failed — let them through to dashboard
      }
      setCheckingPrefs(false); // User is onboarded, proceed to Phase 2
    })();
  }, [user, navigate]);

  // PHASE 2: Load dashboard data (only after prefs check passes)
  const load = useCallback(async () => {
    if (fetched.current || checkingPrefs) return;
    fetched.current = true;
    setLoading(true); setError(null);
    try {
      const res = await api.getDashboard([], [], false);  // GET = instant cache
      setData(res);
      processResponse(res);

      if (res.is_stale) {
        showToast('Intelligence is being refreshed in the background...');
      }
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [setHeadlines, mode, checkingPrefs]);

  // MANUAL FORCE REFRESH: POST triggers full pipeline
  const forceRefresh = async () => {
    setRefreshing(true); setError(null);
    try {
      const res = await api.getDashboard([], [], true);  // POST = force
      const oldSignalCount = (data?.clusters || []).filter(c => c.signal_tier === 'CRITICAL' || c.signal_tier === 'SIGNAL').length;
      const newSignalCount = (res.clusters || []).filter(c => c.signal_tier === 'CRITICAL' || c.signal_tier === 'SIGNAL').length;
      setData(res);
      processResponse(res);

      if (newSignalCount > oldSignalCount) {
        showToast(`Feed updated — ${newSignalCount - oldSignalCount} new signal${newSignalCount - oldSignalCount > 1 ? 's' : ''} detected`);
      } else {
        showToast('Intelligence refreshed — feed is current');
      }
    } catch (e) { setError(e.message); }
    setRefreshing(false);
  };

  useEffect(() => { if (!checkingPrefs) load(); }, [checkingPrefs, load]);

  // Live freshness timer — ticks every 30s
  const [liveAge, setLiveAge] = useState(0);
  useEffect(() => {
    if (!data?.cached_at) return;
    const baseAge = data.cache_age_seconds || 0;
    const loadedAt = Date.now();
    setLiveAge(baseAge);
    const t = setInterval(() => {
      const elapsed = Math.floor((Date.now() - loadedAt) / 1000);
      setLiveAge(baseAge + elapsed);
    }, 30000);
    return () => clearInterval(t);
  }, [data?.cached_at]);
  const freshLabel = liveAge < 60 ? 'Just now'
    : liveAge < 3600 ? `${Math.floor(liveAge / 60)}m ago`
    : `${Math.floor(liveAge / 3600)}h ago`;

  const articles = data?.articles || [];
  const clusters = data?.clusters || [];
  // HARD RULE: only top 3 signals ever visible
  const topSignals = clusters.filter(c => c.signal_tier === 'CRITICAL' || c.signal_tier === 'SIGNAL').slice(0, 3);
  const watchSignals = clusters.filter(c => c.signal_tier === 'WATCH');
  const delta = data?.daily_delta || [];
  const exposure = data?.exposure_score ?? null;
  const radar = data?.opportunity_radar || {};
  const tension = data?.tension_index || {};
  const impact = data?.impact || {};
  const queue = data?.monitoring_queue || [];
  const { displayed: briefText, typing } = useTypewriter(data?.daily_brief);

  // Sentiment counts
  const posC = articles.filter(a => a.sentiment?.label === 'POSITIVE').length;
  const negC = articles.filter(a => a.sentiment?.label === 'NEGATIVE').length;
  const neuC = articles.length - posC - negC;
  const entCount = articles.reduce((s, a) => s + (a.entities?.length || 0), 0);

  /* ── Phase 1: Checking if user is onboarded (blank, instant) ── */
  if (checkingPrefs) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '70vh' }}>
      <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: 2 }}>CHECKING SESSION...</span>
    </div>
  );

  /* ── Phase 2: Loading pipeline (only after prefs confirmed) ── */
  if (loading && !data) return <PipelineLoader />;

  return (
    <div className="dashboard-grid">

      {/* ── Toast notification ─── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--accent-dim)', border: '1px solid var(--accent-border)',
          borderRadius: 'var(--br-lg)', padding: '10px 24px', zIndex: 9999,
          fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)',
          letterSpacing: 0.5, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          animation: 'fadeIn 0.3s var(--ease)',
        }}>
          {toast}
        </div>
      )}

      {/* ═══════ LEFT PANEL ═══════ */}
      <div className="left-panel" style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', paddingBottom: 20 }}>

        <div className="panel fin" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div className="label">COMMAND</div>
            <button onClick={forceRefresh} disabled={refreshing || loading} className="wire-btn">
              {refreshing ? '⟳ SYNCING...' : '⟳ REFRESH'}
            </button>
          </div>
          {/* Freshness badge */}
          {data && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span className="mono" style={{ fontSize: 9, color: data?.is_stale ? 'var(--warn)' : 'var(--pos)', letterSpacing: 0.5 }}>
                ● Updated {freshLabel}
              </span>
            </div>
          )}
          {user && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {user.photoURL && <img src={user.photoURL} alt="" style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--accent-border)' }} />}
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{user.displayName}</div>
                <div className="mono" style={{ fontSize: 9, color: 'var(--pos)', letterSpacing: 1 }}>● LIVE SESSION</div>
              </div>
            </div>
          )}
        </div>

        {data && (
          <div className="panel panel-accent fin fin-d1" style={{ padding: 18 }}>
            <div className="label" style={{ marginBottom: 14 }}>FEED METRICS</div>
            <div className="stat-row"><span className="stat-label">Sources Ingested</span><span className="stat-value">{data.sources_count || articles.length}</span></div>
            <div className="stat-row"><span className="stat-label">Stories Found</span><span className="stat-value">{clusters.length}</span></div>
            <div className="stat-row"><span className="stat-label">Entities Detected</span><span className="stat-value">{entCount}</span></div>
            <div className="stat-row"><span className="stat-label">Signal / Watch / Noise</span>
              <span className="stat-value-sm" style={{ color: 'var(--text-1)' }}>
                {topSignals.length} / {watchSignals.length} / {clusters.length - topSignals.length - watchSignals.length}
              </span>
            </div>
            <div className="section-line" />
            <div className="label" style={{ marginBottom: 8, marginTop: 4, fontSize: 9, color: 'var(--text-3)' }}>SENTIMENT DISTRIBUTION</div>
            <SentimentSpark pos={posC} neu={neuC} neg={negC} />
          </div>
        )}

        <TensionIndex tension={tension} />

        {data && (
          <div className="panel fin fin-d4" style={{ padding: 16 }}>
            <div className="label" style={{ marginBottom: 10, fontSize: 9 }}>PIPELINE</div>
            <div style={{ display: 'grid', gap: 5 }}>
              {[
                ['AI', 'OpenRouter → Gemini'],
                ['NLP', 'HuggingFace (free)'],
                ['NEWS', 'Google RSS'],
                ['TIER', 'Deterministic'],
                ['GEN', data.generated_at ? new Date(data.generated_at).toLocaleTimeString() : '—'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="mono" style={{ fontSize: 9, color: 'var(--text-3)', letterSpacing: 1 }}>{k}</span>
                  <span className="mono" style={{ fontSize: 9, color: 'var(--text-2)' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══════ CENTER FEED ═══════ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', paddingBottom: 20 }}>

        {/* Daily Delta — shows how your tracked topics changed today */}
        {delta.length > 0 && (
          <div className="delta-tape fin" title="Daily Delta — how your tracked topics shifted in the last 24 hours">
            {delta.map((d, i) => (
              <div key={i} className={`delta-cell ${d.delta > 0 ? 'delta-up-cell' : d.delta < 0 ? 'delta-down-cell' : 'delta-flat-cell'}`}>
                <span className="delta-cell-topic">{d.label}</span>
                <span className={`delta-cell-value ${d.delta > 0 ? 'delta-up' : d.delta < 0 ? 'delta-down' : 'delta-flat'}`}>
                  {d.delta > 0 ? '▲+' : d.delta < 0 ? '▼' : '—'}{d.delta !== 0 ? Math.abs(d.delta) : ''}
                </span>
                <span className="delta-cell-pulse">Pulse {d.current}</span>
              </div>
            ))}
          </div>
        )}

        {/* Relevance Gauge */}
        {exposure !== null && <ExposureGauge score={exposure} />}

        {/* Live Headlines */}
        {articles.length > 0 && (
          <div className="ticker-wrap" style={{ borderRadius: 'var(--br)', marginTop: 4 }}>
            <div className="ticker-tag">LIVE</div>
            <div className="ticker-move">
              {[...articles, ...articles].map((a, i) => (
                <div key={i} className="ticker-item"><span className="ticker-sep">//</span> {a.title.toUpperCase()}</div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="panel" style={{ borderColor: 'var(--neg)', padding: 24 }}>
            <div className="label" style={{ color: 'var(--neg)', marginBottom: 8 }}>PIPELINE ERROR</div>
            <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14 }}>{error}</p>
            <button onClick={forceRefresh} className="wire-btn">RETRY</button>
          </div>
        )}

        {/* Top Stories */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0' }}>
          <div className="label">
            TOP STORIES
            <span className="mono" style={{ fontSize: 9, color: 'var(--text-3)', marginLeft: 10, fontWeight: 400 }}>
              {topSignals.length} of {clusters.length} stories surfaced
            </span>
          </div>
          {/* Signal Legend */}
          <div className="signal-legend">
            <div className="signal-legend-item" title="High urgency — requires immediate attention"><span className="signal-legend-dot critical" /> Critical</div>
            <div className="signal-legend-item" title="Notable — worth watching closely"><span className="signal-legend-dot signal" /> Signal</div>
            <div className="signal-legend-item" title="Developing — not urgent, being monitored"><span className="signal-legend-dot watch" /> Watch</div>
          </div>
        </div>

        {topSignals.length > 0 ? topSignals.map((cluster, i) => (
          <div key={i}
            className={`signal-card tier-${cluster.signal_tier?.toLowerCase()}-card fin`}
            style={{ animationDelay: `${i * 0.06}s` }}
            onClick={() => navigate('/story', { state: { article: { title: cluster.thread_title, text: cluster.summary, text_preview: cluster.summary, source: 'Intelligence Synthesis', exposure_score: cluster.exposure_score } } })}
          >
            <div className="signal-card-header">
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="mono" style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-3)', width: 18 }}>#{i + 1}</span>
                  <SignalBadge tier={cluster.signal_tier} />
                </div>
                <h3 style={{ fontSize: 16, marginTop: 8, color: 'var(--text-0)', lineHeight: 1.35, letterSpacing: '-0.01em' }}>
                  {cluster.thread_title}
                </h3>
                <p className="signal-impact">{cluster.impact_line || cluster.summary}</p>
                {cluster.why_it_matters && (
                  <p style={{ fontSize: 11, color: 'var(--accent)', marginTop: 6, fontStyle: 'italic', lineHeight: 1.5 }}>
                    Why it matters: {cluster.why_it_matters}
                  </p>
                )}
              </div>
            </div>
            <div className="signal-card-meta">
              <span className="badge pulse" title="Pulse Score — urgency level from 0-100 based on volume, sentiment, and source diversity">⚡ {cluster.pulse_score}</span>
              <span className="badge sources" title="Number of independent news sources reporting on this story">{cluster.source_count} sources</span>
              {cluster.risk_type === 'risk' && <span className="badge neg" style={{ fontSize: 8 }} title="This story signals a potential risk to your tracked interests">⚠ Risk</span>}
              {cluster.risk_type === 'opportunity' && <span className="badge pos" style={{ fontSize: 8 }} title="This story signals a potential opportunity in your tracked areas">▲ Opportunity</span>}
            </div>
          </div>
        )) : !loading ? (
          <div className="panel" style={{ textAlign: 'center', padding: 40 }}>
            <span className="mono" style={{ color: 'var(--text-3)', letterSpacing: 2, fontSize: 11 }}>NO CRITICAL STORIES DETECTED</span>
          </div>
        ) : null}

        {/* Developing (Watch Tier — collapsed by default) */}
        {watchSignals.length > 0 && (
          <div className="fin fin-d3" style={{ marginTop: 4 }}>
            <div className="label"
              style={{ marginBottom: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}
              onClick={() => setExpandedWatch(!expandedWatch)}
            >
              <span>DEVELOPING · {watchSignals.length} stories being monitored</span>
              <span style={{ fontSize: 14, color: 'var(--text-3)', transition: 'transform 0.3s', transform: expandedWatch ? 'rotate(90deg)' : 'none', display: 'inline-block' }}>▸</span>
            </div>
            {expandedWatch && watchSignals.map((cluster, i) => (
              <div key={i} className="signal-card tier-watch-card" style={{ padding: '12px 16px', marginBottom: 6 }}
                onClick={() => navigate('/story', { state: { article: { title: cluster.thread_title, text: cluster.summary, text_preview: cluster.summary, source: 'Watch' } } })}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', flex: 1 }}>{cluster.thread_title}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, marginLeft: 12 }}>
                    <span className="badge pulse" style={{ fontSize: 8 }}>⚡ {cluster.pulse_score}</span>
                    <SignalBadge tier="WATCH" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Monitoring Queue */}
        {queue.length > 0 && mode !== 'calm' && (
          <div className="panel fin fin-d4" style={{ padding: '16px 0', marginTop: 6 }}>
            <div className="label" style={{ padding: '0 16px', marginBottom: 10 }}>
              MONITORING QUEUE
              <span className="mono" style={{ fontSize: 9, color: 'var(--text-3)', marginLeft: 8, fontWeight: 400 }}>
                Next assessment ~2h
              </span>
            </div>
            {queue.slice(0, 4).map((q, i) => (
              <div key={i} className="monitoring-item">
                <span className="monitoring-title">{q.thread_title}</span>
                <span className="mono" style={{ fontSize: 9, color: 'var(--text-3)', marginRight: 8 }}>Pulse {q.pulse_score}</span>
                <span className="monitoring-eta">{q.source_count} sources</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══════ RIGHT PANEL ═══════ */}
      <div className="right-panel" style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', paddingBottom: 20 }}>

        <div className="panel panel-accent fin fin-d1" style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', minHeight: 200 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div className="label">STRATEGIC BRIEF</div>
            <span className="mono" style={{ fontSize: 9, color: 'var(--text-3)' }}>AI SYNTHESIS</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {data?.daily_brief ? (
              <div className="typewriter">{briefText}{typing && <span className="typewriter-cursor" />}</div>
            ) : (
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>[Awaiting AI synthesis...]</span>
            )}
          </div>
        </div>

        {(radar.top_risk || radar.top_opportunity) && (
          <div className="radar-split fin fin-d2">
            <div className="radar-half">
              <div className="radar-label risk">▼ TOP RISK</div>
              <div className="radar-text">{radar.top_risk || 'No significant risks detected.'}</div>
            </div>
            <div className="radar-half">
              <div className="radar-label opp">▲ OPPORTUNITY</div>
              <div className="radar-text">{radar.top_opportunity || 'Monitoring for counter-signals...'}</div>
            </div>
          </div>
        )}

        {impact?.headline && (
          <div className="panel fin fin-d2" style={{ padding: 20 }}>
            <div className="label" style={{ marginBottom: 12 }}>EXECUTIVE IMPACT</div>
            <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, lineHeight: 1.4, color: 'var(--text-0)' }}>{impact.headline}</p>
            {impact.why_it_matters && (
              <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.65, marginBottom: 12 }}>{typeof impact.why_it_matters === 'string' ? impact.why_it_matters.slice(0, 300) : ''}{impact.why_it_matters?.length > 300 ? '...' : ''}</p>
            )}
            {impact.actions?.length > 0 && (
              <>
                <div className="section-line" />
                <div className="label" style={{ marginBottom: 8, fontSize: 9, color: 'var(--text-3)' }}>RECOMMENDED ACTIONS</div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {impact.actions.map((a, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <span style={{ color: 'var(--accent)', fontSize: 12, marginTop: 1, fontWeight: 700 }}>→</span>
                      <span style={{ fontSize: 11, color: 'var(--text-1)', lineHeight: 1.55 }}>{a}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {articles.length > 0 && (() => {
          const ents = {};
          articles.forEach(a => (a.entities || []).forEach(e => {
            const k = e.name; ents[k] = (ents[k] || 0) + 1;
          }));
          const top = Object.entries(ents).sort((a, b) => b[1] - a[1]).slice(0, 12);
          if (!top.length) return null;
          return (
            <div className="panel fin fin-d3" style={{ padding: 20 }}>
              <div className="label" style={{ marginBottom: 12 }}>KEY ENTITIES</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {top.map(([name, cnt]) => (
                  <span key={name} style={{
                    padding: '4px 10px', fontSize: 10, fontFamily: 'var(--mono)',
                    background: cnt > 2 ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                    border: `1px solid ${cnt > 2 ? 'var(--accent-border)' : 'rgba(255,255,255,0.05)'}`,
                    borderRadius: 'var(--br)', color: cnt > 2 ? 'var(--accent)' : 'var(--text-2)',
                    display: 'inline-flex', gap: 5, alignItems: 'center',
                  }}>
                    {name}
                    {cnt > 1 && <span style={{ fontSize: 8, opacity: 0.5 }}>×{cnt}</span>}
                  </span>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
