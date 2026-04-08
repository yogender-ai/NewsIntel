import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Cloud, Sun, CloudRain, Wind, Droplets, Eye, Gauge, Search, ArrowLeft,
  Sunrise, Sunset, Loader, MapPin, Thermometer, Moon, RefreshCw
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

const ALL_CITIES = [
  { name: 'Delhi', emoji: '🏛️', region: 'India' },
  { name: 'Mumbai', emoji: '🌊', region: 'India' },
  { name: 'London', emoji: '🇬🇧', region: 'UK' },
  { name: 'New York', emoji: '🗽', region: 'USA' },
  { name: 'Tokyo', emoji: '🗼', region: 'Japan' },
  { name: 'Dubai', emoji: '🏙️', region: 'UAE' },
  { name: 'Singapore', emoji: '🇸🇬', region: 'Singapore' },
  { name: 'Sydney', emoji: '🇦🇺', region: 'Australia' },
  { name: 'Paris', emoji: '🗼', region: 'France' },
  { name: 'Bangalore', emoji: '💻', region: 'India' },
  { name: 'Rohtak', emoji: '🌾', region: 'Haryana' },
  { name: 'Chandigarh', emoji: '🌳', region: 'India' },
  { name: 'Chehru', emoji: '🏘️', region: 'Haryana' },
  { name: 'Jaipur', emoji: '🏰', region: 'India' },
  { name: 'Kolkata', emoji: '🌉', region: 'India' },
  { name: 'Chennai', emoji: '🏖️', region: 'India' },
  { name: 'Hyderabad', emoji: '🕌', region: 'India' },
  { name: 'Pune', emoji: '🏔️', region: 'India' },
  { name: 'Los Angeles', emoji: '🎬', region: 'USA' },
  { name: 'Toronto', emoji: '🍁', region: 'Canada' },
];

// Village/small-town fallback mapping
const VILLAGE_FALLBACK = {
  'chehru': 'Rohtak',
  'kalanaur': 'Rohtak',
  'meham': 'Rohtak',
  'dighal': 'Jhajjar',
  'beri': 'Jhajjar',
  'sampla': 'Rohtak',
  'asthal bohar': 'Rohtak',
  'lakhan majra': 'Rohtak',
};

export default function WeatherPage() {
  const navigate = useNavigate();
  const [city, setCity] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [hoveredCard, setHoveredCard] = useState(null);
  const containerRef = useRef(null);

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
    setErrorMsg('');
    try {
      let [w, f] = await Promise.all([
        fetchWeather(cityName),
        fetchWeatherForecast(cityName),
      ]);

      // If API returned no data, try the fallback for small villages
      if (!w || w.temp_c === undefined) {
        const fallback = VILLAGE_FALLBACK[cityName.toLowerCase()];
        if (fallback) {
          setErrorMsg(`"${cityName}" is a small village. Showing weather for nearest station: ${fallback}`);
          [w, f] = await Promise.all([
            fetchWeather(fallback),
            fetchWeatherForecast(fallback),
          ]);
        }
      }

      if (w && w.temp_c !== undefined) {
        setWeather(w);
        setForecast(f);
        setCity(w.city || cityName);
      } else {
        setErrorMsg(`Could not locate "${cityName}". Try adding the state or country name.`);
      }
    } catch {
      setErrorMsg(`Connection error. Please try again.`);
    }
    setLoading(false);
  };

  const handleSearch = async (e) => {
    e?.preventDefault();
    const q = searchInput.trim();
    if (!q) return;
    setCity(q);
    setSearchFocused(false);
    await loadWeather(q);
  };

  // Live search suggestions
  const suggestions = searchInput.length > 1
    ? ALL_CITIES.filter(c =>
        c.name.toLowerCase().includes(searchInput.toLowerCase()) ||
        c.region.toLowerCase().includes(searchInput.toLowerCase())
      ).slice(0, 5)
    : [];

  const condition = weather?.condition || 'Clear';
  const icon = getWeatherIcon(condition);
  const isDay = weather?.is_day === 1 || condition.toLowerCase().includes('sun');

  // Dynamic gradient per weather
  const c = condition.toLowerCase();
  let bgGradient;
  if (c.includes('rain') || c.includes('drizzle')) bgGradient = 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #475569 100%)';
  else if (c.includes('snow')) bgGradient = 'linear-gradient(135deg, #e2e8f0 0%, #94a3b8 50%, #64748b 100%)';
  else if (c.includes('thunder') || c.includes('storm')) bgGradient = 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)';
  else if (c.includes('cloud') || c.includes('overcast')) bgGradient = 'linear-gradient(135deg, #1e3a5f 0%, #334155 50%, #475569 100%)';
  else if (c.includes('fog') || c.includes('mist') || c.includes('haze')) bgGradient = 'linear-gradient(135deg, #374151, #6b7280)';
  else if (isDay) bgGradient = 'linear-gradient(135deg, #0c4a6e 0%, #0369a1 40%, #38bdf8 100%)';
  else bgGradient = 'linear-gradient(135deg, #020617 0%, #0f172a 50%, #1e1b4b 100%)';

  const hourlyData = forecast?.hourly || [];
  const dailyData = forecast?.daily || [];
  const astronomy = forecast?.astronomy || {};

  return (
    <div ref={containerRef} style={{
      width: '100%', height: '100vh', background: bgGradient,
      display: 'flex', flexDirection: 'column', color: '#fff',
      position: 'relative', overflow: 'hidden', fontFamily: "'Inter', sans-serif",
      transition: 'background 1.2s ease'
    }}>

      {/* ── Animated Background Particles ── */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        {Array.from({ length: 30 }, (_, i) => (
          <div key={i} className="weather-particle" style={{
            position: 'absolute',
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            width: `${2 + Math.random() * 6}px`,
            height: `${2 + Math.random() * 6}px`,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)',
            animation: `weatherFloat ${8 + Math.random() * 12}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 10}s`,
          }} />
        ))}
        {/* Glowing aurora band */}
        <div style={{
          position: 'absolute', top: '-50%', left: '-20%', width: '140%', height: '100%',
          background: 'radial-gradient(ellipse at center, rgba(56, 189, 248, 0.08) 0%, transparent 70%)',
          animation: 'auroraShift 15s ease-in-out infinite alternate',
        }} />
      </div>

      {/* ── Header ── */}
      <div style={{ padding: '20px 40px', display: 'flex', alignItems: 'center', gap: '20px', zIndex: 10, flexShrink: 0 }}>
        <button onClick={() => navigate('/')} className="weather-btn-hover" style={{
          background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
          color: '#fff', display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 20px', borderRadius: '50px', cursor: 'pointer',
          backdropFilter: 'blur(20px)', fontWeight: 600, fontSize: '14px', transition: 'all 0.3s'
        }}>
          <ArrowLeft size={16} /> Command Center
        </button>

        <form onSubmit={handleSearch} style={{ flex: 1, maxWidth: '500px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: searchFocused ? '#38bdf8' : '#94a3b8', transition: 'color 0.3s' }} />
          <input
            type="text"
            placeholder="Search any city, village, or region..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
            style={{
              width: '100%', padding: '14px 20px 14px 48px', borderRadius: '50px',
              background: searchFocused ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.2)',
              border: searchFocused ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid rgba(255,255,255,0.1)',
              color: '#fff', fontSize: '15px', outline: 'none',
              backdropFilter: 'blur(20px)', transition: 'all 0.3s',
              boxShadow: searchFocused ? '0 0 30px rgba(56, 189, 248, 0.15)' : 'none'
            }}
          />
          {/* Live Suggestions Dropdown */}
          {searchFocused && suggestions.length > 0 && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
              background: 'rgba(2, 6, 23, 0.95)', backdropFilter: 'blur(20px)',
              border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '16px',
              padding: '8px', zIndex: 1000, boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
            }}>
              {suggestions.map((s, i) => (
                <div key={i}
                  onClick={() => { setSearchInput(s.name); setSearchFocused(false); loadWeather(s.name); }}
                  style={{
                    padding: '10px 14px', cursor: 'pointer', borderRadius: '10px',
                    display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(56, 189, 248, 0.15)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontSize: '20px' }}>{s.emoji}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{s.name}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>{s.region}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </form>

        {/* Quick City Chips */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'nowrap', overflow: 'auto' }} className="no-scrollbar">
          {ALL_CITIES.slice(0, 6).map(ct => (
            <button key={ct.name} className="weather-btn-hover"
              onClick={() => { setSearchInput(ct.name); loadWeather(ct.name); }}
              style={{
                background: city === ct.name ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.05)',
                border: city === ct.name ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.08)',
                color: '#fff', padding: '8px 14px', borderRadius: '50px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px',
                fontSize: '13px', fontWeight: 500, transition: 'all 0.3s', whiteSpace: 'nowrap'
              }}>
              <span>{ct.emoji}</span> {ct.name}
            </button>
          ))}
        </div>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div style={{
          margin: '0 40px 12px', padding: '12px 24px',
          background: 'rgba(251, 191, 36, 0.15)', border: '1px solid rgba(251, 191, 36, 0.4)',
          borderRadius: '12px', color: '#fcd34d', fontWeight: 500, fontSize: '13px',
          backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          <MapPin size={14} /> {errorMsg}
        </div>
      )}

      {/* ── Main Content ── */}
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '20px', zIndex: 1 }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#38bdf8', animation: 'spin 1s linear infinite' }} />
          <div style={{ color: '#94a3b8', fontSize: '14px', letterSpacing: '2px', fontWeight: 600, textTransform: 'uppercase' }}>Linking Satellite...</div>
        </div>
      ) : weather && (
        <div style={{ flex: 1, padding: '0 40px 24px', overflowY: 'auto', display: 'flex', gap: '30px', zIndex: 1 }} className="custom-scroll">

          {/* ── LEFT: Hero + Details ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Giant Hero Card */}
            <div className="weather-hero-card" style={{
              background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(40px)',
              border: '1px solid rgba(255,255,255,0.15)', borderRadius: '32px',
              padding: '40px 50px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              boxShadow: '0 30px 80px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
              position: 'relative', overflow: 'hidden', transition: 'transform 0.4s, box-shadow 0.4s'
            }}>
              {/* Subtle inner glow */}
              <div style={{ position: 'absolute', top: '-50%', right: '-20%', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(56,189,248,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ fontSize: '100px', fontWeight: 800, lineHeight: 1, letterSpacing: '-5px', textShadow: '0 10px 40px rgba(0,0,0,0.4)' }}>
                  {weather.temp_c}<span style={{ fontSize: '50px', fontWeight: 300, verticalAlign: 'top', marginLeft: '4px' }}>°C</span>
                </div>
                <div style={{ fontSize: '22px', fontWeight: 500, opacity: 0.9, marginTop: '8px', letterSpacing: '0.5px' }}>{weather.condition}</div>
                <div style={{ fontSize: '15px', color: '#cbd5e1', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={14} /> {weather.city}{weather.region ? `, ${weather.region}` : ''}{weather.country ? ` · ${weather.country}` : ''}
                </div>
                <div style={{ marginTop: '12px', fontSize: '13px', color: '#94a3b8', display: 'flex', gap: '16px' }}>
                  <span>Feels like {weather.feels_like_c ?? weather.temp_c}°C</span>
                  <span>💧 {weather.humidity}%</span>
                  <span>💨 {weather.wind_speed_kmph} km/h</span>
                </div>
              </div>
              <div style={{ fontSize: '130px', filter: 'drop-shadow(0 20px 50px rgba(0,0,0,0.5))', animation: 'iconBob 4s ease-in-out infinite', position: 'relative', zIndex: 1 }}>
                {icon}
              </div>
            </div>

            {/* Detail Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
              {[
                { Icon: Droplets, val: `${weather.humidity}%`, lab: 'Humidity', color: '#38bdf8' },
                { Icon: Wind, val: `${weather.wind_speed_kmph} km/h`, lab: 'Wind Speed', color: '#a78bfa' },
                { Icon: Eye, val: `${weather.visibility_km} km`, lab: 'Visibility', color: '#34d399' },
                { Icon: Sun, val: weather.uv_index, lab: 'UV Index', color: '#fbbf24' },
                { Icon: Gauge, val: `${weather.pressure_mb} mb`, lab: 'Pressure', color: '#f472b6' },
                { Icon: Cloud, val: `${weather.cloud_cover}%`, lab: 'Cloud Cover', color: '#94a3b8' },
              ].map((item, idx) => (
                <div key={idx}
                  className="detail-card-hover"
                  onMouseEnter={() => setHoveredCard(idx)}
                  onMouseLeave={() => setHoveredCard(null)}
                  style={{
                    background: hoveredCard === idx ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)',
                    backdropFilter: 'blur(20px)',
                    border: hoveredCard === idx ? `1px solid ${item.color}40` : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '20px', padding: '20px',
                    display: 'flex', flexDirection: 'column', gap: '8px',
                    cursor: 'default', transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: hoveredCard === idx ? 'translateY(-4px) scale(1.02)' : 'translateY(0) scale(1)',
                    boxShadow: hoveredCard === idx ? `0 15px 40px ${item.color}20` : 'none',
                  }}
                >
                  <item.Icon size={22} color={item.color} style={{ transition: 'transform 0.3s', transform: hoveredCard === idx ? 'scale(1.2)' : 'scale(1)' }} />
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>{item.lab}</div>
                  <div style={{ fontSize: '22px', fontWeight: 700 }}>{item.val}</div>
                </div>
              ))}
            </div>

            {/* Hourly Forecast */}
            {hourlyData.length > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '20px' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#94a3b8', marginBottom: '14px', letterSpacing: '1px', textTransform: 'uppercase' }}>Hourly Forecast</div>
                <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }} className="no-scrollbar">
                  {hourlyData.map((h, i) => (
                    <div key={i} className="hourly-hover" style={{
                      minWidth: '70px', textAlign: 'center', padding: '12px 8px',
                      background: 'rgba(255,255,255,0.05)', borderRadius: '16px',
                      border: '1px solid rgba(255,255,255,0.05)',
                      transition: 'all 0.3s', cursor: 'default', flexShrink: 0
                    }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px' }}>{h.time}</div>
                      <div style={{ fontSize: '24px', marginBottom: '4px' }}>{getWeatherIcon(h.condition)}</div>
                      <div style={{ fontSize: '16px', fontWeight: 600 }}>{h.temp_c}°</div>
                      <div style={{ fontSize: '10px', color: '#60a5fa', marginTop: '4px' }}>💧{h.chance_of_rain || 0}%</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: Forecast + Astronomy ── */}
          <div style={{ width: '360px', display: 'flex', flexDirection: 'column', gap: '20px', flexShrink: 0 }}>

            {/* 3-Day Forecast */}
            <div style={{
              background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', padding: '24px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
            }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#94a3b8', marginBottom: '16px', letterSpacing: '1px', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
                3-Day Trajectory
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {dailyData.map((d, i) => (
                  <div key={i} className="daily-row-hover" style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 8px', borderRadius: '12px', transition: 'all 0.3s', cursor: 'default'
                  }}>
                    <div style={{ width: '90px', fontWeight: 500, fontSize: '14px' }}>{d.day}</div>
                    <div style={{ fontSize: '28px', width: '40px', textAlign: 'center' }}>{getWeatherIcon(d.condition)}</div>
                    <div style={{ display: 'flex', gap: '12px', fontWeight: 600, fontSize: '16px' }}>
                      <span style={{ color: '#fff' }}>{d.max_c}°</span>
                      <span style={{ color: '#64748b' }}>{d.min_c}°</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sun & Moon */}
            {astronomy.sunrise && (
              <div style={{
                background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(20px)',
                borderRadius: '24px', padding: '28px',
                display: 'flex', gap: '20px', alignItems: 'center', justifyContent: 'space-evenly',
                border: '1px solid rgba(255,255,255,0.06)',
                boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(252, 211, 77, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Sunrise size={24} color="#fcd34d" />
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>Sunrise</div>
                  <div style={{ fontWeight: 700, fontSize: '16px' }}>{astronomy.sunrise}</div>
                </div>
                <div style={{ width: '1px', height: '50px', background: 'linear-gradient(transparent, rgba(255,255,255,0.15), transparent)' }} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(251, 146, 60, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Sunset size={24} color="#fb923c" />
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>Sunset</div>
                  <div style={{ fontWeight: 700, fontSize: '16px' }}>{astronomy.sunset}</div>
                </div>
                {astronomy.moon_phase && (
                  <>
                    <div style={{ width: '1px', height: '50px', background: 'linear-gradient(transparent, rgba(255,255,255,0.15), transparent)' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(167, 139, 250, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Moon size={24} color="#a78bfa" />
                      </div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>Moon</div>
                      <div style={{ fontWeight: 700, fontSize: '14px' }}>{astronomy.moon_phase}</div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* All Cities Grid */}
            <div style={{
              background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.06)', borderRadius: '24px', padding: '20px',
              flex: 1, overflow: 'auto'
            }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '12px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                Explore Regions
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                {ALL_CITIES.slice(0, 12).map(ct => (
                  <button key={ct.name} className="weather-btn-hover"
                    onClick={() => { setSearchInput(ct.name); loadWeather(ct.name); }}
                    style={{
                      background: ct.name === city ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.04)',
                      border: ct.name === city ? '1px solid rgba(56,189,248,0.4)' : '1px solid rgba(255,255,255,0.06)',
                      color: '#fff', padding: '10px', borderRadius: '12px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px',
                      fontWeight: 500, transition: 'all 0.3s', textAlign: 'left'
                    }}>
                    <span style={{ fontSize: '16px' }}>{ct.emoji}</span> {ct.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CSS Animations ── */}
      <style>{`
        @keyframes weatherFloat {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.15; }
          50% { transform: translateY(-30px) translateX(15px); opacity: 0.35; }
        }
        @keyframes auroraShift {
          0% { transform: translateX(-10%) rotate(-5deg); }
          100% { transform: translateX(10%) rotate(5deg); }
        }
        @keyframes iconBob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        @keyframes spin { 100% { transform: rotate(360deg); } }

        .weather-hero-card:hover {
          transform: translateY(-4px) !important;
          box-shadow: 0 40px 100px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15) !important;
        }
        .weather-btn-hover:hover {
          background: rgba(56,189,248,0.15) !important;
          border-color: rgba(56,189,248,0.4) !important;
          transform: translateY(-2px);
        }
        .detail-card-hover:hover {
          transform: translateY(-4px) scale(1.02);
        }
        .hourly-hover:hover {
          background: rgba(56,189,248,0.1) !important;
          border-color: rgba(56,189,248,0.3) !important;
          transform: translateY(-3px);
        }
        .daily-row-hover:hover {
          background: rgba(255,255,255,0.06);
        }
        .custom-scroll::-webkit-scrollbar { width: 6px; }
        .custom-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 6px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
