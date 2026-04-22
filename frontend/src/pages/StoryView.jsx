import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function StoryView() {
  const location = useLocation();
  const navigate = useNavigate();
  const article = location.state?.article;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('left');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!article) { navigate('/dashboard'); return; }
    (async () => {
      setLoading(true);
      try {
        const res = await api.storyDeepDive(article.title, article.text, article.source);
        setData(res);
      } catch (e) { setError(e.message); }
      setLoading(false);
    })();
  }, [article, navigate]);

  if (!article) return null;

  const perspectives = data?.perspectives || {};
  const currentPerspective = perspectives[activeTab] || {};
  const sentimentLabel = (data?.sentiment?.label || '').toUpperCase();
  const sentimentScore = data?.sentiment?.score || 0;

  const sentimentClass = sentimentLabel === 'POSITIVE' ? 'positive' : sentimentLabel === 'NEGATIVE' ? 'negative' : 'neutral';

  return (
    <div style={{ maxWidth: 880, margin: '0 auto' }}>
      {/* Back */}
      <button className="btn-ghost" onClick={() => navigate('/dashboard')} style={{ marginBottom: 24 }}>
        ← Dashboard
      </button>

      {/* Header */}
      <div className="fade-in" style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span className="label">{article.source}</span>
          {sentimentLabel && !loading && (
            <span className={`badge badge-${sentimentClass}`}>
              {sentimentLabel} · {Math.round(sentimentScore * 100)}%
            </span>
          )}
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.3, letterSpacing: '-0.3px', marginBottom: 16 }}>
          {article.title}
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--t2)' }}>{article.text}</p>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gap: 20 }}>
          <div className="card">
            <div className="skeleton" style={{ width: 150, height: 14, marginBottom: 20 }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ width: 90, height: 28, borderRadius: 6 }} />)}
            </div>
          </div>
          <div className="card">
            <div className="skeleton" style={{ width: 180, height: 14, marginBottom: 20 }} />
            <div className="skeleton" style={{ width: '100%', height: 100 }} />
          </div>
        </div>
      ) : error ? (
        <div className="card" style={{ borderColor: 'var(--negative)' }}>
          <p style={{ color: 'var(--negative)', fontSize: 13 }}>Analysis failed: {error}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 20 }}>

          {/* ── Key Entities ──────────────────────────────────── */}
          {data?.entities && data.entities.length > 0 && (
            <div className="card fade-in d1">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <div className="section-title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                  Extracted Entities
                </div>
                <span className="label">{data.entities.length} DETECTED</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {data.entities.map((e, i) => (
                  <div key={i} className="entity-tag">
                    {e.name}
                    <span className="entity-tag-type">{e.type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Sentiment Breakdown ──────────────────────────── */}
          <div className="card fade-in d2">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div className="section-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                Sentiment Analysis
              </div>
              <span className="label">AI MODEL</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              {/* Score */}
              <div style={{ textAlign: 'center' }}>
                <div className="metric" style={{ color: `var(--${sentimentClass})`, marginBottom: 4 }}>
                  {Math.round(sentimentScore * 100)}%
                </div>
                <span className="label" style={{ color: `var(--${sentimentClass})` }}>{sentimentLabel}</span>
              </div>
              {/* Bar */}
              <div style={{ flex: 1 }}>
                <div className="tension-track" style={{ height: 8 }}>
                  <div className="tension-fill" style={{
                    width: `${sentimentScore * 100}%`,
                    background: `linear-gradient(90deg, var(--${sentimentClass})44, var(--${sentimentClass}))`,
                  }} />
                </div>
                <p style={{ fontSize: 11, color: 'var(--t4)', marginTop: 6 }}>
                  Confidence score from RoBERTa sentiment model via Hugging Face
                </p>
              </div>
            </div>
          </div>

          {/* ── Perspectives Panel ────────────────────────────── */}
          <div className="card fade-in d3">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div className="section-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Perspectives Panel
              </div>
              <span className="label">FRAMING ANALYSIS</span>
            </div>

            <div className="tab-group" style={{ marginBottom: 24 }}>
              {[
                { key: 'left', label: '← Left', color: '#60a5fa' },
                { key: 'center', label: 'Center', color: 'var(--t2)' },
                { key: 'right', label: 'Right →', color: '#f87171' },
              ].map(tab => (
                <button
                  key={tab.key}
                  className={`tab ${activeTab === tab.key ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                  style={{ color: activeTab === tab.key ? tab.color : undefined }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {currentPerspective.framing ? (
              <div style={{ display: 'grid', gap: 20 }}>
                {/* Framing */}
                <div style={{ padding: 16, background: 'var(--bg-primary)', borderRadius: 'var(--r-md)', border: '1px solid var(--border-subtle)' }}>
                  <p className="label" style={{ marginBottom: 8, color: activeTab === 'left' ? '#60a5fa' : activeTab === 'right' ? '#f87171' : 'var(--t3)' }}>
                    HOW THEY FRAME IT
                  </p>
                  <p style={{ fontSize: 15, lineHeight: 1.7, fontWeight: 500 }}>{currentPerspective.framing}</p>
                </div>

                {/* Details grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="grid-2">
                  {currentPerspective.emphasis && (
                    <div>
                      <p className="label" style={{ marginBottom: 6, color: 'var(--positive)' }}>
                        ● WHAT THEY EMPHASIZE
                      </p>
                      <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--t2)' }}>{currentPerspective.emphasis}</p>
                    </div>
                  )}
                  {currentPerspective.omission && (
                    <div>
                      <p className="label" style={{ marginBottom: 6, color: 'var(--negative)' }}>
                        ● WHAT THEY OMIT
                      </p>
                      <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--t2)' }}>{currentPerspective.omission}</p>
                    </div>
                  )}
                </div>

                {currentPerspective.tone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="label">EMOTIONAL TONE:</span>
                    <span style={{ fontSize: 13, color: 'var(--t2)', fontStyle: 'italic' }}>{currentPerspective.tone}</span>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '30px 0' }}>
                <p style={{ fontSize: 28, marginBottom: 8 }}>🔍</p>
                <p style={{ fontSize: 13, color: 'var(--t4)', maxWidth: 300, margin: '0 auto' }}>
                  Perspective analysis is generated by Gemini via the Gateway. The AI analyzes how different political leanings would frame this story.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
