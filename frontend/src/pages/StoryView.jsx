import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';

const SignalBadge = ({ tier }) => {
  const t = (tier || 'NOISE').toUpperCase();
  const cls = `tier-badge tier-${t.toLowerCase()}`;
  const labels = { CRITICAL: '● CRITICAL', SIGNAL: '◆ SIGNAL', WATCH: '○ WATCH', NOISE: '· NOISE' };
  return <span className={cls}>{labels[t] || t}</span>;
};

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

  const entities = deepData?.entities?.length > 0 ? deepData.entities : (article.entities || []);
  const sentLabel = article.sentiment?.label || deepData?.sentiment?.label || 'NEUTRAL';
  const sentConf = article.sentiment?.confidence || deepData?.sentiment?.score || 0.5;
  const perspectives = deepData?.perspectives || [];
  const hasPulse = typeof article.pulse_score === 'number';
  const hasExposure = typeof article.exposure_score === 'number';

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 60, animation: 'cardEntrance 0.5s ease backwards' }}>

      {/* Nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <button onClick={() => navigate('/dashboard')} className="btn-mini" style={{ gap: 8, padding: '10px 18px', fontSize: 12 }}>← Back to Dashboard</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {article.signal_tier && <SignalBadge tier={article.signal_tier} />}
          <span style={{ color: '#8b859d', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Deep Analysis</span>
        </div>
      </div>

      {/* Header Card */}
      <div style={{ padding: 32, marginBottom: 20, borderRadius: 14, background: '#fff', border: '1px solid #ede9f6', boxShadow: '0 16px 36px rgba(48,39,87,0.05)', animation: 'cardEntrance 0.5s ease backwards', animationDelay: '0.1s' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <span style={{ color: 'var(--accent)', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{(article.source || 'INTELLIGENCE').toUpperCase()}</span>
            </div>
            <h1 style={{ fontSize: 26, lineHeight: 1.25, marginBottom: 16, color: '#17152a', fontWeight: 900 }}>{article.title}</h1>
            <p style={{ fontSize: 14, color: '#696478', lineHeight: 1.7 }}>
              {article.text_preview || article.text || ''}
            </p>
          </div>
          {article.url && (
            <a href={article.url} target="_blank" rel="noopener noreferrer" className="btn-mini primary" style={{ flexShrink: 0, padding: '12px 20px' }}>
              Original ↗
            </a>
          )}
        </div>
      </div>

      {/* Signal Scores Row */}
      {(hasPulse || hasExposure) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20, animation: 'cardEntrance 0.5s ease backwards', animationDelay: '0.15s' }}>
          {hasPulse && (
            <div style={{ padding: 20, borderRadius: 12, background: '#fff', border: '1px solid #ede9f6', boxShadow: '0 8px 24px rgba(48,39,87,0.04)' }}>
              <span style={{ display: 'block', color: '#8b859d', fontSize: 9, fontWeight: 900, textTransform: 'uppercase', marginBottom: 6 }}>Pulse Score</span>
              <strong style={{ fontSize: 32, color: '#17152a', fontWeight: 900 }}>{article.pulse_score}</strong>
              <span style={{ display: 'block', marginTop: 4, color: '#9a96aa', fontSize: 11 }}>Signal intensity</span>
            </div>
          )}
          {hasExposure && (
            <div style={{ padding: 20, borderRadius: 12, background: '#fff', border: '1px solid #ede9f6', boxShadow: '0 8px 24px rgba(48,39,87,0.04)' }}>
              <span style={{ display: 'block', color: '#8b859d', fontSize: 9, fontWeight: 900, textTransform: 'uppercase', marginBottom: 6 }}>Exposure</span>
              <strong style={{ fontSize: 32, color: '#17152a', fontWeight: 900 }}>{article.exposure_score}</strong>
              <span style={{ display: 'block', marginTop: 4, color: '#9a96aa', fontSize: 11 }}>Relevance to you</span>
            </div>
          )}
          <div style={{ padding: 20, borderRadius: 12, background: '#fff', border: '1px solid #ede9f6', boxShadow: '0 8px 24px rgba(48,39,87,0.04)' }}>
            <span style={{ display: 'block', color: '#8b859d', fontSize: 9, fontWeight: 900, textTransform: 'uppercase', marginBottom: 6 }}>Sentiment</span>
            <strong style={{ fontSize: 32, color: sentLabel === 'POSITIVE' ? '#2fab62' : sentLabel === 'NEGATIVE' ? '#e6535f' : '#9a96aa', fontWeight: 900 }}>{sentLabel}</strong>
            <span style={{ display: 'block', marginTop: 4, color: '#9a96aa', fontSize: 11 }}>{(sentConf * 100).toFixed(0)}% confidence</span>
          </div>
        </div>
      )}

      {/* Analysis Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20, animation: 'cardEntrance 0.5s ease backwards', animationDelay: '0.2s' }}>
        {/* Sentiment Detail */}
        <div style={{ padding: 24, borderRadius: 12, background: '#fff', border: '1px solid #ede9f6', boxShadow: '0 8px 24px rgba(48,39,87,0.04)' }}>
          <span style={{ display: 'block', color: 'var(--accent)', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Sentiment Analysis</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 50, height: 50, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22,
              background: sentLabel === 'POSITIVE' ? '#eefbf3' : sentLabel === 'NEGATIVE' ? '#fff6f8' : '#f4f2fa',
              border: `2px solid ${sentLabel === 'POSITIVE' ? '#2fab62' : sentLabel === 'NEGATIVE' ? '#e6535f' : '#c4bfd4'}`,
            }}>
              {sentLabel === 'POSITIVE' ? '▲' : sentLabel === 'NEGATIVE' ? '▼' : '—'}
            </div>
            <div>
              <div style={{
                fontSize: 18, fontWeight: 800,
                color: sentLabel === 'POSITIVE' ? '#2fab62' : sentLabel === 'NEGATIVE' ? '#e6535f' : '#9a96aa',
              }}>
                {sentLabel}
              </div>
              <div style={{ fontSize: 11, color: '#9a96aa', marginTop: 2, fontWeight: 700 }}>
                {(sentConf * 100).toFixed(1)}% confidence
              </div>
            </div>
          </div>
        </div>

        {/* Entities */}
        <div style={{ padding: 24, borderRadius: 12, background: '#fff', border: '1px solid #ede9f6', boxShadow: '0 8px 24px rgba(48,39,87,0.04)' }}>
          <span style={{ display: 'block', color: 'var(--accent)', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
            Entities {entities.length > 0 ? `(${entities.length})` : ''}
          </span>
          {entities.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {entities.map((e, i) => (
                <span key={i} style={{
                  padding: '5px 10px', fontSize: 11, fontWeight: 700,
                  background: '#f8f6fc', border: '1px solid #ede9f6',
                  borderRadius: 8, display: 'inline-flex', gap: 5, alignItems: 'center',
                }}>
                  <span style={{ color: '#302c45' }}>{e.name}</span>
                  <span style={{ color: '#9a96aa', fontSize: 8, textTransform: 'uppercase', fontWeight: 900 }}>{e.type}</span>
                </span>
              ))}
            </div>
          ) : (
            <span style={{ fontSize: 12, color: '#9a96aa' }}>No entities detected yet</span>
          )}
        </div>
      </div>

      {/* Perspectives */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, borderRadius: 12, background: '#fff', border: '1px solid #ede9f6', animation: 'cardEntrance 0.5s ease backwards', animationDelay: '0.25s' }}>
          <div className="pulse-glow" style={{ width: 14, height: 14, background: 'var(--accent)', borderRadius: '50%', margin: '0 auto 14px' }} />
          <span style={{ fontSize: 11, color: 'var(--accent)', letterSpacing: 1, fontWeight: 800, textTransform: 'uppercase' }}>
            Analyzing narrative perspectives...
          </span>
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: 30, borderRadius: 12, background: '#fff6f8', border: '1px solid #f8dfe6', color: '#e6535f', fontSize: 13 }}>
          Analysis unavailable: {error}
        </div>
      ) : perspectives.length > 0 ? (
        <div style={{ padding: 24, borderRadius: 12, background: '#fff', border: '1px solid #ede9f6', boxShadow: '0 8px 24px rgba(48,39,87,0.04)', marginBottom: 20, animation: 'cardEntrance 0.5s ease backwards', animationDelay: '0.25s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ color: 'var(--accent)', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Narrative Perspectives</span>
            <span style={{ fontSize: 9, color: '#9a96aa', fontWeight: 700 }}>AI Analysis</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            {perspectives.map((p, i) => (
              <div key={i} style={{
                background: '#f8f6fc', padding: 20, borderRadius: 12,
                border: '1px solid #ede9f6',
                borderTop: `3px solid ${i === 0 ? '#2fab62' : i === 2 ? '#e6535f' : 'var(--accent)'}`,
              }}>
                <div style={{ marginBottom: 12, color: i === 0 ? '#2fab62' : i === 2 ? '#e6535f' : 'var(--accent)', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {(p.viewpoint || ['Progressive', 'Centrist', 'Conservative'][i] || 'View').toUpperCase()}
                </div>
                {p.framing && <p style={{ fontSize: 12, color: '#696478', lineHeight: 1.6, marginBottom: 10 }}>
                  <strong style={{ color: '#302c45' }}>Framing:</strong> {p.framing}
                </p>}
                {p.emphasis && <p style={{ fontSize: 12, color: '#696478', lineHeight: 1.6, marginBottom: 10 }}>
                  <strong style={{ color: '#302c45' }}>Emphasis:</strong> {p.emphasis}
                </p>}
                {p.omission && <p style={{ fontSize: 12, color: '#696478', lineHeight: 1.6 }}>
                  <strong style={{ color: '#302c45' }}>Omission:</strong> {p.omission}
                </p>}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

