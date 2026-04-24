import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { AppContext } from '../App';
import { useAuth } from '../context/AuthContext';

const TOPIC_LABELS = {
  tech: 'Technology',
  politics: 'Geopolitics',
  markets: 'Markets',
  ai: 'AI',
  climate: 'Climate',
  healthcare: 'Healthcare',
  defense: 'Defense',
  crypto: 'Crypto',
  space: 'Space',
  trade: 'Trade',
  auto: 'Automotive',
  telecom: 'Telecom',
  'real-estate': 'Real Estate',
  media: 'Media',
  education: 'Education',
  legal: 'Legal',
};

const THEME_VARIANTS = {
  tech: ['theme-tech', 'theme-cyber', 'theme-aurora'],
  markets: ['theme-markets', 'theme-emerald', 'theme-gold'],
  politics: ['theme-politics', 'theme-copper', 'theme-civic'],
  ai: ['theme-ai', 'theme-violet', 'theme-neon'],
  defense: ['theme-defense', 'theme-crimson', 'theme-steel'],
};

const PIPELINE_STAGES = [
  ['rss', 'Sources'],
  ['nlp', 'Entities'],
  ['ai', 'Synthesis'],
  ['classify', 'Signals'],
  ['ready', 'Ready'],
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const storeKey = (uid, name) => `ni_${uid || 'local'}_${name}`;

function readStore(uid) {
  const fallback = { saved: [], watched: [], dismissed: [], trackedEntities: [], topicWeights: {}, opened: {} };
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(storeKey(uid, 'signal_state')) || '{}') };
  } catch {
    return fallback;
  }
}

function writeStore(uid, state) {
  localStorage.setItem(storeKey(uid, 'signal_state'), JSON.stringify(state));
}

function signalId(cluster) {
  return (cluster.thread_title || cluster.summary || 'signal').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80);
}

function getOpenThemeVariant(category) {
  const spin = Number(localStorage.getItem('ni_theme_spin') || '0');
  const variants = THEME_VARIANTS[category] || THEME_VARIANTS.tech;
  return variants[spin % variants.length];
}

function words(text, max = 12) {
  const parts = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  return parts.length > max ? `${parts.slice(0, max).join(' ')}...` : parts.join(' ');
}

function splitBrief(text) {
  return String(text || '')
    .split(/(?<=[.!?])\s+/)
    .map(s => words(s, 12))
    .filter(Boolean)
    .slice(0, 3);
}

function preferenceLabels(cluster) {
  return (cluster.matched_preferences || [])
    .map(m => m.label || TOPIC_LABELS[m.id] || m.id)
    .filter(Boolean);
}

function topicIds(cluster, fallbackTopics = []) {
  const matches = (cluster.matched_preferences || []).map(m => m.id).filter(Boolean);
  if (matches.length) return matches;
  const text = `${cluster.thread_title || ''} ${cluster.summary || ''}`.toLowerCase();
  return fallbackTopics.filter(t => text.includes(t));
}

function tierClass(tier) {
  return `tier-badge tier-${(tier || 'noise').toLowerCase()}`;
}

function miniTrend(score = 50, salt = 1) {
  return Array.from({ length: 9 }, (_, i) => {
    const wave = Math.sin((i + salt) * 1.2) * 12;
    return Math.max(12, Math.min(98, score - 16 + i * 3 + wave));
  });
}

function buildEntities(cluster, articles) {
  const ids = new Set((cluster.article_ids || []).map(String));
  const counts = {};
  articles.forEach(article => {
    if (!ids.size || ids.has(String(article.id))) {
      (article.entities || []).forEach(entity => {
        if (!entity.name) return;
        counts[entity.name] = (counts[entity.name] || 0) + 1;
      });
    }
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name]) => name);
}

function buildGraph(cluster) {
  const title = words(cluster.thread_title, 4) || 'Event';
  const impact = words(cluster.impact_line || cluster.summary, 5) || 'Market shift';
  const risk = cluster.risk_type === 'risk' ? 'Risk pressure rises' : cluster.risk_type === 'opportunity' ? 'Opportunity opens' : 'Signal moves';
  const exposure = cluster.exposure_score >= 70 ? 'Your exposure increases' : cluster.exposure_score >= 40 ? 'Your exposure changes' : 'Low personal exposure';
  return [title, impact, risk, exposure];
}

function MetricInfoButton({ type, onOpen }) {
  return (
    <button className="metric-info-btn" onClick={() => onOpen(type)} title="Explain this metric">
      i
    </button>
  );
}

function MiniRing({ value = 50, label, onClick }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <button className="mini-ring" onClick={onClick} title={`Explain ${label}`}>
      <span style={{ background: `conic-gradient(var(--accent) ${pct * 3.6}deg, rgba(255,255,255,0.08) 0deg)` }}>
        <b>{Math.round(pct)}</b>
      </span>
      <em>{label}</em>
    </button>
  );
}

function Sparkline({ values }) {
  const points = values.map((v, i) => `${(i / Math.max(values.length - 1, 1)) * 100},${100 - v}`).join(' ');
  return (
    <svg className="mini-spark" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} />
    </svg>
  );
}

function PipelineLoader() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActive(p => Math.min(PIPELINE_STAGES.length - 1, p + 1)), 520);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="phase5-loader">
      <div className="pulse-glow loader-dot" />
      <span className="mono">BUILDING SIGNAL FEED</span>
      <div className="phase5-pipeline">
        {PIPELINE_STAGES.map(([key, label], i) => (
          <div key={key} className={i < active ? 'done' : i === active ? 'active' : ''}>{label}</div>
        ))}
      </div>
    </div>
  );
}

function ExplainDrawer({ metric, cluster, onClose }) {
  if (!metric) return null;
  const pulse = Math.round(cluster?.pulse_score || 85);
  const exposure = Math.round(cluster?.exposure_score || 84);
  const content = {
    delta: {
      title: 'Daily Delta',
      intro: 'Topic movement versus the previous 24h baseline.',
      formula: 'Delta = Current Pulse - Previous Pulse',
      rows: ['Source volume changes', 'Sentiment shifts', 'Topic velocity spikes', 'Entity frequency changes'],
    },
    pulse: {
      title: `Pulse Score (${pulse}/100)`,
      intro: 'Intensity and significance of this signal.',
      formula: '30% velocity + 25% sources + 20% sentiment + 15% entities + 10% relevance',
      rows: ['Source activity +22', 'Sentiment intensity +18', 'Velocity spike +25', 'Entity relevance +12', 'User relevance +8'],
    },
    exposure: {
      title: `Exposure Score (${exposure}/100)`,
      intro: 'How much this signal may affect your tracked intelligence profile.',
      formula: 'Topics + entities + regions + interaction history',
      rows: ['Topic match +25', 'Region overlap +20', 'Tracked entity +18', 'Past engagement +9'],
    },
    tier: {
      title: 'Signal Tier',
      intro: 'Priority label for how quickly the story deserves attention.',
      formula: '80-100 Critical | 60-79 Signal | 40-59 Watch | Below 40 Noise',
      rows: ['Critical: immediate attention', 'Signal: meaningful shift', 'Watch: developing', 'Noise: low importance'],
    },
    relevant: {
      title: 'Why Relevant?',
      intro: 'This signal matched your personal intelligence profile.',
      formula: `Exposure = ${exposure}`,
      rows: [
        ...(preferenceLabels(cluster || {}).length ? preferenceLabels(cluster).map(x => `Tracked topic: ${x}`) : ['Topic overlap detected']),
        `Source count: ${cluster?.source_count || 1}`,
        `Pulse: ${pulse}`,
      ],
    },
  }[metric];

  return (
    <aside className="explain-drawer">
      <button className="drawer-close" onClick={onClose}>Close</button>
      <div className="label">EXPLAINABILITY</div>
      <h2>{content.title}</h2>
      <p>{content.intro}</p>
      <div className="formula-box">{content.formula}</div>
      {metric === 'pulse' && (
        <div className="weighted-bars">
          {[30, 25, 20, 15, 10].map((v, i) => <span key={i} style={{ width: `${v * 2}%` }}>{v}%</span>)}
        </div>
      )}
      <div className="explain-list">
        {content.rows.map(row => <span key={row}>{row}</span>)}
      </div>
    </aside>
  );
}

function StoryGraph({ cluster, onClose }) {
  if (!cluster) return null;
  return (
    <aside className="graph-drawer">
      <button className="drawer-close" onClick={onClose}>Close</button>
      <div className="label">STORY GRAPH</div>
      <h2>{words(cluster.thread_title, 8)}</h2>
      <div className="causal-chain">
        {buildGraph(cluster).map((node, i) => (
          <React.Fragment key={node}>
            <div className="causal-node">
              <span>{i + 1}</span>
              <b>{node}</b>
            </div>
            {i < 3 && <div className="causal-arrow">down</div>}
          </React.Fragment>
        ))}
      </div>
      <button className="btn btn-primary" onClick={onClose}>Use Signal</button>
    </aside>
  );
}

function SignalCard({ cluster, index, entities, isSaved, isWatched, onAction, onExplain, onGraph, onDeepDive }) {
  const labels = preferenceLabels(cluster);
  const pulse = Math.round(cluster.pulse_score || 50);
  const exposure = Math.round(cluster.exposure_score || 50);
  const isNew = Date.now() - new Date(cluster.updated_at || Date.now()).getTime() < 1000 * 60 * 90;

  return (
    <article className={`phase5-signal-card tier-${(cluster.signal_tier || 'signal').toLowerCase()}-card`}>
      <div className="signal-topline">
        <span className={tierClass(cluster.signal_tier)} onClick={() => onExplain('tier', cluster)}>{cluster.signal_tier || 'SIGNAL'}</span>
        {isNew && <span className="new-badge">NEW</span>}
        <span className="velocity-pill">{pulse >= 80 ? 'Fast' : pulse >= 55 ? 'Moving' : 'Slow'}</span>
      </div>

      <h3>{cluster.thread_title}</h3>
      <p>{words(cluster.impact_line || cluster.summary || cluster.why_it_matters, 12)}</p>

      <div className="visual-metrics">
        <button className="metric-chip" onClick={() => onExplain('pulse', cluster)}>
          <span>Pulse</span><b>{pulse}</b>
        </button>
        <MiniRing value={exposure} label="Exposure" onClick={() => onExplain('exposure', cluster)} />
        <Sparkline values={miniTrend(pulse, index + 1)} />
      </div>

      <div className="entity-strip">
        {entities.slice(0, 3).map(entity => (
          <button key={entity} onClick={() => onAction('trackEntity', cluster, entity)}>{entity}</button>
        ))}
        {!entities.length && labels.slice(0, 2).map(label => <span key={label}>{label}</span>)}
      </div>

      <div className="signal-actions">
        <button onClick={() => onAction('watch', cluster)}>{isWatched ? 'Watching' : 'Track'}</button>
        <button onClick={() => onAction('save', cluster)}>{isSaved ? 'Saved' : 'Save'}</button>
        <button onClick={() => onExplain('relevant', cluster)}>Explain</button>
        <button onClick={() => onGraph(cluster)}>Graph</button>
        <button onClick={() => onAction('dismiss', cluster)}>Dismiss</button>
        <button onClick={() => onDeepDive(cluster)}>Deep Analysis</button>
      </div>
    </article>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { setHeadlines, mode } = useContext(AppContext);
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [checkingPrefs, setCheckingPrefs] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [signalState, setSignalState] = useState(() => readStore(user?.uid));
  const [explain, setExplain] = useState(null);
  const [graphSignal, setGraphSignal] = useState(null);
  const dataRef = useRef(null);
  const fetched = useRef(false);

  useEffect(() => {
    setSignalState(readStore(user?.uid));
  }, [user?.uid]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }, []);

  const applyTheme = useCallback((res) => {
    const txt = JSON.stringify(res?.articles?.map(a => a.title) || []).toLowerCase();
    const el = document.querySelector('.app-container');
    if (!el) return;
    let category = 'tech';
    if (txt.match(/market|stock|econom|financ|invest/)) category = 'markets';
    else if (txt.match(/trump|china|nato|election|politic|congress|senate/)) category = 'politics';
    else if (txt.match(/\bai\b|openai|deepseek|llm|neural|machine learn/)) category = 'ai';
    else if (txt.match(/military|war|defense|missile|army|weapon/)) category = 'defense';
    el.className = `app-container ${getOpenThemeVariant(category)}${mode === 'calm' ? ' calm-mode' : ''}`;
  }, [mode]);

  const processResponse = useCallback((res) => {
    if (res?.clusters?.length) setHeadlines(res.clusters.map(c => c.thread_title).filter(Boolean));
    else if (res?.articles?.length) setHeadlines(res.articles.slice(0, 6).map(a => a.title));
    applyTheme(res);
  }, [applyTheme, setHeadlines]);

  const syncCachedDashboard = useCallback(async () => {
    const res = await api.getCachedDashboard();
    dataRef.current = res;
    setData(res);
    processResponse(res);
    return res;
  }, [processResponse]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const prefsRes = await api.getPreferences();
        if (prefsRes.status === 'not_found' || !prefsRes.data?.onboarded) {
          navigate('/onboarding');
          return;
        }
      } catch {
        // Let dashboard handle API errors instead of trapping the user.
      }
      setCheckingPrefs(false);
    })();
  }, [user, navigate]);

  const load = useCallback(async () => {
    if (fetched.current || checkingPrefs) return;
    fetched.current = true;
    setLoading(true);
    setError(null);
    try {
      const [res] = await Promise.all([syncCachedDashboard(), sleep(3200)]);
      if (res?.is_stale) showToast('Refreshing in the background');
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [checkingPrefs, showToast, syncCachedDashboard]);

  useEffect(() => { if (!checkingPrefs) load(); }, [checkingPrefs, load]);

  useEffect(() => {
    if (checkingPrefs || !data) return undefined;
    const id = setInterval(() => syncCachedDashboard().catch(() => {}), data.refresh_in_progress || data.is_stale ? 20000 : 120000);
    return () => clearInterval(id);
  }, [checkingPrefs, data, syncCachedDashboard]);

  const forceRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await api.forceDashboardRefresh([], []);
      dataRef.current = res;
      setData(res);
      processResponse(res);
      showToast('Signals refreshed');
    } catch (e) {
      setError(e.message);
    }
    setRefreshing(false);
  };

  const updateInteraction = (type, cluster, entity) => {
    const id = signalId(cluster);
    const topics = topicIds(cluster, data?.topics_used || []);
    setSignalState(prev => {
      const next = {
        ...prev,
        saved: [...(prev.saved || [])],
        watched: [...(prev.watched || [])],
        dismissed: [...(prev.dismissed || [])],
        trackedEntities: [...(prev.trackedEntities || [])],
        topicWeights: { ...(prev.topicWeights || {}) },
        opened: { ...(prev.opened || {}) },
      };
      const bump = type === 'dismiss' ? -2 : type === 'open' ? 1 : 2;
      topics.forEach(topic => { next.topicWeights[topic] = (next.topicWeights[topic] || 0) + bump; });
      if (type === 'save' && !next.saved.includes(id)) next.saved.push(id);
      if (type === 'watch' && !next.watched.includes(id)) next.watched.push(id);
      if (type === 'dismiss' && !next.dismissed.includes(id)) next.dismissed.push(id);
      if (type === 'trackEntity' && entity && !next.trackedEntities.includes(entity)) next.trackedEntities.push(entity);
      if (type === 'open') next.opened[id] = (next.opened[id] || 0) + 1;
      writeStore(user?.uid, next);
      return next;
    });
    const labels = { save: 'Signal saved', watch: 'Signal watched', dismiss: 'Noise dismissed', trackEntity: `${entity} tracked`, open: 'Learning from click' };
    showToast(labels[type] || 'Updated');
  };

  const openDeepDive = (cluster) => {
    updateInteraction('open', cluster);
    navigate('/story', {
      state: {
        article: {
          title: cluster.thread_title,
          text: cluster.summary,
          text_preview: cluster.summary,
          source: 'Intelligence Synthesis',
          exposure_score: cluster.exposure_score,
        },
      },
    });
  };

  const articles = data?.articles || [];
  const clusters = data?.clusters || [];
  const activeTopics = data?.topics_used || [];
  const activeRegions = data?.regions_used || [];
  const delta = data?.daily_delta || [];
  const pipeline = data?.pipeline_status || {};
  const radar = data?.opportunity_radar || {};
  const impact = data?.impact || {};
  const dismissed = new Set(signalState.dismissed || []);
  const saved = new Set(signalState.saved || []);
  const watched = new Set(signalState.watched || []);
  const entityMoves = (signalState.trackedEntities || []).filter(entity =>
    articles.some(article => (article.entities || []).some(e => e.name === entity))
  );

  const rankedSignals = useMemo(() => {
    const tierScore = { CRITICAL: 400, SIGNAL: 300, WATCH: 200, NOISE: 0 };
    return clusters
      .filter(c => !dismissed.has(signalId(c)))
      .map(c => {
        const topicBoost = topicIds(c, activeTopics).reduce((sum, topic) => sum + (signalState.topicWeights?.[topic] || 0), 0);
        return { ...c, _rank: (tierScore[c.signal_tier] || 0) + (c.pulse_score || 0) + (c.exposure_score || 0) + topicBoost * 6 };
      })
      .sort((a, b) => b._rank - a._rank)
      .slice(0, 6);
  }, [activeTopics, clusters, dismissed, signalState.topicWeights]);

  const topEntities = useMemo(() => {
    const counts = {};
    articles.forEach(article => (article.entities || []).forEach(e => {
      if (e.name) counts[e.name] = (counts[e.name] || 0) + 1;
    }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [articles]);

  if (checkingPrefs) return <div className="phase5-loader"><span className="mono">CHECKING SESSION</span></div>;
  if (loading && !data) return <PipelineLoader />;

  return (
    <div className="phase5-shell">
      {toast && <div className="phase5-toast">{toast}</div>}
      <ExplainDrawer metric={explain?.type} cluster={explain?.cluster} onClose={() => setExplain(null)} />
      <StoryGraph cluster={graphSignal} onClose={() => setGraphSignal(null)} />

      <aside className="phase5-left">
        <div className="panel command-card">
          <div className="label">COMMAND</div>
          <button className="wire-btn" onClick={forceRefresh} disabled={refreshing}>{refreshing ? 'Syncing' : 'Refresh'}</button>
          <div className="session-user">
            {user?.photoURL && <img src={user.photoURL} alt="" />}
            <div>
              <b>{user?.displayName || 'Operator'}</b>
              <span>Live session</span>
            </div>
          </div>
        </div>

        <div className="panel exposure-network">
          <div className="label">YOUR EXPOSURE NETWORK</div>
          <div className="network-score">{Math.round(data?.exposure_score || 50)}</div>
          <div className="network-chain">
            {(activeTopics.slice(0, 2).length ? activeTopics.slice(0, 2) : ['tech']).map(topic => (
              <span key={topic}>{TOPIC_LABELS[topic] || topic}</span>
            ))}
            {topEntities.slice(0, 2).map(([name]) => <span key={name}>{name}</span>)}
          </div>
          <small>{entityMoves.length || 0} tracked entities moved today</small>
        </div>

        <div className="panel profile-chip-panel">
          <div className="label">PROFILE</div>
          <div>
            {activeTopics.map(topic => <span key={topic}>{TOPIC_LABELS[topic] || topic}</span>)}
            {activeRegions.map(region => <span key={region}>{region}</span>)}
          </div>
        </div>
      </aside>

      <main className="phase5-main">
        <section className="hero-strip">
          <div>
            <span className="label">GEN-Z SIGNAL MODE</span>
            <h1>Top signals in 10 seconds.</h1>
          </div>
          <div className="signal-legend">
            {['Critical', 'Signal', 'Watch'].map(item => (
              <button key={item} className="signal-legend-item" onClick={() => setExplain({ type: 'tier' })}>
                <span className={`signal-legend-dot ${item.toLowerCase()}`} /> {item}
              </button>
            ))}
          </div>
        </section>

        {delta.length > 0 && (
          <section className="delta-tape phase5-delta" onClick={() => setExplain({ type: 'delta' })}>
            {delta.map(d => (
              <div key={d.topic} className={`delta-cell ${d.delta > 0 ? 'delta-up-cell' : d.delta < 0 ? 'delta-down-cell' : 'delta-flat-cell'}`}>
                <span className="delta-cell-topic">{d.label}</span>
                <span className={`delta-cell-value ${d.delta > 0 ? 'delta-up' : d.delta < 0 ? 'delta-down' : 'delta-flat'}`}>
                  {d.has_baseline ? `${d.delta > 0 ? '+' : ''}${d.delta}` : 'Base'}
                </span>
                <span className="delta-cell-pulse">{d.has_baseline ? `Pulse ${d.current}` : 'Baseline building'}</span>
              </div>
            ))}
          </section>
        )}

        {error && (
          <div className="panel phase5-error">
            <div className="label">PIPELINE ERROR</div>
            <p>{error}</p>
            <button className="wire-btn" onClick={forceRefresh}>Retry</button>
          </div>
        )}

        <section className="signal-stack">
          {rankedSignals.length ? rankedSignals.map((cluster, i) => {
            const id = signalId(cluster);
            return (
              <SignalCard
                key={id}
                cluster={cluster}
                index={i}
                entities={buildEntities(cluster, articles)}
                isSaved={saved.has(id)}
                isWatched={watched.has(id)}
                onAction={updateInteraction}
                onExplain={(type, c) => setExplain({ type, cluster: c })}
                onGraph={setGraphSignal}
                onDeepDive={openDeepDive}
              />
            );
          }) : (
            <div className="panel empty-signal">No priority signals detected.</div>
          )}
        </section>
      </main>

      <aside className="phase5-right">
        <div className="panel brief-chips">
          <div className="label">STRATEGIC BRIEF</div>
          {(splitBrief(data?.daily_brief).length ? splitBrief(data?.daily_brief) : ['Signals are still forming', 'Watchlist is learning', 'Refresh for live scan']).map(item => (
            <span key={item}>{item}</span>
          ))}
        </div>

        {(radar.top_risk || radar.top_opportunity) && (
          <div className="mini-risk-grid">
            <div className="risk-tile">
              <span>Risk</span>
              <b>{words(radar.top_risk || 'No major risk', 8)}</b>
            </div>
            <div className="risk-tile opportunity">
              <span>Opportunity</span>
              <b>{words(radar.top_opportunity || 'Opportunity forming', 8)}</b>
            </div>
          </div>
        )}

        {impact?.headline && (
          <div className="panel why-cards">
            <div className="label">WHY IT MATTERS</div>
            {[impact.headline, ...(impact.actions || [])].slice(0, 3).map(item => <span key={item}>{words(item, 10)}</span>)}
          </div>
        )}

        <div className="panel smart-alerts">
          <div className="label">SMART ALERTS</div>
          <span>Exposure {Math.round(data?.exposure_score || 50)} across active profile</span>
          {delta.slice(0, 2).map(d => (
            <span key={d.topic}>{d.has_baseline ? `${d.label} moved ${d.delta}` : `${d.label} baseline building`}</span>
          ))}
          <span>{saved.size} saved signals</span>
        </div>

        <div className="panel tracked-entities">
          <div className="label">TRACK ENTITIES</div>
          {topEntities.map(([name, count]) => (
            <button key={name} onClick={() => updateInteraction('trackEntity', rankedSignals[0] || {}, name)}>
              {name}<em>{count}</em>
            </button>
          ))}
        </div>

        <div className="panel pipeline-mini">
          <div className="label">PIPELINE</div>
          <span>AI: {(pipeline.synthesis || 'unknown').replaceAll('_', ' ')}</span>
          <span>Cache: {pipeline.cache || 'profile-scoped'}</span>
          <span>Generated: {data?.generated_at ? new Date(data.generated_at).toLocaleTimeString() : '-'}</span>
        </div>
      </aside>
    </div>
  );
}
