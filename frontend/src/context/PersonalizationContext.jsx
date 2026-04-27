import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from './AuthContext';

const PersonalizationContext = createContext(null);

/* ── Helpers ─────────────────────────────────── */
function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
}
function writeJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

function signalId(cluster) {
  return cluster?.signal_id || cluster?.thread_id ||
    (cluster?.thread_title || cluster?.summary || 'signal').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80);
}

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Number(v) || 0));

function timeAgo(value) {
  const seconds = Math.max(1, Math.round((Date.now() - new Date(value || Date.now()).getTime()) / 1000));
  if (!Number.isFinite(seconds)) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

function words(text, max = 12) {
  const parts = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  return parts.length > max ? `${parts.slice(0, max).join(' ')}...` : parts.join(' ');
}

/* ── Score helpers ────────────────────────────── */
function calculatePulseBreakdown(cluster, interactionBoost = 0) {
  const velocity = clamp((cluster.source_count || cluster.article_ids?.length || 1) * 18 + Math.abs(cluster.delta?.value || 0) * 2);
  const sourceStrength = clamp(((cluster.source_diversity || 0.45) * 70) + Math.min(cluster.source_count || 1, 5) * 6);
  const sentiment = clamp((cluster.sentiment_intensity || 0.35) * 100);
  const entityRelevance = clamp((cluster.entities?.length || 0) * 18 + (cluster.matched_preferences?.length || 0) * 16);
  const userRelevance = clamp(cluster.relevance_score || cluster.exposure_score || 50);
  const weighted = Math.round(velocity * 0.3 + sourceStrength * 0.25 + sentiment * 0.2 + entityRelevance * 0.15 + userRelevance * 0.1 + interactionBoost);
  return {
    score: clamp(cluster.pulse_score || weighted),
    parts: [['Velocity', velocity, '30%'], ['Source strength', sourceStrength, '25%'], ['Sentiment intensity', sentiment, '20%'], ['Entity relevance', entityRelevance, '15%'], ['User relevance', userRelevance, '10%']],
  };
}

function calculateExposureBreakdown(cluster) {
  const factors = cluster.why_relevant?.factors || [];
  const topic = factors.find(f => f.type === 'topic')?.points || (cluster.matched_preferences?.length ? 25 : 8);
  const entity = factors.find(f => f.type === 'entity')?.points || Math.min((cluster.entities?.length || 0) * 8, 24);
  const region = factors.find(f => f.type === 'region')?.points || 0;
  const memory = factors.find(f => ['watchlist', 'saved', 'interaction'].includes(f.type))?.points || 0;
  return {
    score: clamp(cluster.relevance_score || cluster.exposure_score || topic + entity + region + memory),
    parts: [['Topic overlap', topic], ['Tracked entities', entity], ['Region overlap', region], ['Past interactions', memory]],
  };
}

function buildDelta(cluster, backendDelta, previousPulseMap) {
  const id = signalId(cluster);
  const current = Math.round(cluster.pulse_score || 50);
  const previous = backendDelta?.has_baseline ? Math.round(backendDelta.previous) : previousPulseMap[id];
  if (typeof previous !== 'number') return { value: null, label: 'Tracking baseline', tone: 'neutral', current, previous: null };
  const value = current - previous;
  const direction = value > 0 ? 'Momentum Rising' : value < 0 ? 'Cooling' : 'Stable';
  return { value, label: `${value > 0 ? '+' : ''}${value} ${direction}`, tone: value > 0 ? 'up' : value < 0 ? 'down' : 'neutral', current, previous };
}

function normalizeSignal(cluster, dashboard, localState) {
  const id = signalId(cluster);
  const matched = cluster?.matched_preferences?.[0]?.id;
  const backendDelta = dashboard?.daily_delta?.find(d => d.topic === matched) || null;
  const pulse = calculatePulseBreakdown(cluster, localState.engagement[id] || 0);
  const exposure = calculateExposureBreakdown(cluster);
  const delta = buildDelta({ ...cluster, pulse_score: pulse.score }, backendDelta, localState.previousPulse);
  const riskLevel = cluster.risk_type === 'risk' ? 'High' : cluster.risk_type === 'opportunity' ? 'Low' : 'Medium';
  const opportunityLevel = cluster.risk_type === 'opportunity' ? 'High' : exposure.score >= 70 ? 'Medium' : 'Low';
  const confidence = Math.round(clamp((cluster.confidence || 0.65) * 100));
  const saved = localState.saved.has(id) || dashboard?.saved_signal_ids?.includes(id);
  const tracked = localState.tracked.has(id) || dashboard?.watched_signal_ids?.includes(id);
  const dismissed = localState.dismissed.has(id) || cluster.dismissed;
  const rank = pulse.score + exposure.score + (saved ? 18 : 0) + (tracked ? 24 : 0) + (localState.engagement[id] || 0) - (dismissed ? 999 : 0);

  return {
    ...cluster, id, thread_id: id, pulse, exposure, delta, riskLevel, opportunityLevel, confidence,
    saved, tracked, dismissed, rank,
    updatedAgo: timeAgo(cluster.updated_at || dashboard?.generated_at),
    whyLine: cluster.impact_line || cluster.why_it_matters || cluster.summary || 'Signal impact is forming.',
  };
}

const TOPIC_LABELS = {
  tech: 'Tech', politics: 'Geopolitics', markets: 'Markets', ai: 'AI', climate: 'Climate',
  healthcare: 'Health', defense: 'Defense', crypto: 'Crypto', space: 'Space', trade: 'Trade',
  auto: 'Auto', telecom: 'Telecom', 'real-estate': 'Real Estate', media: 'Media',
  education: 'Education', legal: 'Legal',
};

/* ── Provider ────────────────────────────────── */
export function PersonalizationProvider({ children }) {
  const { user } = useAuth();

  // Raw dashboard data
  const [dashboardData, setDashboardData] = useState(() => readJson('ni_cached_dashboard', null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Local interaction state (optimistic)
  const [savedIds, setSavedIds] = useState(() => new Set(readJson('ni_saved_signals', [])));
  const [trackedIds, setTrackedIds] = useState(() => new Set(readJson('ni_tracked_signals', [])));
  const [dismissedIds, setDismissedIds] = useState(() => new Set(readJson('ni_dismissed_signals', [])));
  const [engagement, setEngagement] = useState(() => readJson('ni_signal_engagement', {}));
  const [previousPulse] = useState(() => readJson('ni_previous_pulse', {}));

  // Separate data
  const [watchlistData, setWatchlistData] = useState(null);
  const [alertsData, setAlertsData] = useState(null);
  const [pulseHistoryData, setPulseHistoryData] = useState(null);
  const [entitiesData, setEntitiesData] = useState(null);

  // Toast
  const [toast, setToast] = useState(null);
  const showToast = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(null), 2400); }, []);

  // Refresh flag
  const refreshCounter = useRef(0);

  /* ── Load dashboard ───── */
  const loadDashboard = useCallback(async () => {
    setError(null);
    try {
      const res = await api.getPersonalizedDashboard();
      setDashboardData(res);
      writeJson('ni_cached_dashboard', res);
      setSavedIds(prev => new Set([...prev, ...(res.saved_signal_ids || [])]));
      setTrackedIds(prev => new Set([...prev, ...(res.watched_signal_ids || [])]));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── Load supplementary data ── */
  const loadWatchlist = useCallback(async () => {
    try { setWatchlistData(await api.getWatchlist()); } catch (e) { console.warn('Watchlist load:', e); }
  }, []);

  const loadAlerts = useCallback(async () => {
    try { setAlertsData(await api.getAlerts()); } catch (e) { console.warn('Alerts load:', e); }
  }, []);

  const loadPulseHistory = useCallback(async (days = 30) => {
    try { setPulseHistoryData(await api.getPulseHistory(days)); } catch (e) { console.warn('Pulse history load:', e); }
  }, []);

  const loadEntities = useCallback(async () => {
    try { setEntitiesData(await api.getEntities()); } catch (e) { console.warn('Entities load:', e); }
  }, []);

  /* ── Initial load ─── */
  useEffect(() => {
    if (!user) return;
    loadDashboard();
  }, [user, loadDashboard]);

  /* ── Local state helpers ── */
  const persistLocalSet = (key, setter, updater) => {
    setter(prev => { const next = updater(new Set(prev)); writeJson(key, [...next]); return next; });
  };

  const bumpEngagement = (id, amount) => {
    setEngagement(prev => { const next = { ...prev, [id]: (prev[id] || 0) + amount }; writeJson('ni_signal_engagement', next); return next; });
  };

  /* ── Normalized signals (derived) ── */
  const localState = useMemo(() => ({
    saved: savedIds, tracked: trackedIds, dismissed: dismissedIds, engagement, previousPulse,
  }), [savedIds, trackedIds, dismissedIds, engagement, previousPulse]);

  const signals = useMemo(() => {
    return (dashboardData?.clusters || [])
      .map(cluster => normalizeSignal(cluster, dashboardData, localState))
      .filter(signal => !signal.dismissed)
      .sort((a, b) => b.rank - a.rank);
  }, [dashboardData, localState]);

  const allSignals = useMemo(() => {
    return (dashboardData?.clusters || [])
      .map(cluster => normalizeSignal(cluster, dashboardData, localState))
      .sort((a, b) => b.rank - a.rank);
  }, [dashboardData, localState]);

  /* ── Snapshot previous pulse ── */
  useEffect(() => {
    if (!signals.length) return;
    const snapshot = { ...previousPulse };
    signals.forEach(s => { snapshot[s.id] = Math.round(s.pulse.score); });
    writeJson('ni_previous_pulse', snapshot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardData?.generated_at]);

  /* ── Derived state ── */
  const topics = useMemo(() => [
    ...(dashboardData?.topics_used || []).map(t => TOPIC_LABELS[t] || t),
    ...(dashboardData?.regions_used || []),
  ], [dashboardData]);

  const topicIds = dashboardData?.topics_used || [];
  const regionIds = dashboardData?.regions_used || [];
  const trackedEntities = dashboardData?.tracked_entities || [];
  const exposureScore = dashboardData?.exposure_score || 50;
  const dailyDelta = dashboardData?.daily_delta || [];
  const sourcesCount = dashboardData?.sources_count || 0;
  const generatedAt = dashboardData?.generated_at;
  const alerts = alertsData?.alerts || dashboardData?.alerts || [];
  const unreadAlertCount = alertsData?.unread_count ?? alerts.filter(a => a.unread && !a.resolved).length;
  const pulseHistory = pulseHistoryData || dashboardData?.pulse_history || {};
  const exposureNetwork = dashboardData?.exposure_network || { nodes: [], edges: [] };
  const watchedSignals = watchlistData?.watched_signals || [];
  const savedThreads = watchlistData?.saved_threads || [];

  /* ── Action methods (optimistic + API) ── */
  const saveSignal = useCallback(async (signal) => {
    const id = signal.id || signalId(signal);
    persistLocalSet('ni_saved_signals', setSavedIds, next => (next.add(id), next));
    bumpEngagement(id, 3);
    showToast('Signal saved and ranking boosted');
    api.saveThread(id).catch(() => {});
    api.recordInteraction(id, 'save').catch(() => {});
    loadWatchlist();
  }, [showToast, loadWatchlist]);

  const unsaveSignal = useCallback(async (signal) => {
    const id = signal.id || signal.thread_id || signalId(signal);
    persistLocalSet('ni_saved_signals', setSavedIds, next => (next.delete(id), next));
    showToast('Signal unsaved');
    loadWatchlist();
  }, [showToast, loadWatchlist]);

  const trackSignal = useCallback(async (signal) => {
    const id = signal.id || signalId(signal);
    persistLocalSet('ni_tracked_signals', setTrackedIds, next => (next.add(id), next));
    bumpEngagement(id, 5);
    const entity = signal.entities?.[0]?.name;
    showToast(entity ? `${entity} tracked` : 'Topic tracked');
    api.watchSignal(id, 1).catch(() => {});
    if (entity) api.trackEntity(entity, 'ORG', 1).catch(() => {});
    api.recordInteraction(id, 'watch').catch(() => {});
    loadWatchlist();
    loadEntities();
  }, [showToast, loadWatchlist, loadEntities]);

  const untrackSignal = useCallback(async (signal) => {
    const id = signal.id || signal.signal_id || signalId(signal);
    persistLocalSet('ni_tracked_signals', setTrackedIds, next => (next.delete(id), next));
    showToast('Signal untracked');
    loadWatchlist();
  }, [showToast, loadWatchlist]);

  const dismissSignal = useCallback(async (signal) => {
    const id = signal.id || signalId(signal);
    persistLocalSet('ni_dismissed_signals', setDismissedIds, next => (next.add(id), next));
    showToast('Signal dismissed and ranking reduced');
    api.dismissSignal(id, 'not_relevant').catch(() => {});
    api.recordInteraction(id, 'dismiss').catch(() => {});
  }, [showToast]);

  const trackEntity = useCallback(async (name, type = 'ORG') => {
    showToast(`Tracking ${name}`);
    api.trackEntity(name, type, 1).catch(() => {});
    loadEntities();
    // Reload dashboard after a delay so backend can factor in the entity
    setTimeout(() => loadDashboard(), 1500);
  }, [showToast, loadEntities, loadDashboard]);

  const recordOpen = useCallback((signal) => {
    const id = signal.id || signalId(signal);
    bumpEngagement(id, 4);
    api.recordInteraction(id, 'open').catch(() => {});
  }, []);

  const recordExplain = useCallback((signal) => {
    const id = signal.id || signalId(signal);
    api.recordInteraction(id, 'explain').catch(() => {});
  }, []);

  const recordGraph = useCallback((signal) => {
    const id = signal.id || signalId(signal);
    bumpEngagement(id, 3);
    api.recordInteraction(id, 'graph').catch(() => {});
  }, []);

  const resolveAlert = useCallback(async (alertId) => {
    showToast('Alert resolved');
    // Update local state optimistically
    setAlertsData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        alerts: prev.alerts.map(a => a.id === alertId ? { ...a, resolved: true, unread: false } : a),
        unread_count: Math.max(0, (prev.unread_count || 0) - 1),
      };
    });
  }, [showToast]);

  const resolveAllAlerts = useCallback(async () => {
    showToast('All alerts resolved');
    setAlertsData(prev => {
      if (!prev) return prev;
      return { ...prev, alerts: prev.alerts.map(a => ({ ...a, resolved: true, unread: false })), unread_count: 0 };
    });
  }, [showToast]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await loadDashboard();
  }, [loadDashboard]);

  const value = useMemo(() => ({
    // State
    loading, error, dashboardData, signals, allSignals,
    savedIds, trackedIds, dismissedIds,
    topics, topicIds, regionIds,
    trackedEntities, exposureScore, dailyDelta, sourcesCount, generatedAt,
    alerts, unreadAlertCount, pulseHistory, exposureNetwork,
    watchedSignals, savedThreads,
    toast,
    // Actions
    saveSignal, unsaveSignal, trackSignal, untrackSignal, dismissSignal,
    trackEntity, recordOpen, recordExplain, recordGraph,
    resolveAlert, resolveAllAlerts, refresh, showToast,
    // Utilities
    signalId, timeAgo, words, clamp, TOPIC_LABELS,
  }), [
    loading, error, dashboardData, signals, allSignals,
    savedIds, trackedIds, dismissedIds,
    topics, topicIds, regionIds,
    trackedEntities, exposureScore, dailyDelta, sourcesCount, generatedAt,
    alerts, unreadAlertCount, pulseHistory, exposureNetwork,
    watchedSignals, savedThreads,
    toast,
    saveSignal, unsaveSignal, trackSignal, untrackSignal, dismissSignal,
    trackEntity, recordOpen, recordExplain, recordGraph,
    resolveAlert, resolveAllAlerts, refresh, showToast,
  ]);

  return (
    <PersonalizationContext.Provider value={value}>
      {children}
    </PersonalizationContext.Provider>
  );
}

export function usePersonalization() {
  const ctx = useContext(PersonalizationContext);
  if (!ctx) throw new Error('usePersonalization must be used within PersonalizationProvider');
  return ctx;
}

export { signalId, timeAgo, words, clamp, TOPIC_LABELS, calculatePulseBreakdown, calculateExposureBreakdown, normalizeSignal };
