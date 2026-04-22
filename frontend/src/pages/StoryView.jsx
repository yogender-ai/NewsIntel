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
    if (!article) {
      navigate('/dashboard');
      return;
    }

    async function fetchDeepDive() {
      setLoading(true);
      try {
        const res = await api.storyDeepDive(article.title, article.text, article.source);
        setData(res);
      } catch (e) {
        setError(e.message);
      }
      setLoading(false);
    }

    fetchDeepDive();
  }, [article, navigate]);

  if (!article) return null;

  const perspectives = data?.perspectives || {};
  const currentPerspective = perspectives[activeTab] || {};

  const sentimentLabel = data?.sentiment?.label || '';
  const sentimentColor =
    sentimentLabel === 'POSITIVE' ? 'var(--green)' :
    sentimentLabel === 'NEGATIVE' ? 'var(--red)' : 'var(--text-secondary)';

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Back button */}
      <button
        className="btn-ghost"
        onClick={() => navigate('/dashboard')}
        style={{ marginBottom: '24px', fontSize: '13px', color: 'var(--text-secondary)' }}
      >
        ← Back to Dashboard
      </button>

      {/* Story header */}
      <div className="fade-in" style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <span className="label" style={{ color: 'var(--text-tertiary)' }}>{article.source}</span>
          {sentimentLabel && !loading && (
            <span className="badge" style={{
              background: sentimentLabel === 'POSITIVE' ? 'var(--green-dim)' :
                sentimentLabel === 'NEGATIVE' ? 'var(--red-dim)' : 'rgba(255,255,255,0.04)',
              color: sentimentColor,
            }}>
              {sentimentLabel} · {Math.round((data?.sentiment?.score || 0) * 100)}%
            </span>
          )}
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: 700, lineHeight: 1.3, marginBottom: '16px' }}>
          {article.title}
        </h1>
        <p style={{ fontSize: '15px', lineHeight: 1.8, color: 'var(--text-secondary)' }}>
          {article.text}
        </p>
      </div>

      {loading ? (
        <div>
          <div className="card" style={{ marginBottom: '20px' }}>
            <div className="skeleton" style={{ width: '180px', height: '14px', marginBottom: '20px' }} />
            <div className="skeleton" style={{ width: '100%', height: '16px', marginBottom: '12px' }} />
            <div className="skeleton" style={{ width: '80%', height: '16px', marginBottom: '12px' }} />
            <div className="skeleton" style={{ width: '60%', height: '16px' }} />
          </div>
          <div className="card">
            <div className="skeleton" style={{ width: '140px', height: '14px', marginBottom: '20px' }} />
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              {[1,2,3].map(i => <div key={i} className="skeleton" style={{ width: '80px', height: '36px', borderRadius: '8px' }} />)}
            </div>
            <div className="skeleton" style={{ width: '100%', height: '80px' }} />
          </div>
        </div>
      ) : error ? (
        <div className="card" style={{ borderColor: 'var(--red)', background: 'var(--red-dim)' }}>
          <p style={{ color: 'var(--red)', fontSize: '13px' }}>⚠ Deep dive failed: {error}</p>
        </div>
      ) : (
        <>
          {/* ── Entities ──────────────────────────────────────── */}
          {data?.entities && data.entities.length > 0 && (
            <div className="card fade-in" style={{ marginBottom: '20px' }}>
              <div className="card-header">
                <div className="card-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  Key Entities
                </div>
                <span className="label">{data.entities.length} DETECTED</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {data.entities.map((e, i) => (
                  <div key={i} style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}>
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>{e.name}</span>
                    <span className="mono" style={{
                      fontSize: '10px',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      background: 'var(--cyan-dim)',
                      color: 'var(--cyan)',
                    }}>
                      {e.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Perspectives Panel ────────────────────────────── */}
          <div className="card fade-in fade-in-delay-1">
            <div className="card-header">
              <div className="card-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                Perspectives Panel
              </div>
              <span className="label">FRAMING ANALYSIS</span>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '24px', background: 'var(--bg-primary)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
              {[
                { key: 'left', label: '← Left', color: '#5b8def' },
                { key: 'center', label: 'Center', color: 'var(--text-secondary)' },
                { key: 'right', label: 'Right →', color: '#ef5b5b' },
              ].map(tab => (
                <button
                  key={tab.key}
                  className={`perspective-tab ${activeTab === tab.key ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    flex: 1,
                    color: activeTab === tab.key ? tab.color : undefined,
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            {currentPerspective.framing ? (
              <div style={{ display: 'grid', gap: '16px' }}>
                <div>
                  <p className="label" style={{ marginBottom: '6px' }}>FRAMING</p>
                  <p style={{ fontSize: '15px', lineHeight: 1.6 }}>{currentPerspective.framing}</p>
                </div>
                {currentPerspective.emphasis && (
                  <div>
                    <p className="label" style={{ marginBottom: '6px', color: 'var(--green)' }}>EMPHASIS</p>
                    <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>{currentPerspective.emphasis}</p>
                  </div>
                )}
                {currentPerspective.omission && (
                  <div>
                    <p className="label" style={{ marginBottom: '6px', color: 'var(--red)' }}>OMISSION</p>
                    <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>{currentPerspective.omission}</p>
                  </div>
                )}
                {currentPerspective.tone && (
                  <div>
                    <p className="label" style={{ marginBottom: '6px' }}>TONE</p>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{currentPerspective.tone}</p>
                  </div>
                )}
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
                Perspective analysis unavailable for this story.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
