import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Cloud, Sun, CloudRain, CloudSnow, Wind, Droplets, Eye, Thermometer,
  Gauge, Search, ArrowLeft, Sunrise, Sunset, Moon, CloudLightning,
  Loader, MapPin, RefreshCw, ChevronRight,
} from 'lucide-react';
import { fetchWeather, fetchWeatherForecast, detectLocation } from '../api';

const WEATHER_ICONS = {
  'Sunny': '☀️', 'Clear': '🌙', 'Partly Cloudy': '⛅', 'Partly cloudy': '⛅',
  'Cloudy': '☁️', 'Overcast': '🌥️', 'Mist': '🌫️', 'Fog': '🌫️',
  'Rain': '🌧️', 'Light rain': '🌦️', 'Heavy rain': '🌧️', 'Moderate rain': '🌧️',
  'Patchy rain possible': '🌦️', 'Light drizzle': '🌦️',
  'Thunderstorm': '⛈️', 'Thunder': '⛈️',
  'Snow': '❄️', 'Light snow': '🌨️', 'Heavy snow': '❄️', 'Blizzard': '🌨️',
  'Haze': '🌫️', 'Smoke': '🌫️',
};

function getWeatherIcon(condition) {
  if (!condition) return '🌤️';
  for (const [key, icon] of Object.entries(WEATHER_ICONS)) {
    if (condition.toLowerCase().includes(key.toLowerCase())) return icon;
  }
  return '🌤️';
}

function getWeatherBg(condition) {
  if (!condition) return 'weather-bg-clear';
  const c = condition.toLowerCase();
  if (c.includes('rain') || c.includes('drizzle')) return 'weather-bg-rain';
  if (c.includes('snow') || c.includes('blizzard')) return 'weather-bg-snow';
  if (c.includes('thunder') || c.includes('storm')) return 'weather-bg-storm';
  if (c.includes('cloud') || c.includes('overcast')) return 'weather-bg-cloudy';
  if (c.includes('fog') || c.includes('mist') || c.includes('haze')) return 'weather-bg-fog';
  return 'weather-bg-clear';
}

const POPULAR_CITIES = [
  { name: 'Delhi', emoji: '🏛️' },
  { name: 'Mumbai', emoji: '🌊' },
  { name: 'London', emoji: '🇬🇧' },
  { name: 'New York', emoji: '🗽' },
  { name: 'Tokyo', emoji: '🗼' },
  { name: 'Dubai', emoji: '🏙️' },
  { name: 'Singapore', emoji: '🇸🇬' },
  { name: 'Sydney', emoji: '🇦🇺' },
  { name: 'Bangalore', emoji: '💻' },
  { name: 'Paris', emoji: '🗼' },
  { name: 'Rohtak', emoji: '🌾' },
  { name: 'Chandigarh', emoji: '🌳' },
];

export default function WeatherPage() {
  const navigate = useNavigate();
  const [city, setCity] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Auto-detect location on mount
  useEffect(() => {
    (async () => {
      try {
        const loc = await detectLocation();
        const detectedCity = loc?.city || 'Delhi';
        setCity(detectedCity);
        setSearchInput(detectedCity);
        await loadWeather(detectedCity);
      } catch {
        setCity('Delhi');
        setSearchInput('Delhi');
        await loadWeather('Delhi');
      }
    })();
  }, []);

  const loadWeather = async (cityName) => {
    setLoading(true);
    try {
      const [w, f] = await Promise.all([
        fetchWeather(cityName),
        fetchWeatherForecast(cityName),
      ]);
      setWeather(w);
      setForecast(f);
    } catch { /* silent */ }
    setLoading(false);
  };

  const handleSearch = async (e) => {
    e?.preventDefault();
    const q = searchInput.trim();
    if (!q) return;
    setCity(q);
    await loadWeather(q);
  };

  const handleCityClick = async (cityName) => {
    setSearchInput(cityName);
    setCity(cityName);
    await loadWeather(cityName);
  };

  const handleRefresh = async () => {
    if (refreshing || !city) return;
    setRefreshing(true);
    await loadWeather(city);
    setRefreshing(false);
  };

  const condition = weather?.condition || '';
  const icon = getWeatherIcon(condition);
  const bgClass = getWeatherBg(condition);

  // Parse forecast data
  const hourlyData = forecast?.hourly || [];
  const dailyData = forecast?.daily || [];
  const astronomy = forecast?.astronomy || {};

  return (
    <div className={`weather-page ${bgClass}`}>
      {/* Animated background particles */}
      <div className="weather-particles">
        {bgClass === 'weather-bg-rain' && (
          <>
            {Array.from({ length: 30 }, (_, i) => (
              <div key={i} className="rain-drop" style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${0.5 + Math.random() * 0.5}s`,
              }} />
            ))}
          </>
        )}
        {bgClass === 'weather-bg-snow' && (
          <>
            {Array.from({ length: 30 }, (_, i) => (
              <div key={i} className="snow-flake" style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${3 + Math.random() * 3}s`,
              }} />
            ))}
          </>
        )}
      </div>

      {/* Header */}
      <div className="weather-header">
        <button className="weather-back-btn" onClick={() => navigate('/')}>
          <ArrowLeft size={16} /> Back
        </button>
        <form className="weather-search-form" onSubmit={handleSearch}>
          <Search size={14} />
          <input
            type="text"
            className="weather-search-input"
            placeholder="Search city..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            autoComplete="off"
          />
          <button type="submit" className="weather-search-btn">Go</button>
        </form>
        <button
          className={`weather-refresh-btn ${refreshing ? 'spinning' : ''}`}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {loading ? (
        <div className="weather-loading">
          <Loader size={32} className="spin" />
          <p>Loading weather for {city || 'your location'}...</p>
        </div>
      ) : weather ? (
        <div className="weather-content">
          <section className="weather-hero" style={{ animation: 'fadeInUp 0.6s ease-out backwards', animationDelay: '0.1s' }}>
            <div className="weather-hero-icon">{icon}</div>
            <div className="weather-hero-temp">
              <span className="temp-value">{weather.temp_c}</span>
              <span className="temp-unit">°C</span>
            </div>
            <div className="weather-hero-condition">{weather.condition}</div>
            <div className="weather-hero-location">
              <MapPin size={14} />
              <span>{weather.city}</span>
              {weather.region && <span>, {weather.region}</span>}
              {weather.country && <span> · {weather.country}</span>}
            </div>
            {weather.city?.toLowerCase() !== city?.toLowerCase() && (
              <p className="weather-station-note">
                Nearest weather station to "{city}"
              </p>
            )}
            <div className="weather-hero-feels">
              Feels like {weather.feels_like_c}°C
            </div>
          </section>

          {/* ── DETAILS GRID ── */}
          <section className="weather-details-grid" style={{ animation: 'fadeInUp 0.6s ease-out backwards', animationDelay: '0.2s' }}>
            <div className="weather-detail-card">
              <Droplets size={18} className="detail-icon" />
              <span className="detail-label">Humidity</span>
              <span className="detail-value">{weather.humidity}%</span>
            </div>
            <div className="weather-detail-card">
              <Wind size={18} className="detail-icon" />
              <span className="detail-label">Wind</span>
              <span className="detail-value">{weather.wind_speed_kmph} km/h {weather.wind_dir}</span>
            </div>
            <div className="weather-detail-card">
              <Eye size={18} className="detail-icon" />
              <span className="detail-label">Visibility</span>
              <span className="detail-value">{weather.visibility_km} km</span>
            </div>
            <div className="weather-detail-card">
              <Sun size={18} className="detail-icon" />
              <span className="detail-label">UV Index</span>
              <span className="detail-value">{weather.uv_index}</span>
            </div>
            <div className="weather-detail-card">
              <Gauge size={18} className="detail-icon" />
              <span className="detail-label">Pressure</span>
              <span className="detail-value">{weather.pressure_mb} mb</span>
            </div>
            <div className="weather-detail-card">
              <Cloud size={18} className="detail-icon" />
              <span className="detail-label">Cloud Cover</span>
              <span className="detail-value">{weather.cloud_cover}%</span>
            </div>
          </section>

          {/* ── ASTRONOMY ── */}
          {(astronomy.sunrise || astronomy.sunset) && (
            <section className="weather-astronomy" style={{ animation: 'fadeInUp 0.6s ease-out backwards', animationDelay: '0.3s' }}>
              <h3><Sun size={16} /> Sun & Moon</h3>
              <div className="astronomy-grid">
                {astronomy.sunrise && (
                  <div className="astronomy-item">
                    <Sunrise size={20} />
                    <span className="astronomy-label">Sunrise</span>
                    <span className="astronomy-value">{astronomy.sunrise}</span>
                  </div>
                )}
                {astronomy.sunset && (
                  <div className="astronomy-item">
                    <Sunset size={20} />
                    <span className="astronomy-label">Sunset</span>
                    <span className="astronomy-value">{astronomy.sunset}</span>
                  </div>
                )}
                {astronomy.moonrise && (
                  <div className="astronomy-item">
                    <Moon size={20} />
                    <span className="astronomy-label">Moonrise</span>
                    <span className="astronomy-value">{astronomy.moonrise}</span>
                  </div>
                )}
                {astronomy.moon_phase && (
                  <div className="astronomy-item">
                    <Moon size={20} />
                    <span className="astronomy-label">Phase</span>
                    <span className="astronomy-value">{astronomy.moon_phase}</span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ── HOURLY FORECAST ── */}
          {hourlyData.length > 0 && (
            <section className="weather-hourly" style={{ animation: 'fadeInUp 0.6s ease-out backwards', animationDelay: '0.4s' }}>
              <h3>Hourly Forecast</h3>
              <div className="hourly-scroll">
                {hourlyData.map((h, i) => (
                  <div key={i} className="hourly-card">
                    <span className="hourly-time">{h.time}</span>
                    <span className="hourly-icon">{getWeatherIcon(h.condition)}</span>
                    <span className="hourly-temp">{h.temp_c}°</span>
                    <span className="hourly-rain">
                      <Droplets size={10} /> {h.chance_of_rain || 0}%
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── 3-DAY FORECAST ── */}
          {dailyData.length > 0 && (
            <section className="weather-daily" style={{ animation: 'fadeInUp 0.6s ease-out backwards', animationDelay: '0.5s' }}>
              <h3>3-Day Forecast</h3>
              <div className="daily-list">
                {dailyData.map((d, i) => (
                  <div key={i} className="daily-row">
                    <span className="daily-day">{d.day}</span>
                    <span className="daily-icon">{getWeatherIcon(d.condition)}</span>
                    <span className="daily-condition">{d.condition}</span>
                    <span className="daily-temps">
                      <span className="daily-high">{d.max_c}°</span>
                      <span className="daily-low">{d.min_c}°</span>
                    </span>
                    <span className="daily-rain">
                      <Droplets size={10} /> {d.chance_of_rain || 0}%
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── POPULAR CITIES ── */}
          <section className="weather-cities" style={{ animation: 'fadeInUp 0.6s ease-out backwards', animationDelay: '0.6s' }}>
            <h3><MapPin size={16} /> Other Cities</h3>
            <div className="weather-cities-grid">
              {POPULAR_CITIES.map((c) => (
                <button
                  key={c.name}
                  className={`weather-city-btn ${c.name.toLowerCase() === city?.toLowerCase() ? 'active' : ''}`}
                  onClick={() => handleCityClick(c.name)}
                >
                  <span>{c.emoji}</span>
                  {c.name}
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div className="weather-error">
          <CloudRain size={40} />
          <h3>Couldn't load weather</h3>
          <p>Try searching for a different city.</p>
        </div>
      )}
    </div>
  );
}
