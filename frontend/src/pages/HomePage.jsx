import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { normalizeDashboardData } from '../lib/dashboardAdapter';
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

function LoadingSkeleton() {
  return (
    <div className="wp-loading">
      <div /><div /><div /><div />
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
      className={`live-cursor ${pressed ? 'pressed' : ''}`}
      style={{ '--cursor-x': `${point.x}px`, '--cursor-y': `${point.y}px` }}
    />
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

function DetailDrawer({ shift, onClose }) {
  if (!shift) return null;
  return (
    <aside className="shift-drawer">
      <button className="drawer-close" onClick={onClose}><X size={18} /></button>
      <span>{shift.category || 'Signal'}</span>
      <h2>{shift.headline}</h2>
      {shift.summary && <p>{shift.summary}</p>}
      <div className="drawer-grid">
        <div><small>Pulse</small><b>{shift.pulse ?? '-'}</b></div>
        <div><small>Exposure</small><b>{shift.exposure ?? '-'}</b></div>
        <div><small>Impact</small><b>{shift.impactLevel || '-'}</b></div>
        <div><small>Sources</small><b>{shift.sourceCount ?? '-'}</b></div>
      </div>
      <section>
        <h3>Why it matters</h3>
        <p>{shift.raw?.why_it_matters || shift.summary || 'No additional backend explanation available.'}</p>
      </section>
    </aside>
  );
}

function InsightDrawer({ view, data, onClose, onSelectTopic, onOpenShift, onRefresh }) {
  if (!view) return null;

  const titles = {
    orbit: 'Signal Orbit',
    map: 'Signal Map',
    simulator: 'Scenario Simulator',
    countries: 'Countries In Focus',
    sources: 'Sources Monitored',
  };

  return (
    <aside className="insight-drawer">
      <button className="drawer-close" onClick={onClose}><X size={18} /></button>
      <span>Live Lens</span>
      <h2>{titles[view] || 'Live Intelligence'}</h2>

      {view === 'orbit' && (
        <div className="orbit-lens">
          {(data.changesToday || []).slice(0, 6).map((item, index) => (
            <button
              key={item.id}
              style={{ '--i': index, '--orbit-power': `${Math.max(24, Math.abs(item.delta || item.current || 20))}%` }}
              onClick={() => onSelectTopic(item.id)}
            >
              <b>{item.topic}</b>
              <small>{item.delta === null ? item.direction : `${item.delta > 0 ? '+' : ''}${item.delta}`}</small>
            </button>
          ))}
          {!data.changesToday?.length && <p>Movement baseline is still building from live snapshots.</p>}
        </div>
      )}

      {view === 'map' && (
        <div className="map-lens">
          {(data.preferences?.regions || []).map((region, index) => (
            <button key={region} style={{ '--i': index }} onClick={() => onSelectTopic(null)}>
              <b>{String(region).replace(/-/g, ' ')}</b>
              <small>Focus region</small>
            </button>
          ))}
          {!data.preferences?.regions?.length && <p>No focus regions are set yet.</p>}
        </div>
      )}

      {view === 'simulator' && (
        <div className="scenario-lens">
          {(data.topShifts || []).slice(0, 3).map((shift) => (
            <button key={shift.id} onClick={() => onOpenShift(shift)}>
              <b>{shift.headline}</b>
              <small>Pulse {shift.pulse ?? '-'} / Sources {shift.sourceCount ?? '-'}</small>
            </button>
          ))}
          <button onClick={onRefresh}>Recalculate from live feed</button>
        </div>
      )}

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
          {!data.sources?.length && <p>Source details will appear when the backend includes source rows.</p>}
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
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [selectedShift, setSelectedShift] = useState(null);
  const [insightView, setInsightView] = useState(null);
  const [tourOpen, setTourOpen] = useState(false);

  const load = useCallback(async ({ force = false } = {}) => {
    setError('');
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const prefsResult = await api.getPreferences().catch(() => null);
      const prefsData = prefsResult?.data || null;
      const topics = prefsData?.preferred_categories || [];
      const regions = prefsData?.preferred_regions || [];
      const [dashResult, alertsResult] = await Promise.all([
        force ? api.forceDashboardRefresh(topics, regions) : api.getPersonalizedDashboard(),
        api.getAlerts().catch(() => null),
      ]);
      setPreferences(prefsResult);
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

  const data = useMemo(
    () => normalizeDashboardData({ dashboard, preferences, alerts, user }),
    [dashboard, preferences, alerts, user],
  );

  const topShifts = selectedTopic
    ? data.topShifts.filter((shift) => shift.raw?.matched_preferences?.some((item) => item.id === selectedTopic || item.label === selectedTopic))
    : data.topShifts;

  return (
    <div className="world-pulse-page">
      <LiveCursor />
      <Sidebar
        preferences={data.preferences}
        onHome={() => { setSelectedTopic(null); setInsightView(null); }}
        onOrbit={() => setInsightView('orbit')}
        onMap={() => setInsightView('map')}
        onSimulator={() => setInsightView('simulator')}
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
                        <TopShiftCard key={shift.id} shift={shift} onOpen={setSelectedShift} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState title="No live shifts available." body="Event-backed signals will appear after ingestion produces dashboard events." />
                  )}
                </section>
                <StartTourCard onStart={() => setTourOpen(true)} />
              </div>

              <aside className="wp-right">
                <PulseTrendChart history={data.pulseHistory} />
                <QuickGlance
                  data={data.quickGlance}
                  onCountries={() => setInsightView('countries')}
                  onSignals={() => setInsightView('orbit')}
                  onAlerts={() => navigate('/alerts')}
                  onSources={() => setInsightView('sources')}
                />
                <section className="wp-card trust-card">
                  <div className="wp-section-head"><span>Source / Freshness Trust</span></div>
                  <FreshnessBadge cache={data.cache} />
                  {data.cache?.isStale && <p>Showing latest cached intelligence. Refreshing in background.</p>}
                  <dl>
                    <div><dt>Refresh type</dt><dd>{data.cache?.refreshType || '-'}</dd></div>
                    <div><dt>Next refresh</dt><dd>{data.cache?.nextRefreshAt || '-'}</dd></div>
                  </dl>
                </section>
              </aside>
            </section>
          </>
        )}
      </main>
      <DetailDrawer shift={selectedShift} onClose={() => setSelectedShift(null)} />
      <InsightDrawer
        view={insightView}
        data={data}
        onClose={() => setInsightView(null)}
        onSelectTopic={(topic) => { setSelectedTopic(topic); setInsightView(null); }}
        onOpenShift={(shift) => { setSelectedShift(shift); setInsightView(null); }}
        onRefresh={() => load({ force: true })}
      />
      {tourOpen && <TourModal onClose={() => setTourOpen(false)} />}
    </div>
  );
}
