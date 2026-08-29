/* API client for the NewsIntel core-v2 backend.
 *
 * Replaces the Firebase-header client. Identity is a bearer access token; when it
 * expires mid-flight the client refreshes once and replays the original request, so
 * callers never have to think about token lifetime. Concurrent 401s share a single
 * refresh rather than stampeding the endpoint. */

const API_BASE = import.meta.env.VITE_API_URL || '';

const ACCESS_KEY = 'ni_access';
const REFRESH_KEY = 'ni_refresh';

/* localStorage throws in some privacy modes; never let that break the app. */
const safeStore = {
  get(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  },
};

export const tokens = {
  access: () => safeStore.get(ACCESS_KEY),
  refresh: () => safeStore.get(REFRESH_KEY),
  set({ access_token, refresh_token }) {
    if (access_token) safeStore.set(ACCESS_KEY, access_token);
    if (refresh_token) safeStore.set(REFRESH_KEY, refresh_token);
  },
  clear() {
    safeStore.remove(ACCESS_KEY);
    safeStore.remove(REFRESH_KEY);
  },
};

const listeners = new Set();
export function onAuthLost(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function authLost() {
  tokens.clear();
  listeners.forEach((fn) => fn());
}

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

async function toError(res) {
  const text = await res.text().catch(() => '');
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { /* not json */ }
  let detail = payload?.detail ?? payload?.message ?? text;
  // FastAPI validation errors arrive as a list of {loc, msg}.
  if (Array.isArray(detail)) {
    detail = detail.map((d) => d?.msg).filter(Boolean).join('; ') || 'Validation failed';
  }
  return new ApiError(detail || `Request failed (${res.status})`, res.status, payload);
}

let refreshInFlight = null;

async function refreshAccessToken() {
  const refresh_token = tokens.refresh();
  if (!refresh_token) return false;

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token }),
        });
        if (!res.ok) return false;
        tokens.set(await res.json());
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

async function request(path, { method = 'GET', body, timeoutMs = 30000, auth = true, retryOn401 = true } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const access = tokens.access();
  if (auth && access) headers.Authorization = `Bearer ${access}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      signal: controller.signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new ApiError('The request timed out. The server may be waking up.', 0, null);
    }
    throw new ApiError('Could not reach the server. Check your connection.', 0, null);
  }
  clearTimeout(timer);

  if (res.status === 401 && auth && retryOn401 && tokens.refresh()) {
    if (await refreshAccessToken()) {
      return request(path, { method, body, timeoutMs, auth, retryOn401: false });
    }
    authLost();
  }

  if (!res.ok) throw await toError(res);
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  /* ── auth ── */
  signup: (email, password, display_name) =>
    request('/api/auth/signup', { method: 'POST', body: { email, password, display_name }, auth: false }),
  login: (email, password) =>
    request('/api/auth/login', { method: 'POST', body: { email, password }, auth: false }),
  logout: () => {
    const refresh_token = tokens.refresh();
    const done = refresh_token
      ? request('/api/auth/logout', { method: 'POST', body: { refresh_token } }).catch(() => null)
      : Promise.resolve();
    return done.finally(() => tokens.clear());
  },
  me: () => request('/api/auth/me'),
  updateProfile: (patch) => request('/api/auth/me/profile', { method: 'PATCH', body: patch }),
  deleteAccount: () => request('/api/auth/me', { method: 'DELETE' }),

  /* ── intelligence ── */
  snapshot: () => request('/api/home-snapshot'),
  story: (id) => request(`/api/story/${encodeURIComponent(id)}`),
  orbit: () => request('/api/orbit'),
  pipelineMonitor: () => request('/api/pipeline/monitor'),

  /* ── ask (RAG) ── */
  ask: (question, { days = 14, max_sources = 8, personalize = true } = {}) =>
    request('/api/ask', {
      method: 'POST',
      body: { question, days, max_sources, personalize },
      timeoutMs: 120000,
    }),
  askCorpus: () => request('/api/ask/corpus'),
};

export { API_BASE };
