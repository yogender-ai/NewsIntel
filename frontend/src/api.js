const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export const api = {
  // Single combined dashboard call (replaces 3 separate calls)
  getDashboard: (articles) =>
    request('/api/dashboard', {
      method: 'POST',
      body: JSON.stringify({ articles }),
    }),

  // Story Deep Dive (only called when user clicks a story)
  storyDeepDive: (title, text, source) =>
    request('/api/stories/deep-dive', {
      method: 'POST',
      body: JSON.stringify({ title, text, source }),
    }),

  // User Preferences
  savePreferences: (data) =>
    request('/api/user/preferences', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getPreferences: () => request('/api/user/preferences'),
};
