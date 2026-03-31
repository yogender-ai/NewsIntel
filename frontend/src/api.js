/**
 * API client for the News Intelligence backend v4.0
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Analyze a topic — hits the backend /analyze endpoint
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
 * Fetch trending headlines (fast, no NLP)
 */
export async function fetchTrending() {
  try {
    const response = await fetch(`${API_BASE}/trending`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (response.ok) {
      return response.json();
    }
  } catch {
    // Silently fail
  }
  return { headlines: [], count: 0, has_breaking: false, city_suggestions: [] };
}

/**
 * Fetch weather for a city
 */
export async function fetchWeather(city = 'Delhi') {
  try {
    const response = await fetch(`${API_BASE}/weather?city=${encodeURIComponent(city)}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (response.ok) {
      return response.json();
    }
  } catch {
    // Silently fail
  }
  return null;
}

/**
 * Fetch stock market data
 */
export async function fetchStocks() {
  try {
    const response = await fetch(`${API_BASE}/stocks`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (response.ok) {
      return response.json();
    }
  } catch {
    // Silently fail
  }
  return { stocks: [] };
}

/**
 * Detect user location from IP
 */
export async function detectLocation() {
  try {
    const response = await fetch(`${API_BASE}/detect-location`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (response.ok) {
      return response.json();
    }
  } catch {
    // Silently fail
  }
  return { city: 'Delhi', region: 'Delhi', country: 'India' };
}

/**
 * Fetch available regions
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
