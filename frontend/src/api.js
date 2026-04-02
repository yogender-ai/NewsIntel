/**
 * API client for News Intelligence v5.0
 */

const API_BASE = import.meta.env.VITE_API_URL || 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:8000' 
    : 'https://newsintel.onrender.com');

/**
 * Analyze a topic — hits the backend /analyze endpoint
 */
export async function analyzeTopic(topic, region = 'global', forceRefresh = false) {
  let url = `${API_BASE}/analyze?topic=${encodeURIComponent(topic)}&region=${encodeURIComponent(region)}`;
  if (forceRefresh) url += '&force=true';
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
 * Fetch full weather forecast (hourly + 3 day)
 */
export async function fetchWeatherForecast(city = 'Delhi') {
  try {
    const response = await fetch(`${API_BASE}/weather-forecast?city=${encodeURIComponent(city)}`, {
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
 * Ping the backend health endpoint to warm up
 */
export async function pingHealth() {
  try {
    await fetch(`${API_BASE}/health`, { method: 'GET' });
  } catch {
    // Silently fail
  }
}

/**
 * Submit feedback to the backend
 */
export async function submitFeedback(author, text, emotion = 'neutral') {
  try {
    const response = await fetch(`${API_BASE}/api/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ author, text, emotion })
    });
    if (response.ok) {
      return response.json();
    }
    throw new Error(`HTTP error! status: ${response.status}`);
  } catch (error) {
    console.error("Feedback submission failed:", error);
    return { status: "error", message: "Failed to connect to server." };
  }
}

/**
 * Fetch GitHub Stars for the repository
 */
export async function fetchGitHubStars() {
  try {
    const response = await fetch('https://api.github.com/repos/yogender-ai/NewsIntel', {
      method: 'GET'
    });
    if (response.ok) {
      const data = await response.json();
      return data.stargazers_count;
    }
  } catch (err) {
    console.error("Failed to fetch github stars:", err);
  }
  return null;
}
