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
import LockedNavToast from '../components/worldpulse/LockedNavToast';
import StartTourCard from '../components/worldpulse/StartTourCard';
import FreshnessBadge from '../components/worldpulse/FreshnessBadge';

function LoadingSkeleton() {
  return (
    <div className="wp-loading">
      <div /><div /><div /><div />
    </div>
  );
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
        <div><small>Pulse</small><b>{shift.pulse ?? '—'}</b></div>
        <div><small>Exposure</small><b>{shift.exposure ?? '—'}</b></div>
        <div><small>Impact</small><b>{shift.impactLevel || '—'}</b></div>
        <div><small>Sources</small><b>{shift.sourceCount ?? '—'}</b></div>
      </div>
      <section>
        <h3>Why it matters</h3>
        <p>{shift.raw?.why_it_matters || shift.summary || 'No additional backend explanation available.'}</p>
      </section>
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
  const [tourOpen, setTourOpen] = useState(false);

  const CACHE_KEY = 'ni_hp_cache';

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
      // Persist to localStorage as fallback
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ dashboard: dashResult, preferences: prefsResult, alerts: alertsResult, ts: Date.now() }));
      } catch { /* quota exceeded — ignore */ }
    } catch (err) {
      // Try to recover from localStorage cache
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
        if (cached?.dashboard) {
          setDashboard(cached.dashboard);
          setPreferences(cached.preferences);
          setAlerts(cached.alerts);
          const ageMinutes = Math.round((Date.now() - (cached.ts || 0)) / 60000);
          setError(`Showing cached data (${ageMinutes}m old). Live feed unavailable: ${(err.message || '').slice(0, 80)}`);
        } else {
          setError(err.message || 'Unable to load live intelligence.');
        }
      } catch {
        setError(err.message || 'Unable to load live intelligence.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  useEffect(() => {
    if (!lockedToast) return undefined;
    const timer = setTimeout(() => setLockedToast(''), 2600);
    return () => clearTimeout(timer);
  }, [lockedToast]);

  const data = useMemo(
    () => normalizeDashboardData({ dashboard, preferences, alerts, user }),
    [dashboard, preferences, alerts, user],
  );

  const topShifts = selectedTopic
    ? data.topShifts.filter((shift) => shift.raw?.matched_preferences?.some((item) => item.id === selectedTopic || item.label === selectedTopic))
    : data.topShifts;

  return (
    <div className="world-pulse-page">
      <Sidebar
        preferences={data.preferences}
        onLocked={setLockedToast}
        onSetFocus={() => navigate('/onboarding')}
        onSettings={() => navigate('/settings')}
      />
      <main className="world-pulse-main">
        <TopHeader
          user={user}
          cache={data.cache}
          refreshing={refreshing}
          onRefresh={() => load({ force: true })}
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
                <QuickGlance data={data.quickGlance} />
                <section className="wp-card trust-card">
                  <div className="wp-section-head"><span>Source / Freshness Trust</span></div>
                  <FreshnessBadge cache={data.cache} />
                  {data.cache?.isStale && <p>Showing latest cached intelligence. Refreshing in background.</p>}
                  <dl>
                    <div><dt>Refresh type</dt><dd>{data.cache?.refreshType || '—'}</dd></div>
                    <div><dt>Next refresh</dt><dd>{data.cache?.nextRefreshAt || '—'}</dd></div>
                  </dl>
                </section>
              </aside>
            </section>
          </>
        )}
      </main>
      <DetailDrawer shift={selectedShift} onClose={() => setSelectedShift(null)} />
      {tourOpen && <TourModal onClose={() => setTourOpen(false)} />}
      <LockedNavToast message={lockedToast} />
    </div>
  );
}
