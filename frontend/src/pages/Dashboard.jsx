import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

const ARTICLES = [
  { id: '1', title: 'US-China tech war escalates as new chip restrictions announced', text: 'The United States has imposed sweeping new restrictions on semiconductor exports to China, targeting advanced AI chips and manufacturing equipment. Beijing responded with threats of retaliatory measures against American companies operating in China. NVIDIA and AMD stocks dropped 3% in pre-market trading.', source: 'Reuters' },
  { id: '2', title: 'Federal Reserve signals potential rate cut amid slowing growth', text: 'Federal Reserve officials indicated they are considering rate cuts as economic data points to slower growth in the US economy. Consumer spending declined for the second consecutive month. The dollar weakened against major currencies following the announcement.', source: 'Bloomberg' },
  { id: '3', title: "India becomes world's third largest AI talent hub", text: "India has surpassed the UK and Germany to become the third largest hub for artificial intelligence talent globally. The country's tech sector saw a 340% increase in AI job postings. Google and Microsoft are doubling their AI research teams in Bangalore.", source: 'Economic Times' },
  { id: '4', title: 'Middle East tensions spike after diplomatic talks collapse', text: 'Diplomatic negotiations in the Middle East have broken down. Oil futures jumped 4% as markets priced in supply disruptions. The UN Security Council called an emergency session. Defense stocks surged while airlines declined.', source: 'Al Jazeera' },
  { id: '5', title: 'OpenAI launches GPT-5 with breakthrough reasoning', text: 'OpenAI unveiled GPT-5 with enhanced reasoning and multimodal capabilities. The model shows significant improvements in math, coding, and scientific analysis. Tech companies are scrambling to integrate it. AI safety debates intensified.', source: 'TechCrunch' },
  { id: '6', title: 'ECB warns of eurozone financial stability risks', text: 'The ECB issued its strongest warning about financial stability, citing rising corporate defaults and commercial real estate vulnerabilities. Potential contagion from leveraged derivatives positions was highlighted. European bank stocks fell 2%.', source: 'Financial Times' },
];

function getUrg(s) {
  if (!s) return { l: 'low', c: 'var(--pos)', dot: 'var(--pos)' };
  if (s.label === 'NEGATIVE' && s.confidence > 0.7) return { l: 'high', c: 'var(--neg)', dot: 'var(--neg)' };
  if (s.label === 'NEGATIVE') return { l: 'med', c: 'var(--warn)', dot: 'var(--warn)' };
  return { l: 'low', c: 'var(--pos)', dot: 'var(--pos)' };
}

/* ── Radar Component ──────────────────────────────────────────── */
function TensionRadar({ entries }) {
  if (entries.length === 0) return (
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <p style={{ fontSize: 10, color: 'var(--t4)', fontFamily: 'var(--mono)' }}>
        AWAITING GEOLOCATION DATA...
      </p>
    </div>
  );

  const maxScore = Math.max(...entries.map(([,v]) => v), 1);
  const angleStep = (2 * Math.PI) / Math.max(entries.length, 1);

  return (
    <div className="radar-container">
      <div className="radar-ring radar-ring-1" />
      <div className="radar-ring radar-ring-2" />
      <div className="radar-ring radar-ring-3" />
      <div className="radar-sweep" />

      {entries.map(([name, score], i) => {
        const angle = angleStep * i - Math.PI / 2;
        const radius = 35 + (score / maxScore) * 55;
        const x = 50 + Math.cos(angle) * radius;
        const y = 50 + Math.sin(angle) * radius;
        const color = score >= 70 ? 'var(--neg)' : score >= 40 ? 'var(--warn)' : 'var(--pos)';
        const labelX = 50 + Math.cos(angle) * (radius + 14);
        const labelY = 50 + Math.sin(angle) * (radius + 14);

        return (
          <React.Fragment key={name}>
            <div className="radar-dot" style={{
              left: `${x}%`, top: `${y}%`,
              background: color,
              width: 5 + (score / maxScore) * 5,
              height: 5 + (score / maxScore) * 5,
            }} />
            <div className="radar-label" style={{ left: `${labelX}%`, top: `${labelY}%` }}>
              {name.slice(0, 8)}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const fetched = useRef(false);
  const navigate = useNavigate();

  const load = useCallback(async (force = false) => {
    if (fetched.current && !force) return;
    fetched.current = true;
    setLoading(true);
    setError(null);
    try { setData(await api.getDashboard(ARTICLES)); }
    catch (e) { setError(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const now = new Date();
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  /* ── Ticker items (duplicate for infinite scroll) ─────────── */
  const tickerItems = useMemo(() => {
    if (!data?.articles) return [];
    return data.articles.map(a => ({
      title: ARTICLES.find(art => art.id === a.id)?.title || '',
      sentiment: a.sentiment?.label,
      source: a.source,
    }));
  }, [data]);

  /* ── Loading ──────────────────────────────────────────────── */
  if (loading) return (
    <div>
      <div style={{ padding: '16px 0', marginBottom: 20 }}>
        <div className="skel" style={{ width: 300, height: 20, marginBottom: 8 }} />
        <div className="skel" style={{ width: 180, height: 10 }} />
      </div>
      {[1,2,3,4,5,6].map(i => (
        <div key={i} className="skel" style={{ width: '100%', height: 48, marginBottom: 3, borderRadius: 6 }} />
      ))}
    </div>
  );

  const brief = data?.daily_brief || '';
  const articles = data?.articles || [];
  const tension = data?.tension_index || {};
  const impact = data?.impact || {};

  const bullets = brief
    ? brief.split(/\n+/).map(s => s.replace(/^[\d.)\-•*]+\s*/, '').trim()).filter(s => s.length > 15).slice(0, 5)
    : [];

  const tensionArr = Object.entries(tension).sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <div>
      {/* ══ TICKER TAPE ════════════════════════════════════════ */}
      {tickerItems.length > 0 && (
        <div className="ticker-wrap fin" style={{ margin: '0 -32px 20px', padding: '6px 0' }}>
          <div className="ticker-track">
            {[...tickerItems, ...tickerItems].map((item, i) => (
              <span key={i} className="ticker-item">
                <span className="ticker-dot" style={{
                  background: item.sentiment === 'NEGATIVE' ? 'var(--neg)' : item.sentiment === 'POSITIVE' ? 'var(--pos)' : 'var(--t3)'
                }} />
                <span className="mono" style={{ fontSize: 9, color: 'var(--t3)', letterSpacing: 1 }}>{item.source}</span>
                <span>{item.title}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ══ HEADER ═════════════════════════════════════════════ */}
      <div className="fin" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px', fontFamily: 'var(--sans)' }}>
              INTELLIGENCE FEED
            </h1>
            <span className="badge-live">LIVE</span>
          </div>
          <p className="mono" style={{ fontSize: 10, color: 'var(--t3)', letterSpacing: 1.5 }}>
            {time} UTC · {data?.sources_count || 0} SOURCES · 14 API CALLS · GATEWAY
          </p>
        </div>
        <button className="btn" onClick={() => load(true)}>↻ REFRESH</button>
      </div>

      {error && (
        <div className="panel fin" style={{ marginBottom: 16, padding: '10px 16px', borderColor: 'var(--neg)' }}>
          <p className="mono" style={{ fontSize: 11, color: 'var(--neg)' }}>ERR: {error}</p>
        </div>
      )}

      {/* ══ ROW 1: BRIEF + RADAR ═══════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, marginBottom: 24 }} className="g2">

        {/* ── Intelligence Brief — Typewriter ─────────────────── */}
        <div className="panel fin d1">
          <div className="panel-head">
            <div className="panel-title">
              <span style={{ color: 'var(--accent)' }}>▸</span> DAILY BRIEF
            </div>
            <span className="label">GEMINI 2.5 FLASH LITE</span>
          </div>

          {bullets.length > 0 ? (
            <div>
              {bullets.map((b, i) => (
                <div key={i} className="typewriter-line">
                  <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', width: 24, flexShrink: 0 }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--t2)' }} dangerouslySetInnerHTML={{
                    __html: b.replace(
                      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g,
                      (m) => m.length > 3 ? `<strong style="color:var(--t1);font-weight:600">${m}</strong>` : m
                    )
                  }} />
                </div>
              ))}
              <span className="type-cursor" />
            </div>
          ) : brief ? (
            <p className="mono" style={{ fontSize: 12, lineHeight: 1.8, color: 'var(--t2)' }}>{brief}</p>
          ) : (
            <p className="mono" style={{ fontSize: 10, color: 'var(--t4)' }}>SYNTHESIZING...</p>
          )}
        </div>

        {/* ── Radar ────────────────────────────────────────────── */}
        <div className="panel fin d2">
          <div className="panel-head">
            <div className="panel-title">
              <span style={{ color: 'var(--warn)' }}>◉</span> TENSION RADAR
            </div>
          </div>
          <TensionRadar entries={tensionArr} />
        </div>
      </div>

      {/* ══ ROW 2: WIRE FEED ═══════════════════════════════════ */}
      <div className="fin d3" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div className="panel-title">
            <span style={{ color: 'var(--accent-2)' }}>◆</span> WIRE FEED
          </div>
          <span className="label">{articles.length} STORIES ANALYZED</span>
        </div>

        <div>
          {ARTICLES.map((art, i) => {
            const a = articles.find(s => s.id === art.id);
            const u = getUrg(a?.sentiment);
            const sentClass = a?.sentiment?.label === 'POSITIVE' ? 'pos' : a?.sentiment?.label === 'NEGATIVE' ? 'neg' : 'neutral';

            return (
              <div key={art.id}
                className="wire-strip"
                onClick={() => navigate('/story', { state: { article: art } })}
                style={{ animationDelay: `${0.1 + i * 0.05}s` }}
              >
                <div className={`urgency-bar urgency-bar-${u.l}`} />
                <span className="wire-source">{art.source}</span>
                <span className="wire-title">{art.title}</span>
                {a?.sentiment && (
                  <span className={`wire-badge wire-badge-${sentClass}`}>
                    {a.sentiment.label}
                  </span>
                )}
                <span className="wire-arrow">→</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ══ ROW 3: IMPACT ══════════════════════════════════════ */}
      {impact && (impact.headline || impact.why_it_matters) && (
        <div className="panel fin d5" style={{ borderLeft: '2px solid var(--accent-3)' }}>
          <div className="panel-head">
            <div className="panel-title">
              <span style={{ color: 'var(--accent-3)' }}>⬡</span> PERSONAL IMPACT
            </div>
            <span className="label">PERSONALIZED</span>
          </div>

          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
            {impact.impact_score !== undefined && (
              <div className="impact-ring" style={{
                background: `conic-gradient(var(--accent-3) ${(impact.impact_score || 0) * 360}deg, var(--bg-2) 0deg)`,
                boxShadow: '0 0 30px rgba(168,85,247,0.15)',
              }}>
                <div style={{
                  width: 62, height: 62, borderRadius: '50%', background: 'var(--bg-1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span className="impact-val" style={{ color: 'var(--accent-3)' }}>
                    {Math.round((impact.impact_score || 0) * 100)}
                  </span>
                </div>
              </div>
            )}

            <div style={{ flex: 1 }}>
              {impact.headline && (
                <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, lineHeight: 1.4 }}>{impact.headline}</p>
              )}
              {impact.why_it_matters && (
                <p style={{ fontSize: 12, lineHeight: 1.75, color: 'var(--t2)', marginBottom: 14 }}>{impact.why_it_matters}</p>
              )}
              {impact.actions?.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {impact.actions.map((a, i) => (
                    <div key={i} className="mono" style={{
                      padding: '6px 12px', borderRadius: 'var(--r-sm)',
                      background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.1)',
                      fontSize: 10, color: 'var(--accent-3)', lineHeight: 1.5,
                    }}>
                      [{String(i + 1).padStart(2, '0')}] {a}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
