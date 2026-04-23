import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function StoryView() {
  const location = useLocation();
  const navigate = useNavigate();
  const article = location.state?.article;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!article) { navigate('/dashboard'); return; }
    window.scrollTo(0, 0);

    const loadData = async () => {
      setLoading(true);
      try {
        const result = await api.storyDeepDive(
          article.title,
          article.text_preview || article.text || article.title,
          article.source
        );
        setData(result);
      } catch (err) {
        setError(err.message);
      }
      setLoading(false);
    };
    loadData();
  }, [article, navigate]);

  if (!article) return null;

  const sentimentLabel = article.sentiment?.label || data?.sentiment?.label;
  const sentimentConf = article.sentiment?.confidence || data?.sentiment?.score;

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: 60 }}>

      {/* ── Navigation ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <button onClick={() => navigate('/dashboard')} className="wire-btn">← BACK TO DASHBOARD</button>
        <span className="mono-label" style={{ color: 'var(--text-3)' }}>DEEP DIVE</span>
      </div>

      {/* ── Article Header ── */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
              <span className="mono-label">{article.source}</span>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>•</span>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{new Date(article.published).toLocaleString()}</span>
            </div>
            <h1 style={{ fontSize: 22, lineHeight: 1.35, marginBottom: 14 }}>{article.title}</h1>
            <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7 }}>
              {article.text_preview || article.text}
            </p>
          </div>
          <a href={article.url} target="_blank" rel="noopener noreferrer" className="wire-btn" style={{ flexShrink: 0 }}>
            READ ORIGINAL ↗
          </a>
        </div>

        {/* Inline sentiment from article data */}
        {sentimentLabel && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>SENTIMENT</span>
            <span className={`badge ${sentimentLabel.toLowerCase()}`}>{sentimentLabel}</span>
            {sentimentConf && (
              <div style={{ flex: 1, maxWidth: 200, height: 3, background: 'var(--bg-elevated)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${(sentimentConf) * 100}%`,
                  background: sentimentLabel === 'POSITIVE' ? 'var(--pos)' : sentimentLabel === 'NEGATIVE' ? 'var(--neg)' : 'var(--text-2)',
                }} />
              </div>
            )}
            <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>{sentimentConf ? `${(sentimentConf * 100).toFixed(0)}%` : ''}</span>
          </div>
        )}

        {/* Inline entities from article data */}
        {article.entities?.length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {article.entities.map((e, i) => (
              <span key={i} style={{
                padding: '3px 8px', fontSize: 10,
                background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 3, fontFamily: 'var(--mono)',
              }}>
                {e.name} <span style={{ color: 'var(--text-3)', fontSize: 8 }}>{e.type}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Deep Analysis ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 50 }}>
          <div className="pulse-glow" style={{ width: 14, height: 14, background: 'var(--theme-main)', borderRadius: '50%', margin: '0 auto 16px' }} />
          <span className="mono" style={{ fontSize: 11, color: 'var(--theme-main)', letterSpacing: 2 }}>RUNNING DEEP ANALYSIS...</span>
        </div>
      ) : error ? (
        <div className="panel" style={{ borderColor: 'var(--neg)' }}>
          <span className="mono-label" style={{ color: 'var(--neg)' }}>ANALYSIS FAILED</span>
          <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-2)' }}>{error}</p>
        </div>
      ) : data ? (
        <div style={{ display: 'grid', gap: 20 }}>

          {/* Deep entities */}
          {data.entities?.length > 0 && (
            <div className="panel fin">
              <span className="mono-label" style={{ marginBottom: 14, display: 'block' }}>ENTITIES DETECTED ({data.entities.length})</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {data.entities.map((e, i) => (
                  <span key={i} style={{
                    padding: '4px 10px', fontSize: 11,
                    background: 'var(--bg-base)', border: '1px solid var(--theme-border)',
                    borderRadius: 'var(--br)', display: 'inline-flex', gap: 6, alignItems: 'center',
                  }}>
                    <span style={{ color: 'var(--text-1)' }}>{e.name}</span>
                    <span style={{ color: 'var(--text-3)', fontSize: 8, fontFamily: 'var(--mono)', textTransform: 'uppercase' }}>{e.type}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Perspectives */}
          {data.perspectives && data.perspectives.length > 0 && (
            <div className="panel fin">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <span className="mono-label">NARRATIVE ANALYSIS</span>
                <span className="mono" style={{ fontSize: 9, color: 'var(--theme-main)', opacity: 0.7 }}>GEMINI 2.5</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 14 }}>
                {data.perspectives.map((p, i) => (
                  <div key={i} style={{
                    background: 'var(--bg-base)', padding: 16,
                    borderRadius: 'var(--br)', border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <div className="mono-label" style={{ marginBottom: 10, color: 'var(--text-1)', fontSize: 11 }}>
                      {p.viewpoint?.toUpperCase()}
                    </div>
                    {p.framing && <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 8 }}>
                      <strong style={{ color: 'var(--text-1)' }}>Framing:</strong> {p.framing}
                    </p>}
                    {p.emphasis && <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 8 }}>
                      <strong style={{ color: 'var(--text-1)' }}>Emphasis:</strong> {p.emphasis}
                    </p>}
                    {p.omission && <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
                      <strong style={{ color: 'var(--text-1)' }}>Omission:</strong> {p.omission}
                    </p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Impact */}
          {data.impact && (
            <div className="panel fin">
              <span className="mono-label" style={{ marginBottom: 14, display: 'block' }}>PERSONAL IMPACT</span>
              {data.impact.headline && <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 10, lineHeight: 1.4 }}>{data.impact.headline}</p>}
              {data.impact.why_it_matters && <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>{data.impact.why_it_matters}</p>}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
