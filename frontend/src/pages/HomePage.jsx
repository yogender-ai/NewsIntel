import { useState, useEffect } from 'react';
import { fetchTrending } from '../api';
import WorldMap from '../components/WorldMap';
import LiveNewsStream from '../components/LiveNewsStream';
import VoiceAnalystAI from '../components/VoiceAnalystAI';
import HolographicStream from '../components/HolographicStream';
import SplitFlapDisplay from '../components/SplitFlapDisplay';
import StockTicker from '../components/StockTicker';
import { useLanguage } from '../context/LanguageContext';
import { Network, Search, Zap, CloudLightning, ShieldAlert, Cpu, Flame, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function HomePage() {
  const [trending, setTrending] = useState(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { t } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchTrending();
        setTrending(data);
      } catch { /* silent */ }
    })();
  }, []);

  const headlines = trending?.headlines || [];
  const heroHeadlines = headlines.slice(0, 5);
  const shelfItems = headlines.slice(5, 15);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/search/${encodeURIComponent(searchQuery)}`);
  };

  return (
    <div className="command-center-layout" style={{
      width: '100%', 
      height: '100vh',
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden', 
      background: '#010205', 
      position: 'relative'
    }}>

      {/* ── UNIVERSAL COMMAND BAR (Top) ── */}
      <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px', zIndex: 100, gap: '20px'
      }}>
          {/* Weather / Local Intel */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#fff', fontSize: '14px', background: 'rgba(255,255,255,0.03)', padding: '8px 16px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <CloudLightning size={16} color="#3b82f6" />
            <span style={{ fontWeight: 600 }}>72°F</span>
            <span style={{ color: '#64748b' }}>Clear</span>
          </div>

          {/* Search + Pro Categories */}
          <div style={{ flex: 1, maxWidth: '600px', display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
              <form onSubmit={handleSearch} style={{ flex: 1, position: 'relative' }}>
                  <Search size={16} color={searchFocused ? "#3b82f6" : "#64748b"} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    placeholder="Global Intelligence Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                    style={{
                        width: '100%', padding: '10px 16px 10px 40px', borderRadius: '24px',
                        background: searchFocused ? 'rgba(59, 130, 246, 0.05)' : 'rgba(255,255,255,0.03)',
                        border: searchFocused ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid rgba(255,255,255,0.05)',
                        color: '#fff', outline: 'none', transition: 'all 0.3s',
                        boxShadow: searchFocused ? '0 0 20px rgba(59, 130, 246, 0.2)' : 'none'
                    }}
                  />
                  {searchFocused && (
                      <div style={{
                          position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
                          background: 'rgba(10, 15, 30, 0.95)', backdropFilter: 'blur(10px)',
                          border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '12px',
                          padding: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', zIndex: 1000
                      }}>
                          <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px', fontWeight: 600 }}>PRO SUGGESTIONS</div>
                          {['Middle East Tensions', 'AI Market Regulations', 'Quantum Computing Breakthroughs'].map((s, i) => (
                              <div key={i} style={{ padding: '8px', cursor: 'pointer', color: '#fff', fontSize: '13px', borderRadius: '4px' }} onClick={() => {setSearchQuery(s); navigate(`/search/${encodeURIComponent(s)}`);}}
                                   onMouseEnter={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                  <Search size={12} color="#64748b" style={{ marginRight: '8px' }}/> {s}
                              </div>
                          ))}
                      </div>
                  )}
              </form>
              
              {/* Category Chips */}
              <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => navigate('/search/Trending')} className="cat-chip"><Flame size={12} color="#ef4444"/> Trending</button>
                  <button onClick={() => navigate('/search/Politics')} className="cat-chip"><ShieldAlert size={12} color="#3b82f6"/> Geo</button>
                  <button onClick={() => navigate('/search/Technology')} className="cat-chip"><Cpu size={12} color="#10b981"/> Tech</button>
                  <button onClick={() => navigate('/search/Sports')} className="cat-chip"><Trophy size={12} color="#f59e0b"/> Sports</button>
                  <style>{`
                      .cat-chip {
                          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05);
                          color: #cbd5e1; padding: 6px 12px; border-radius: 16px; font-size: 11px; font-weight: 600;
                          cursor: pointer; display: flex; alignItems: center; gap: 4px; transition: all 0.2s;
                      }
                      .cat-chip:hover { background: rgba(255,255,255,0.1); color: #fff; }
                  `}</style>
              </div>
          </div>

          {/* Voice Analyst Siri UI */}
          <div>
              <VoiceAnalystAI />
          </div>
      </div>

      {/* ── BREAKING LIVE BANNER (Optional/Dynamic) ── */}
      <div style={{
          background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.2), transparent)',
          borderTop: '1px solid rgba(239, 68, 68, 0.5)',
          borderBottom: '1px solid rgba(239, 68, 68, 0.5)',
          padding: '6px 24px', display: 'flex', alignItems: 'center', gap: '16px', color: '#fff', fontSize: '13px'
      }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444', fontWeight: 700, letterSpacing: '1px' }}>
              <div className="live-pulse" style={{width: 8, height: 8, borderRadius: '50%', background: '#ef4444'}}></div> LIVE
          </div>
          <span style={{ fontWeight: 500 }}>Global Leaders Summit triggers market volatility.</span>
          <button style={{ marginLeft: 'auto', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#fff', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
            WATCH STREAM
          </button>
      </div>

      {/* Main Grid */}
      <div style={{ display: 'flex', flex: 1, padding: '10px 20px', gap: '30px', overflow: 'hidden' }}>
        
        {/* Left Side: 3D GLOBE + SPLIT FLAP */}
        <div style={{ 
          flex: 6.5, 
          position: 'relative', 
        }}>
          {/* Split Flap Holographic Overlay on Globe */}
          <div style={{ position: 'absolute', top: 20, left: 0, right: 0, zIndex: 10, display: 'flex', justifyContent: 'center', pointerEvents: 'none', filter: 'drop-shadow(0 0 20px rgba(0,0,0,0.8))' }}>
              <SplitFlapDisplay 
                headlines={heroHeadlines.length > 0 ? heroHeadlines : [{title: "CONNECTING TO GLOBAL INTELLIGENCE NETWORK..."}, {title: "AWAITING LIVE DATA FEED..."}]} 
                interval={15000} 
              />
          </div>
          <WorldMap />
        </div>

        {/* Right Side: LIVE STREAM & CRAZY COMMUNITY HUB */}
        <div style={{ 
          flex: 3.5, 
          display: 'flex', 
          flexDirection: 'column',
          gap: '20px',
          paddingTop: '10px'
        }}>
          {/* Live Stream */}
          <div style={{ flexShrink: 0, height: '40%' }}>
            <LiveNewsStream />
          </div>

          {/* Crazy Animated Community Hub Grid */}
          <div className="glass-shelf" style={{
            flex: 1, background: 'rgba(0, 0, 0, 0.2)', backdropFilter: 'blur(20px)',
            border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '16px', padding: '16px',
            display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative',
            boxShadow: 'inset 0 0 40px rgba(59, 130, 246, 0.05)'
          }}>
            {/* Background Radar FX */}
            <div style={{ position: 'absolute', top: '50%', left: '50%', width: '150%', height: '150%', background: 'conic-gradient(from 0deg, transparent 70%, rgba(59, 130, 246, 0.1) 100%)', borderRadius: '50%', transform: 'translate(-50%, -50%)', animation: 'spin 4s linear infinite', pointerEvents: 'none' }} />
            <style>{`@keyframes spin { 100% { transform: translate(-50%, -50%) rotate(360deg); } }`}</style>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#3b82f6', fontSize: '13px', fontWeight: 600, letterSpacing: '1px', position: 'relative', zIndex: 1 }}>
              <Network size={14} /> GLOBAL INTEL GRID
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', overflowY: 'auto', paddingRight: '4px', position: 'relative', zIndex: 1 }}>
              {shelfItems.slice(0, 8).map((item, idx) => (
                <div key={idx} 
                  onClick={() => navigate(`/search/${encodeURIComponent(item.title.split(' ').slice(0, 5).join(' '))}`)}
                  style={{
                    background: 'rgba(10, 15, 30, 0.6)', border: '1px solid rgba(59, 130, 246, 0.15)',
                    padding: '12px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: '6px',
                    position: 'relative', overflow: 'hidden'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)';
                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)';
                    e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(10, 15, 30, 0.6)';
                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.15)';
                    e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  }}
                >
                  <div style={{position: 'absolute', top: 0, left: 0, width: '2px', height: '100%', background: item.is_trusted ? '#10b981' : '#f59e0b'}} />
                  <div style={{ fontSize: '13px', color: '#fff', lineHeight: 1.4, textOverflow: 'ellipsis', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                    {item.title}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '4px' }}>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>{item.time_ago}</span>
                    <Zap size={10} color="#3b82f6" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── STOCK TICKER REBORN ── */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.05)', background: '#02040a' }}>
         <StockTicker />
      </div>

      {/* Bottom Ticker Stream */}
      <div style={{ flexShrink: 0 }}>
        <HolographicStream headlines={headlines} />
      </div>
    </div>
  );
}
