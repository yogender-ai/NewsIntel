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

      {/* Nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <button onClick={() => navigate('/dashboard')} className="wire-btn">← DASHBOARD</button>
        <span className="label" style={{ color: 'var(--text-3)' }}>ARTICLE DEEP DIVE</span>
      </div>

      {/* Header */}
      <div className="panel fin" style={{ padding: 32, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <span className="label">{article.source}</span>
              <span style={{ color: 'var(--text-3)' }}>•</span>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{article.published ? new Date(article.published).toLocaleString() : ''}</span>
            </div>
            <h1 style={{ fontSize: 24, lineHeight: 1.3, marginBottom: 16 }}>{article.title}</h1>
            <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7 }}>
              {article.text_preview || article.text || ''}
            </p>
          </div>
          <a href={article.url} target="_blank" rel="noopener noreferrer" className="btn-premium" style={{ flexShrink: 0 }}>
            ORIGINAL ↗
          </a>
        </div>
      </div>

      {/* Analysis Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

        {/* Sentiment */}
        <div className="panel fin" style={{ padding: 24 }}>
          <div className="label" style={{ marginBottom: 14 }}>SENTIMENT ANALYSIS</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 50, height: 50, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22,
              background: sentLabel === 'POSITIVE' ? 'rgba(0,230,118,0.1)' : sentLabel === 'NEGATIVE' ? 'rgba(255,51,102,0.1)' : 'rgba(136,146,164,0.1)',
              border: `2px solid ${sentLabel === 'POSITIVE' ? 'var(--pos)' : sentLabel === 'NEGATIVE' ? 'var(--neg)' : 'var(--text-3)'}`,
            }}>
              {sentLabel === 'POSITIVE' ? '▲' : sentLabel === 'NEGATIVE' ? '▼' : '—'}
            </div>
            <div>
              <div style={{
                fontSize: 18, fontWeight: 700,
                color: sentLabel === 'POSITIVE' ? 'var(--pos)' : sentLabel === 'NEGATIVE' ? 'var(--neg)' : 'var(--text-2)',
              }}>
                {sentLabel}
              </div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                {(sentConf * 100).toFixed(1)}% confidence
              </div>
            </div>
          </div>
          <div style={{ marginTop: 14, height: 4, background: 'var(--bg-elevated)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${sentConf * 100}%`, borderRadius: 2,
              background: sentLabel === 'POSITIVE' ? 'var(--pos)' : sentLabel === 'NEGATIVE' ? 'var(--neg)' : 'var(--text-2)',
            }} />
          </div>
        </div>

        {/* Entities */}
        <div className="panel fin" style={{ padding: 24 }}>
          <div className="label" style={{ marginBottom: 14 }}>
            ENTITIES {entities.length > 0 ? `(${entities.length})` : ''}
          </div>
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

      {/* Perspectives */}
      {loading ? (
        <div className="panel" style={{ textAlign: 'center', padding: 30 }}>
          <div className="pulse-glow" style={{ width: 12, height: 12, background: 'var(--theme-main)', borderRadius: '50%', margin: '0 auto 12px' }} />
          <span className="mono" style={{ fontSize: 11, color: 'var(--theme-main)', letterSpacing: 1 }}>
            ANALYZING NARRATIVE PERSPECTIVES...
          </span>
        </div>
      ) : perspectives.length > 0 ? (
        <div className="panel fin" style={{ padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <div className="label">NARRATIVE PERSPECTIVES</div>
            <span className="mono" style={{ fontSize: 9, color: 'var(--text-3)' }}>OpenRouter / Gemini</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            {perspectives.map((p, i) => (
              <div key={i} style={{
                background: 'var(--bg-base)', padding: 20, borderRadius: 'var(--br)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderTop: `2px solid ${i === 0 ? 'var(--pos)' : i === 2 ? 'var(--neg)' : 'var(--theme-main)'}`,
              }}>
                <div className="label" style={{ marginBottom: 12, color: 'var(--text-1)', fontSize: 11 }}>
                  {(p.viewpoint || ['Progressive', 'Centrist', 'Conservative'][i] || 'View').toUpperCase()}
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
        <div className="panel" style={{ borderColor: 'var(--warn)', padding: 20 }}>
          <div className="label" style={{ color: 'var(--warn)' }}>PERSPECTIVE ANALYSIS UNAVAILABLE</div>
          <p style={{ marginTop: 6, fontSize: 12, color: 'var(--text-2)' }}>
            AI provider returned an error. Sentiment and entities above are from HuggingFace (free, always available).
          </p>
        </div>
      ) : null}
    </div>
  );
}
