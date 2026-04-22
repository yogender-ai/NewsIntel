import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

// ── Sample articles (will be replaced with live feed) ─────────────
const SAMPLE_ARTICLES = [
  {
    id: '1',
    title: 'US-China tech war escalates as new chip restrictions announced',
    text: 'The United States has imposed sweeping new restrictions on semiconductor exports to China, targeting advanced AI chips and manufacturing equipment. Beijing responded with threats of retaliatory measures against American companies operating in China. The move is expected to impact companies like NVIDIA and AMD significantly. Supply chain disruptions are anticipated across the global semiconductor industry.',
    source: 'Reuters',
    url: '',
    published_at: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Federal Reserve signals potential rate cut amid slowing growth',
    text: 'Federal Reserve officials indicated they are considering rate cuts as economic data points to slower growth in the US economy. Consumer spending has declined for the second consecutive month while unemployment claims have risen. The dollar weakened against major currencies following the announcement. Bond markets rallied as investors priced in a more dovish Federal Reserve stance.',
    source: 'Bloomberg',
    url: '',
    published_at: new Date().toISOString(),
  },
  {
    id: '3',
    title: "India becomes world's third largest AI talent hub",
    text: "India has surpassed the UK and Germany to become the third largest hub for artificial intelligence talent globally, according to a new Stanford report. The country's tech sector has seen a 340% increase in AI-related job postings. Major investments from Google, Microsoft, and homegrown firms like Infosys are driving the growth in Bangalore and Hyderabad. The government's Digital India initiative is accelerating adoption.",
    source: 'Economic Times',
    url: '',
    published_at: new Date().toISOString(),
  },
  {
    id: '4',
    title: 'Middle East tensions spike after diplomatic talks collapse',
    text: 'Diplomatic negotiations in the Middle East have broken down after key parties walked away from the table. Oil futures jumped 4% on the news as markets priced in potential supply disruptions. The UN Security Council has called an emergency session to address the deteriorating situation. Defense stocks surged while travel and airline stocks declined sharply.',
    source: 'Al Jazeera',
    url: '',
    published_at: new Date().toISOString(),
  },
  {
    id: '5',
    title: 'OpenAI launches GPT-5 with reasoning capabilities',
    text: 'OpenAI has unveiled GPT-5, its most advanced language model featuring enhanced reasoning and multimodal capabilities. The model demonstrates significant improvements in mathematical reasoning, coding, and scientific analysis. Tech companies are scrambling to integrate the new model into their products. The announcement has reignited debates about AI safety and regulation.',
    source: 'TechCrunch',
    url: '',
    published_at: new Date().toISOString(),
  },
  {
    id: '6',
    title: 'European Central Bank warns of financial stability risks',
    text: 'The ECB has issued its strongest warning yet about financial stability risks in the eurozone, citing rising corporate defaults and commercial real estate vulnerabilities. The central bank highlighted potential contagion risks from leveraged positions in derivatives markets. European bank stocks fell 2% on the news.',
    source: 'Financial Times',
    url: '',
    published_at: new Date().toISOString(),
  },
];

// ── Urgency classification ────────────────────────────────────────
function getUrgency(sentiment) {
  if (!sentiment) return { level: 'low', label: 'Monitor', color: 'var(--positive)' };
  if (sentiment.label === 'NEGATIVE' && sentiment.confidence > 0.7)
    return { level: 'high', label: 'Alert', color: 'var(--negative)' };
  if (sentiment.label === 'NEGATIVE')
    return { level: 'medium', label: 'Watch', color: 'var(--warning)' };
  return { level: 'low', label: 'Monitor', color: 'var(--positive)' };
}

// ── Time formatting ───────────────────────────────────────────────
function formatTime() {
  const now = new Date();
  return {
    time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    date: now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
  };
}

// ═══════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════
export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [brief, setBrief] = useState('');
  const [tension, setTension] = useState({});
  const [stories, setStories] = useState([]);
  const [impact, setImpact] = useState(null);
  const [clock, setClock] = useState(formatTime());
  const navigate = useNavigate();

  // Live clock
  useEffect(() => {
    const interval = setInterval(() => setClock(formatTime()), 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [briefRes, analysisRes] = await Promise.allSettled([
        api.getDailyBrief(SAMPLE_ARTICLES),
        api.analyzeStories(SAMPLE_ARTICLES),
      ]);

      if (briefRes.status === 'fulfilled') setBrief(briefRes.value.daily_brief || '');
      if (analysisRes.status === 'fulfilled') {
        setTension(analysisRes.value.tension_index || {});
        setStories(analysisRes.value.articles || []);
      }

      const combinedText = SAMPLE_ARTICLES.map(a => a.text).join(' ');
      try {
        const impactRes = await api.getImpact(combinedText.slice(0, 2000));
        setImpact(impactRes);
      } catch (e) { console.warn('Impact unavailable:', e); }

    } catch (e) { console.error('Dashboard fetch failed:', e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const handleDeepDive = (article) => navigate('/story', { state: { article } });

  // ── Parse brief into bullet points ────────────────────────────
  const briefBullets = brief
    ? brief.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 10).slice(0, 5)
    : [];

  // ── Tension entries sorted ────────────────────────────────────
  const tensionEntries = Object.entries(tension).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxTension = tensionEntries.length > 0 ? Math.max(...tensionEntries.map(([,v]) => v), 1) : 100;

  const getTensionColor = (s) => s >= 70 ? 'var(--negative)' : s >= 40 ? 'var(--warning)' : 'var(--positive)';

  // ── Loading state ─────────────────────────────────────────────
  if (loading) {
    return (
      <div>
        <div style={{ marginBottom: 32 }}>
          <div className="skeleton" style={{ width: 200, height: 24, marginBottom: 8 }} />
          <div className="skeleton" style={{ width: 140, height: 14 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 20, marginBottom: 24 }} className="grid-2">
          <div className="card" style={{ padding: 28 }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div className="skeleton" style={{ width: 20, height: 16 }} />
                <div className="skeleton" style={{ width: `${90 - i * 15}%`, height: 16 }} />
              </div>
            ))}
          </div>
          <div className="card" style={{ padding: 28 }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ marginBottom: 18 }}>
                <div className="skeleton" style={{ width: 100, height: 12, marginBottom: 8 }} />
                <div className="skeleton" style={{ width: '100%', height: 6 }} />
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }} className="grid-3">
          {[1,2,3].map(i => (
            <div key={i} className="card">
              <div className="skeleton" style={{ width: 60, height: 10, marginBottom: 14 }} />
              <div className="skeleton" style={{ width: '100%', height: 16, marginBottom: 8 }} />
              <div className="skeleton" style={{ width: '80%', height: 14 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="fade-in" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 2 }}>
            Intelligence Dashboard
          </h1>
          <p style={{ fontSize: 12, color: 'var(--t3)' }}>
            {clock.date} · <span className="mono">{clock.time}</span> · {SAMPLE_ARTICLES.length} sources analyzed
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="badge badge-live">LIVE</span>
          <button className="btn-ghost" onClick={fetchDashboard}>↻ Refresh</button>
        </div>
      </div>

      {/* ── Row 1: Brief + Tension ──────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 20, marginBottom: 20 }} className="grid-2">
        
        {/* Daily Brief — Key Takeaways Format */}
        <div className="card card-accent-left fade-in d1">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div className="section-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Today's Brief
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
                      /\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\b/g,
                      '<strong>$1</strong>'
                    )
                  }} />
                </div>
              ))}
            </div>
          ) : brief ? (
            <p style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--t2)' }}>{brief}</p>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--t4)' }}>
              Generating intelligence brief... This requires the AI pipeline to be active.
            </p>
          )}
        </div>

        {/* Global Tension Index */}
        <div className="card fade-in d2">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div className="section-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              Tension Index
            </div>
            <span className="label">REAL-TIME</span>
          </div>

          {tensionEntries.length > 0 ? (
            <div>
              {tensionEntries.map(([region, score]) => (
                <div key={region} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--t2)' }}>{region}</span>
                    <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: getTensionColor(score) }}>{score}</span>
                  </div>
                  <div className="tension-track">
                    <div className="tension-fill" style={{
                      width: `${(score / maxTension) * 100}%`,
                      background: `linear-gradient(90deg, ${getTensionColor(score)}44, ${getTensionColor(score)})`,
                    }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ fontSize: 28, marginBottom: 8 }}>📡</p>
              <p style={{ fontSize: 12, color: 'var(--t4)' }}>
                Tension data populates as stories with location entities are analyzed.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Row 2: Story Cards ──────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div className="section-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            Story Cards
          </div>
          <span className="label">{stories.length} CLUSTERED</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }} className="grid-3">
          {SAMPLE_ARTICLES.map((article, i) => {
            const analysis = stories.find(s => s.id === article.id);
            const urgency = getUrgency(analysis?.sentiment);

            return (
              <div
                key={article.id}
                className={`card card-clickable fade-in d${Math.min(i + 1, 5)}`}
                onClick={() => handleDeepDive(article)}
              >
                {/* Source + Urgency */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span className="label">{article.source}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className={`urgency-dot urgency-${urgency.level}`} />
                    <span style={{ fontSize: 10, fontWeight: 600, color: urgency.color, letterSpacing: '0.5px' }}>
                      {urgency.label}
                    </span>
                  </div>
                </div>

                {/* Title */}
                <h3 style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.45, marginBottom: 8, color: 'var(--t1)' }}>
                  {article.title}
                </h3>

                {/* Preview */}
                <p style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--t3)', marginBottom: 12 }}>
                  {article.text.slice(0, 100)}...
                </p>

                {/* Sentiment badge */}
                {analysis?.sentiment && (
                  <span className={`badge badge-${analysis.sentiment.label === 'POSITIVE' ? 'positive' : analysis.sentiment.label === 'NEGATIVE' ? 'negative' : 'neutral'}`}>
                    {analysis.sentiment.label} · {Math.round(analysis.sentiment.confidence * 100)}%
                  </span>
                )}

                {/* Entities */}
                {analysis?.entities && analysis.entities.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 10 }}>
                    {analysis.entities.slice(0, 3).map((e, j) => (
                      <span key={j} className="entity-tag">{e.name}</span>
                    ))}
                  </div>
                )}

                {/* Click indicator */}
                <div style={{ marginTop: 14, fontSize: 11, color: 'var(--t4)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  Deep dive →
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Row 3: So What For You ──────────────────────────── */}
      {impact && (
        <div className="card fade-in d4" style={{ borderLeft: '2px solid var(--accent-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div className="section-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              So What For You?
            </div>
            <span className="label">PERSONALIZED</span>
          </div>

          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
            {/* Impact Score Ring */}
            {impact.impact_score !== undefined && (
              <div className="impact-ring" style={{
                background: `conic-gradient(var(--accent-3) ${(impact.impact_score || 0) * 360}deg, var(--bg-elevated) 0deg)`,
              }}>
                <div style={{
                  width: 50, height: 50, borderRadius: '50%', background: 'var(--bg-card)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span className="impact-ring-value" style={{ color: 'var(--accent-3)' }}>
                    {Math.round((impact.impact_score || 0) * 100)}
                  </span>
                </div>
              </div>
            )}

            {/* Content */}
            <div style={{ flex: 1 }}>
              {impact.headline && (
                <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: 'var(--t1)' }}>
                  {impact.headline}
                </p>
              )}
              {impact.why_it_matters && (
                <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--t2)', marginBottom: 16 }}>
                  {impact.why_it_matters}
                </p>
              )}
              {impact.actions && impact.actions.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {impact.actions.map((action, i) => (
                    <div key={i} style={{
                      padding: '8px 14px',
                      borderRadius: 'var(--r-md)',
                      background: 'rgba(168, 85, 247, 0.06)',
                      border: '1px solid rgba(168, 85, 247, 0.12)',
                      fontSize: 12,
                      fontWeight: 500,
                      color: 'var(--accent-3)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}>
                      <span>→</span> {action}
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
