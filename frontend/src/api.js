const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  };

  const res = await fetch(url, config);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  // Layer 01 — Daily Brief
  getDailyBrief: (articles) =>
    request('/api/daily-brief', {
      method: 'POST',
      body: JSON.stringify({ articles }),
    }),

  // Layer 02 — Analyze & Cluster Stories
  analyzeStories: (articles) =>
    request('/api/stories/analyze', {
      method: 'POST',
      body: JSON.stringify({ articles }),
    }),

  // Layer 03 — Story Deep Dive
  storyDeepDive: (title, text, source) =>
    request('/api/stories/deep-dive', {
      method: 'POST',
      body: JSON.stringify({ title, text, source }),
    }),

  // Layer 05 — Personal Impact
  getImpact: (story_text) =>
    request('/api/personalize/impact', {
      method: 'POST',
      body: JSON.stringify({ story_text }),
    }),

  // User Preferences
  savePreferences: (data) =>
    request('/api/user/preferences', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getPreferences: () => request('/api/user/preferences'),

  // Health
  health: () => request('/health'),
};
