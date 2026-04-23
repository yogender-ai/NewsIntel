import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function StoryView() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const article = state?.article;

  const [deepData, setDeepData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!article) { navigate('/dashboard'); return; }
    window.scrollTo(0, 0);

    (async () => {
      setLoading(true);
      try {
        const result = await api.storyDeepDive(
          article.title,
          article.text_preview || article.text || article.title,
          article.source
        );
        setDeepData(result);
      } catch (err) {
        setError(err.message);
      }
      setLoading(false);
    })();
  }, [article, navigate]);

  if (!article) return null;

  // Use article data (always available) + deep data (may fail)
  const entities = deepData?.entities?.length > 0 ? deepData.entities : (article.entities || []);
  const sentLabel = article.sentiment?.label || deepData?.sentiment?.label || 'NEUTRAL';
  const sentConf = article.sentiment?.confidence || deepData?.sentiment?.score || 0.5;
  const perspectives = deepData?.perspectives || [];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 60 }}>

      {/* ── Nav ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <button onClick={() => navigate('/dashboard')} className="wire-btn">← DASHBOARD</button>
        <span className="mono-label" style={{ color: 'var(--text-3)' }}>ARTICLE DEEP DIVE</span>
      </div>

      {/* ── Header Panel ── */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <span className="mono-label">{article.source}</span>
              <span style={{ color: 'var(--text-3)' }}>•</span>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{article.published ? new Date(article.published).toLocaleString() : ''}</span>
            </div>
            <h1 style={{ fontSize: 22, lineHeight: 1.35, marginBottom: 14 }}>{article.title}</h1>
            <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7 }}>
              {article.text_preview || article.text || ''}
            </p>
          </div>
          <a href={article.url} target="_blank" rel="noopener noreferrer" className="wire-btn" style={{ flexShrink: 0 }}>
            ORIGINAL ↗
          </a>
        </div>
      </div>

      {/* ── Analysis Grid (shows immediately from article data) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

        {/* Sentiment */}
        <div className="panel fin">
          <span className="mono-label" style={{ marginBottom: 14, display: 'block' }}>SENTIMENT</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20,
              background: sentLabel === 'POSITIVE' ? 'rgba(0,230,118,0.1)' : sentLabel === 'NEGATIVE' ? 'rgba(255,51,102,0.1)' : 'rgba(120,120,140,0.1)',
              border: `2px solid ${sentLabel === 'POSITIVE' ? 'var(--pos)' : sentLabel === 'NEGATIVE' ? 'var(--neg)' : 'var(--text-3)'}`,
            }}>
              {sentLabel === 'POSITIVE' ? '▲' : sentLabel === 'NEGATIVE' ? '▼' : '—'}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: sentLabel === 'POSITIVE' ? 'var(--pos)' : sentLabel === 'NEGATIVE' ? 'var(--neg)' : 'var(--text-2)' }}>
                {sentLabel}
              </div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                {(sentConf * 100).toFixed(1)}% confidence
              </div>
            </div>
          </div>
          {/* Confidence bar */}
          <div style={{ marginTop: 14, height: 4, background: 'var(--bg-elevated)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${sentConf * 100}%`, borderRadius: 2,
              background: sentLabel === 'POSITIVE' ? 'var(--pos)' : sentLabel === 'NEGATIVE' ? 'var(--neg)' : 'var(--text-2)',
              transition: 'width 0.6s var(--ease)',
            }} />
          </div>
        </div>

        {/* Entities */}
        <div className="panel fin">
          <span className="mono-label" style={{ marginBottom: 14, display: 'block' }}>
            ENTITIES {entities.length > 0 ? `(${entities.length})` : ''}
          </span>
          {entities.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {entities.map((e, i) => (
                <span key={i} style={{
                  padding: '4px 10px', fontSize: 11,
                  background: 'var(--bg-base)', border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 'var(--br)', display: 'inline-flex', gap: 5, alignItems: 'center',
                }}>
                  <span style={{ color: 'var(--text-1)' }}>{e.name}</span>
                  <span className="mono" style={{ color: 'var(--text-3)', fontSize: 8, textTransform: 'uppercase' }}>{e.type}</span>
                </span>
              ))}
            </div>
          ) : (
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>No entities detected</span>
          )}
        </div>
      </div>

      {/* ── Perspectives (from deep-dive Gemini call) ── */}
      {loading ? (
        <div className="panel" style={{ textAlign: 'center', padding: 30 }}>
          <div className="pulse-glow" style={{ width: 12, height: 12, background: 'var(--theme-main)', borderRadius: '50%', margin: '0 auto 12px' }} />
          <span className="mono" style={{ fontSize: 11, color: 'var(--theme-main)', letterSpacing: 1 }}>
            RUNNING PERSPECTIVE ANALYSIS (1 Gemini call)...
          </span>
        </div>
      ) : perspectives.length > 0 ? (
        <div className="panel fin" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <span className="mono-label">NARRATIVE PERSPECTIVES</span>
            <span className="mono" style={{ fontSize: 9, color: 'var(--text-3)' }}>GEMINI 2.5 FLASH</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            {perspectives.map((p, i) => (
              <div key={i} style={{
                background: 'var(--bg-base)', padding: 18,
                borderRadius: 'var(--br)', border: '1px solid rgba(255,255,255,0.06)',
                borderTop: `2px solid ${i === 0 ? 'var(--pos)' : i === 2 ? 'var(--neg)' : 'var(--theme-main)'}`,
              }}>
                <div className="mono-label" style={{ marginBottom: 12, color: 'var(--text-1)', fontSize: 11 }}>
                  {(p.viewpoint || ['Progressive', 'Centrist', 'Conservative'][i] || 'Perspective').toUpperCase()}
                </div>
                {p.framing && <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 10 }}>
                  <strong style={{ color: 'var(--text-1)' }}>Framing:</strong> {p.framing}
                </p>}
                {p.emphasis && <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 10 }}>
                  <strong style={{ color: 'var(--text-1)' }}>Emphasis:</strong> {p.emphasis}
                </p>}
                {p.omission && <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
                  <strong style={{ color: 'var(--text-1)' }}>Omission:</strong> {p.omission}
                </p>}
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="panel" style={{ borderColor: 'var(--warn)' }}>
          <span className="mono-label" style={{ color: 'var(--warn)' }}>PERSPECTIVE ANALYSIS UNAVAILABLE</span>
          <p style={{ marginTop: 6, fontSize: 12, color: 'var(--text-2)' }}>
            Gemini API returned an error ({error}). This usually means rate limits were hit.
            Sentiment and entities above are still from HuggingFace (free).
          </p>
        </div>
      ) : null}
    </div>
  );
}
