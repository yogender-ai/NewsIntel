import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Banknote, Bell, Bookmark, Building2, CircleDot, Cpu, Globe2, LineChart, Plus, ShieldAlert, TrendingUp, User, X } from 'lucide-react';
import { api } from '../api';
import { AppContext } from '../App';
import { useAuth } from '../context/AuthContext';

const TOPIC_LABELS = {
  tech: 'Tech',
  politics: 'Geopolitics',
  markets: 'Markets',
  ai: 'AI',
  climate: 'Climate',
  healthcare: 'Health',
  defense: 'Defense',
  crypto: 'Crypto',
  space: 'Space',
  trade: 'Trade',
  auto: 'Auto',
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

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function signalId(cluster) {
  return cluster?.signal_id || cluster?.thread_id || (cluster?.thread_title || cluster?.summary || 'signal').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80);
}

function words(text, max = 10) {
  const parts = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  return parts.length > max ? `${parts.slice(0, max).join(' ')}...` : parts.join(' ');
}

function getOpenThemeVariant(category) {
  const spin = Number(localStorage.getItem('ni_theme_spin') || '0');
  const variants = THEME_VARIANTS[category] || THEME_VARIANTS.tech;
  return variants[spin % variants.length];
}

function metricCopy(type) {
  return {
    delta: ['Daily Delta', 'Movement versus the previous 24h baseline. Positive means rising, zero means stable, negative means cooling.'],
    pulse: ['Pulse Score', 'Signal intensity from source velocity, sentiment, entity movement, and personal relevance.'],
    exposure: ['Exposure Score', 'How strongly this signal connects to your topics, regions, entities, and past actions.'],
  }[type] || ['Metric', 'A compact signal measure.'];
}

function MetricPopover({ type, onClose }) {
  if (!type) return null;
  const [title, body] = metricCopy(type);
  return (
    <div className="metric-popover">
      <button onClick={onClose}>Close</button>
      <b>{title}</b>
      <p>{body}</p>
    </div>
  );
}

function ExposureRing({ value, onInfo }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="simple-exposure">
      <span className="rail-title">Your Exposure</span>
      <button className="simple-ring" onClick={() => onInfo('exposure')} style={{ background: `conic-gradient(var(--accent) ${pct * 3.6}deg, rgba(255,255,255,0.08) 0deg)` }}>
        <span>{Math.round(pct)}</span>
      </button>
      <div>
        <span>High</span>
        <button onClick={() => onInfo('exposure')}>i</button>
      </div>
    </div>
  );
}

function DeltaPill({ delta, onInfo }) {
  if (!delta?.has_baseline) {
    return <button className="delta-pill neutral" onClick={() => onInfo('delta')}>Establishing baseline</button>;
  }
  const value = Number(delta.delta || 0);
  const label = value > 0 ? `▲ +${value} Rising` : value < 0 ? `▼ ${value} Cooling` : '— 0 Stable';
  return <button className={`delta-pill ${value > 0 ? 'up' : value < 0 ? 'down' : 'neutral'}`} onClick={() => onInfo('delta')}>{label}</button>;
}

function CausalChain({ cluster }) {
  const graphNodes = cluster?.story_graph?.nodes?.map(n => n.label).slice(0, 4);
  const fallback = [
    words(cluster?.thread_title, 5) || 'Event',
    words(cluster?.impact_line || cluster?.summary, 6) || 'Market impact',
    cluster?.risk_type === 'risk' ? 'Risk pressure rises' : cluster?.risk_type === 'opportunity' ? 'Opportunity opens' : 'Signal shifts',
    `Profile exposure ${cluster?.exposure_score >= 70 ? 'rises' : 'changes'}`,
  ];
  const nodes = graphNodes?.length >= 4 ? graphNodes : fallback;
  const labels = ['Event', 'Market Impact', 'Risk Shift', 'Profile Exposure'];
  const icons = [Cpu, Building2, TrendingUp, User];
  return (
    <div className="simple-chain">
      {nodes.map((node, i) => (
        <React.Fragment key={`${node}-${i}`}>
          <div className="chain-node">
            {React.createElement(icons[i] || LineChart, { size: 25 })}
            <span>{labels[i]}</span>
            <b>{words(node, 8)}</b>
          </div>
          {i < nodes.length - 1 && <div className="chain-arrow"><ArrowRight size={18} /></div>}
        </React.Fragment>
      ))}
    </div>
  );
}

function SignalIcon({ tier }) {
  const normalized = String(tier || '').toLowerCase();
  if (normalized.includes('watch')) return <Banknote size={34} />;
  if (normalized.includes('signal')) return <Globe2 size={34} />;
  return <Cpu size={34} />;
}

function MiniSparkline({ tone = 'critical' }) {
  const points = tone === 'watch'
    ? '0,44 16,30 30,35 45,20 60,28 76,12 92,24 110,8 132,18 150,2'
    : tone === 'signal'
      ? '0,38 14,29 28,34 45,25 62,29 76,20 93,25 108,16 126,21 142,4 150,0'
      : '0,42 14,35 29,38 44,29 58,31 74,22 89,16 104,26 120,12 135,18 150,4';
  return (
    <svg className="signal-spark" viewBox="0 0 150 52" role="img" aria-label="Signal movement">
      <defs>
        <linearGradient id={`spark-fill-${tone}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.24" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,52 ${points} 150,52`} fill={`url(#spark-fill-${tone})`} />
      <polyline points={points} />
    </svg>
  );
}

function SignalCard({ cluster, delta, selected, saved, onOpen, onSave, onInfo }) {
  const tier = cluster.signal_tier || 'SIGNAL';
  const pulse = Math.round(cluster.pulse_score || 50);
  const risk = cluster.risk_type === 'risk' ? 'High' : cluster.risk_type === 'opportunity' ? 'Low' : 'Medium';
  const opportunity = cluster.risk_type === 'opportunity' ? 'High' : cluster.exposure_score >= 70 ? 'Medium' : 'Low';
  const tone = tier.toLowerCase().includes('critical') ? 'critical' : tier.toLowerCase().includes('watch') ? 'watch' : 'signal';

  return (
    <article className={`simple-signal-card ${selected ? 'selected' : ''} tone-${tone}`}>
      <div className="simple-card-top">
        <span className={`tier-badge tier-${tier.toLowerCase()}`}>{tier}</span>
      </div>
      <div className="signal-card-grid">
        <div className="signal-icon"><SignalIcon tier={tier} /></div>
        <div className="signal-copy">
          <h2>{cluster.thread_title}</h2>
          <p>{words(cluster.impact_line || cluster.summary || cluster.why_it_matters, 12)}</p>
          <div className="risk-row">
            <span>Risk: {risk}</span>
            <span>Opportunity: {opportunity}</span>
          </div>
        </div>
        <div className="signal-score">
          <button onClick={() => onInfo('pulse')}>Pulse Score</button>
          <strong>{pulse}</strong>
          <DeltaPill delta={delta} onInfo={onInfo} />
        </div>
        <MiniSparkline tone={tone} />
      </div>
      <div className="simple-actions">
        <button className="btn btn-primary" onClick={() => onOpen(cluster)}>Open Signal</button>
        <button className="save-icon" onClick={() => onSave(cluster)} title={saved ? 'Saved' : 'Save'}><Bookmark size={17} fill={saved ? 'currentColor' : 'none'} /></button>
      </div>
    </article>
  );
}

function DetailPanel({ cluster, onAction, onDeepDive }) {
  if (!cluster) {
    return (
      <aside className="simple-context empty">
        <div className="label">SIGNAL CONTEXT</div>
        <h2>Select a signal</h2>
        <p>Open a signal to see why it matters, causal flow, risk, opportunity, and the next action.</p>
      </aside>
    );
  }

  const why = cluster.why_relevant?.factors || [];
  const risks = cluster.risk_type === 'risk'
    ? [words(cluster.summary || cluster.impact_line, 12)]
    : ['No dominant risk spike detected.'];
  const opportunities = cluster.risk_type === 'opportunity'
    ? [words(cluster.impact_line || cluster.summary, 12)]
    : [cluster.exposure_score >= 70 ? 'High relevance creates monitoring value.' : 'Watch for confirmation.'];
  const suggested = cluster.signal_tier === 'CRITICAL' ? 'Review now and keep on watchlist.' : 'Save and monitor next movement.';

  return (
    <aside className="simple-context">
      <button className="context-close" title="Close"><X size={17} /></button>
      <div className={`tier-badge tier-${String(cluster.signal_tier || 'signal').toLowerCase()}`}>{cluster.signal_tier || 'SIGNAL'}</div>
      <h2>{cluster.thread_title}</h2>
      <div className="context-tabs">
        <button className="active">Overview</button>
        <button>Story Graph</button>
        <button>Risks</button>
        <button>Opportunities</button>
        <button>Action</button>
      </div>

      <section>
        <h3>Summary</h3>
        <p>{words(cluster.summary || cluster.impact_line, 20)}</p>
      </section>

      <section>
        <h3>Story Graph</h3>
        <CausalChain cluster={cluster} />
      </section>

      <section>
        <h3>Why Relevant To You</h3>
        <div className="reason-list">
          {(why.length ? why : [{ label: 'Matches your active intelligence profile', points: Math.round(cluster.exposure_score || 50) }]).slice(0, 4).map(item => (
            <span key={item.label}>{item.label} <b>+{item.points}</b></span>
          ))}
        </div>
      </section>

      <section className="split-context">
        <div className="why-tile opportunity">
          <h3><TrendingUp size={16} /> Opportunity</h3>
          {opportunities.map(item => <p key={item}>{item}</p>)}
        </div>
        <div className="why-tile risk">
          <h3><ShieldAlert size={16} /> Risk</h3>
          {risks.map(item => <p key={item}>{item}</p>)}
        </div>
      </section>

      <section>
        <h3>Suggested Action</h3>
        <p>{suggested}</p>
      </section>

      <div className="detail-actions">
        <button className="primary-action" onClick={() => onAction('watch', cluster)}>Track This Topic</button>
        <button className="icon-action" onClick={() => onAction('dismiss', cluster)} title="Dismiss topic"><Plus size={18} /></button>
        <button onClick={() => onDeepDive(cluster)}>Deep Analysis</button>
      </div>

      <section>
        <h3>Relevance to you</h3>
        <div className="relevance-meter"><span style={{ width: `${Math.min(100, Math.round(cluster.exposure_score || 50))}%` }} /></div>
        <b className="relevance-score">{Math.round(cluster.exposure_score || 50)}/100</b>
      </section>
    </aside>
  );
}

function Loader() {
  return (
    <div className="phase5-loader">
      <div className="pulse-glow loader-dot" />
      <span className="mono">BUILDING SIGNAL FEED</span>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { setHeadlines, mode } = useContext(AppContext);
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkingPrefs, setCheckingPrefs] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [savedIds, setSavedIds] = useState(new Set());
  const [toast, setToast] = useState(null);
  const [metricInfo, setMetricInfo] = useState(null);
  const [error, setError] = useState(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
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

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res] = await Promise.all([api.getPersonalizedDashboard(), sleep(900)]);
      setData(res);
      setSavedIds(new Set(res.saved_signal_ids || []));
      setSelectedId(prev => prev || signalId(res.clusters?.[0]));
      if (res.clusters?.length) setHeadlines(res.clusters.slice(0, 3).map(c => c.thread_title));
      applyTheme(res);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }, [applyTheme, setHeadlines]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const prefs = await api.getPreferences();
        if (prefs.status === 'not_found' || !prefs.data?.onboarded) {
          navigate('/onboarding');
          return;
        }
      } catch {
        // Dashboard load will display API errors.
      }
      setCheckingPrefs(false);
    })();
  }, [navigate, user]);

  useEffect(() => {
    if (!checkingPrefs) loadDashboard();
  }, [checkingPrefs, loadDashboard]);

  const clusters = data?.clusters || [];
  const topSignals = clusters.slice(0, 3);
  const selectedSignal = topSignals.find(c => signalId(c) === selectedId) || topSignals[0];
  const activeTopics = data?.topics_used || [];
  const activeRegions = data?.regions_used || [];
  const entityMoves = (data?.tracked_entities || []).filter(entity =>
    (data?.articles || []).some(article => (article.entities || []).some(e => e.name === entity.entity_name))
  );

  const deltaFor = (cluster) => {
    const matched = cluster?.matched_preferences?.[0]?.id;
    return data?.daily_delta?.find(d => d.topic === matched) || data?.daily_delta?.[0];
  };

  const persistAction = async (type, cluster) => {
    const id = signalId(cluster);
    try {
      if (type === 'open') await api.recordInteraction(id, 'open');
      if (type === 'save') {
        await api.saveThread(id);
        setSavedIds(prev => new Set([...prev, id]));
      }
      if (type === 'watch') await api.watchSignal(id, 1);
      if (type === 'dismiss') await api.dismissSignal(id, 'not_relevant');
      showToast(type === 'save' ? 'Signal saved' : type === 'dismiss' ? 'Signal dismissed' : 'Updated');
    } catch (err) {
      console.warn('Signal action failed', err);
      showToast('Action saved locally');
    }
  };

  const openSignal = async (cluster) => {
    setSelectedId(signalId(cluster));
    await persistAction('open', cluster);
  };

  const openDeepDive = (cluster) => {
    persistAction('open', cluster);
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

  if (checkingPrefs || loading) return <Loader />;

  return (
    <div className="simple-dashboard">
      {toast && <div className="phase5-toast">{toast}</div>}
      <MetricPopover type={metricInfo} onClose={() => setMetricInfo(null)} />

      <aside className="simple-left-rail">
        <ExposureRing value={data?.exposure_score || 50} onInfo={setMetricInfo} />
        <div className="simple-profile">
          {[...activeTopics.map(t => TOPIC_LABELS[t] || t), ...activeRegions].slice(0, 8).map(item => (
            <span key={item}>{item}</span>
          ))}
        </div>
        <button className="edit-profile" onClick={() => navigate('/settings')}>Edit Profile</button>
        <div className="entity-move-card">
          <span>Entities moved today</span>
          <strong>+{entityMoves.length || 6}</strong>
          <MiniSparkline tone="watch" />
          <button>View all <ArrowRight size={14} /></button>
        </div>
        <div className="stay-ahead">
          <Bell size={20} />
          <h3>Stay ahead.</h3>
          <p>We surface what matters, before it trends.</p>
          <button>How it works</button>
        </div>
      </aside>

      <main className="simple-feed">
        <header className="simple-feed-header">
          <div>
            <h1>What matters right now</h1>
            <p>Top signals based on your profile and real-time intelligence</p>
          </div>
          <button className="updated-pill"><CircleDot size={9} /> Updated 2m ago</button>
        </header>

        {error && (
          <div className="panel phase5-error">
            <div className="label">LOAD ERROR</div>
            <p>{error}</p>
            <button className="wire-btn" onClick={loadDashboard}>Retry</button>
          </div>
        )}

        <section className="simple-signal-list">
          {topSignals.map(cluster => (
            <SignalCard
              key={signalId(cluster)}
              cluster={cluster}
              delta={deltaFor(cluster)}
              selected={signalId(cluster) === signalId(selectedSignal)}
              saved={savedIds.has(signalId(cluster))}
              onOpen={openSignal}
              onSave={(c) => persistAction('save', c)}
              onInfo={setMetricInfo}
            />
          ))}
        </section>

        <section className="why-strip">
          <h3>Why these matter to you</h3>
          <div>
            <span><CircleDot size={18} /> <b>Topic Match</b> Tech focus +25</span>
            <span><Building2 size={18} /> <b>Entity Match</b> Nvidia, TSMC +20</span>
            <span><Globe2 size={18} /> <b>Region Overlap</b> Global exposure +15</span>
            <span><LineChart size={18} /> <b>Recent Engagement</b> Similar stories +10</span>
          </div>
        </section>
      </main>

      <DetailPanel
        cluster={selectedSignal}
        onAction={persistAction}
        onDeepDive={openDeepDive}
      />
    </div>
  );
}
