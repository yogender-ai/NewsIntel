import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Cloud, Sun, CloudRain, Wind, Droplets, Eye, Gauge, Search, ArrowLeft, Sunrise, Sunset, Loader, MapPin
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

const POPULAR_CITIES = [
  { name: 'Delhi', emoji: '🏛️' },
  { name: 'London', emoji: '🇬🇧' },
  { name: 'New York', emoji: '🗽' },
  { name: 'Tokyo', emoji: '🗼' },
  { name: 'Dubai', emoji: '🏙️' },
];

export default function WeatherPage() {
  const navigate = useNavigate();
  const [city, setCity] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

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
    setErrorMsg('');
    try {
      const [w, f] = await Promise.all([
        fetchWeather(cityName),
        fetchWeatherForecast(cityName),
      ]);
      if (w && w.temp_c !== undefined) {
         setWeather(w);
         setForecast(f);
      } else {
         setErrorMsg(`Global database couldn't pinpoint "${cityName}". Displaying latest known data.`);
      }
    } catch {
        setErrorMsg(`Global satellite link failed for "${cityName}". Showing previous location.`);
    }
    setLoading(false);
  };

  const handleSearch = async (e) => {
    e?.preventDefault();
    const q = searchInput.trim();
    if (!q) return;
    setCity(q);
    await loadWeather(q);
  };

  const condition = weather?.condition || 'Clear';
  const icon = getWeatherIcon(condition);
  const isDay = weather?.is_day === 1 || condition.toLowerCase().includes('sun');
  const bgGradient = isDay ? 'linear-gradient(135deg, #1e3a8a, #3b82f6)' : 'linear-gradient(135deg, #020617, #1e1b4b)';

  const hourlyData = forecast?.hourly || [];
  const dailyData = forecast?.daily || [];
  const astronomy = forecast?.astronomy || {};

  return (
    <div style={{
        width: '100%', height: '100vh', background: bgGradient, display: 'flex', flexDirection: 'column', color: '#fff', position: 'relative', overflow: 'hidden', fontFamily: 'Inter, sans-serif'
    }}>
      {/* Search Header */}
      <div style={{ padding: '24px 40px', display: 'flex', alignItems: 'center', gap: '24px', zIndex: 10 }}>
        <button onClick={() => navigate('/')} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '30px', cursor: 'pointer', backdropFilter: 'blur(10px)', transition: 'background 0.2s', fontWeight: 600 }}>
          <ArrowLeft size={16} /> Dashboard
        </button>
        <form onSubmit={handleSearch} style={{ flex: 1, maxWidth: '500px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search global regions..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ width: '100%', padding: '14px 16px 14px 44px', borderRadius: '30px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '15px', outline: 'none', backdropFilter: 'blur(10px)' }}
          />
        </form>
        <div style={{ display: 'flex', gap: '10px' }}>
            {POPULAR_CITIES.map(c => (
                <button key={c.name} onClick={() => { setSearchInput(c.name); loadWeather(c.name); }} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px 14px', borderRadius: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{c.emoji}</span> {c.name}
                </button>
            ))}
        </div>
      </div>

      {errorMsg && (
          <div style={{ margin: '0 40px', padding: '12px 24px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', borderRadius: '8px', color: '#fca5a5', fontWeight: 500, fontSize: '14px' }}>
              {errorMsg}
          </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
           <Loader size={40} color="#60a5fa" className="spin" />
           <div style={{ color: '#94a3b8', fontSize: '16px', letterSpacing: '1px', fontWeight: 500 }}>LINKING SATELLITE...</div>
        </div>
      ) : weather && (
        <div style={{ flex: 1, padding: '24px 40px', overflowY: 'auto', display: 'flex', gap: '40px' }} className="custom-scroll">
            
            {/* Left Column: Hero & Details */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(30px)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '30px', padding: '50px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
                    <div>
                        <div style={{ fontSize: '120px', fontWeight: 800, lineHeight: 1, letterSpacing: '-4px', textShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>{weather.temp_c}°</div>
                        <div style={{ fontSize: '24px', fontWeight: 500, opacity: 0.9, marginTop: '8px' }}>{weather.condition}</div>
                        <div style={{ fontSize: '16px', color: '#cbd5e1', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}><MapPin size={16}/> {weather.city}, {weather.country}</div>
                    </div>
                    <div style={{ fontSize: '150px', filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.4))' }}>
                        {icon}
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                    {[
                        { icon: Droplets, val: `${weather.humidity}%`, lab: 'Humidity' },
                        { icon: Wind, val: `${weather.wind_speed_kmph} km/h`, lab: 'Wind' },
                        { icon: Eye, val: `${weather.visibility_km} km`, lab: 'Visibility' },
                        { icon: Sun, val: weather.uv_index, lab: 'UV Index' },
                        { icon: Gauge, val: `${weather.pressure_mb} mb`, lab: 'Pressure' },
                        { icon: Cloud, val: `${weather.cloud_cover}%`, lab: 'Cloud Cover' },
                    ].map((item, idx) => (
                        <div key={idx} style={{ background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '20px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <item.icon size={20} color="#60a5fa" />
                            <div style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 500 }}>{item.lab}</div>
                            <div style={{ fontSize: '20px', fontWeight: 600 }}>{item.val}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right Column: Forecast */}
            <div style={{ width: '400px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '30px', padding: '24px' }}>
                    <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>3-Day Trajectory</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {dailyData.map((d, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
                                <div style={{ width: '80px', fontWeight: 500 }}>{d.day}</div>
                                <div style={{ fontSize: '24px', width: '40px', textAlign: 'center' }}>{getWeatherIcon(d.condition)}</div>
                                <div style={{ display: 'flex', gap: '16px', fontWeight: 600 }}>
                                    <span style={{ color: '#fff' }}>{d.max_c}°</span>
                                    <span style={{ color: '#94a3b8' }}>{d.min_c}°</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {astronomy.sunrise && (
                    <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '30px', padding: '24px', display: 'flex', gap: '20px', alignItems: 'center', justifyContent: 'space-around', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <Sunrise size={28} color="#fcd34d" />
                            <div style={{ fontSize: '13px', color: '#94a3b8' }}>Sunrise</div>
                            <div style={{ fontWeight: 600 }}>{astronomy.sunrise}</div>
                        </div>
                        <div style={{ width: '1px', height: '40px', background: 'rgba(255,255,255,0.1)' }} />
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <Sunset size={28} color="#fca5a5" />
                            <div style={{ fontSize: '13px', color: '#94a3b8' }}>Sunset</div>
                            <div style={{ fontWeight: 600 }}>{astronomy.sunset}</div>
                        </div>
                    </div>
                )}
            </div>

        </div>
      )}

      <style>{`
        .spin { animation: spin 2s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .custom-scroll::-webkit-scrollbar { width: 6px; }
        .custom-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 6px; }
      `}</style>
    </div>
  );
}
