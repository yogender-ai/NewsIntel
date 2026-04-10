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

/* ── Dynamic community posts that rotate ── */
const ALL_COMMUNITY_POSTS = [
  { author: 'Isaac Chen', role: 'Senior Market Strategist', color: '#3b82f6', verified: true, title: 'Dow spikes 1,200 points as US-Iran ceasefire sparks buying frenzy.', comments: 124, votes: 758, time: '3h ago', tags: ['Trending', 'Economy', 'Iran'] },
  { author: 'Maxine Forsythe', role: 'Geopolitical Analyst', color: '#f43f5e', verified: true, title: 'Middle East tensions run high amid new ceasefire talks.', comments: 68, votes: 635, time: '6h ago', tags: ['Reuters', 'Iran', 'Ceasefire'] },
  { author: 'Paul D.', role: 'Energy Trader', color: '#f59e0b', verified: true, title: 'Brent crude spikes to $89/barrel as US-Iran ceasefire talks fuel optimism.', comments: 31, votes: 508, time: '2h ago', tags: ['Oil', 'Energy', 'Futures'] },
  { author: 'Sarah Kim', role: 'Asia-Pacific Desk', color: '#10b981', verified: true, title: 'South Korean chipmakers rally after US tariff exemptions announced.', comments: 89, votes: 412, time: '1h ago', tags: ['Tech', 'Trade', 'Asia'] },
  { author: 'Ahmed Hassan', role: 'MENA Correspondent', color: '#8b5cf6', verified: false, title: 'Sudan humanitarian crisis deepens as warring factions reject talks.', comments: 156, votes: 923, time: '45m ago', tags: ['Conflict', 'Africa', 'UN'] },
  { author: 'Elena Rodriguez', role: 'Climate Analyst', color: '#06b6d4', verified: true, title: 'Hurricane season predicted to be most active in 30 years warns NOAA.', comments: 72, votes: 341, time: '4h ago', tags: ['Climate', 'Weather', 'NOAA'] },
];

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
  const [visiblePosts, setVisiblePosts] = useState(ALL_COMMUNITY_POSTS.slice(0, 4));
  const [factIndex, setFactIndex] = useState(0);
  const [engagementCounts, setEngagementCounts] = useState(ALL_COMMUNITY_POSTS.map(p => p.votes));
  const navigate = useNavigate();

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

  // Rotate community posts every 12 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setVisiblePosts(prev => {
        const shifted = [...ALL_COMMUNITY_POSTS];
        shifted.push(shifted.shift());
        ALL_COMMUNITY_POSTS.length = 0;
        ALL_COMMUNITY_POSTS.push(...shifted);
        return shifted.slice(0, 4);
      });
    }, 12000);
    return () => clearInterval(interval);
  }, []);

  // Rotate key facts every 8 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setFactIndex(prev => (prev + 1) % KEY_FACTS.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // Simulate engagement going up
  useEffect(() => {
    const interval = setInterval(() => {
      setEngagementCounts(prev => prev.map(v => v + Math.floor(Math.random() * 3)));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const headlines = trending?.headlines || [];
  const heroHeadlines = headlines.slice(0, 8);

  return (
    <div className="home-preview-page" style={{ padding: '0 24px 40px', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative', zIndex: 1 }}>
      
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
          
          <div style={{ marginTop: '24px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button onClick={() => {
              const h = heroHeadlines[0];
              if (h) navigate(`/search/${encodeURIComponent(h.title.split(' ').slice(0, 6).join(' '))}`);
            }} style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: '#fff', border: 'none', borderRadius: '24px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 20px rgba(139,92,246,0.35)', transition: 'transform 0.2s' }}>
              Deep AI Analysis <Zap size={14} />
            </button>
            <button onClick={() => navigate('/community')} style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}>
              Join Discussions <Users size={14} />
            </button>
          </div>
        </div>

        {/* Right: Live YouTube Stream */}
        <div style={{ background: 'rgba(8,5,16,0.8)', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 10px 40px rgba(0,0,0,0.4)' }}>
          <LiveNewsStream />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── SECTION 2: INTERACTIVE MAP (Full Width) ── */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <div style={{ background: 'linear-gradient(180deg, #08050f 0%, #0c0818 100%)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(139,92,246,0.15)', boxShadow: '0 10px 50px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Globe size={16} style={{ color: '#8b5cf6' }} />
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#8b5cf6', letterSpacing: '2px' }}>GLOBAL INTELLIGENCE HEATMAP</span>
            <div style={{ width: '80px', height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden', position: 'relative' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: '60%', background: 'linear-gradient(90deg, #8b5cf6, #10b981)', borderRadius: '2px', animation: 'progressGlow 3s ease-in-out infinite' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[{l:'Critical',c:'#ef4444'},{l:'High',c:'#f97316'},{l:'Medium',c:'#facc15'},{l:'Low',c:'#10b981'}].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#94a3b8' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.c }} />
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
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1fr)', gap: '24px' }}>
        
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

        {/* Right Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Bullish Gauge */}
          <div style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(6,78,59,0.3))', borderRadius: '16px', border: '1px solid rgba(16,185,129,0.25)', boxShadow: '0 0 30px rgba(16,185,129,0.1)' }}>
            <div style={{ fontSize: '11px', color: '#34d399', fontWeight: '700', letterSpacing: '1px', marginBottom: '4px' }}>MARKET SENTIMENT</div>
            <div style={{ fontSize: '36px', fontWeight: '900', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              84% <TrendingUp size={28} color="#34d399" />
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>VERY BULLISH</div>
          </div>
          <TrendsSidebar />
          <AlertsPanel />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── SECTION 4: COMMUNITY DISCUSSIONS (6 posts) ── */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1fr)', gap: '24px' }}>
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 'bold', color: '#fbbf24', letterSpacing: '1px' }}>
              <MessageSquare size={14} /> TOP COMMUNITY DISCUSSIONS
              <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '400' }}>({ALL_COMMUNITY_POSTS.length} active)</span>
            </div>
            <button onClick={() => navigate('/community')} style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', border: 'none', color: '#fff', fontSize: '11px', fontWeight: '600', padding: '6px 14px', borderRadius: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
              View All <ArrowRight size={12} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {visiblePosts.map((post, idx) => (
              <div key={`${post.author}-${idx}`} onClick={() => navigate('/community')} style={{ background: 'rgba(0,0,0,0.25)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'all 0.25s', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.08)'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.2)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.25)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'; }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <img src={`https://ui-avatars.com/api/?name=${post.author.replace(' ', '+')}&background=${post.color.slice(1)}&color=fff`} style={{ width: '32px', height: '32px', borderRadius: '50%' }} alt="" />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>
                        {post.author} {post.verified && <span style={{ color: '#10b981', fontSize: '10px', fontWeight: '700' }}>VERIFIED</span>}
                      </div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>{post.role} · {post.time}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#e2e8f0', marginBottom: '8px', lineHeight: '1.4' }}>{post.title}</div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {post.tags.map((tag, ti) => (
                      <span key={ti} style={{ fontSize: '10px', padding: '2px 8px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '10px', color: '#a78bfa' }}>{tag}</span>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', minWidth: '60px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#10b981' }}>▲ {engagementCounts[ALL_COMMUNITY_POSTS.indexOf(post)] || post.votes}</span>
                  <span style={{ fontSize: '10px', color: '#64748b' }}>{post.comments} replies</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Similar Stories + Analyst */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <SimilarStories />
          <AnalystOpinions />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── SECTION 5: INTELLIGENCE FEED ── */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <IntelligenceFeed headlines={headlines} />

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
