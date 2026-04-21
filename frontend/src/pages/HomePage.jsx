import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchTrending } from '../api';
import SplitFlapDisplay from '../components/SplitFlapDisplay';
import LiveNewsStream from '../components/LiveNewsStream';
import TrendsSidebar from '../components/TrendsSidebar';
import SimilarStories from '../components/SimilarStories';
import AnalystOpinions from '../components/AnalystOpinions';
import IntelligenceFeed from '../components/IntelligenceFeed';
import AlertsPanel from '../components/AlertsPanel';
import WorldMap from '../components/WorldMap';
import { ArrowRight, Globe, Zap, Users, Shield, MessageSquare, Eye, ChevronUp, ChevronDown, BarChart3, Radio, Flame } from 'lucide-react';




/* ── Live stat counters removed per user request ── */

export default function HomePage() {
  const [trending, setTrending] = useState(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const navigate = useNavigate();

  // No fake sentiment oscillation — sentiment comes from real API analysis only

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchTrending();
        setTrending(data);
      } catch { /* silent */ }
    })();
  }, []);





  const headlines = trending?.headlines || [];
  const heroHeadlines = headlines.slice(0, 8);


  return (
    <div className="home-preview-page" style={{ padding: '32px 24px 40px', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '18px', position: 'relative', zIndex: 1 }}>
      


      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── SECTION 1: HERO — SplitFlap + Live YouTube ── */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: '24px' }}>
        
        {/* Left: SplitFlap Breaking News */}
        <div className="cmd-breaking-panel" style={{ padding: '28px', background: 'linear-gradient(135deg, rgba(20,15,35,0.85), rgba(10,5,20,0.95))', borderRadius: '16px', border: '1px solid rgba(139,92,246,0.2)', boxShadow: '0 10px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
          <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', background: '#ef4444', borderRadius: '50%', animation: 'pulseDot 1.5s infinite', boxShadow: '0 0 8px rgba(239,68,68,0.5)' }} />
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#ef4444', letterSpacing: '2px' }}>LIVE INTELLIGENCE FEED</span>
            <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#64748b', fontFamily: 'var(--font-mono)' }}>{new Date().toLocaleTimeString()}</span>
          </div>
          
          <SplitFlapDisplay headlines={heroHeadlines.length > 0 ? heroHeadlines : [{ title: "CONNECTING TO GLOBAL FEED..." }]} interval={8000} />
          
          <div style={{ marginTop: '20px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button onClick={() => {
              if (!localStorage.getItem('user_token')) {
                window.dispatchEvent(new Event('open-login'));
              } else {
                const h = heroHeadlines[0];
                if (h) navigate(`/search/${encodeURIComponent(h.title.split(' ').slice(0, 6).join(' '))}`);
              }
            }} style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: '#fff', border: 'none', borderRadius: '24px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 20px rgba(139,92,246,0.35)' }}>
              Deep AI Analysis <Zap size={13} />
            </button>
            <button onClick={() => navigate('/community')} style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              Join Discussions <Users size={13} />
            </button>
          </div>
        </div>

        {/* Right: Live YouTube Stream */}
        <div style={{ background: 'rgba(8,5,16,0.8)', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 10px 40px rgba(0,0,0,0.4)' }}>
          <LiveNewsStream />
        </div>
      </div>

      {/* ── SECTION 2: INTERACTIVE MAP (Full Width, no box) ── */}
      <div style={{ padding: '8px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', padding: '0 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Globe size={14} style={{ color: '#8b5cf6' }} />
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#8b5cf6', letterSpacing: '2px' }}>GLOBAL INTELLIGENCE HEATMAP</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[{l:'Critical',c:'#ef4444'},{l:'High',c:'#f97316'},{l:'Medium',c:'#facc15'},{l:'Low',c:'#10b981'}].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', color: '#64748b' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: item.c }} />
                {item.l}
              </div>
            ))}
          </div>
        </div>
        <WorldMap />
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── SECTION 3: WHY THIS MATTERS + SIDEBAR ── */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1fr)', gap: '24px', alignItems: 'start' }}>
        
        {/* Left: Deep Context */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* WHY THIS MATTERS */}
          <div style={{ padding: '24px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <h2 style={{ fontSize: '12px', color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', fontWeight: '700', letterSpacing: '1.5px' }}>
              <Radio size={14} /> LIVE INTELLIGENCE BRIEFING
            </h2>

            {headlines.length > 0 ? (
              <>
                {/* Live Stats Row */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  {[
                    { label: 'Active Streams', value: headlines.length, color: '#8b5cf6' },
                    { label: 'Critical', value: headlines.filter(h => h.severity === 'critical').length, color: '#ef4444' },
                    { label: 'High', value: headlines.filter(h => h.severity === 'high').length, color: '#f97316' },
                    { label: 'Sources', value: [...new Set(headlines.map(h => h.source))].length, color: '#10b981' },
                  ].map((stat, i) => (
                    <div key={i} style={{ flex: 1, padding: '10px', background: `${stat.color}08`, border: `1px solid ${stat.color}25`, borderRadius: '10px', textAlign: 'center' }}>
                      <div style={{ fontSize: '18px', fontWeight: '800', color: stat.color }}>{stat.value}</div>
                      <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: '600', letterSpacing: '0.5px', marginTop: '2px' }}>{stat.label}</div>
                    </div>
                  ))}
                </div>

                {/* Top Story */}
                <div style={{ padding: '14px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '12px', marginBottom: '12px' }}>
                  <div style={{ fontSize: '10px', color: '#ef4444', fontWeight: '700', letterSpacing: '1px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', animation: 'pulseDot 1.5s infinite' }} />
                    TOP STORY
                  </div>
                  <p style={{ color: '#e2e8f0', fontSize: '13px', lineHeight: '1.5', margin: 0 }}>
                    {headlines[0]?.title}
                  </p>
                  <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', color: '#38bdf8', fontWeight: '600' }}>{headlines[0]?.source}</span>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>{headlines[0]?.time_ago}</span>
                    {headlines[0]?.event_label && (
                      <span style={{ fontSize: '9px', padding: '2px 6px', background: 'rgba(139,92,246,0.2)', color: '#a78bfa', borderRadius: '4px', fontWeight: '600' }}>{headlines[0]?.event_label}</span>
                    )}
                  </div>
                </div>

                {/* Second Story */}
                {headlines.length > 1 && (
                  <div style={{ padding: '14px', background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.12)', borderRadius: '12px' }}>
                    <div style={{ fontSize: '10px', color: '#8b5cf6', fontWeight: '700', letterSpacing: '1px', marginBottom: '6px' }}>DEVELOPING</div>
                    <p style={{ color: '#cbd5e1', fontSize: '12px', lineHeight: '1.5', margin: 0 }}>
                      {headlines[1]?.title}
                    </p>
                    <span style={{ fontSize: '10px', color: '#64748b', marginTop: '6px', display: 'block' }}>{headlines[1]?.source} · {headlines[1]?.time_ago}</span>
                  </div>
                )}
              </>
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                <div className="map-loader-ring" style={{ margin: '0 auto 12px' }} />
                Connecting to global intelligence feeds...
              </div>
            )}
          </div>

          {/* Live Market Headlines */}
          {(() => {
            const marketKeywords = ['market', 'stock', 'nasdaq', 's&p', 'dow', 'oil', 'gold', 'economy', 'inflation', 'tariff', 'crude', 'rally', 'crash', 'recession', 'trade'];
            const marketHeadlines = headlines.filter(h => marketKeywords.some(kw => h.title.toLowerCase().includes(kw))).slice(0, 3);
            if (marketHeadlines.length === 0) return null;
            return (
              <div style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '12px', color: '#f59e0b', fontWeight: '700', letterSpacing: '1px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <BarChart3 size={14} /> MARKET INTELLIGENCE
                  </h3>
                  <button onClick={() => navigate('/markets')} style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '10px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                    FULL BOARD <ArrowRight size={10} />
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {marketHeadlines.map((mh, i) => (
                    <div key={i} onClick={() => window.open(mh.link, '_blank')} style={{ padding: '12px', background: 'rgba(249,115,22,0.04)', border: '1px solid rgba(249,115,22,0.1)', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(249,115,22,0.1)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(249,115,22,0.04)'}
                    >
                      <div style={{ fontSize: '12px', fontWeight: '600', color: '#e2e8f0', lineHeight: '1.4', marginBottom: '4px' }}>{mh.title}</div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '10px', color: '#f59e0b', fontWeight: '600' }}>{mh.source}</span>
                        <span style={{ fontSize: '10px', color: '#64748b' }}>{mh.time_ago}</span>
                        {mh.event_label && <span style={{ fontSize: '9px', padding: '1px 5px', background: 'rgba(249,115,22,0.15)', color: '#f59e0b', borderRadius: '3px', fontWeight: '600' }}>{mh.event_label}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          {/* Intelligence Feed embedded inside Left Column */}
          <div style={{ marginTop: '20px' }}>
            <IntelligenceFeed headlines={headlines} />
          </div>
        </div>

        {/* Right Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Market Sentiment — shows real data from analysis, not fake oscillation */}
          <div style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.12))', borderRadius: '16px', border: '1px solid rgba(139,92,246,0.2)' }}>
            <div style={{ fontSize: '11px', color: '#8b5cf6', fontWeight: '700', letterSpacing: '1px', marginBottom: '8px' }}>MARKET SENTIMENT</div>
            <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: '1.5' }}>
              Search a topic to see real AI-powered sentiment analysis
            </div>
            <div style={{ marginTop: '10px', fontSize: '10px', color: '#64748b' }}>Powered by Gemini 2.5 Flash + RoBERTa</div>
          </div>
          <TrendsSidebar />
          <AlertsPanel />
          <SimilarStories />
          <AnalystOpinions />
        </div>
      </div>

      {/* Feed is now natively embedded in the left column */}


    </div>
  );
}
