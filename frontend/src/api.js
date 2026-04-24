import { auth } from './firebase';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

function getHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const currentUser = auth.currentUser;
  // Attach Firebase identity so backend can personalize per user and recover
  // preferences by email if a UID row is missing after a deploy/database move.
  const uid = currentUser?.uid;
  if (uid) headers['X-User-Id'] = uid;
  if (currentUser?.email) headers['X-User-Email'] = currentUser.email;
  return headers;
}

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: getHeaders(),
    ...options,
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`${res.status}: ${err.slice(0, 100)}`);
  }
  return res.json();
}

export const api = {
  // GET: Serve cached intelligence, personalized per user via X-User-Id header
  getCachedDashboard: () =>
    request('/api/dashboard', { method: 'GET' }),

  getPersonalizedDashboard: () =>
    request('/api/personalized-dashboard', { method: 'GET' }),

  // POST: Force full pipeline refresh (user-triggered)
  forceDashboardRefresh: (topics = [], regions = []) =>
    request('/api/dashboard', {
      method: 'POST',
      body: JSON.stringify({ topics, regions }),
    }),

  // Legacy alias (used by Dashboard.jsx)
  getDashboard: (topics = [], regions = [], force = false) =>
    force
      ? request('/api/dashboard', { method: 'POST', body: JSON.stringify({ topics, regions }) })
      : request('/api/dashboard', { method: 'GET' }),

  storyDeepDive: (title, text, source) =>
    request('/api/stories/deep-dive', {
      method: 'POST',
      body: JSON.stringify({ title, text, source }),
    }),

  savePreferences: (prefs) =>
    request('/api/user/preferences', {
      method: 'POST',
      body: JSON.stringify(prefs),
    }),

  getPreferences: () => request('/api/user/preferences'),

  deleteAccount: () =>
    request('/api/user/account', { method: 'DELETE' }),

  // ── Watchlist ──
  watchSignal: (signal_id, watch_priority = 1) =>
    request('/api/watchlist', {
      method: 'POST',
      body: JSON.stringify({ signal_id, watch_priority }),
    }),

  getWatchlist: () => request('/api/watchlist'),

  // ── Saved Threads ──
  saveThread: (thread_id) =>
    request('/api/saved-threads', {
      method: 'POST',
      body: JSON.stringify({ thread_id }),
    }),

  // ── Entities ──
  trackEntity: (entity_name, entity_type = 'ENTITY', follow_weight = 1) =>
    request('/api/entities', {
      method: 'POST',
      body: JSON.stringify({ entity_name, entity_type, follow_weight }),
    }),

  getEntities: () => request('/api/entities'),

  // ── Dismissed Signals ──
  dismissSignal: (signal_id, dismiss_reason = 'not_relevant') =>
    request('/api/dismissed-signals', {
      method: 'POST',
      body: JSON.stringify({ signal_id, dismiss_reason }),
    }),

  // ── Interactions ──
  recordInteraction: (signal_id, interaction_type, metadata = {}, dwell_time_seconds = 0) =>
    request('/api/interactions', {
      method: 'POST',
      body: JSON.stringify({ signal_id, interaction_type, metadata, dwell_time_seconds }),
    }),

  // ── Story Graph ──
  getStoryGraph: (thread_id) => request(`/api/story-graph/${encodeURIComponent(thread_id)}`),

  // ── Alerts ──
  getAlerts: () => request('/api/alerts'),

  // ── Pulse History ──
  getPulseHistory: (days = 30) => request(`/api/pulse-history?days=${days}`),

  // ── Exposure Network ──
  getExposureNetwork: () => request('/api/exposure-network'),
};
