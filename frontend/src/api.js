/**
 * API client for the News Intelligence backend
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Analyze a topic — hits the backend /analyze endpoint
 * @param {string} topic
 * @param {string} region
 * @returns {Promise<object>}
 */
export async function analyzeTopic(topic, region = 'global') {
  const url = `${API_BASE}/analyze?topic=${encodeURIComponent(topic)}&region=${encodeURIComponent(region)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Analysis failed (${response.status})`);
  }

  return response.json();
}

/**
 * Fetch available regions
 * @returns {Promise<object>}
 */
export async function fetchRegions() {
  try {
    const response = await fetch(`${API_BASE}/regions`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (response.ok) {
      return response.json();
    }
  } catch {
    // Fallback
  }
  return {
    regions: [
      { code: 'global', name: 'Global', flag: '🌍' },
      { code: 'in', name: 'India', flag: '🇮🇳' },
      { code: 'us', name: 'United States', flag: '🇺🇸' },
      { code: 'gb', name: 'United Kingdom', flag: '🇬🇧' },
    ],
  };
}

/**
 * Ping the backend health endpoint to warm up Render
 */
export async function pingHealth() {
  try {
    await fetch(`${API_BASE}/health`, { method: 'GET' });
  } catch {
    // Silently fail — it's just a warm-up
  }
}
