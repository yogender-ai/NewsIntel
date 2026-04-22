import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

// ── Sample articles (HARDCODED — will be replaced with real news feed) ──
const SAMPLE_ARTICLES = [
  { id: '1', title: 'US-China tech war escalates as new chip restrictions announced', text: 'The United States has imposed sweeping new restrictions on semiconductor exports to China, targeting advanced AI chips and manufacturing equipment. Beijing responded with threats of retaliatory measures against American companies operating in China. NVIDIA and AMD stocks dropped 3% in pre-market trading.', source: 'Reuters' },
  { id: '2', title: 'Federal Reserve signals potential rate cut amid slowing growth', text: 'Federal Reserve officials indicated they are considering rate cuts as economic data points to slower growth in the US economy. Consumer spending declined for the second consecutive month. The dollar weakened against major currencies following the announcement.', source: 'Bloomberg' },
  { id: '3', title: "India becomes world's third largest AI talent hub", text: "India has surpassed the UK and Germany to become the third largest hub for artificial intelligence talent globally. The country's tech sector saw a 340% increase in AI job postings. Google and Microsoft are doubling their AI research teams in Bangalore.", source: 'Economic Times' },
  { id: '4', title: 'Middle East tensions spike after diplomatic talks collapse', text: 'Diplomatic negotiations in the Middle East have broken down. Oil futures jumped 4% as markets priced in supply disruptions. The UN Security Council called an emergency session. Defense stocks surged while airlines declined.', source: 'Al Jazeera' },
  { id: '5', title: 'OpenAI launches GPT-5 with breakthrough reasoning', text: 'OpenAI unveiled GPT-5 with enhanced reasoning and multimodal capabilities. The model shows significant improvements in math, coding, and scientific analysis. Tech companies are scrambling to integrate it. AI safety debates intensified.', source: 'TechCrunch' },
  { id: '6', title: 'ECB warns of eurozone financial stability risks', text: 'The ECB issued its strongest warning about financial stability, citing rising corporate defaults and commercial real estate vulnerabilities. Potential contagion from leveraged derivatives positions was highlighted. European bank stocks fell 2%.', source: 'Financial Times' },
];

function getUrgency(sentiment) {
  if (!sentiment) return { level: 'low', label: 'Monitor', color: 'var(--positive)' };
  if (sentiment.label === 'NEGATIVE' && sentiment.confidence > 0.7)
    return { level: 'high', label: 'Alert', color: 'var(--negative)' };
  if (sentiment.label === 'NEGATIVE')
    return { level: 'medium', label: 'Watch', color: 'var(--warning)' };
  if (sentiment.label === 'POSITIVE')
    return { level: 'low', label: 'Positive', color: 'var(--positive)' };
  return { level: 'low', label: 'Monitor', color: 'var(--t3)' };
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const hasFetched = useRef(false);
  const navigate = useNavigate();

  const fetchDashboard = useCallback(async (force = false) => {
    // Prevent double-fetch
    if (hasFetched.current && !force) return;
    hasFetched.current = true;

    setLoading(true);
    setError(null);
    try {
      // ONE single API call for everything
      const result = await api.getDashboard(SAMPLE_ARTICLES);
      setData(result);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const handleRefresh = () => fetchDashboard(true);
  const handleDeepDive = (article) => navigate('/story', { state: { article } });

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  // ── Loading ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div>
        <div style={{ marginBottom: 28 }}>
          <div className="skeleton" style={{ width: 200, height: 22, marginBottom: 8 }} />
          <div className="skeleton" style={{ width: 160, height: 13 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 18, marginBottom: 20 }} className="grid-2">
          <div className="card" style={{ minHeight: 200 }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 18 }}>
                <div className="skeleton" style={{ width: 22, height: 16 }} />
                <div className="skeleton" style={{ width: `${95 - i * 12}%`, height: 16 }} />
              </div>
            ))}
          </div>
          <div className="card" style={{ minHeight: 200 }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ marginBottom: 20 }}>
                <div className="skeleton" style={{ width: 100, height: 11, marginBottom: 8 }} />
                <div className="skeleton" style={{ width: '100%', height: 6 }} />
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }} className="grid-3">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="card">
              <div className="skeleton" style={{ width: 60, height: 10, marginBottom: 12 }} />
              <div className="skeleton" style={{ width: '100%', height: 14, marginBottom: 8 }} />
              <div className="skeleton" style={{ width: '75%', height: 14 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Parse data ──────────────────────────────────────────────
  const brief = data?.daily_brief || '';
  const articles = data?.articles || [];
  const tension = data?.tension_index || {};
  const impact = data?.impact || {};

  const briefBullets = brief
    ? brief.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 15).slice(0, 5)
    : [];

  const tensionEntries = Object.entries(tension).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxTension = tensionEntries.length > 0 ? Math.max(...tensionEntries.map(([,v]) => v), 1) : 100;
  const getTensionColor = (s) => s >= 70 ? 'var(--negative)' : s >= 40 ? 'var(--warning)' : 'var(--positive)';

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="fade-in" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 2 }}>
            Intelligence Dashboard
          </h1>
          <p style={{ fontSize: 12, color: 'var(--t3)' }}>
            {dateStr} · <span className="mono">{timeStr}</span> · {data?.sources_count || 0} sources
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="badge badge-live">LIVE</span>
          <button className="btn-ghost" onClick={handleRefresh}>↻ Refresh</button>
        </div>
      </div>

      {error && (
        <div className="card fade-in" style={{ marginBottom: 18, borderColor: 'var(--negative)', padding: '14px 20px' }}>
          <p style={{ fontSize: 12, color: 'var(--negative)' }}>⚠ {error}</p>
        </div>
      )}

      {/* ── Row 1: Brief + Tension ──────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 18, marginBottom: 18 }} className="grid-2">
        
        {/* Daily Brief */}
        <div className="card card-accent fade-in d1">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div className="section-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Today's Intelligence Brief
            </div>
            <span className="label">AI SYNTHESIS</span>
          </div>

          {briefBullets.length > 0 ? (
            <div>
              {briefBullets.map((bullet, i) => (
                <div key={i} className="insight-bullet">
                  <span className="insight-number">{String(i + 1).padStart(2, '0')}</span>
                  <p className="insight-text" dangerouslySetInnerHTML={{
                    __html: bullet.replace(
                      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g,
                      (match) => match.length > 3 ? `<strong>${match}</strong>` : match
                    )
                  }} />
                </div>
              ))}
            </div>
          ) : brief ? (
            <p style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--t2)' }}>{brief}</p>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <p style={{ fontSize: 13, color: 'var(--t4)' }}>Generating intelligence brief...</p>
            </div>
          )}
        </div>

        {/* Tension Index */}
        <div className="card fade-in d2">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div className="section-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              Tension Index
            </div>
            <span className="label">ENTITY-BASED</span>
          </div>

          {tensionEntries.length > 0 ? (
            tensionEntries.map(([region, score]) => (
              <div key={region} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--t2)' }}>{region}</span>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: getTensionColor(score) }}>{score}</span>
                </div>
                <div className="tension-track">
                  <div className="tension-fill" style={{
                    width: `${(score / maxTension) * 100}%`,
                    background: `linear-gradient(90deg, ${getTensionColor(score)}33, ${getTensionColor(score)})`,
                    color: getTensionColor(score),
                  }} />
                </div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ fontSize: 24, marginBottom: 6 }}>📡</p>
              <p style={{ fontSize: 11, color: 'var(--t4)', lineHeight: 1.5 }}>
                Tension data populates when articles<br/>contain geographic entities
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Row 2: Story Cards ──────────────────────────────── */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="section-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            Story Cards
          </div>
          <span className="label">{articles.length} ANALYZED</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }} className="grid-3">
          {SAMPLE_ARTICLES.map((article, i) => {
            const analysis = articles.find(s => s.id === article.id);
            const urgency = getUrgency(analysis?.sentiment);

            return (
              <div key={article.id} className={`card card-clickable fade-in d${Math.min(i + 1, 6)}`}
                onClick={() => handleDeepDive(article)}>
                
                {/* Source + Urgency */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span className="label">{article.source}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span className={`urgency-dot urgency-${urgency.level}`} />
                    <span style={{ fontSize: 9, fontWeight: 700, color: urgency.color, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                      {urgency.label}
                    </span>
                  </div>
                </div>

                {/* Title */}
                <h3 style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.5, marginBottom: 8, color: 'var(--t1)' }}>
                  {article.title}
                </h3>

                {/* Preview */}
                <p style={{ fontSize: 11, lineHeight: 1.6, color: 'var(--t3)', marginBottom: 10 }}>
                  {article.text.slice(0, 90)}...
                </p>

                {/* Sentiment badge + entities */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
                  {analysis?.sentiment && (
                    <span className={`badge badge-${analysis.sentiment.label === 'POSITIVE' ? 'positive' : analysis.sentiment.label === 'NEGATIVE' ? 'negative' : 'neutral'}`}>
                      {analysis.sentiment.label}
                    </span>
                  )}
                  {analysis?.entities?.slice(0, 2).map((e, j) => (
                    <span key={j} className="entity-tag" style={{ fontSize: 10, padding: '2px 7px' }}>{e.name}</span>
                  ))}
                </div>

                {/* Drill in */}
                <div style={{ marginTop: 12, fontSize: 10, color: 'var(--t4)', letterSpacing: '0.5px' }}>
                  DEEP DIVE →
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Row 3: So What For You ──────────────────────────── */}
      {impact && (impact.headline || impact.why_it_matters) && (
        <div className="card card-accent-purple fade-in d5">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div className="section-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              So What For You?
            </div>
            <span className="label">PERSONALIZED</span>
          </div>

          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
            {impact.impact_score !== undefined && (
              <div className="impact-ring" style={{
                background: `conic-gradient(var(--accent-3) ${(impact.impact_score || 0) * 360}deg, var(--bg-elevated) 0deg)`,
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', background: 'var(--bg-card)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span className="impact-ring-value" style={{ color: 'var(--accent-3)' }}>
                    {Math.round((impact.impact_score || 0) * 100)}
                  </span>
                </div>
              </div>
            )}

            <div style={{ flex: 1 }}>
              {impact.headline && (
                <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{impact.headline}</p>
              )}
              {impact.why_it_matters && (
                <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--t2)', marginBottom: 14 }}>
                  {impact.why_it_matters}
                </p>
              )}
              {impact.actions?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {impact.actions.map((action, i) => (
                    <div key={i} style={{
                      padding: '6px 12px', borderRadius: 'var(--r-md)',
                      background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.1)',
                      fontSize: 11, fontWeight: 500, color: 'var(--accent-3)',
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                      → {action}
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
