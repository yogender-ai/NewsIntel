import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchTrending } from '../api';
import SplitFlapDisplay from '../components/SplitFlapDisplay';
import LiveNewsStream from '../components/LiveNewsStream';
import TrendsSidebar from '../components/TrendsSidebar';
import { ArrowRight, Globe, Zap, Users, Shield, TrendingUp } from 'lucide-react';
import WorldMap from '../components/WorldMap';

export default function HomePage() {
  const [trending, setTrending] = useState(null);
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
    <div className="home-preview-page" style={{ padding: '0 24px', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* ── HERO PREVIEW ── */}
      <div className="preview-hero-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1fr)', gap: '24px' }}>
        
        {/* Left: SplitFlap & Live News Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="cmd-breaking-panel" style={{ padding: '24px', background: 'linear-gradient(135deg, rgba(20,15,35,0.8), rgba(10,5,20,0.9))', borderRadius: '16px', border: '1px solid rgba(139, 92, 246, 0.2)', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
            <div className="cmd-breaking-badge" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="cmd-breaking-dot" style={{ width: '8px', height: '8px', background: '#ef4444', borderRadius: '50%', animation: 'pulseDot 1.5s infinite' }} />
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#ef4444', letterSpacing: '2px' }}>LIVE INTELLIGENCE FEED</span>
            </div>
            
            <SplitFlapDisplay headlines={heroHeadlines.length > 0 ? heroHeadlines : [{ title: "CONNECTING TO GLOBAL FEED..." }]} interval={8000} />
            
            <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
              <button onClick={() => navigate('/story')} style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: '#fff', border: 'none', borderRadius: '24px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)' }}>
                Deep AI Analysis <Zap size={14} />
              </button>
              <button onClick={() => navigate('/community')} style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}>
                Join Discussions <Users size={14} />
              </button>
            </div>
          </div>

          <div className="live-stream-preview-wrapper" style={{ background: '#080510', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
             <LiveNewsStream />
          </div>

        </div>

        {/* Right: Map & Community Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Map Preview */}
          <div style={{ background: '#0a0815', padding: '20px', borderRadius: '16px', border: '1px solid rgba(139, 92, 246, 0.15)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 'bold', color: '#8b5cf6' }}>
                <Globe size={14} /> GLOBAL SENSORS
               </div>
               <button onClick={() => navigate('/search/global')} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                 Interactive Map <ArrowRight size={12} />
               </button>
            </div>
            {/* The SVG map works well shrunk in its container */}
            <WorldMap />
          </div>

          {/* Community Snippet Highlights */}
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 'bold', color: '#fbbf24' }}>
                <Users size={14} /> TOP COMMUNITY DISCUSSIONS
               </div>
               <button onClick={() => navigate('/community')} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                 View All <ArrowRight size={12} />
               </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Fake post 1 */}
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer' }} onClick={() => navigate('/community')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <img src="https://ui-avatars.com/api/?name=Isaac+Chen&background=3b82f6&color=fff" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>Isaac Chen <span style={{ color: '#10b981', fontSize: '10px' }}>VERIFIED</span></div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Senior Market Strategist</div>
                  </div>
                </div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#e2e8f0', marginBottom: '8px', lineHeight: '1.4' }}>Dow spikes 1,200 points as US-Iran ceasefire sparks buying frenzy.</div>
                <div style={{ fontSize: '12px', color: '#8b5cf6', fontWeight: '500' }}>124 comments • Read Discussion →</div>
              </div>

              {/* Fake post 2 */}
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer' }} onClick={() => navigate('/community')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <img src="https://ui-avatars.com/api/?name=Maxine+F&background=f43f5e&color=fff" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>Maxine Forsythe <span style={{ color: '#10b981', fontSize: '10px' }}>VERIFIED</span></div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Geopolitical Analyst</div>
                  </div>
                </div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#e2e8f0', marginBottom: '8px', lineHeight: '1.4' }}>Middle East tensions run high amid new ceasefire talks.</div>
                <div style={{ fontSize: '12px', color: '#8b5cf6', fontWeight: '500' }}>68 comments • Read Discussion →</div>
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* ── LOWER SECTION: TRENDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2fr)', gap: '24px', marginTop: '12px' }}>
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 'bold', color: '#f59e0b' }}>
                <TrendingUp size={14} /> LIVE TRENDS
               </div>
               <button onClick={() => navigate('/search/trends')} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                 Full Analytics <ArrowRight size={12} />
               </button>
            </div>
            <TrendsSidebar />
        </div>

        <div style={{ background: 'linear-gradient(25deg, rgba(8,5,15,0.8), rgba(20,10,40,0.8))', padding: '32px', borderRadius: '16px', border: '1px solid rgba(139, 92, 246, 0.2)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <h2 style={{ fontSize: '28px', fontWeight: '800', color: '#fff', marginBottom: '16px' }}>Ready to analyze global intelligence?</h2>
          <p style={{ fontSize: '15px', color: '#94a3b8', maxWidth: '400px', marginBottom: '32px' }}>
            Gain uninterrupted access to realtime AI sentiment models, interactive maps, and geopolitical discussions.
          </p>
          <button style={{ padding: '14px 32px', background: '#fff', color: '#000', border: 'none', borderRadius: '32px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', boxShadow: '0 10px 30px rgba(255,255,255,0.2)' }}>
            Start Using NewsIntel Now <ArrowRight size={16} />
          </button>
        </div>
      </div>

    </div>
  );
}
