import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { analyzeTopic, fetchWeather } from '../api';
import { ArrowLeft, MapPin, Wind, Thermometer, Info, Activity, ShieldAlert, CloudRain } from 'lucide-react';
import HolographicStream from '../components/HolographicStream';
import ArticleCard from '../components/ArticleCard';

// Simulated database for deep-dive stats
const PROFILE_DB = {
  'United States': { region: 'North America', pop: '331M', gdp: '$23.3T', threat: 'Medium', flag: '🇺🇸', highlight: 'Economic shifts and tech policy.' },
  'China': { region: 'East Asia', pop: '1.4B', gdp: '$17.7T', threat: 'Medium', flag: '🇨🇳', highlight: 'Trade dynamics and tech exports.' },
  'Iran': { region: 'Middle East', pop: '87M', gdp: '$359B', threat: 'Critical', flag: '🇮🇷', highlight: 'Geopolitical tension and energy.' },
  'Ukraine': { region: 'Eastern Europe', pop: '41M', gdp: '$200B', threat: 'Critical', flag: '🇺🇦', highlight: 'Active conflict zone and defense.' },
  'Israel': { region: 'Middle East', pop: '9M', gdp: '$488B', threat: 'High', flag: '🇮🇱', highlight: 'Regional security focus.' },
  'Russia': { region: 'Eastern Europe/Asia', pop: '143M', gdp: '$1.7T', threat: 'High', flag: '🇷🇺', highlight: 'Sanctions and resource economics.' },
  'Sudan': { region: 'North Africa', pop: '45M', gdp: '$34B', threat: 'High', flag: '🇸🇩', highlight: 'Internal political shifts.' },
};

export default function CountryProfilePage() {
  const { country } = useParams();
  const navigate = useNavigate();
  const decodedCountry = decodeURIComponent(country || 'United States');
  
  const [data, setData] = useState({ news: [], weather: null });
  const [loading, setLoading] = useState(true);

  const meta = PROFILE_DB[decodedCountry] || { region: 'Global', pop: 'N/A', gdp: 'N/A', threat: 'Low', flag: '🗺️', highlight: 'General monitoring active.' };

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [n, w] = await Promise.all([
        analyzeTopic(`${decodedCountry} intelligence`),
        fetchWeather(decodedCountry)
      ]);
      setData({ news: n?.articles || [], weather: w || null });
      setLoading(false);
    })();
  }, [decodedCountry]);

  return (
    <div style={{ padding: '0 40px 40px', minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
      {/* Top Breadcrumb Nav */}
      <div style={{ padding: '24px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '32px' }}>
         <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#fff'} onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}>
           <ArrowLeft size={16} /> Back to Map
         </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '40px' }}>
         
         {/* LEFT COLUMN */}
         <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* Header Identity */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
               <div style={{ fontSize: '80px', filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.5))' }}>{meta.flag}</div>
               <div>
                  <h1 style={{ margin: 0, fontSize: '42px', fontWeight: 800, color: '#f8fafc', letterSpacing: '-1px' }}>{decodedCountry}</h1>
                  <div style={{ display: 'flex', gap: '16px', color: '#cbd5e1', marginTop: '8px', fontSize: '14px' }}>
                     <span><MapPin size={12} style={{marginRight:'4px'}}/>{meta.region}</span>
                     <span>🌍 Pop: {meta.pop}</span>
                     <span>💰 GDP: {meta.gdp}</span>
                  </div>
               </div>
            </div>

            {/* Strategic Overview */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', padding: '24px', borderRadius: '20px' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 16px', color: '#e2e8f0', fontWeight: 600 }}>
                 <Info size={18} color="#38bdf8" /> STRATEGIC OVERVIEW
               </div>
               <p style={{ color: '#94a3b8', lineHeight: 1.6, fontSize: '15px' }}>
                  The nation of <strong style={{color: '#fff'}}>{decodedCountry}</strong> requires constant intelligence monitoring. Currently characterized by {meta.highlight.toLowerCase()}
               </p>
               
               <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
                 <div style={{ flex: 1, padding: '16px', borderRadius: '12px', background: meta.threat === 'Critical' ? 'rgba(239, 68, 68, 0.1)' : meta.threat === 'High' ? 'rgba(249, 115, 22, 0.1)' : 'rgba(52, 211, 153, 0.1)', border: `1px solid ${meta.threat === 'Critical' ? '#ef4444' : meta.threat === 'High' ? '#f97316' : '#34d399'}` }}>
                    <div style={{ fontSize: '12px', color: '#cbd5e1', marginBottom: '8px', fontWeight: 600 }}>THREAT ASSESSMENT</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: meta.threat === 'Critical' ? '#ef4444' : meta.threat === 'High' ? '#f97316' : '#34d399' }}>
                      <ShieldAlert size={20} /> {meta.threat.toUpperCase()}
                    </div>
                 </div>
               </div>
            </div>

            {/* Live Intelligence Feed */}
            <div>
               <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 20px', color: '#e2e8f0', fontWeight: 600 }}>
                 <Activity size={18} color="#a855f7" /> LIVE REGIONAL INTELLIGENCE
               </div>
               
               {loading ? (
                  <div style={{ display: 'flex', height: '200px', alignItems: 'center', justifyContent: 'center' }}>
                     <div className="loader-ring" />
                  </div>
               ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {data.news.slice(0, 5).map((art, i) => (
                      <ArticleCard key={i} article={art} />
                    ))}
                  </div>
               )}
            </div>
         </div>


         {/* RIGHT COLUMN */}
         <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
            {/* Real-time Weather Telemetry */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', padding: '24px', borderRadius: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 16px', color: '#e2e8f0', fontWeight: 600 }}>
                 <CloudRain size={18} color="#f59e0b" /> CLIMATE TELEMETRY
               </div>
               {loading || !data.weather ? (
                  <div style={{ color: '#94a3b8', fontSize: '13px' }}>Awaiting terminal...</div>
               ) : (
                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px' }}>
                       <Thermometer size={16} color="#fbbf24" style={{ marginBottom: '8px' }}/>
                       <div style={{ fontSize: '24px', fontWeight: 700 }}>{data.weather.temp_c}°C</div>
                       <div style={{ fontSize: '11px', color: '#94a3b8' }}>{data.weather.condition}</div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px' }}>
                       <Wind size={16} color="#38bdf8" style={{ marginBottom: '8px' }}/>
                       <div style={{ fontSize: '24px', fontWeight: 700 }}>{data.weather.wind_speed_kmph}</div>
                       <div style={{ fontSize: '11px', color: '#94a3b8' }}>KM/H WINDS</div>
                    </div>
                 </div>
               )}
            </div>

            {/* Comms Intercept (Holographic Stream) */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', padding: '24px', borderRadius: '20px', height: '400px', overflow: 'hidden', position: 'relative' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 16px', color: '#e2e8f0', fontWeight: 600, position: 'relative', zIndex: 10 }}>
                 <Activity size={18} color="#ef4444" /> RAW COMMS INTERCEPT
               </div>
               <div style={{ position: 'absolute', inset: 0, marginTop: '50px' }}>
                 <HolographicStream query={decodedCountry} />
               </div>
            </div>

         </div>

      </div>
    </div>
  );
}
