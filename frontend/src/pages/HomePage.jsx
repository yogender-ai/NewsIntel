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
import { ArrowRight, Globe, Zap, Users, TrendingUp, Shield, MessageSquare, Eye, ChevronUp, ChevronDown, BarChart3, Radio, Flame } from 'lucide-react';



/* ── Key Intelligence Facts that rotate ── */
const KEY_FACTS = [
  'US and Iran in secret negotiations for weeks, aiming for a ceasefire agreement within days.',
  'Oil prices spiked 4% today as Brent Crude rose to $87.50 per barrel.',
  'EU regulators approve landmark AI safety framework impacting all member states.',
  'Hurricane forecasters warn of unprecedented La Niña conditions forming in the Atlantic.',
  'Gold prices surge past $2,400/oz as investors hedge against geopolitical uncertainty.',
  'Ukraine reports 14 drone strikes on Kyiv overnight, largest barrage in 3 months.',
];

/* ── Live stat counters ── */
const LIVE_STATS = [
  { label: 'ARTICLES ANALYZED', base: 14892 },
  { label: 'ACTIVE REGIONS', base: 47 },
  { label: 'AI MODELS RUNNING', base: 12 },
  { label: 'DATA POINTS/SEC', base: 2340 },
];

export default function HomePage() {
  const [trending, setTrending] = useState(null);
  const [liveStatValues, setLiveStatValues] = useState(LIVE_STATS.map(s => s.base));
  const [factIndex, setFactIndex] = useState(0);
  const [sentiment, setSentiment] = useState(84);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const navigate = useNavigate();

  // Oscillate sentiment every 6 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setSentiment(prev => {
        const delta = Math.floor(Math.random() * 5) - 2;
        return Math.max(60, Math.min(95, prev + delta));
      });
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchTrending();
        setTrending(data);
      } catch { /* silent */ }
    })();
  }, []);

  // Live counter simulation — updates every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveStatValues(prev => prev.map((v, i) => {
        if (i === 0) return v + Math.floor(Math.random() * 8) + 1;
        if (i === 1) return LIVE_STATS[1].base + Math.floor(Math.random() * 5);
        if (i === 2) return LIVE_STATS[2].base;
        return LIVE_STATS[3].base + Math.floor(Math.random() * 200);
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);



  // Rotate key facts every 8 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setFactIndex(prev => (prev + 1) % KEY_FACTS.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);



  const headlines = trending?.headlines || [];
  const heroHeadlines = headlines.slice(0, 8);

  const sentimentLabel = sentiment >= 80 ? 'VERY BULLISH' : sentiment >= 65 ? 'BULLISH' : 'NEUTRAL';
  const sentimentColor = sentiment >= 80 ? '#10b981' : sentiment >= 65 ? '#f59e0b' : '#94a3b8';

  return (
    <div className="home-preview-page" style={{ padding: '0 24px 40px', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '18px', position: 'relative', zIndex: 1 }}>
      
      {/* ── LIVE STATS BAR ── */}
      <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', padding: '12px 0' }}>
        {LIVE_STATS.map((stat, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', animation: 'pulseDot 2s infinite' }} />
            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '600', letterSpacing: '1px' }}>{stat.label}</span>
            <span style={{ fontSize: '13px', color: '#10b981', fontWeight: '800', fontFamily: 'var(--font-mono)' }}>{liveStatValues[i].toLocaleString()}</span>
          </div>
        ))}
      </div>

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
            <h2 style={{ fontSize: '14px', color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <span style={{ fontSize: '18px' }}>🔮</span> WHY THIS MATTERS
            </h2>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
              <img src="https://ui-avatars.com/api/?name=Michael+Gaki&background=1e1e2d&color=fff" style={{ width: '40px', height: '40px', borderRadius: '50%' }} alt="" />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#e2e8f0' }}>Michael Gaki</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Senior Financial Analyst · <span style={{ color: '#10b981' }}>VERIFIED</span></div>
              </div>
            </div>
            <p style={{ color: '#cbd5e1', fontSize: '14px', lineHeight: '1.7', marginBottom: '16px' }}>
              Traders are rushing to buy stocks as Dow futures jumped 1,200 points (a +2.8% surge) in just one day.
              This bullish momentum has spilled over to the S&P 500 and NASDAQ as well. Geopolitical cooldowns
              and strong earnings reports are the primary catalysts.
            </p>

            {/* Key Facts — rotating */}
            <div style={{ padding: '16px', background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: '12px' }}>
              <div style={{ fontSize: '11px', color: '#8b5cf6', fontWeight: '700', letterSpacing: '1px', marginBottom: '8px' }}>✔ KEY FACTS</div>
              <p style={{ color: '#e2e8f0', fontSize: '13px', lineHeight: '1.5', transition: 'opacity 0.5s' }}>
                {KEY_FACTS[factIndex]}
              </p>
            </div>
          </div>

          {/* Market Reaction Mini Chart */}
          <div style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <h3 style={{ fontSize: '12px', color: '#f59e0b', fontWeight: '700', letterSpacing: '1px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart3 size={14} /> MARKET REACTION
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              {[
                { name: 'S&P 500', val: '+2.6%', num: '48,512', up: true },
                { name: 'NASDAQ', val: '-0.55%', num: '23,789', up: false },
                { name: 'Brent Crude', val: '+4.1%', num: '$87.50', up: true },
              ].map((m, i) => (
                <div key={i} style={{ padding: '14px', background: m.up ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)', borderRadius: '12px', border: `1px solid ${m.up ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}` }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>{m.name}</div>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: '#fff' }}>{m.num}</div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: m.up ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {m.up ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {m.val}
                  </div>
                </div>
              ))}
            </div>
          </div>
          </div>
          {/* Intelligence Feed embedded inside Left Column */}
          <div style={{ marginTop: '20px' }}>
            <IntelligenceFeed headlines={headlines} />
          </div>
        </div>

        {/* Right Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Live Sentiment Gauge */}
          <div style={{ padding: '20px', background: `linear-gradient(135deg, ${sentimentColor}11, ${sentimentColor}22)`, borderRadius: '16px', border: `1px solid ${sentimentColor}44`, boxShadow: `0 0 30px ${sentimentColor}15`, transition: 'all 0.8s ease' }}>
            <div style={{ fontSize: '11px', color: sentimentColor, fontWeight: '700', letterSpacing: '1px', marginBottom: '4px', transition: 'color 0.8s' }}>MARKET SENTIMENT</div>
            <div style={{ fontSize: '36px', fontWeight: '900', color: sentimentColor, display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'color 0.8s' }}>
              {sentiment}% <TrendingUp size={28} color={sentimentColor} />
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', transition: 'all 0.8s' }}>{sentimentLabel}</div>
            <div style={{ marginTop: '8px', width: '100%', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ width: `${sentiment}%`, height: '100%', background: sentimentColor, borderRadius: '2px', transition: 'width 0.8s ease, background 0.8s ease' }} />
            </div>
          </div>
          <TrendsSidebar />
          <AlertsPanel />
          <SimilarStories />
          <AnalystOpinions />
        </div>
      </div>

      {/* Feed is now natively embedded in the left column */}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── SECTION 6: CTA BANNER ── */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <div style={{ background: 'linear-gradient(135deg, rgba(15,10,30,0.9), rgba(30,15,60,0.9))', padding: '40px', borderRadius: '20px', border: '1px solid rgba(139,92,246,0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 10px 60px rgba(139,92,246,0.15)' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#fff', marginBottom: '8px' }}>Ready to analyze global intelligence?</h2>
          <p style={{ fontSize: '14px', color: '#94a3b8', maxWidth: '500px' }}>
            Access realtime AI sentiment models, interactive geopolitical maps, expert community discussions, and 24/7 live coverage from around the world.
          </p>
        </div>
        <button style={{ padding: '14px 32px', background: '#fff', color: '#000', border: 'none', borderRadius: '32px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 10px 30px rgba(255,255,255,0.15)', whiteSpace: 'nowrap', flexShrink: 0 }}>
          Get Started <ArrowRight size={16} />
        </button>
      </div>

    </div>
  );
}
