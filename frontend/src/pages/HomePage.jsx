import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, X, Activity } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { normalizeDashboardData, formatRelativeTime } from '../lib/dashboardAdapter';
import Sidebar from '../components/worldpulse/Sidebar';
import TopHeader from '../components/worldpulse/TopHeader';
import WorldPulseRing from '../components/worldpulse/WorldPulseRing';
import WhatChangedToday from '../components/worldpulse/WhatChangedToday';
import PulseTrendChart from '../components/worldpulse/PulseTrendChart';
import QuickGlance from '../components/worldpulse/QuickGlance';
import TopShiftCard from '../components/worldpulse/TopShiftCard';
import EmptyState from '../components/worldpulse/EmptyState';
import StartTourCard from '../components/worldpulse/StartTourCard';
import FreshnessBadge from '../components/worldpulse/FreshnessBadge';
import LockedNavToast from '../components/worldpulse/LockedNavToast';

function LoadingSkeleton() {
  return (
    <div className="wp-loading">
      <span />
    </div>
  );
}

function LiveCursor() {
  const [point, setPoint] = useState({ x: -80, y: -80 });
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    const move = (event) => {
      setPoint({ x: event.clientX, y: event.clientY });
      document.documentElement.style.setProperty('--cursor-x', `${event.clientX}px`);
      document.documentElement.style.setProperty('--cursor-y', `${event.clientY}px`);
    };
    const down = () => setPressed(true);
    const up = () => setPressed(false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
    };
  }, []);

  return (
    <div
      className={`live-cursor-advanced ${pressed ? 'pressed' : ''}`}
      style={{ transform: `translate(${point.x}px, ${point.y}px)` }}
    >
      <div className="cursor-ring" />
      <div className="cursor-dot" />
    </div>
  );
}

function readableLiveError(err) {
  const raw = err?.message || 'Unable to load live intelligence.';
  const jsonStart = raw.indexOf('{');
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(raw.slice(jsonStart));
      const detail = parsed.detail || parsed.error || raw;
      if (String(detail).includes('invalid input for query argument')) {
        return 'Event-store timestamp query failed during ingestion/read. Backend has been updated to normalize UTC timestamps.';
      }
      return String(detail).slice(0, 180);
    } catch {
      // Fall through to cleaner text below.
    }
  }
  if (raw.includes('invalid input for query argument')) {
    return 'Event-store timestamp query failed during ingestion/read. Backend has been updated to normalize UTC timestamps.';
  }
  return raw.replace(/^\d+:\s*/, '').slice(0, 180);
}

const aiStatusLabel = {
  enriched: 'AI enriched',
  pending: 'Analysis pending',
  failed: 'Analysis unavailable',
  rules_only: 'Rules only',
};

function EmptyLine({ children }) {
  return <p className="empty-copy">{children}</p>;
}

function EntityChip({ entity }) {
  const name = typeof entity === 'string' ? entity : entity?.name;
  const type = typeof entity === 'string' ? '' : entity?.type;
  if (!name) return null;
  return <span className="entity-chip">{name}{type ? <small>{type}</small> : null}</span>;
}

function StoryGraph({ graph }) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph?.edges) ? graph.edges : [];
  if (!nodes.length) return <EmptyLine>Story graph building.</EmptyLine>;

  return (
    <div className="ai-story-graph">
      {nodes.map((node, index) => (
        <React.Fragment key={node.id || `${node.label}-${index}`}>
          <div className={`story-node story-node-${node.type || 'node'}`}>
            <small>{node.type || 'node'}</small>
            <b>{node.label}</b>
          </div>
          {index < nodes.length - 1 && (
            <div className="story-edge">
              <span>{edges[index]?.label || ''}</span>
              <ArrowRight size={15} />
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function PulseBreakdown({ breakdown }) {
  const rows = [
    ['Freshness', breakdown?.freshness],
    ['Source count', breakdown?.source_count],
    ['Confidence', breakdown?.confidence],
    ['AI importance', breakdown?.ai_importance],
    ['User relevance', breakdown?.user_relevance],
  ];
  if (!breakdown) return <EmptyLine>Pulse breakdown unavailable.</EmptyLine>;
  return (
    <div className="pulse-breakdown">
      {rows.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <b>{Number.isFinite(Number(value)) ? Math.round(Number(value)) : '-'}</b>
        </div>
      ))}
    </div>
  );
}

function SourcesList({ sources }) {
  if (!sources.length) return <EmptyLine>No source details available.</EmptyLine>;
  return (
    <div className="source-list">
      {sources.map((source) => (
        <a key={source.id || source.url || source.title} href={source.url} target="_blank" rel="noreferrer">
          <b>{source.source || 'Source'}</b>
          <span>{source.title}</span>
        </a>
      ))}
    </div>
  );
}

function DetailDrawer({ shift, sources, onClose }) {
  if (!shift) return null;
  const isEnriched = shift.aiStatus === 'enriched';
  return (
    <aside className={`shift-drawer ai-detail ai-${shift.aiStatus}`}>
      <button className="drawer-close" onClick={onClose}><X size={18} /></button>
      <span>{aiStatusLabel[shift.aiStatus] || aiStatusLabel.rules_only}</span>
      <h2>{shift.headline}</h2>
      {shift.category && <em className="detail-category">{shift.category}</em>}
      <div className="drawer-grid">
        <div><small>Pulse</small><b>{shift.pulse ?? '-'}</b></div>
        <div><small>Exposure</small><b>{shift.exposure ?? '-'}</b></div>
        <div><small>Risk</small><b>{isEnriched ? shift.riskLevel || '-' : '-'}</b></div>
        <div><small>Opportunity</small><b>{isEnriched ? shift.opportunityLevel || '-' : '-'}</b></div>
      </div>

      <section>
        <h3>Summary</h3>
        {isEnriched && shift.summary ? <p>{shift.summary}</p> : <EmptyLine>{aiStatusLabel[shift.aiStatus] || aiStatusLabel.rules_only}</EmptyLine>}
      </section>

      <section>
        <h3>Why it matters</h3>
        {isEnriched && shift.whyItMatters ? <p>{shift.whyItMatters}</p> : <EmptyLine>No AI explanation available.</EmptyLine>}
      </section>

      <section>
        <h3>Entities</h3>
        {isEnriched && shift.entities?.length ? (
          <div className="entity-row detail-entities">
            {shift.entities.map((entity) => <EntityChip key={entity.name || entity} entity={entity} />)}
          </div>
        ) : <EmptyLine>No AI entities available.</EmptyLine>}
      </section>

      <section>
        <h3>Sources</h3>
        <SourcesList sources={sources} />
      </section>

      <section>
        <h3>Story graph</h3>
        <StoryGraph graph={isEnriched ? shift.storyGraph : null} />
      </section>

      <section>
        <h3>Risk / Opportunity</h3>
        <div className="risk-opportunity-grid">
          <div><small>Risk level</small><b>{isEnriched ? shift.riskLevel || '-' : '-'}</b></div>
          <div><small>Opportunity level</small><b>{isEnriched ? shift.opportunityLevel || '-' : '-'}</b></div>
          <div><small>Sentiment</small><b>{isEnriched ? shift.sentiment || '-' : '-'}</b></div>
        </div>
      </section>

      <section>
        <h3>Pulse explainability</h3>
        <PulseBreakdown breakdown={shift.pulseBreakdown} />
      </section>

      <section>
        <h3>Confidence explanation</h3>
        {isEnriched && shift.confidenceExplanation ? <p>{shift.confidenceExplanation}</p> : <EmptyLine>No confidence explanation available.</EmptyLine>}
      </section>

      <section>
        <h3>Uncertainty</h3>
        {isEnriched && shift.uncertainty ? <p>{shift.uncertainty}</p> : <EmptyLine>No uncertainty note available.</EmptyLine>}
      </section>
    </aside>
  );
}

function InsightDrawer({ view, data, onClose }) {
  if (!view) return null;

  const titles = {
    countries: 'Countries In Focus',
    sources: 'Sources Monitored',
  };

  return (
    <aside className="insight-drawer">
      <button className="drawer-close" onClick={onClose}><X size={18} /></button>
      <span>Live Lens</span>
      <h2>{titles[view] || 'Live Intelligence'}</h2>

      {view === 'countries' && (
        <div className="drawer-list">
          {(data.preferences?.regions || []).map((region) => <button key={region}>{String(region).replace(/-/g, ' ')}</button>)}
          {!data.preferences?.regions?.length && <p>No country or region preferences are active.</p>}
        </div>
      )}

      {view === 'sources' && (
        <div className="drawer-list">
          {(data.sources || []).slice(0, 12).map((source, index) => (
            <button key={source.id || source.name || source.url || index}>
              {source.name || source.domain || source.url || `Source ${index + 1}`}
            </button>
          ))}
          {!data.sources?.length && <p>Source details will appear when backend source rows are available.</p>}
        </div>
      )}
    </aside>
  );
}

function TourModal({ onClose }) {
  return (
    <div className="tour-modal">
      <div>
        <button onClick={onClose}><X size={18} /></button>
        <h2>World Pulse in 60 seconds</h2>
        <p><b>World Pulse</b> shows intensity from live event-backed signals.</p>
        <p><b>What Changed</b> tracks category movement from backend pulse snapshots.</p>
        <p><b>Top 3 Shifts</b> surfaces the highest-priority live signals.</p>
        <p><b>Focus Profile</b> controls the topics and regions used to personalize the screen.</p>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [preferences, setPreferences] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lockedToast, setLockedToast] = useState('');
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [selectedShift, setSelectedShift] = useState(null);
  const [insightView, setInsightView] = useState(null);
  const [tourOpen, setTourOpen] = useState(false);

  const load = useCallback(async ({ force = false } = {}) => {
    setError('');
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const [dashResult, alertsResult] = await Promise.all([
        api.getCachedDashboard(),
        api.getAlerts().catch(() => ({ alerts: [] })),
      ]);
      setPreferences({ data: { preferred_categories: dashResult?.topics_used || [], preferred_regions: dashResult?.regions_used || [] } });
      setDashboard(dashResult);
      setAlerts(alertsResult);
    } catch (err) {
      setDashboard(null);
      setPreferences(null);
      setAlerts(null);
      setError(readableLiveError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    const timer = window.setTimeout(() => load(), 0);
    return () => window.clearTimeout(timer);
  }, [user, load]);

  useEffect(() => {
    if (!lockedToast) return undefined;
    const timer = window.setTimeout(() => setLockedToast(''), 2200);
    return () => window.clearTimeout(timer);
  }, [lockedToast]);

  const data = useMemo(
    () => normalizeDashboardData({ dashboard, preferences, alerts, user }),
    [dashboard, preferences, alerts, user],
  );

  const topShifts = selectedTopic
    ? data.topShifts.filter((shift) => shift.raw?.matched_preferences?.some((item) => item.id === selectedTopic || item.label === selectedTopic))
    : data.topShifts;

  const articleIndex = useMemo(() => {
    const index = new Map();
    (data.raw?.articles || []).forEach((article) => index.set(String(article.id), article));
    return index;
  }, [data.raw]);

  const selectedSources = selectedShift?.articles?.length
    ? selectedShift.articles.map((id) => articleIndex.get(String(id))).filter(Boolean)
    : [];

  return (
    <div className="world-pulse-page">
      <LiveCursor />
      <Sidebar
        preferences={data.preferences}
        activeItem="home"
        onHome={() => { setSelectedTopic(null); setInsightView(null); }}
        onOrbit={() => navigate('/orbit')}
        onMap={() => navigate('/map')}
        onSimulator={() => navigate('/simulator')}
        onLocked={setLockedToast}
        onWatchlist={() => navigate('/watchlist')}
        onAlerts={() => navigate('/alerts')}
        onSetFocus={() => navigate('/onboarding')}
        onSettings={() => navigate('/settings')}
      />
      <main className="world-pulse-main">
        <TopHeader
          user={user}
          cache={data.cache}
          refreshing={refreshing}
          onRefresh={() => load({ force: true })}
          onAlerts={() => navigate('/alerts')}
          alertCount={data.alerts?.length || 0}
        />

        {loading ? <LoadingSkeleton /> : (
          <>
            {error && (
              <div className="wp-error">
                <b>Live data unavailable</b>
                <span>{error}</span>
                <button onClick={() => load()}>Retry</button>
              </div>
            )}

            <section className="wp-grid">
              <div className="wp-primary">
                <WorldPulseRing worldPulse={data.worldPulse} />
                <WhatChangedToday changes={data.changesToday} selectedTopic={selectedTopic} onSelect={setSelectedTopic} />
                <section className="wp-card top-shifts-section">
                  <div className="wp-section-head"><span>Top 3 Shifts You Must Know</span></div>
                  {topShifts.length ? (
                    <div className="top-shifts-list">
                      {topShifts.slice(0, 3).map((shift) => (
                        <TopShiftCard key={shift.id} shift={shift} onOpen={(s) => navigate(`/dashboard/event/${s.id}`)} index={topShifts.indexOf(shift)} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState title="No live shifts available." body="Event-backed signals will appear after ingestion produces dashboard events." />
                  )}
                </section>
                <StartTourCard onStart={() => setTourOpen(true)} />
              </div>

              <aside className="wp-right">
                <PulseTrendChart history={data.pulseHistory} worldPulse={data.worldPulse} />
                <QuickGlance
                  data={data.quickGlance}
                  onCountries={() => setInsightView('countries')}
                  onSignals={() => setSelectedTopic(null)}
                  onAlerts={() => navigate('/alerts')}
                  onSources={() => setInsightView('sources')}
                />
                <section className="wp-card system-status-card">
                  <div className="status-header">
                    <Activity size={14} className="status-icon" />
                    <span>System Status</span>
                  </div>
                  <div className="status-metrics">
                    <div className="status-metric">
                      <small>Last Sync</small>
                      <strong>{data.cache?.cachedAt ? formatRelativeTime(data.cache.cachedAt) : 'Live'}</strong>
                    </div>
                    <div className="status-metric">
                      <small>Pipeline</small>
                      <strong style={{textTransform: 'capitalize'}}>{(data.cache?.refreshType || 'active').replace('_', ' ')}</strong>
                    </div>
                  </div>
                </section>
              </aside>
            </section>
          </>
        )}
      </main>
      <DetailDrawer shift={selectedShift} sources={selectedSources} onClose={() => setSelectedShift(null)} />
      <InsightDrawer
        view={insightView}
        data={data}
        onClose={() => setInsightView(null)}
      />
      {tourOpen && <TourModal onClose={() => setTourOpen(false)} />}
      <LockedNavToast message={lockedToast} />
    </div>
  );
}
