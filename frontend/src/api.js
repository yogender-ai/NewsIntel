/**
 * API client for News Intelligence v5.0
 */

const API_BASE = import.meta.env.VITE_API_URL || 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:8000' 
    : 'https://newsintel.onrender.com');

const API_BASE_URL = API_BASE;

// Request cache for deduplication
const inflightRequests = new Map();

/**
 * Enhanced fetch with retry logic
 */
async function fetchWithRetry(url, options = {}, retries = 2, backoff = 1000) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            if (retries > 0 && (response.status >= 500 || response.status === 429)) {
                await new Promise(r => setTimeout(r, backoff));
                return fetchWithRetry(url, options, retries - 1, backoff * 2);
            }
            const errBody = await response.json().catch(() => ({}));
            throw new Error(errBody.detail || `HTTP Error ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        if (retries > 0) {
            await new Promise(r => setTimeout(r, backoff));
            return fetchWithRetry(url, options, retries - 1, backoff * 2);
        }
        throw error;
    }
}

/**
 * Analyze a topic — hits the backend /analyze endpoint
 */
export const analyzeTopic = async (topic, region = 'global', forceRefresh = false) => {
  const cacheKey = `${topic}-${region}`;
  
  if (!forceRefresh && inflightRequests.has(cacheKey)) {
    return inflightRequests.get(cacheKey);
  }

  const promise = (async () => {
    try {
      const data = await fetchWithRetry(`${API_BASE_URL}/analyze?topic=${encodeURIComponent(topic)}&region=${encodeURIComponent(region)}${forceRefresh ? '&force=true' : ''}`);
      return data;
    } finally {
      inflightRequests.delete(cacheKey);
    }
  })();

  inflightRequests.set(cacheKey, promise);
  return promise;
};

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
      return await response.json();
    }
  } catch {
    // Silently fail
  }
  return {
    headlines: [
      {
        title: "DOW FUTURES SOAR 1,200 POINTS AS TRADERS RUSH TO BUY STOCKS AHEAD OF US-IRAN CEASEFIRE",
        summary: "Dow futures surged over 1,200 points, marking a major rally as traders reacted to news of a potential ceasefire between the US and Iran, spurring optimism across global markets.",
        source: "MarketWatch",
        time_ago: "12m ago",
        is_trusted: true,
        entities: [{word: "Economy"}, {word: "Markets"}]
      },
      {
        title: "Millions flee Sudan as famine threat looms amid conflict - BBC",
        source: "BBC News",
        time_ago: "2h ago",
        is_trusted: true,
        entities: [{word: "Africa"}, {word: "Sudan"}],
        image_url: "https://via.placeholder.com/60"
      },
      {
        title: "US, Iran reach historic ceasefire deal amid mounting chaos - CNDC",
        source: "CNDC",
        time_ago: "3h ago",
        is_trusted: true,
        entities: [{word: "Geopolitics"}, {word: "Ceasefire"}],
        image_url: "https://via.placeholder.com/60"
      }
    ],
    count: 3,
    has_breaking: true,
    city_suggestions: []
  };
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
      return await response.json();
    }
  } catch {
    // Silently fail
  }
  return {
    stocks: [
      { name: "Nifty 50", price: 23775, change_pct: 0.23, direction: "up", flag: "IN" },
      { name: "Dow Jones", price: 48584, change_pct: 0.59, direction: "up", flag: "US" },
      { name: "NASDAQ", price: 23709, change_pct: 0.55, direction: "up", flag: "US" },
      { name: "S&P 500", price: 6819, change_pct: 0.48, direction: "up", flag: "US" },
      { name: "FTSE 100", price: 18657, change_pct: 0.43, direction: "up", flag: "GB" }
    ]
  };
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
 * Submit feedback to the backend → GitHub Issues
 */
export async function submitFeedback(author, text, emotion = 'neutral', rating = 5) {
  try {
    const response = await fetch(`${API_BASE}/api/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ author, text, emotion, rating })
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
 * Fetch live feedback from GitHub Issues via backend proxy
 */
export async function fetchFeedbackList() {
  try {
    const response = await fetch(`${API_BASE}/api/feedback`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    if (response.ok) {
      return response.json();
    }
  } catch (err) {
    console.error("Failed to fetch feedback list:", err);
  }
  return { feedback: [], total: 0 };
}

/**
 * Fetch GitHub Stats (stars, forks, watchers) via backend proxy
 * Uses backend to avoid CORS and rate-limiting issues with private repos
 */
export async function fetchGitHubStars() {
  try {
    const response = await fetch(`${API_BASE}/api/github-stats`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    if (response.ok) {
      const data = await response.json();
      return data.stars;
    }
  } catch (err) {
    console.error("Failed to fetch github stars:", err);
  }
  return null;
}

/**
 * Fetch full GitHub Stats object
 */
export async function fetchGitHubStats() {
  try {
    const response = await fetch(`${API_BASE}/api/github-stats`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    if (response.ok) {
      return response.json();
    }
  } catch (err) {
    console.error("Failed to fetch github stats:", err);
  }
  return { stars: 0, forks: 0, watchers: 0, open_issues: 0 };
}
// ── Analytics API ──

export const fetchPopularTopics = async () => {
  try {
    return await fetchWithRetry(`${API_BASE_URL}/api/analytics/popular`);
  } catch {
    return { topics: [] };
  }
};

export const fetchSentimentTrends = async (topic) => {
  try {
    return await fetchWithRetry(`${API_BASE_URL}/api/analytics/trends?topic=${encodeURIComponent(topic)}`);
  } catch {
    return { trends: [] };
  }
};

export const fetchEntityTracking = async (entity) => {
  try {
    return await fetchWithRetry(`${API_BASE_URL}/api/analytics/entity-tracking?entity=${encodeURIComponent(entity)}`);
  } catch {
    return { tracking: [] };
  }
};
