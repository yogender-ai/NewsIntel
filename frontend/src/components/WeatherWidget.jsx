import { useState, useEffect } from 'react';
import { Cloud, Droplets, Wind, Search, MapPin, Eye, Thermometer, Sun, CloudRain, CloudSnow, CloudLightning, CloudDrizzle, Loader } from 'lucide-react';
import { fetchWeather, detectLocation } from '../api';

const WEATHER_ICONS = {
  'Clear': '☀️', 'Sunny': '☀️',
  'Partly cloudy': '⛅', 'Partly Cloudy': '⛅',
  'Cloudy': '☁️', 'Overcast': '☁️',
  'Mist': '🌫️', 'Fog': '🌫️', 'Haze': '🌫️',
  'Light rain': '🌦️', 'Light Rain': '🌦️', 'Patchy rain possible': '🌦️',
  'Rain': '🌧️', 'Moderate rain': '🌧️', 'Heavy rain': '🌧️',
  'Thunderstorm': '⛈️', 'Thunder': '⛈️',
  'Snow': '🌨️', 'Light snow': '🌨️',
  'Drizzle': '🌦️', 'Light drizzle': '🌦️',
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

  const getWeatherIcon = (condition) => {
    return WEATHER_ICONS[condition] || '🌤️';
  };

  const filtered = CITY_SUGGESTIONS.filter(
    c => c.toLowerCase().includes(cityInput.toLowerCase()) && c.toLowerCase() !== cityInput.toLowerCase()
  );

  return (
    <div className="weather-widget glass" id="weather-widget">
      <div className="weather-header">
        <div className="weather-title-row">
          <Cloud size={14} />
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
          <Loader size={18} className="spin" />
          <span>Detecting location...</span>
        </div>
      ) : error ? (
        <div className="weather-error">{error}</div>
      ) : weather ? (
        <div className="weather-body">
          <div className="weather-main-row">
            <span className="weather-icon-big">{getWeatherIcon(weather.condition)}</span>
            <div className="weather-temp-block">
              <span className="weather-temp">{weather.temp_c}°C</span>
              <span className="weather-feels">Feels {weather.feels_like_c}°C</span>
            </div>
          </div>
          <div className="weather-condition">{weather.condition}</div>
          <div className="weather-city-name">
            <MapPin size={11} />
            {weather.city}{weather.region ? `, ${weather.region}` : ''}
          </div>
          <div className="weather-details-grid">
            <div className="weather-detail">
              <Droplets size={11} />
              <span className="weather-detail-label">Humidity</span>
              <span className="weather-detail-value">{weather.humidity}%</span>
            </div>
            <div className="weather-detail">
              <Wind size={11} />
              <span className="weather-detail-label">Wind</span>
              <span className="weather-detail-value">{weather.wind_speed_kmph} km/h</span>
            </div>
            <div className="weather-detail">
              <Eye size={11} />
              <span className="weather-detail-label">Visibility</span>
              <span className="weather-detail-value">{weather.visibility_km} km</span>
            </div>
            <div className="weather-detail">
              <Sun size={11} />
              <span className="weather-detail-label">UV Index</span>
              <span className="weather-detail-value">{weather.uv_index}</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
