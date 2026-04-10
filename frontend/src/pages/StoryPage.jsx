import { useState, useEffect } from 'react';
import { fetchTrending } from '../api';
import WorldMap from '../components/WorldMap';
import LiveNewsStream from '../components/LiveNewsStream';
import SplitFlapDisplay from '../components/SplitFlapDisplay';
import TrendsSidebar from '../components/TrendsSidebar';
import SimilarStories from '../components/SimilarStories';
import AnalystOpinions from '../components/AnalystOpinions';
import IntelligenceFeed from '../components/IntelligenceFeed';
import { useLanguage } from '../context/LanguageContext';
import { Target, Zap, Globe, TrendingUp, Flame } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const MAP_FILTERS = [
  { label: 'Trending', icon: Flame, color: '#ef4444' },
  { label: 'Economy', icon: TrendingUp, color: '#10b981' },
  { label: 'Geo', icon: Globe, color: '#8b5cf6' },
  { label: 'Iran Ceasefire', icon: Target, color: '#f59e0b' },
];

export default function HomePage() {
  const [trending, setTrending] = useState(null);
  const [activeMapFilter, setActiveMapFilter] = useState('Trending');
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

  return (
    <div className="command-center-v2 article-view" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 350px', gap: '30px', padding: '0 24px' }}>
      
      {/* ── LEFT: MAIN CONTENT COLUMN ── */}
      <div className="cmd-main-column" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Dynamic Split-Flap Headline */}
        <div className="cmd-breaking-panel" style={{ padding: '24px', background: 'linear-gradient(135deg, rgba(20,15,35,0.8), rgba(10,5,20,0.9))', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="cmd-breaking-badge" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="cmd-breaking-dot" style={{ width: '8px', height: '8px', background: '#ef4444', borderRadius: '50%' }} />
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#ef4444', letterSpacing: '2px' }}>LIVE FEED</span>
          </div>
          <SplitFlapDisplay 
            headlines={heroHeadlines.length > 0 ? heroHeadlines : [{ title: "CONNECTING..." }]} 
            interval={10000} 
          />
        </div>

        {/* Flat Glowing Heat Map */}
        <div className="cmd-globe-panel" style={{ background: '#0a0a10', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="cmd-globe-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div className="cmd-globe-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 'bold', color: '#8b5cf6' }}>
              <Zap size={14} className="cmd-globe-icon" />
              <span>GLOBAL INTELLIGENCE</span>
            </div>
          </div>
          <WorldMap />
        </div>

        {/* Why This Matters / Context Block (from Image 4) */}
        <div className="cmd-context-panel" style={{ padding: '24px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h2 style={{ fontSize: '14px', color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <span style={{ fontSize: '18px' }}>🔮</span> WHY THIS MATTERS
          </h2>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
            <img src="https://ui-avatars.com/api/?name=Michael+Gaki&background=1e1e2d&color=fff" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#e2e8f0' }}>Michael Gaki</div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>Senior Financial Analyst</div>
            </div>
          </div>
          <p style={{ color: '#cbd5e1', fontSize: '14px', lineHeight: '1.6' }}>
            Traders are rushing to buy stocks as major indices jumped significantly today. 
            This bullish momentum is heavily influenced by geopolitical cooldowns and strong earnings reports.
            Expect high volatility moving forward.
          </p>
        </div>

        {/* Live News Stream */}
        <div className="cmd-stream-panel">
          <LiveNewsStream />
        </div>

        {/* Intelligence Feed */}
        <IntelligenceFeed headlines={headlines} />

      </div>

      {/* ── RIGHT: SIDEBAR COLUMN ── */}
      <div className="cmd-sidebar-column" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Bullish Indicator */}
        <div className="bullish-indicator" style={{ padding: '24px', background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(6,78,59,0.4))', borderRadius: '16px', border: '1px solid rgba(16,185,129,0.3)', boxShadow: '0 0 40px rgba(16,185,129,0.15)' }}>
           <div style={{ fontSize: '12px', color: '#34d399', fontWeight: 'bold', letterSpacing: '1px' }}>VERY BULLISH</div>
           <div style={{ fontSize: '42px', fontWeight: '900', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
             84% <TrendingUp size={36} color="#34d399" />
           </div>
        </div>

        {/* Global Trends */}
        <TrendsSidebar />

        {/* Similar Stories */}
        <SimilarStories />

        {/* Analyst Opinions */}
        <AnalystOpinions />
        
      </div>

    </div>
  );
}
