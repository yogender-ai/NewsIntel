import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

// ── Sample articles (HARDCODED — will be replaced with real news API) ───
const SAMPLE_ARTICLES = [
  { id: '1', title: 'US-China tech war escalates as new chip restrictions announced', text: 'The United States has imposed sweeping new restrictions on semiconductor exports to China, targeting advanced AI chips and manufacturing equipment. Beijing responded with threats of retaliatory measures against American companies operating in China. NVIDIA and AMD stocks dropped 3% in pre-market trading.', source: 'Reuters' },
  { id: '2', title: 'Federal Reserve signals potential rate cut amid slowing growth', text: 'Federal Reserve officials indicated they are considering rate cuts as economic data points to slower growth in the US economy. Consumer spending declined for the second consecutive month. The dollar weakened against major currencies following the announcement.', source: 'Bloomberg' },
  { id: '3', title: "India becomes world's third largest AI talent hub", text: "India has surpassed the UK and Germany to become the third largest hub for artificial intelligence talent globally. The country's tech sector saw a 340% increase in AI job postings. Google and Microsoft are doubling their AI research teams in Bangalore.", source: 'Economic Times' },
  { id: '4', title: 'Middle East tensions spike after diplomatic talks collapse', text: 'Diplomatic negotiations in the Middle East have broken down. Oil futures jumped 4% as markets priced in supply disruptions. The UN Security Council called an emergency session. Defense stocks surged while airlines declined.', source: 'Al Jazeera' },
  { id: '5', title: 'OpenAI launches GPT-5 with breakthrough reasoning', text: 'OpenAI unveiled GPT-5 with enhanced reasoning and multimodal capabilities. The model shows significant improvements in math, coding, and scientific analysis. Tech companies are scrambling to integrate it. AI safety debates intensified.', source: 'TechCrunch' },
  { id: '6', title: 'ECB warns of eurozone financial stability risks', text: 'The ECB issued its strongest warning about financial stability, citing rising corporate defaults and commercial real estate vulnerabilities. Potential contagion from leveraged derivatives positions was highlighted. European bank stocks fell 2%.', source: 'Financial Times' },
];

function urgency(s) {
  if (!s) return { l: 'low', t: 'Monitor', c: 'var(--pos)' };
  if (s.label === 'NEGATIVE' && s.confidence > 0.7) return { l: 'high', t: 'Alert', c: 'var(--neg)' };
  if (s.label === 'NEGATIVE') return { l: 'med', t: 'Watch', c: 'var(--warn)' };
  if (s.label === 'POSITIVE') return { l: 'low', t: 'Positive', c: 'var(--pos)' };
  return { l: 'low', t: 'Monitor', c: 'var(--t3)' };
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const fetched = useRef(false);
  const navigate = useNavigate();

  const fetch = useCallback(async (force = false) => {
    if (fetched.current && !force) return;
    fetched.current = true;
    setLoading(true);
    setError(null);
    try {
      setData(await api.getDashboard(SAMPLE_ARTICLES));
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const now = new Date();
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const date = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  /* ── Loading Skeleton ─────────────────────────────────────── */
  if (loading) {
    return (
      <div>
        <div style={{ marginBottom: 28 }}>
          <div className="skel" style={{ width: 220, height: 24, marginBottom: 10 }} />
          <div className="skel" style={{ width: 160, height: 12 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 18, marginBottom: 18 }} className="g2">
          <div className="glass" style={{ minHeight: 220, background: 'var(--bg-card-solid)' }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
                <div className="skel" style={{ width: 24, height: 14 }} />
                <div className="skel" style={{ width: `${90 - i * 10}%`, height: 14 }} />
              </div>
            ))}
          </div>
          <div className="glass" style={{ minHeight: 220, background: 'var(--bg-card-solid)' }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ marginBottom: 22 }}>
                <div className="skel" style={{ width: 100, height: 10, marginBottom: 10 }} />
                <div className="skel" style={{ width: '100%', height: 6 }} />
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }} className="g3">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="glass" style={{ minHeight: 140, background: 'var(--bg-card-solid)' }}>
              <div className="skel" style={{ width: 60, height: 9, marginBottom: 14 }} />
              <div className="skel" style={{ width: '100%', height: 14, marginBottom: 8 }} />
              <div className="skel" style={{ width: '70%', height: 14 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── Parse ─────────────────────────────────────────────────── */
  const brief = data?.daily_brief || '';
  const articles = data?.articles || [];
  const tension = data?.tension_index || {};
  const impact = data?.impact || {};

  const bullets = brief
    ? brief.split(/\n+/).map(s => s.replace(/^[\d.)\-•*]+\s*/, '').trim()).filter(s => s.length > 15).slice(0, 5)
    : [];

  const tensionArr = Object.entries(tension).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxT = tensionArr.length > 0 ? Math.max(...tensionArr.map(([,v]) => v), 1) : 100;
  const tColor = (s) => s >= 70 ? 'var(--neg)' : s >= 40 ? 'var(--warn)' : 'var(--pos)';

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="fin" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.7px', marginBottom: 3 }}>
            Intelligence Dashboard
          </h1>
          <p style={{ fontSize: 12, color: 'var(--t3)' }}>
            {date} · <span className="mono">{time}</span> · {data?.sources_count || 0} sources analyzed
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="badge badge-live">LIVE</span>
          <button className="btn-ghost" onClick={() => fetch(true)} style={{ fontSize: 11 }}>↻ Refresh</button>
        </div>
      </div>

      {error && (
        <div className="glass fin" style={{ marginBottom: 16, padding: '12px 18px', borderColor: 'var(--neg)' }}>
          <p style={{ fontSize: 12, color: 'var(--neg)' }}>⚠ {error}</p>
        </div>
      )}

      {/* ── Row 1: Brief + Tension ──────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 18, marginBottom: 18 }} className="g2">

        {/* Intelligence Brief */}
        <div className="glass glass-accent fin d1">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div className="section-head">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Today's Brief
            </div>
            <span className="label">GEMINI 2.5 FLASH</span>
          </div>

          {bullets.length > 0 ? (
            <div>
              {bullets.map((b, i) => (
                <div key={i} className="insight">
                  <span className="insight-num">{String(i + 1).padStart(2, '0')}</span>
                  <p className="insight-text" dangerouslySetInnerHTML={{
                    __html: b.replace(
                      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g,
                      (m) => m.length > 3 ? `<strong>${m}</strong>` : m
                    )
                  }} />
                </div>
              ))}
            </div>
          ) : brief ? (
            <p style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--t2)' }}>{brief}</p>
          ) : (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <p style={{ fontSize: 13, color: 'var(--t4)' }}>Generating intelligence brief...</p>
            </div>
          )}
        </div>

        {/* Tension */}
        <div className="glass fin d2">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div className="section-head">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--warn)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              Tension Index
            </div>
            <span className="label">ENTITY NER</span>
          </div>

          {tensionArr.length > 0 ? tensionArr.map(([r, s]) => (
            <div key={r} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--t2)' }}>{r}</span>
                <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: tColor(s) }}>{s}</span>
              </div>
              <div className="tension-track">
                <div className="tension-fill" style={{
                  width: `${(s / maxT) * 100}%`,
                  background: `linear-gradient(90deg, ${tColor(s)}44, ${tColor(s)})`,
                  color: tColor(s),
                }} />
              </div>
            </div>
          )) : (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <p style={{ fontSize: 28, marginBottom: 8, filter: 'grayscale(0.5)' }}>📡</p>
              <p style={{ fontSize: 11, color: 'var(--t4)', lineHeight: 1.6 }}>
                Tension data populates when<br/>articles contain geographic entities
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Row 2: Story Cards ──────────────────────────────── */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div className="section-head">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            Story Cards
          </div>
          <span className="label">{articles.length} ANALYZED</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }} className="g3">
          {SAMPLE_ARTICLES.map((art, i) => {
            const a = articles.find(s => s.id === art.id);
            const u = urgency(a?.sentiment);
            const sentClass = a?.sentiment?.label === 'POSITIVE' ? 'pos' : a?.sentiment?.label === 'NEGATIVE' ? 'neg' : 'neutral';

            return (
              <div key={art.id}
                className={`glass glass-interactive fin d${Math.min(i + 1, 6)}`}
                onClick={() => navigate('/story', { state: { article: art } })}
              >
                {/* Source + Urgency */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span className="label">{art.source}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span className={`urgency urgency-${u.l}`} />
                    <span style={{ fontSize: 9, fontWeight: 700, color: u.c, letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                      {u.t}
                    </span>
                  </div>
                </div>

                {/* Title */}
                <h3 style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.5, marginBottom: 8, color: 'var(--t1)' }}>
                  {art.title}
                </h3>

                {/* Preview */}
                <p style={{ fontSize: 11, lineHeight: 1.6, color: 'var(--t3)', marginBottom: 12 }}>
                  {art.text.slice(0, 80)}...
                </p>

                {/* Badges */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
                  {a?.sentiment && (
                    <span className={`badge badge-${sentClass}`}>
                      {a.sentiment.label}
                    </span>
                  )}
                  {a?.entities?.slice(0, 2).map((e, j) => (
                    <span key={j} className="etag">{e.name}</span>
                  ))}
                </div>

                {/* Drill CTA */}
                <div style={{ marginTop: 14, fontSize: 10, fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.8px', opacity: 0.7 }}>
                  DEEP DIVE →
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Row 3: Personal Impact ──────────────────────────── */}
      {impact && (impact.headline || impact.why_it_matters) && (
        <div className="glass glass-accent-purple fin d5">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div className="section-head">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              So What For You?
            </div>
            <span className="label">PERSONALIZED IMPACT</span>
          </div>

          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
            {impact.impact_score !== undefined && (
              <div className="impact-ring" style={{
                background: `conic-gradient(var(--accent-3) ${(impact.impact_score || 0) * 360}deg, var(--bg-2) 0deg)`,
              }}>
                <div style={{
                  width: 58, height: 58, borderRadius: '50%', background: 'var(--bg-card-solid)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span className="impact-ring-val" style={{ color: 'var(--accent-3)' }}>
                    {Math.round((impact.impact_score || 0) * 100)}
                  </span>
                </div>
              </div>
            )}

            <div style={{ flex: 1 }}>
              {impact.headline && (
                <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, lineHeight: 1.4 }}>{impact.headline}</p>
              )}
              {impact.why_it_matters && (
                <p style={{ fontSize: 13, lineHeight: 1.75, color: 'var(--t2)', marginBottom: 14 }}>
                  {impact.why_it_matters}
                </p>
              )}
              {impact.actions?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {impact.actions.map((a, i) => (
                    <div key={i} style={{
                      padding: '6px 14px', borderRadius: 'var(--r-md)',
                      background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.12)',
                      fontSize: 11, fontWeight: 500, color: 'var(--accent-3)',
                    }}>
                      → {a}
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
