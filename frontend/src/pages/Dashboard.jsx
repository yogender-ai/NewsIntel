import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowDown, ArrowRight, ArrowUp, Banknote, Bell, Bookmark, Building2, Check,
  ChevronRight, CircleDot, Cpu, Eye, Gauge, GitBranch, Globe2, Info, LineChart,
  Minus, ShieldAlert, Sparkles, Target, TrendingUp, User, X,
} from 'lucide-react';
import { AppContext } from '../App';
import { useAuth } from '../context/AuthContext';
import { usePersonalization } from '../context/PersonalizationContext';
import { api } from '../api';

/* ── Utilities (imported from context) ──────── */
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Number(v) || 0));
const words = (text, max = 12) => { const p = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean); return p.length > max ? `${p.slice(0, max).join(' ')}...` : p.join(' '); };
const timeAgo = (v) => { const s = Math.max(1, Math.round((Date.now() - new Date(v || Date.now()).getTime()) / 1000)); if (s < 60) return `${s}s ago`; const m = Math.round(s / 60); if (m < 60) return `${m} min ago`; return `${Math.round(m / 60)}h ago`; };
const TOPIC_LABELS = { tech: 'Tech', politics: 'Geopolitics', markets: 'Markets', ai: 'AI', climate: 'Climate', healthcare: 'Health', defense: 'Defense', crypto: 'Crypto', space: 'Space', trade: 'Trade', auto: 'Auto', telecom: 'Telecom', 'real-estate': 'Real Estate', media: 'Media', education: 'Education', legal: 'Legal' };

/* ── Metric Drawer ──────────────────────────── */
function MetricDrawer({ metric, signal, onClose }) {
  if (!metric || !signal) return null;
  const config = {
    delta: {
      title: 'Daily Delta', body: 'Movement versus the previous pulse snapshot for this signal or matched topic.',
      why: 'Delta tells you whether the story is gaining urgency or cooling down.',
      parts: [['Current pulse', signal.delta.current], ['Previous pulse', signal.delta.previous ?? 'Baseline forming'], ['Delta', signal.delta.value === null ? 'Tracking' : `${signal.delta.value > 0 ? '+' : ''}${signal.delta.value}`]],
    },
    pulse: {
      title: 'Pulse Score', body: 'Weighted intensity score from velocity, source strength, sentiment, entities, and user relevance.',
      why: 'Pulse helps rank what deserves attention first.',
      parts: signal.pulse.parts.map(([label, value, weight]) => [label, `${Math.round(value)} (${weight})`]),
    },
    exposure: {
      title: 'Exposure Score', body: 'How strongly this signal connects to your topics, tracked entities, regions, and past actions.',
      why: 'Exposure keeps the feed personal instead of generic.',
      parts: signal.exposure.parts.map(([label, value]) => [label, `+${Math.round(value)}`]),
    },
    risk: {
      title: 'Risk', body: `Current risk level is ${signal.riskLevel}. It uses risk type, sentiment intensity, source velocity, and story language.`,
      why: 'Risk explains what could go wrong if this signal keeps moving.',
      parts: [['Risk level', signal.riskLevel], ['Sentiment intensity', `${Math.round((signal.sentiment_intensity || 0.35) * 100)}%`]],
    },
    opportunity: {
      title: 'Opportunity', body: `Current opportunity level is ${signal.opportunityLevel}. It rises when relevance is high and risk pressure is controlled.`,
      why: 'Opportunity shows what may be worth tracking or acting on.',
      parts: [['Opportunity level', signal.opportunityLevel], ['Exposure', `${Math.round(signal.exposure.score)}/100`]],
    },
    confidence: {
      title: 'Signal Confidence', body: 'Confidence is based on source agreement, source count, entity certainty, and graph completeness.',
      why: 'Confidence tells you how much trust to place in the signal.',
      parts: [['Confidence', `${signal.confidence}%`], ['Sources', signal.source_count || 1], ['Graph nodes', signal.story_graph?.nodes?.length || 4]],
    },
  }[metric];

  return (
    <aside className="metric-drawer">
      <button className="drawer-x" onClick={onClose}><X size={17} /></button>
      <span className="metric-eyebrow">Explain</span>
      <h2>{config.title}</h2>
      <p>{config.body}</p>
      <div className="explain-rows">
        {config.parts.map(([label, value]) => (<span key={label}><b>{label}</b><strong>{value}</strong></span>))}
      </div>
      <h3>Why it matters</h3>
      <p>{config.why}</p>
    </aside>
  );
}

/* ── Left Rail ──────────────────────────────── */
function ExposureRail({ score, topics, entities, alertsCount, sourcesCount, onExplain }) {
  const pct = (score || 50);
  return (
    <aside className="simple-left-rail">
      <div className="simple-exposure">
        <span className="rail-title">Your Exposure</span>
        <button className="simple-ring" onClick={() => onExplain('exposure')} style={{ background: `conic-gradient(var(--accent) ${pct * 3.6}deg, #ece8f7 0deg)` }}>
          <span>{Math.round(pct)}</span>
        </button>
        <div><span>{pct >= 75 ? 'High' : pct >= 45 ? 'Medium' : 'Low'}</span><button onClick={() => onExplain('exposure')}><Info size={13} /></button></div>
      </div>
      <div className="simple-profile">
        {topics.length ? topics.slice(0, 5).map(item => <span key={item}>{item}</span>) : <em>Pick interests to personalize.</em>}
      </div>
      <div className="entity-move-card">
        <span>Tracked entities</span>
        <strong>{entities.length || 0}</strong>
        {entities.length ? entities.slice(0, 3).map(entity => <small key={entity.entity_name || entity.name}>{entity.entity_name || entity.name}</small>) : <small>Track companies or topics to personalize.</small>}
      </div>
      <div className="entity-move-card">
        <span>Alerts</span>
        <strong>{alertsCount || 0}</strong>
        <small>{alertsCount ? 'New items need review.' : `Nothing urgent. Monitoring ${sourcesCount || 0} sources.`}</small>
      </div>
      <div className="stay-ahead">
        <Bell size={20} />
        <h3>Stay ahead.</h3>
        <p>Signals adjust when you save, track, dismiss, and open stories.</p>
      </div>
    </aside>
  );
}

/* ── Signal Components ──────────────────────── */
function SignalIcon({ signal }) {
  const text = `${signal.thread_title} ${signal.summary}`.toLowerCase();
  if (text.match(/chip|semiconductor|ai|software|tech/)) return <Cpu size={33} />;
  if (text.match(/bank|rate|market|stock|econom/)) return <Banknote size={33} />;
  if (text.match(/geopolitic|war|policy|china|nato/)) return <Globe2 size={33} />;
  if (signal.risk_type === 'risk') return <ShieldAlert size={33} />;
  return <LineChart size={33} />;
}

function MiniSparkline({ signal }) {
  const base = signal.pulse_trend?.length ? signal.pulse_trend.slice(-10) : [
    signal.delta.previous ?? signal.pulse.score - 6, signal.pulse.score - 4, signal.pulse.score - 9,
    signal.pulse.score - 1, signal.pulse.score + 3, signal.pulse.score - 2,
    signal.pulse.score + 5, signal.pulse.score, signal.pulse.score + (signal.delta.value || 4),
  ];
  const max = Math.max(...base, 100); const min = Math.min(...base, 0);
  const points = base.map((v, i) => `${Math.round((i / Math.max(base.length - 1, 1)) * 150)},${Math.round(48 - ((v - min) / Math.max(max - min, 1)) * 42)}`).join(' ');
  return (
    <svg className="signal-spark" viewBox="0 0 150 52" role="img" aria-label="Trend sparkline">
      <polygon points={`0,52 ${points} 150,52`} />
      <polyline points={points} />
    </svg>
  );
}

function ScoreButton({ type, label, value, onExplain }) {
  return (
    <button className="score-button" onClick={() => onExplain(type)}>
      <span>{label}<Info size={11} /></span>
      <strong>{Math.round(value)}</strong>
    </button>
  );
}

function SignalCard({ signal, selected, onAction, onExplain }) {
  const tone = signal.signal_tier?.toLowerCase() || 'signal';
  return (
    <article className={`simple-signal-card ${selected ? 'selected' : ''} tone-${tone}`}>
      <div className="simple-card-top">
        <span className={`tier-badge tier-${tone}`}>{signal.signal_tier || 'SIGNAL'}</span>
        <span className="updated-time">{signal.updatedAgo}</span>
      </div>
      <div className="signal-card-grid">
        <div className="signal-icon"><SignalIcon signal={signal} /></div>
        <div className="signal-copy">
          <h2>{words(signal.thread_title, 8)}</h2>
          <p>{words(signal.whyLine, 14)}</p>
          <div className="risk-row">
            <button onClick={() => onExplain('risk')}>Risk: {signal.riskLevel}<Info size={11} /></button>
            <button onClick={() => onExplain('opportunity')}>Opportunity: {signal.opportunityLevel}<Info size={11} /></button>
          </div>
        </div>
        <div className="signal-score">
          <ScoreButton type="pulse" label="Pulse" value={signal.pulse.score} onExplain={onExplain} />
          <ScoreButton type="exposure" label="Exposure" value={signal.exposure.score} onExplain={onExplain} />
        </div>
        <MiniSparkline signal={signal} />
      </div>
      <div className="simple-actions">
        <button className="btn btn-primary" onClick={() => onAction('open', signal)}><Eye size={15} /> Open Signal</button>
        <button className={signal.tracked ? 'active-action' : ''} onClick={() => onAction('track', signal)}><Target size={15} /> {signal.tracked ? 'Tracked' : 'Track'}</button>
        <button className={signal.saved ? 'active-action' : ''} onClick={() => onAction('save', signal)}><Bookmark size={15} /> {signal.saved ? 'Saved' : 'Save'}</button>
        <button onClick={() => onAction('explain', signal)}><Info size={15} /> Explain</button>
        <button onClick={() => onAction('graph', signal)}><GitBranch size={15} /> Graph</button>
        <button onClick={() => onAction('dismiss', signal)}><X size={15} /> Dismiss</button>
      </div>
    </article>
  );
}

/* ── Story Flow ──────────────────────────────── */
function StoryFlow({ signal }) {
  const graphNodes = signal.story_graph?.nodes?.slice(0, 4).map(n => n.label);
  const nodes = graphNodes?.length >= 4 ? graphNodes : [
    signal.thread_title,
    signal.entities?.[0]?.name ? `${signal.entities[0].name} moves` : 'Market impact forms',
    signal.risk_type === 'risk' ? 'Risk pressure rises' : signal.risk_type === 'opportunity' ? 'Opportunity opens' : words(signal.whyLine, 7),
    `Your exposure ${signal.exposure.score >= 65 ? 'rises' : 'changes'} (${Math.round(signal.exposure.score)})`,
  ];
  const labels = ['Event', 'Market Impact', 'Risk Shift', 'User Exposure'];
  const icons = [Cpu, Building2, TrendingUp, User];
  return (
    <div className="story-flow">
      {nodes.map((node, i) => {
        const Icon = icons[i] || CircleDot;
        return (
          <React.Fragment key={`${node}-${i}`}>
            <div className="flow-node"><Icon size={25} /><span>{labels[i]}</span><b>{words(node, 7)}</b></div>
            {i < nodes.length - 1 && <ArrowRight className="flow-arrow" size={18} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ── Detail Panel ────────────────────────────── */
function DetailPanel({ signal, tab, setTab, onAction, onExplain }) {
  if (!signal) {
    return (
      <aside className="simple-context empty">
        <Sparkles size={24} /><h2>No major shifts detected.</h2>
        <p>Signals will appear here as soon as the feed finds meaningful movement.</p>
      </aside>
    );
  }
  const tabs = ['Overview', 'Story Graph', 'Risks', 'Opportunities', 'Action'];
  const why = signal.why_relevant?.factors?.length ? signal.why_relevant.factors : signal.exposure.parts.map(([label, points]) => ({ label, points }));

  return (
    <aside className="simple-context">
      <div className="detail-head">
        <span className={`tier-badge tier-${String(signal.signal_tier || 'signal').toLowerCase()}`}>{signal.signal_tier || 'SIGNAL'}</span>
        <span>{signal.updatedAgo}</span>
      </div>
      <h2>{signal.thread_title}</h2>
      <div className="context-tabs">
        {tabs.map(item => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item}</button>)}
      </div>

      {tab === 'Overview' && (
        <>
          <section><h3>Summary</h3><p>{words(signal.summary || signal.whyLine, 30)}</p></section>
          <section>
            <h3>Why Relevant To You</h3>
            <div className="reason-list">
              {why.slice(0, 4).map(item => <span key={item.label}>{item.label} <b>+{Math.round(item.points || 0)}</b></span>)}
            </div>
          </section>
          <section className="score-grid">
            <ScoreButton type="pulse" label="Pulse" value={signal.pulse.score} onExplain={onExplain} />
            <ScoreButton type="exposure" label="Exposure" value={signal.exposure.score} onExplain={onExplain} />
            <button className="score-button" onClick={() => onExplain('confidence')}><span>Confidence<Info size={11} /></span><strong>{signal.confidence}%</strong></button>
          </section>
        </>
      )}
      {tab === 'Story Graph' && (<section><h3>Story Flow</h3><StoryFlow signal={signal} /></section>)}
      {tab === 'Risks' && (
        <section className="why-tile risk">
          <h3><ShieldAlert size={16} /> Risk</h3>
          <p>{signal.risk_type === 'risk' ? words(signal.summary || signal.whyLine, 26) : 'No dominant risk spike detected yet.'}</p>
          <button onClick={() => onExplain('risk')}>How calculated <Info size={13} /></button>
        </section>
      )}
      {tab === 'Opportunities' && (
        <section className="why-tile opportunity">
          <h3><TrendingUp size={16} /> Opportunity</h3>
          <p>{signal.risk_type === 'opportunity' ? words(signal.whyLine, 26) : signal.exposure.score >= 70 ? 'High relevance creates monitoring value.' : 'Watch for stronger confirmation before acting.'}</p>
          <button onClick={() => onExplain('opportunity')}>How calculated <Info size={13} /></button>
        </section>
      )}
      {tab === 'Action' && (
        <section>
          <h3>Suggested Action</h3>
          <p>{signal.signal_tier === 'CRITICAL' ? 'Track this topic and monitor source updates closely.' : 'Save and monitor the next movement.'}</p>
          <div className="detail-actions">
            <button className="primary-action" onClick={() => onAction('track', signal)}>{signal.tracked ? <Check size={16} /> : <Target size={16} />} {signal.tracked ? 'Tracked' : 'Track This Topic'}</button>
            <button onClick={() => onAction('save', signal)}><Bookmark size={16} /> {signal.saved ? 'Saved' : 'Save'}</button>
            <button onClick={() => onAction('dismiss', signal)}><X size={16} /> Dismiss</button>
          </div>
        </section>
      )}
      <section>
        <h3>Relevance to you</h3>
        <div className="relevance-meter"><span style={{ width: `${signal.exposure.score}%` }} /></div>
        <b className="relevance-score">{Math.round(signal.exposure.score)}/100</b>
      </section>
    </aside>
  );
}

/* ── Empty/Loading States ────────────────────── */
function EmptySignals({ sourcesCount }) {
  return (
    <div className="empty-state"><Sparkles size={26} /><h2>No major shifts detected.</h2>
      <p>{sourcesCount ? `Monitoring ${sourcesCount} sources. New signals will appear when movement crosses your threshold.` : 'Connect interests and tracked entities to begin signal monitoring.'}</p>
    </div>
  );
}

function OnboardingHint() {
  return (
    <div className="walkthrough-strip">
      <span><b>1</b> Pick interests</span><ChevronRight size={15} />
      <span><b>2</b> Track entities</span><ChevronRight size={15} />
      <span><b>3</b> Read top signals</span>
    </div>
  );
}

function Loader() {
  return (<div className="phase5-loader"><div className="pulse-glow loader-dot" /><span className="mono">BUILDING SIGNAL FEED</span></div>);
}

/* ══════════════════════════════════════════════
   DASHBOARD — Now powered by PersonalizationContext
   ══════════════════════════════════════════════ */
export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { setHeadlines } = useContext(AppContext);
  const {
    loading, error, signals, topics, trackedEntities, exposureScore,
    savedIds, trackedIds, dismissedIds, sourcesCount, generatedAt,
    unreadAlertCount, dashboardData, refresh,
    saveSignal, trackSignal, dismissSignal, recordOpen, recordExplain, recordGraph, showToast,
  } = usePersonalization();

  const [checkingPrefs, setCheckingPrefs] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [metricInfo, setMetricInfo] = useState(null);
  const [detailTab, setDetailTab] = useState('Overview');

  // Check if user needs onboarding
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const prefs = await api.getPreferences();
        if (prefs.status === 'not_found' || !prefs.data?.onboarded) { navigate('/onboarding'); return; }
      } catch { /* Dashboard load will show API errors or cached data. */ }
      setCheckingPrefs(false);
    })();
  }, [navigate, user]);

  // Handle deep link from Watchlist/Alerts pages
  useEffect(() => {
    const openId = location.state?.openSignalId;
    if (openId && signals.length) {
      setSelectedId(openId);
      setDetailTab('Overview');
      // Clear the state so it doesn't re-trigger
      window.history.replaceState({}, document.title);
    }
  }, [location.state, signals]);

  // Set headlines for AppContext
  useEffect(() => {
    if (signals.length) setHeadlines(signals.slice(0, 3).map(c => c.thread_title));
  }, [signals, setHeadlines]);

  const selectedSignal = signals.find(s => s.id === selectedId) || signals[0] || null;

  const handleAction = async (type, signal) => {
    const id = signal.id;
    if (type === 'open') {
      setSelectedId(id); setDetailTab('Overview'); recordOpen(signal); showToast('Signal opened');
      return;
    }
    if (type === 'graph') {
      setSelectedId(id); setDetailTab('Story Graph'); recordGraph(signal); showToast('Story flow opened');
      return;
    }
    if (type === 'explain') {
      setSelectedId(id); setMetricInfo('pulse'); recordExplain(signal);
      return;
    }
    if (type === 'save') { saveSignal(signal); return; }
    if (type === 'track') { trackSignal(signal); return; }
    if (type === 'dismiss') { dismissSignal(signal); return; }
  };

  const explain = (type) => { if (selectedSignal) setMetricInfo(type); };

  if (checkingPrefs || loading) return <Loader />;

  return (
    <div className="simple-dashboard">
      <MetricDrawer metric={metricInfo} signal={selectedSignal} onClose={() => setMetricInfo(null)} />

      <ExposureRail
        score={exposureScore}
        topics={topics}
        entities={trackedEntities}
        alertsCount={unreadAlertCount}
        sourcesCount={sourcesCount}
        onExplain={explain}
      />

      <main className="simple-feed">
        <header className="simple-feed-header">
          <div>
            <h1>What matters right now</h1>
            <p>Top signals based on your profile and real-time intelligence</p>
          </div>
          <button className="updated-pill" onClick={refresh}><CircleDot size={9} /> Updated {timeAgo(generatedAt)}</button>
        </header>

        {!topics.length && <OnboardingHint />}

        {error && (
          <div className="panel phase5-error">
            <div className="label">LOAD ERROR</div>
            <p>{error}</p>
            <button className="wire-btn" onClick={refresh}>Retry</button>
          </div>
        )}

        <section className="simple-signal-list">
          {signals.length ? signals.slice(0, 8).map(signal => (
            <SignalCard
              key={signal.id} signal={signal} selected={signal.id === selectedSignal?.id}
              onAction={handleAction}
              onExplain={(type) => { setSelectedId(signal.id); setMetricInfo(type); }}
            />
          )) : <EmptySignals sourcesCount={sourcesCount} />}
        </section>

        <section className="why-strip">
          <h3>What changed since last visit</h3>
          <div>
            <span><Gauge size={18} /> <b>{signals.filter(s => s.signal_tier === 'CRITICAL').length} critical</b> active now</span>
            <span><Target size={18} /> <b>{trackedIds.size} tracked</b> boosted in ranking</span>
            <span><Bookmark size={18} /> <b>{savedIds.size} saved</b> remembered</span>
            <span><X size={18} /> <b>{dismissedIds.size} dismissed</b> suppressed</span>
          </div>
        </section>
      </main>

      <DetailPanel signal={selectedSignal} tab={detailTab} setTab={setDetailTab} onAction={handleAction} onExplain={explain} />
    </div>
  );
}
