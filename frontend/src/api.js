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
};
