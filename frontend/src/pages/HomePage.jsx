import { useState, useEffect } from 'react';
import { fetchTrending } from '../api';
import WorldMap from '../components/WorldMap';
import LiveNewsStream from '../components/LiveNewsStream';
import VoiceAnalystAI from '../components/VoiceAnalystAI';
import HolographicStream from '../components/HolographicStream';
import { useLanguage } from '../context/LanguageContext';

export default function HomePage() {
  const [trending, setTrending] = useState(null);
  const { t } = useLanguage();

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchTrending();
        setTrending(data);
      } catch { /* silent */ }
    })();
  }, []);

  const headlines = trending?.headlines || [];

  return (
    <div className="command-center-layout" style={{
      width: '100%', 
      height: 'calc(100vh - 72px)', /* Adjust based on your header height */
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden', 
      background: '#02040a', 
      position: 'relative'
    }}>
      {/* Background ambient lighting */}
      <div style={{
          position: 'absolute', top: '-10%', left: '-10%', width: '40%', height: '40%',
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)',
          pointerEvents: 'none'
      }} />
      <div style={{
          position: 'absolute', bottom: '-10%', right: '-10%', width: '40%', height: '40%',
          background: 'radial-gradient(circle, rgba(250, 204, 21, 0.1) 0%, transparent 70%)',
          pointerEvents: 'none'
      }} />

      {/* Floating AI Analyst module */}
      <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 100 }}>
         <VoiceAnalystAI />
      </div>

      {/* Main Grid */}
      <div style={{ display: 'flex', flex: 1, padding: '20px', gap: '20px', overflow: 'hidden' }}>
        
        {/* Left Side: 3D GLOBE */}
        <div style={{ 
          flex: 6.5, 
          position: 'relative', 
          borderRadius: '16px', 
          border: '1px solid rgba(255,255,255,0.05)', 
          overflow: 'hidden', 
          background: 'radial-gradient(circle at center, rgba(20, 30, 50, 0.5) 0%, rgba(2, 4, 10, 1) 100%)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5) inset'
        }}>
          <WorldMap />
        </div>

        {/* Right Side: LIVE STREAM */}
        <div style={{ 
          flex: 3.5, 
          display: 'flex', 
          flexDirection: 'column',
          paddingTop: '60px' // Offset to accommodate the VoiceAnalystAI module above it
        }}>
          <LiveNewsStream />
        </div>
      </div>

      {/* Bottom Ticker Stream */}
      <div style={{ flexShrink: 0, paddingBottom: '20px', paddingLeft: '20px', paddingRight: '20px' }}>
        <HolographicStream headlines={headlines} />
      </div>
    </div>
  );
}
