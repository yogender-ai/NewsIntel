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
        setData(await api.storyDeepDive(article.title, article.text, article.source));
      } catch (e) { setError(e.message); }
      setLoading(false);
    })();
  }, [article, navigate]);

  if (!article) return null;

  const perspectives = data?.perspectives || {};
  const persp = perspectives[activeTab] || {};
  const sentLabel = (data?.sentiment?.label || '').toUpperCase();
  const sentScore = data?.sentiment?.score || 0;
  const sentClass = sentLabel === 'POSITIVE' ? 'pos' : sentLabel === 'NEGATIVE' ? 'neg' : 'neutral';

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <button className="btn-ghost" onClick={() => navigate('/dashboard')} style={{ marginBottom: 20 }}>
        ← Dashboard
      </button>

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="fin" style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span className="label">{article.source}</span>
          {sentLabel && !loading && (
            <span className={`badge badge-${sentClass}`}>
              {sentLabel} · {Math.round(sentScore * 100)}%
            </span>
          )}
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.3, letterSpacing: '-0.4px', marginBottom: 14 }}>
          {article.title}
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--t2)' }}>{article.text}</p>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gap: 18 }}>
          <div className="glass" style={{ background: 'var(--bg-card-solid)' }}>
            <div className="skel" style={{ width: 140, height: 12, marginBottom: 18 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              {[1,2,3,4].map(i => <div key={i} className="skel" style={{ width: 90, height: 28, borderRadius: 8 }} />)}
            </div>
          </div>
          <div className="glass" style={{ background: 'var(--bg-card-solid)' }}>
            <div className="skel" style={{ width: 180, height: 12, marginBottom: 18 }} />
            <div className="skel" style={{ width: '100%', height: 80 }} />
          </div>
        </div>
      ) : error ? (
        <div className="glass" style={{ borderColor: 'var(--neg)' }}>
          <p style={{ fontSize: 12, color: 'var(--neg)' }}>Analysis failed: {error}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 18 }}>

          {/* ── Entities ─────────────────────────────────────── */}
          {data?.entities?.length > 0 && (
            <div className="glass fin d1">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div className="section-head">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                  Entities
                </div>
                <span className="label">{data.entities.length} DETECTED</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {data.entities.map((e, i) => (
                  <div key={i} className="etag">
                    {e.name}
                    <span className="etag-type">{e.type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Sentiment ────────────────────────────────────── */}
          <div className="glass fin d2">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div className="section-head">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--warn)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                Sentiment
              </div>
              <span className="label">ROBERTA VIA GATEWAY</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <div style={{ textAlign: 'center' }}>
                <div className="metric" style={{ color: `var(--${sentClass})`, marginBottom: 4 }}>
                  {Math.round(sentScore * 100)}%
                </div>
                <span className="label" style={{ color: `var(--${sentClass})` }}>{sentLabel}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div className="tension-track" style={{ height: 8 }}>
                  <div className="tension-fill" style={{
                    width: `${sentScore * 100}%`,
                    background: `linear-gradient(90deg, var(--${sentClass})44, var(--${sentClass}))`,
                  }} />
                </div>
                <p style={{ fontSize: 10, color: 'var(--t4)', marginTop: 6 }}>
                  RoBERTa sentiment model · Hugging Face Space via Cloud Command Gateway
                </p>
              </div>
            </div>
          </div>

          {/* ── Perspectives ─────────────────────────────────── */}
          <div className="glass fin d3">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div className="section-head">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Perspectives
              </div>
              <span className="label">GEMINI 2.5 FLASH</span>
            </div>

            <div className="tab-group" style={{ marginBottom: 20 }}>
              {[
                { key: 'left', label: '← Left', c: '#60a5fa' },
                { key: 'center', label: 'Center', c: 'var(--t2)' },
                { key: 'right', label: 'Right →', c: '#f87171' },
              ].map(t => (
                <button key={t.key}
                  className={`tab ${activeTab === t.key ? 'active' : ''}`}
                  onClick={() => setActiveTab(t.key)}
                  style={{ color: activeTab === t.key ? t.c : undefined }}
                >{t.label}</button>
              ))}
            </div>

            {persp.framing ? (
              <div style={{ display: 'grid', gap: 18 }}>
                <div style={{ padding: 16, background: 'var(--bg-1)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
                  <p className="label" style={{
                    marginBottom: 8,
                    color: activeTab === 'left' ? '#60a5fa' : activeTab === 'right' ? '#f87171' : 'var(--t3)'
                  }}>HOW THEY FRAME IT</p>
                  <p style={{ fontSize: 15, lineHeight: 1.7, fontWeight: 500 }}>{persp.framing}</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="g2">
                  {persp.emphasis && (
                    <div>
                      <p className="label" style={{ marginBottom: 6, color: 'var(--pos)' }}>● EMPHASIZE</p>
                      <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--t2)' }}>{persp.emphasis}</p>
                    </div>
                  )}
                  {persp.omission && (
                    <div>
                      <p className="label" style={{ marginBottom: 6, color: 'var(--neg)' }}>● OMIT</p>
                      <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--t2)' }}>{persp.omission}</p>
                    </div>
                  )}
                </div>
                {persp.tone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="label">TONE:</span>
                    <span style={{ fontSize: 13, color: 'var(--t2)', fontStyle: 'italic' }}>{persp.tone}</span>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '28px 0' }}>
                <p style={{ fontSize: 28, marginBottom: 8 }}>🔍</p>
                <p style={{ fontSize: 12, color: 'var(--t4)', maxWidth: 280, margin: '0 auto', lineHeight: 1.5 }}>
                  Perspective analysis powered by Gemini 2.5 Flash Lite via Cloud Command Gateway
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
