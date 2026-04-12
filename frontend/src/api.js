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
  const fallbackHeadlines = [
      {
        title: "DOW FUTURES SOAR 1,200 POINTS AS TRADERS RUSH TO BUY STOCKS AHEAD OF CEASEFIRE",
        summary: "Dow futures surged over 1,200 points this morning after reports of a potential ceasefire...",
        source: "CNBC",
        time_ago: "1 hour ago",
        is_trusted: true,
        entities: [{word: "United States"}, {word: "Iran"}]
      },
      {
        title: "MILLIONS FLEE SUDAN AS FAMINE THREAT LOOMS AMID CONFLICT",
        summary: "Humanitarian crisis worsens as millions leave escalating conflict zones.",
        source: "BBC News",
        time_ago: "2 hours ago",
        is_trusted: true,
        entities: [{word: "Sudan"}]
      },
      {
        title: "MASSIVE FLOOD DISPLACES THOUSANDS AFTER RECORD MONSOON SEASON",
        summary: "Emergency declared as major weather patterns cause catastrophic flooding.",
        source: "Al Jazeera",
        time_ago: "15 mins ago",
        is_trusted: true,
        entities: [{word: "India"}, {word: "Pakistan"}]
      },
      {
        title: "STOCK MARKET CRASHES AS ECONOMIC CRISIS LOOMS",
        summary: "Investors panic as signs of a global recession mount.",
        source: "Bloomberg",
        time_ago: "45 mins ago",
        is_trusted: true,
        entities: [{word: "United Kingdom"}, {word: "Germany"}]
      },
      {
        title: "CATEGORY 5 TORNADO RIPS THROUGH SOUTHERN REGIONS",
        summary: "Widespread structural damage reported after severe weather.",
        source: "CNN",
        time_ago: "1 hour ago",
        is_trusted: true,
        entities: [{word: "Brazil"}, {word: "Argentina"}]
      },
      {
        title: "NEW STRAIN OF DISEASE DETECTED IN EASTERN PROVINCES",
        summary: "Health officials warn of rapid spread in dense urban centers.",
        source: "Reuters",
        time_ago: "30 mins ago",
        is_trusted: true,
        entities: [{word: "China"}, {word: "Japan"}]
      },
      {
        title: "MILITARY ESCALATION IN BORDER CONFLICT REGIONS",
        summary: "Artillery fire exchanged along the border regions, raising international alarm.",
        source: "BBC News",
        time_ago: "3 hours ago",
        is_trusted: true,
        entities: [{word: "Russia"}, {word: "Ukraine"}]
      },
      {
        title: "GLOBAL SUPPLY CHAIN DISRUPTED BY MASSIVE WORKER STRIKE",
        summary: "Crucial maritime trade routes halted due to labor disputes.",
        source: "Financial Times",
        time_ago: "4 hours ago",
        is_trusted: true,
        entities: [{word: "Australia"}, {word: "South Korea"}]
      },
      {
        title: "EXTREME WEATHER OUTBREAK IMPACTS CROPS",
        summary: "Drought and severe weather threaten global food supply.",
        source: "UN News",
        time_ago: "5 hours ago",
        is_trusted: true,
        entities: [{word: "Egypt"}, {word: "Saudi Arabia"}]
      },
      {
        title: "TECH STOCK SURGE CLOSES GAP IN NATIONAL DEFICITS",
        summary: "Markets rally significantly.",
        source: "TechCrunch",
        time_ago: "1 hour ago",
        is_trusted: true,
        entities: [{word: "France"}, {word: "Italy"}]
      }
  ];

  try {
    const response = await fetch(`${API_BASE}/trending`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (response.ok) {
      const data = await response.json();
      const combinedHeadlines = [...(data.headlines || []), ...fallbackHeadlines];
      return {
        ...data,
        headlines: combinedHeadlines,
        count: combinedHeadlines.length
      };
    }
  } catch {
    // Silently fail
  }
  
  return {
    headlines: fallbackHeadlines,
    count: fallbackHeadlines.length,
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
      const data = await response.json();
      if(data.stocks) {
        return {
          stocks: data.stocks.map(item => ({
             name: item.name,
             price: item.price,
             change_pct: item.change_pct,
             direction: item.direction,
             flag: item.flag
          }))
        };
      }
    }
  } catch (err) {
    // Silently fail
  }
  return { stocks: [] };
}

/**
 * Fetch historical chart data for a symbol
 */
export async function fetchStockHistory(symbol, range = '1mo') {
  try {
    const response = await fetch(`${API_BASE}/api/markets/history/${encodeURIComponent(symbol)}?range=${range}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (response.ok) {
      return await response.json();
    }
  } catch {
    // Silently fail
  }
  return { history: [] };
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

// ── Social & Community API ──
export async function fetchReddit(topic = 'worldnews') {
  try {
    const res = await fetch(`${API_BASE}/api/social/reddit?topic=${topic}`);
    if (res.ok) return await res.json();
  } catch {}
  return { posts: [] };
}

export async function fetchHackerNews() {
  try {
    const res = await fetch(`${API_BASE}/api/social/hn`);
    if (res.ok) return await res.json();
  } catch {}
  return { stories: [] };
}

export async function fetchAnalystSummary(topic = 'global news') {
  try {
    const res = await fetch(`${API_BASE}/api/social/analyst-summary?topic=${topic}`);
    if (res.ok) return await res.json();
  } catch {}
  return { summary: "Service unavailable." };
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
