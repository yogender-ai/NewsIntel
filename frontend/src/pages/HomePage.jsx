import { useState, useEffect } from 'react';
import { fetchTrending } from '../api';
import WorldMap from '../components/WorldMap';
import LiveNewsStream from '../components/LiveNewsStream';
import VoiceAnalystAI from '../components/VoiceAnalystAI';
import HolographicStream from '../components/HolographicStream';
import SplitFlapDisplay from '../components/SplitFlapDisplay';
import StockTicker from '../components/StockTicker';
import { useLanguage } from '../context/LanguageContext';
import { Network, Search, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function HomePage() {
  const [trending, setTrending] = useState(null);
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
      {/* ── STOCK TICKER AT THE VERY TOP ── */}
      <StockTicker />

      {/* Floating Sir-style AI Analyst module */}
      <div style={{ position: 'absolute', top: 50, right: 20, zIndex: 100 }}>
         <VoiceAnalystAI />
      </div>

      {/* ── SPLIT FLAP (HERO) ── */}
      <div style={{ padding: '20px 20px 0 20px', zIndex: 10 }}>
        <SplitFlapDisplay 
          headlines={heroHeadlines.length > 0 ? heroHeadlines : [{title: "CONNECTING TO GLOBAL INTELLIGENCE NETWORK..."}, {title: "AWAITING LIVE DATA FEED..."}]} 
          interval={15000} 
        />
      </div>

      {/* Main Grid */}
      <div style={{ display: 'flex', flex: 1, padding: '10px 20px', gap: '30px', overflow: 'hidden' }}>
        
        {/* Left Side: 3D GLOBE (No Boxes) */}
        <div style={{ 
          flex: 6.5, 
          position: 'relative', 
        }}>
          <WorldMap />
        </div>

        {/* Right Side: LIVE STREAM & GLASS SHELF */}
        <div style={{ 
          flex: 3.5, 
          display: 'flex', 
          flexDirection: 'column',
          gap: '20px',
          paddingTop: '10px'
        }}>
          {/* Live Stream Boxless */}
          <div style={{ flexShrink: 0, height: '55%' }}>
            <LiveNewsStream />
          </div>

          {/* Glass Shelf (Redesigned Community Hub / Cards) */}
          <div className="glass-shelf" style={{
            flex: 1,
            background: 'rgba(255, 255, 255, 0.02)',
            backdropFilter: 'blur(20px)',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '16px 16px 0 0',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#3b82f6', fontSize: '13px', fontWeight: 600, letterSpacing: '1px' }}>
              <Network size={14} /> 
              INTELLIGENCE HUB
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', paddingRight: '4px' }}>
              {shelfItems.map((item, idx) => (
                <div key={idx} 
                  onClick={() => navigate(`/search/${encodeURIComponent(item.title.split(' ').slice(0, 5).join(' '))}`)}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.02)',
                    padding: '12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.02)';
                  }}
                >
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: item.is_trusted ? '#10b981' : '#f59e0b' }}>
                      {item.is_trusted ? 'VERIFIED' : 'RAW INTEL'}
                    </span>
                    <span>{item.time_ago}</span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#fff', lineHeight: 1.4 }}>
                    {item.title}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>{item.source}</span>
                    <Zap size={12} color="#3b82f6" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Ticker Stream */}
      <div style={{ flexShrink: 0 }}>
        <HolographicStream headlines={headlines} />
      </div>
    </div>
  );
}
