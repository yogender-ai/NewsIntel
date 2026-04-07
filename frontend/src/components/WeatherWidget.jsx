import { useState, useEffect } from 'react';
import { Cloud, Droplets, Wind, Search, MapPin, Eye, Thermometer, Sun, CloudRain, CloudSnow, CloudLightning, CloudDrizzle, CloudFog, Loader } from 'lucide-react';
import { fetchWeather, detectLocation } from '../api';

const WEATHER_STYLES = {
  'Clear': { icon: Sun, color: '#f59e0b', themeClass: 'weather-theme-sunny' },
  'Sunny': { icon: Sun, color: '#f59e0b', themeClass: 'weather-theme-sunny' },
  'Partly cloudy': { icon: Cloud, color: '#94a3b8', themeClass: 'weather-theme-cloudy' },
  'Partly Cloudy': { icon: Cloud, color: '#94a3b8', themeClass: 'weather-theme-cloudy' },
  'Cloudy': { icon: Cloud, color: '#64748b', themeClass: 'weather-theme-overcast' },
  'Overcast': { icon: Cloud, color: '#475569', themeClass: 'weather-theme-overcast' },
  'Mist': { icon: CloudFog, color: '#94a3b8', themeClass: 'weather-theme-foggy' },
  'Fog': { icon: CloudFog, color: '#94a3b8', themeClass: 'weather-theme-foggy' },
  'Haze': { icon: CloudFog, color: '#94a3b8', themeClass: 'weather-theme-foggy' },
  'Light rain': { icon: CloudDrizzle, color: '#3b82f6', themeClass: 'weather-theme-rainy' },
  'Light Rain': { icon: CloudDrizzle, color: '#3b82f6', themeClass: 'weather-theme-rainy' },
  'Patchy rain possible': { icon: CloudDrizzle, color: '#3b82f6', themeClass: 'weather-theme-rainy' },
  'Rain': { icon: CloudRain, color: '#2563eb', themeClass: 'weather-theme-rainy' },
  'Moderate rain': { icon: CloudRain, color: '#2563eb', themeClass: 'weather-theme-rainy' },
  'Heavy rain': { icon: CloudRain, color: '#1d4ed8', themeClass: 'weather-theme-rainy' },
  'Thunderstorm': { icon: CloudLightning, color: '#8b5cf6', themeClass: 'weather-theme-stormy' },
  'Thunder': { icon: CloudLightning, color: '#8b5cf6', themeClass: 'weather-theme-stormy' },
  'Snow': { icon: CloudSnow, color: '#e2e8f0', themeClass: 'weather-theme-snowy' },
  'Light snow': { icon: CloudSnow, color: '#e2e8f0', themeClass: 'weather-theme-snowy' },
  'Drizzle': { icon: CloudDrizzle, color: '#3b82f6', themeClass: 'weather-theme-rainy' },
  'Light drizzle': { icon: CloudDrizzle, color: '#3b82f6', themeClass: 'weather-theme-rainy' },
};

const CITY_SUGGESTIONS = [
  'Delhi', 'Mumbai', 'Bangalore', 'Rohtak', 'Chandigarh',
  'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Jaipur',
  'New York', 'London', 'Tokyo', 'Dubai', 'Singapore',
];

export default function WeatherWidget() {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cityInput, setCityInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Auto-detect location on mount
    (async () => {
      try {
        const loc = await detectLocation();
        if (loc?.city) {
          setCityInput(loc.city);
          const w = await fetchWeather(loc.city);
          if (w) setWeather(w);
        }
      } catch {
        // Fallback to Delhi
        const w = await fetchWeather('Delhi');
        if (w) setWeather(w);
        setCityInput('Delhi');
      }
      setLoading(false);
    })();
  }, []);

  const handleSearch = async (city) => {
    if (!city.trim()) return;
    setLoading(true);
    setError('');
    setShowSuggestions(false);
    setCityInput(city);
    try {
      const w = await fetchWeather(city);
      if (w) {
        setWeather(w);
      } else {
        setError('City not found');
      }
    } catch {
      setError('Failed to fetch weather');
    }
    setLoading(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleSearch(cityInput);
  };

  const getWeatherStyle = (condition) => {
    return WEATHER_STYLES[condition] || { icon: Cloud, color: '#94a3b8', themeClass: '' };
  };

  const filtered = CITY_SUGGESTIONS.filter(
    c => c.toLowerCase().includes(cityInput.toLowerCase()) && c.toLowerCase() !== cityInput.toLowerCase()
  );

  const styleConfig = weather ? getWeatherStyle(weather.condition) : null;
  const WeatherIcon = styleConfig ? styleConfig.icon : Cloud;
  const themeClass = styleConfig ? styleConfig.themeClass : '';

  return (
    <div className={`weather-widget glass premium-weather-card ${themeClass}`} id="weather-widget">
      <div className="weather-bg-fx" />
      <div className="weather-header">
        <div className="weather-title-row">
          <Cloud size={14} className="weather-header-icon" />
          <span>Weather</span>
        </div>
        <form className="weather-search-form" onSubmit={handleSubmit}>
          <div className="weather-search-wrapper">
            <MapPin size={12} className="weather-search-icon" />
            <input
              type="text"
              className="weather-search-input"
              placeholder="Search city..."
              value={cityInput}
              onChange={(e) => {
                setCityInput(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              id="weather-city-input"
            />
          </div>
          {showSuggestions && filtered.length > 0 && (
            <div className="weather-suggestions">
              {filtered.slice(0, 5).map(city => (
                <button
                  key={city}
                  type="button"
                  className="weather-suggestion-item"
                  onMouseDown={() => handleSearch(city)}
                >
                  <MapPin size={10} />
                  {city}
                </button>
              ))}
            </div>
          )}
        </form>
      </div>

      {loading ? (
        <div className="weather-loading">
          <Loader size={18} className="spin weather-loader-icon" />
          <span>Detecting location...</span>
        </div>
      ) : error ? (
        <div className="weather-error">
          <CloudFog size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
          {error}
        </div>
      ) : weather ? (
        <div className="weather-body">
          <div className="weather-main-row">
            <div className="weather-icon-container float-anim">
              <WeatherIcon size={48} color={styleConfig.color} strokeWidth={1.5} className="weather-hero-icon" />
            </div>
            <div className="weather-temp-block">
              <span className="weather-temp">{weather.temp_c}°</span>
              <span className="weather-feels">Feels {weather.feels_like_c}°</span>
            </div>
          </div>
          <div className="weather-condition">{weather.condition}</div>
          <div className="weather-city-name">
            <MapPin size={11} className="pulse-pin" />
            {weather.city}{weather.region ? `, ${weather.region}` : ''}
          </div>
          <div className="weather-details-grid">
            <div className="weather-detail">
              <Droplets size={12} className="w-icon-blue" />
              <div className="w-detail-text">
                <span className="weather-detail-label">Humidity</span>
                <span className="weather-detail-value">{weather.humidity}%</span>
              </div>
            </div>
            <div className="weather-detail">
              <Wind size={12} className="w-icon-gray" />
              <div className="w-detail-text">
                <span className="weather-detail-label">Wind</span>
                <span className="weather-detail-value">{weather.wind_speed_kmph} km/h</span>
              </div>
            </div>
            <div className="weather-detail">
              <Eye size={12} className="w-icon-purple" />
              <div className="w-detail-text">
                <span className="weather-detail-label">Visibility</span>
                <span className="weather-detail-value">{weather.visibility_km} km</span>
              </div>
            </div>
            <div className="weather-detail">
              <Sun size={12} className="w-icon-orange" />
              <div className="w-detail-text">
                <span className="weather-detail-label">UV Index</span>
                <span className="weather-detail-value">{weather.uv_index}</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
