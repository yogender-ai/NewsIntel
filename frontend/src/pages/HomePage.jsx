import { useState, useEffect } from 'react';
import { fetchTrending } from '../api';
import WorldMap from '../components/WorldMap';
import LiveNewsStream from '../components/LiveNewsStream';
import VoiceAnalystAI from '../components/VoiceAnalystAI';
import HolographicStream from '../components/HolographicStream';
import SplitFlapDisplay from '../components/SplitFlapDisplay';
import StockTicker from '../components/StockTicker';
import { useLanguage } from '../context/LanguageContext';
import { Network, Search, CloudLightning, ShieldAlert, Cpu, Flame, Trophy, Globe, Activity, Stethoscope, Play } from 'lucide-react';
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

  // Dynamically extract real suggestions from headlines
  const filteredSuggestions = headlines
    .map(h => h.title)
    .filter(title => title.toLowerCase().includes(searchQuery.toLowerCase()))
    .slice(0, 4);

  // Fallback if no specific headlines match
  if (searchQuery && filteredSuggestions.length === 0) {
      filteredSuggestions.push(`Search global database for "${searchQuery}"...`);
  }

  const playAudioHeadline = (text, e) => {
    e.stopPropagation();
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const prefVoice = voices.find(v => v.name.includes('UK English Male') || v.name.includes('Samantha')) || voices[0];
    if (prefVoice) utterance.voice = prefVoice;
    window.speechSynthesis.speak(utterance);
  };

  const forceSwitchChannel = () => {
     window.dispatchEvent(new CustomEvent('SWITCH_LIVE_CHANNEL', { detail: 'sky' }));
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
          padding: '12px 24px', zIndex: 100, gap: '20px', flexShrink: 0
      }}>
          {/* Weather / Local Intel */}
          <div 
             onClick={() => navigate('/weather')}
             style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '13px', background: 'rgba(255,255,255,0.03)', padding: '6px 12px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', flexShrink: 0, cursor: 'pointer' }}>
            <CloudLightning size={14} color="#3b82f6" />
            <span style={{ fontWeight: 600 }}>72°F</span>
            <span style={{ color: '#64748b' }}>Clear</span>
          </div>

          {/* Search + Categories */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
              <form onSubmit={handleSearch} style={{ width: '300px', position: 'relative', flexShrink: 0 }}>
                  <Search size={14} color={searchFocused ? "#3b82f6" : "#64748b"} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    placeholder="Global Intelligence Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                    style={{
                        width: '100%', padding: '8px 16px 8px 36px', borderRadius: '20px',
                        background: searchFocused ? 'rgba(59, 130, 246, 0.05)' : 'rgba(255,255,255,0.03)',
                        border: searchFocused ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid rgba(255,255,255,0.05)',
                        color: '#fff', outline: 'none', transition: 'all 0.3s', fontSize: '13px',
                        boxShadow: searchFocused ? '0 0 15px rgba(59, 130, 246, 0.2)' : 'none'
                    }}
                  />
                  {searchFocused && searchQuery && filteredSuggestions.length > 0 && (
                      <div style={{
                          position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
                          background: 'rgba(10, 15, 30, 0.95)', backdropFilter: 'blur(10px)',
                          border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '12px',
                          padding: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', zIndex: 1000
                      }}>
                          <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px', fontWeight: 600 }}>LIVE SUGGESTIONS</div>
                          {filteredSuggestions.map((s, i) => (
                              <div key={i} style={{ padding: '8px', cursor: 'pointer', color: '#fff', fontSize: '13px', borderRadius: '4px' }} 
                                   onClick={() => {
                                      const text = s.startsWith('Search global database for') ? searchQuery : s;
                                      setSearchQuery(text); 
                                      navigate(`/search/${encodeURIComponent(text)}`);
                                   }}
                                   onMouseEnter={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)'} 
                                   onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                  <Search size={12} color="#64748b" style={{ marginRight: '8px' }}/> {s}
                              </div>
                          ))}
                      </div>
                  )}
              </form>
              
              {/* Expanded Category Chips */}
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }} className="no-scrollbar">
                  <button onClick={() => navigate('/search/Trending')} className="cat-chip"><Flame size={12} color="#ef4444"/> Trending</button>
                  <button onClick={() => navigate('/search/World')} className="cat-chip"><Globe size={12} color="#8b5cf6"/> World</button>
                  <button onClick={() => navigate('/search/Politics')} className="cat-chip"><ShieldAlert size={12} color="#3b82f6"/> Geo</button>
                  <button onClick={() => navigate('/search/Technology')} className="cat-chip"><Cpu size={12} color="#10b981"/> Tech</button>
                  <button onClick={() => navigate('/search/Science')} className="cat-chip"><Activity size={12} color="#06b6d4"/> Science</button>
                  <button onClick={() => navigate('/search/Health')} className="cat-chip"><Stethoscope size={12} color="#ec4899"/> Health</button>
                  <button onClick={() => navigate('/search/Sports')} className="cat-chip"><Trophy size={12} color="#f59e0b"/> Sports</button>
                  <style>{`
                      .cat-chip {
                          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05);
                          color: #cbd5e1; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600;
                          cursor: pointer; display: flex; align-items: center; gap: 4px; transition: all 0.2s;
                          white-space: nowrap; flex-shrink: 0;
                      }
                      .cat-chip:hover { background: rgba(255,255,255,0.1); color: #fff; }
                      .no-scrollbar::-webkit-scrollbar { display: none; }
                  `}</style>
              </div>
          </div>

          {/* Voice Analyst Siri UI */}
          <div style={{ flexShrink: 0 }}>
              <VoiceAnalystAI />
          </div>
      </div>

      {/* ── PROFIT TICKER (Top) ── */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid rgba(16, 185, 129, 0.2)', background: 'rgba(16, 185, 129, 0.05)' }}>
         <StockTicker mode="up" />
      </div>

      {/* ── BREAKING LIVE BANNER ── */}
      <div style={{
          flexShrink: 0, background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.2), transparent)',
          borderBottom: '1px solid rgba(239, 68, 68, 0.5)',
          padding: '6px 24px', display: 'flex', alignItems: 'center', gap: '16px', color: '#fff', fontSize: '13px'
      }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444', fontWeight: 700, letterSpacing: '1px' }}>
              <div className="live-pulse" style={{width: 8, height: 8, borderRadius: '50%', background: '#ef4444'}}></div> LIVE
          </div>
          <span style={{ fontWeight: 500 }}>Global Leaders Summit triggers market volatility.</span>
          <button onClick={forceSwitchChannel} style={{ marginLeft: 'auto', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#fff', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
            WATCH STREAM
          </button>
      </div>

      {/* ── MAIN GRID ── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, padding: '10px 20px', gap: '30px' }}>
        
        {/* Left Side: 3D GLOBE + SPLIT FLAP */}
        <div style={{ 
          flex: 6.5, 
          position: 'relative', 
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0
        }}>
          {/* Split Flap Holographic Overlay on Globe */}
          <div style={{ position: 'absolute', top: 10, left: 0, right: 0, zIndex: 10, display: 'flex', justifyContent: 'center', pointerEvents: 'none', filter: 'drop-shadow(0 0 20px rgba(0,0,0,0.8))' }}>
              <SplitFlapDisplay 
                headlines={heroHeadlines.length > 0 ? heroHeadlines : [{title: "CONNECTING TO GLOBAL INTELLIGENCE NETWORK..."}, {title: "AWAITING LIVE DATA FEED..."}]} 
                interval={15000} 
              />
          </div>
          
          <div style={{ flex: 1, position: 'relative', minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
             <WorldMap />
          </div>
        </div>

        {/* Right Side: LIVE STREAM & BRIGHT COMMUNITY HUB */}
        <div style={{ 
          flex: 3.5, 
          display: 'flex', 
          flexDirection: 'column',
          gap: '20px',
          minHeight: 0
        }}>
          {/* Live Stream — capped height so globe stays big */}
          <div style={{ flexShrink: 0, maxHeight: '260px', overflow: 'hidden', borderRadius: '8px' }}>
            <LiveNewsStream />
          </div>

          {/* Clean, Bright Community Hub Grid */}
          <div className="glass-shelf" style={{
            flex: 1, 
            background: 'rgba(255, 255, 255, 0.05)', 
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.15)', 
            borderRadius: '16px', 
            padding: '16px',
            display: 'flex', 
            flexDirection: 'column', 
            overflow: 'hidden'
          }}>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#fff', fontSize: '13px', fontWeight: 600, letterSpacing: '1px', flexShrink: 0 }}>
              <Network size={14} color="#3b82f6" /> INTELLIGENCE HUB
            </div>
            
            <div style={{ 
               flex: 1, 
               display: 'flex', 
               flexDirection: 'column', 
               gap: '10px', 
               overflowY: 'auto', 
               paddingRight: '6px' 
            }} className="custom-scroll">
              {shelfItems.map((item, idx) => (
                <div key={idx} 
                  onClick={() => navigate(`/search/${encodeURIComponent(item.title.split(' ').slice(0, 5).join(' '))}`)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)', 
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    padding: '12px', 
                    borderRadius: '8px', 
                    cursor: 'pointer', 
                    transition: 'all 0.2s', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '6px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: '14px', color: '#fff', fontWeight: 500, lineHeight: 1.4, textOverflow: 'ellipsis', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', paddingRight: '8px' }}>
                      {item.title}
                    </div>
                    {/* AUDIO PLAY BUTTON */}
                    <button 
                      onClick={(e) => playAudioHeadline(item.title, e)}
                      style={{ background: 'rgba(59, 130, 246, 0.2)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, color: '#3b82f6' }}
                      title="Listen to headline"
                    >
                      <Play size={12} style={{ marginLeft: '2px' }} />
                    </button>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#cbd5e1' }}>{item.time_ago}</span>
                    <span style={{ fontSize: '10px', color: item.is_trusted ? '#10b981' : '#f59e0b', fontWeight: 600, background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px' }}>
                      {item.is_trusted ? 'VERIFIED' : 'RAW INTEL'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── LOSS TICKER (Bottom) ── */}
      <div style={{ flexShrink: 0, borderTop: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.05)' }}>
         <StockTicker mode="down" />
      </div>

      {/* Bottom Ticker Stream */}
      <div style={{ flexShrink: 0 }}>
        <HolographicStream headlines={headlines} />
      </div>
    </div>
  );
}
