import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

// ── Sample articles for demonstration (replace with real feed later) ──
const SAMPLE_ARTICLES = [
  {
    id: '1',
    title: 'US-China tech war escalates as new chip restrictions announced',
    text: 'The United States has imposed sweeping new restrictions on semiconductor exports to China, targeting advanced AI chips and manufacturing equipment. Beijing responded with threats of retaliatory measures against American companies operating in China. The move is expected to impact companies like NVIDIA and AMD significantly.',
    source: 'Reuters',
    url: '',
    published_at: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Federal Reserve signals potential rate cut amid slowing growth',
    text: 'Federal Reserve officials indicated they are considering rate cuts as economic data points to slower growth in the US economy. Consumer spending has declined for the second consecutive month while unemployment claims have risen. The dollar weakened against major currencies following the announcement.',
    source: 'Bloomberg',
    url: '',
    published_at: new Date().toISOString(),
  },
  {
    id: '3',
    title: 'India becomes world\'s third largest AI talent hub',
    text: 'India has surpassed the UK and Germany to become the third largest hub for artificial intelligence talent globally, according to a new Stanford report. The country\'s tech sector has seen a 340% increase in AI-related job postings. Major investments from Google, Microsoft, and homegrown firms like Infosys are driving the growth in Bangalore and Hyderabad.',
    source: 'Economic Times',
    url: '',
    published_at: new Date().toISOString(),
  },
  {
    id: '4',
    title: 'Middle East tensions spike after diplomatic talks collapse',
    text: 'Diplomatic negotiations in the Middle East have broken down after key parties walked away from the table. Oil futures jumped 4% on the news as markets priced in potential supply disruptions. The UN Security Council has called an emergency session to address the deteriorating situation.',
    source: 'Al Jazeera',
    url: '',
    published_at: new Date().toISOString(),
  },
];

// ── Tension Bar Component ─────────────────────────────────────────
function TensionBar({ region, score, color }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>{region}</span>
        <span className="mono" style={{ fontSize: '13px', fontWeight: 600, color }}>{score}</span>
      </div>
      <div className="tension-bar">
        <div className="tension-bar-fill" style={{ width: `${Math.min(score, 100)}%`, background: color }} />
      </div>
    </div>
  );
}

// ── Story Card Component ──────────────────────────────────────────
function StoryCard({ article, sentiment, entities, onDeepDive, delay }) {
  const sentimentColor =
    sentiment?.label === 'POSITIVE' ? 'var(--green)' :
    sentiment?.label === 'NEGATIVE' ? 'var(--red)' : 'var(--text-secondary)';

  return (
    <div
      className={`card fade-in fade-in-delay-${delay}`}
      style={{ cursor: 'pointer' }}
      onClick={() => onDeepDive(article)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <span className="label" style={{ color: 'var(--text-tertiary)' }}>{article.source}</span>
        {sentiment && (
          <span className="badge" style={{
            background: sentiment.label === 'POSITIVE' ? 'var(--green-dim)' :
              sentiment.label === 'NEGATIVE' ? 'var(--red-dim)' : 'rgba(255,255,255,0.04)',
            color: sentimentColor,
          }}>
            {sentiment.label}
          </span>
        )}
      </div>
      <h3 style={{ fontSize: '15px', fontWeight: 600, lineHeight: 1.4, marginBottom: '10px' }}>
        {article.title}
      </h3>
      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '12px' }}>
        {article.text.slice(0, 140)}...
      </p>
      {entities && entities.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {entities.slice(0, 4).map((e, i) => (
            <span key={i} className="mono" style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '4px',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
            }}>
              {e.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Loading Skeleton ──────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '24px' }}>
        <div className="card">
          <div className="skeleton" style={{ width: '120px', height: '14px', marginBottom: '20px' }} />
          <div className="skeleton" style={{ width: '100%', height: '16px', marginBottom: '12px' }} />
          <div className="skeleton" style={{ width: '90%', height: '16px', marginBottom: '12px' }} />
          <div className="skeleton" style={{ width: '70%', height: '16px' }} />
        </div>
        <div className="card">
          <div className="skeleton" style={{ width: '100px', height: '14px', marginBottom: '20px' }} />
          <div className="skeleton" style={{ width: '100%', height: '8px', marginBottom: '16px' }} />
          <div className="skeleton" style={{ width: '100%', height: '8px', marginBottom: '16px' }} />
          <div className="skeleton" style={{ width: '100%', height: '8px' }} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {[1,2,3,4].map(i => (
          <div key={i} className="card">
            <div className="skeleton" style={{ width: '80px', height: '12px', marginBottom: '14px' }} />
            <div className="skeleton" style={{ width: '100%', height: '14px', marginBottom: '8px' }} />
            <div className="skeleton" style={{ width: '90%', height: '14px', marginBottom: '8px' }} />
            <div className="skeleton" style={{ width: '60%', height: '14px' }} />
          </div>
        ))}
      </div>
    </div>
  );
}


// ── Main Dashboard ────────────────────────────────────────────────
export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [brief, setBrief] = useState('');
  const [tension, setTension] = useState({});
  const [stories, setStories] = useState([]);
  const [impact, setImpact] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fire all requests
      const [briefRes, analysisRes] = await Promise.allSettled([
        api.getDailyBrief(SAMPLE_ARTICLES),
        api.analyzeStories(SAMPLE_ARTICLES),
      ]);

      if (briefRes.status === 'fulfilled') {
        setBrief(briefRes.value.daily_brief || '');
      }

      if (analysisRes.status === 'fulfilled') {
        const data = analysisRes.value;
        setTension(data.tension_index || {});
        setStories(data.articles || []);
      }

      // Get personal impact
      const combinedText = SAMPLE_ARTICLES.map(a => a.text).join(' ');
      try {
        const impactRes = await api.getImpact(combinedText.slice(0, 2000));
        setImpact(impactRes);
      } catch (e) {
        console.warn('Impact fetch failed:', e);
      }

    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const handleDeepDive = (article) => {
    navigate('/story', { state: { article } });
  };

  if (loading) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '4px' }}>Intelligence Dashboard</h1>
            <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>Synthesizing global signals...</p>
          </div>
        </div>
        <DashboardSkeleton />
      </div>
    );
  }

  // Tension data → sorted bars
  const tensionEntries = Object.entries(tension).sort((a, b) => b[1] - a[1]);
  const getTensionColor = (score) =>
    score >= 70 ? 'var(--red)' : score >= 40 ? 'var(--orange)' : 'var(--green)';

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '4px' }}>Intelligence Dashboard</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
            {dateStr} · <span className="mono">{timeStr}</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span className="badge badge-live">LIVE</span>
          <button className="btn-ghost" onClick={fetchDashboard} style={{ fontSize: '13px' }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="card fade-in" style={{
          marginBottom: '24px',
          borderColor: 'var(--red)',
          background: 'var(--red-dim)',
          padding: '16px 20px',
        }}>
          <p style={{ fontSize: '13px', color: 'var(--red)' }}>⚠ API Error: {error}</p>
        </div>
      )}

      {/* ── Top row: Brief + Tension ──────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '24px' }}>
        {/* Daily Brief */}
        <div className="card fade-in" style={{ borderLeft: '3px solid var(--cyan)' }}>
          <div className="card-header">
            <div className="card-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              The Daily Brief
            </div>
            <span className="label">NARRATIVE SYNTHESIS</span>
          </div>
          <p style={{ fontSize: '16px', lineHeight: 1.75, color: 'var(--text-primary)', fontWeight: 400 }}>
            {brief || 'Awaiting intelligence synthesis from AI pipeline...'}
          </p>
        </div>

        {/* Tension Meter */}
        <div className="card fade-in fade-in-delay-1">
          <div className="card-header">
            <div className="card-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
              Global Tension
            </div>
            <span className="label">REAL-TIME</span>
          </div>
          {tensionEntries.length > 0 ? (
            tensionEntries.map(([region, score]) => (
              <TensionBar key={region} region={region} score={score} color={getTensionColor(score)} />
            ))
          ) : (
            <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
              Tension data will populate as articles are analyzed.
            </p>
          )}
        </div>
      </div>

      {/* ── Story Cards Grid ──────────────────────────────────── */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600 }}>Story Cards</h2>
          <span className="label">{stories.length} ANALYZED</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
          {SAMPLE_ARTICLES.map((article, i) => {
            const analysis = stories.find(s => s.id === article.id);
            return (
              <StoryCard
                key={article.id}
                article={article}
                sentiment={analysis?.sentiment}
                entities={analysis?.entities}
                onDeepDive={handleDeepDive}
                delay={(i % 4) + 1}
              />
            );
          })}
        </div>
      </div>

      {/* ── So What? — Personal Impact ────────────────────────── */}
      {impact && (
        <div className="card fade-in fade-in-delay-3" style={{ borderLeft: '3px solid var(--purple)' }}>
          <div className="card-header">
            <div className="card-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              So What For You?
            </div>
            <span className="label">PERSONALIZED</span>
          </div>

          {impact.headline && (
            <p style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-primary)' }}>
              {impact.headline}
            </p>
          )}

          {impact.why_it_matters && (
            <p style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--text-secondary)', marginBottom: '16px' }}>
              {impact.why_it_matters}
            </p>
          )}

          {impact.actions && impact.actions.length > 0 && (
            <div>
              <p className="label" style={{ marginBottom: '8px', color: 'var(--purple)' }}>ACTION ITEMS</p>
              {impact.actions.map((action, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '8px',
                  padding: '8px 0',
                  borderBottom: i < impact.actions.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <span style={{ color: 'var(--purple)', fontWeight: 600, fontSize: '13px' }}>→</span>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{action}</span>
                </div>
              ))}
            </div>
          )}

          {impact.impact_score !== undefined && (
            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="label">RELEVANCE</span>
              <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: 'var(--bg-tertiary)' }}>
                <div style={{
                  height: '100%', borderRadius: '2px',
                  width: `${(impact.impact_score || 0) * 100}%`,
                  background: 'linear-gradient(90deg, var(--purple), var(--cyan))',
                  transition: 'width 0.6s var(--ease-out)',
                }} />
              </div>
              <span className="mono" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--purple)' }}>
                {Math.round((impact.impact_score || 0) * 100)}%
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
