import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

/* ── NO MORE HARDCODED ARTICLES! ──────────────────────────────── */

function getUrg(s) {
  if (!s) return { l: 'low', c: 'var(--pos)' };
  if (s.label === 'NEGATIVE' && s.confidence > 0.7) return { l: 'high', c: 'var(--neg)' };
  if (s.label === 'NEGATIVE') return { l: 'med', c: 'var(--warn)' };
  return { l: 'low', c: 'var(--pos)' };
}

/* ── Tension Radar ────────────────────────────────────────────── */
function TensionRadar({ entries }) {
  if (entries.length === 0) return (
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <p className="mono" style={{ fontSize: 9, color: 'var(--t4)', letterSpacing: 1.5 }}>
        AWAITING GEOLOCATION DATA...
      </p>
    </div>
  );

  const maxScore = Math.max(...entries.map(([,v]) => v), 1);
  const angleStep = (2 * Math.PI) / Math.max(entries.length, 1);

  return (
    <div className="radar-container">
      <div className="radar-ring radar-ring-1" />
      <div className="radar-ring radar-ring-2" />
      <div className="radar-ring radar-ring-3" />
      <div className="radar-sweep" />
      {entries.map(([name, score], i) => {
        const angle = angleStep * i - Math.PI / 2;
        const radius = 35 + (score / maxScore) * 55;
        const x = 50 + Math.cos(angle) * radius;
        const y = 50 + Math.sin(angle) * radius;
        const color = score >= 70 ? 'var(--neg)' : score >= 40 ? 'var(--warn)' : 'var(--pos)';
        const lx = 50 + Math.cos(angle) * (radius + 14);
        const ly = 50 + Math.sin(angle) * (radius + 14);
        return (
          <React.Fragment key={name}>
            <div className="radar-dot" style={{
              left: `${x}%`, top: `${y}%`, background: color,
              width: 5 + (score / maxScore) * 5, height: 5 + (score / maxScore) * 5,
            }} />
            <div className="radar-label" style={{ left: `${lx}%`, top: `${ly}%` }}>
              {name.slice(0, 10)}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ── Time ago helper ──────────────────────────────────────────── */
function timeAgo(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch { return ''; }
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const fetched = useRef(false);
  const navigate = useNavigate();

  const load = useCallback(async (force = false) => {
    if (fetched.current && !force) return;
    fetched.current = true;
    setLoading(true);
    setError(null);
    try {
      // Send preferences (or empty = backend uses defaults/DB prefs)
      setData(await api.getDashboard([], []));
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const now = new Date();
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  /* ── Ticker ──────────────────────────────────────────────── */
  const tickerItems = useMemo(() => {
    if (!data?.articles) return [];
    return data.articles.map(a => ({
      title: a.title,
      sentiment: a.sentiment?.label,
      source: a.source,
    }));
  }, [data]);

  /* ── Loading ─────────────────────────────────────────────── */
  if (loading) return (
    <div>
      <div style={{ padding: '16px 0', marginBottom: 20 }}>
        <div className="skel" style={{ width: 300, height: 20, marginBottom: 8 }} />
        <div className="skel" style={{ width: 180, height: 10 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, marginBottom: 24 }} className="g2">
        <div className="panel" style={{ minHeight: 200, background: 'var(--bg-1)' }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
              <div className="skel" style={{ width: 24, height: 14 }} />
              <div className="skel" style={{ width: `${90 - i * 12}%`, height: 14 }} />
            </div>
          ))}
        </div>
        <div className="panel" style={{ minHeight: 200, background: 'var(--bg-1)' }}>
          <div className="skel" style={{ width: '100%', height: '100%', borderRadius: '50%', maxWidth: 180, maxHeight: 180, margin: '0 auto' }} />
        </div>
      </div>
      {[1,2,3,4,5,6].map(i => (
        <div key={i} className="skel" style={{ width: '100%', height: 48, marginBottom: 3, borderRadius: 6 }} />
      ))}
    </div>
  );

  const brief = data?.daily_brief || '';
  const articles = data?.articles || [];
  const tension = data?.tension_index || {};
  const impact = data?.impact || {};

  const bullets = brief
    ? brief.split(/\n+/).map(s => s.replace(/^[\d.)\-•*]+\s*/, '').trim()).filter(s => s.length > 15).slice(0, 5)
    : [];

  const tensionArr = Object.entries(tension).sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <div>
      {/* ══ TICKER TAPE ════════════════════════════════════════ */}
      {tickerItems.length > 0 && (
        <div className="ticker-wrap fin" style={{ margin: '0 -32px 20px' }}>
          <div className="ticker-track">
            {[...tickerItems, ...tickerItems].map((item, i) => (
              <span key={i} className="ticker-item">
                <span className="ticker-dot" style={{
                  background: item.sentiment === 'NEGATIVE' ? 'var(--neg)' : item.sentiment === 'POSITIVE' ? 'var(--pos)' : 'var(--t3)'
                }} />
                <span className="mono" style={{ fontSize: 9, color: 'var(--t3)', letterSpacing: 1 }}>{item.source}</span>
                <span>{item.title}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ══ HEADER ═════════════════════════════════════════════ */}
      <div className="fin" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px' }}>
              INTELLIGENCE FEED
            </h1>
            <span className="badge-live">LIVE</span>
          </div>
          <p className="mono" style={{ fontSize: 10, color: 'var(--t3)', letterSpacing: 1.5 }}>
            {time} · {data?.sources_count || 0} SOURCES · LIVE NEWS · GATEWAY
          </p>
        </div>
        <button className="btn" onClick={() => load(true)}>↻ REFRESH</button>
      </div>

      {error && (
        <div className="panel fin" style={{ marginBottom: 16, padding: '10px 16px', borderColor: 'var(--neg)' }}>
          <p className="mono" style={{ fontSize: 11, color: 'var(--neg)' }}>ERR: {error}</p>
        </div>
      )}

      {/* ══ ROW 1: BRIEF + RADAR ═══════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, marginBottom: 24 }} className="g2">
        <div className="panel fin d1">
          <div className="panel-head">
            <div className="panel-title">
              <span style={{ color: 'var(--accent)' }}>▸</span> DAILY BRIEF
            </div>
            <span className="label">GEMINI 2.5 FLASH LITE</span>
          </div>
          {bullets.length > 0 ? (
            <div>
              {bullets.map((b, i) => (
                <div key={i} className="typewriter-line">
                  <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', width: 24, flexShrink: 0 }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--t2)' }} dangerouslySetInnerHTML={{
                    __html: b.replace(
                      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g,
                      (m) => m.length > 3 ? `<strong style="color:var(--t1);font-weight:600">${m}</strong>` : m
                    )
                  }} />
                </div>
              ))}
              <span className="type-cursor" />
            </div>
          ) : brief ? (
            <p className="mono" style={{ fontSize: 12, lineHeight: 1.8, color: 'var(--t2)' }}>{brief}</p>
          ) : (
            <p className="mono" style={{ fontSize: 10, color: 'var(--t4)' }}>SYNTHESIZING...</p>
          )}
        </div>

        <div className="panel fin d2">
          <div className="panel-head">
            <div className="panel-title">
              <span style={{ color: 'var(--warn)' }}>◉</span> TENSION RADAR
            </div>
          </div>
          <TensionRadar entries={tensionArr} />
        </div>
      </div>

      {/* ══ ROW 2: WIRE FEED ═══════════════════════════════════ */}
      <div className="fin d3" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div className="panel-title">
            <span style={{ color: 'var(--accent-2)' }}>◆</span> WIRE FEED
          </div>
          <span className="label">{articles.length} LIVE STORIES</span>
        </div>

        <div>
          {articles.map((a, i) => {
            const u = getUrg(a?.sentiment);
            const sentClass = a?.sentiment?.label === 'POSITIVE' ? 'pos' : a?.sentiment?.label === 'NEGATIVE' ? 'neg' : 'neutral';
            const ago = timeAgo(a.published);

            return (
              <div key={a.id}
                className="wire-strip"
                onClick={() => navigate('/story', { state: {
                  article: { id: a.id, title: a.title, text: a.text_preview || a.title, source: a.source, url: a.url }
                }})}
              >
                <div className={`urgency-bar urgency-bar-${u.l}`} />
                <div style={{ minWidth: 0 }}>
                  <span className="wire-source">{a.source}</span>
                  {ago && <span className="mono" style={{ fontSize: 8, color: 'var(--t4)', display: 'block', marginTop: 1 }}>{ago}</span>}
                </div>
                <span className="wire-title">{a.title}</span>
                {a?.sentiment && (
                  <span className={`wire-badge wire-badge-${sentClass}`}>
                    {a.sentiment.label}
                  </span>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {a.url && (
                    <a href={a.url} target="_blank" rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="btn-ghost" style={{ fontSize: 9, color: 'var(--t4)', padding: '2px 6px' }}
                      title="Read original">
                      ↗
                    </a>
                  )}
                  <span className="wire-arrow">→</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ══ ROW 3: IMPACT ══════════════════════════════════════ */}
      {impact && (impact.headline || impact.why_it_matters) && (
        <div className="panel fin d5" style={{ borderLeft: '2px solid var(--accent-3)' }}>
          <div className="panel-head">
            <div className="panel-title">
              <span style={{ color: 'var(--accent-3)' }}>⬡</span> PERSONAL IMPACT
            </div>
            <span className="label">PERSONALIZED</span>
          </div>

          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
            {impact.impact_score !== undefined && (
              <div className="impact-ring" style={{
                background: `conic-gradient(var(--accent-3) ${(impact.impact_score || 0) * 360}deg, var(--bg-2) 0deg)`,
                boxShadow: '0 0 30px rgba(168,85,247,0.15)',
              }}>
                <div style={{
                  width: 62, height: 62, borderRadius: '50%', background: 'var(--bg-1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span className="impact-val" style={{ color: 'var(--accent-3)' }}>
                    {Math.round((impact.impact_score || 0) * 100)}
                  </span>
                </div>
              </div>
            )}

            <div style={{ flex: 1 }}>
              {impact.headline && (
                <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, lineHeight: 1.4 }}>{impact.headline}</p>
              )}
              {impact.why_it_matters && (
                <p style={{ fontSize: 12, lineHeight: 1.75, color: 'var(--t2)', marginBottom: 14 }}>{impact.why_it_matters}</p>
              )}
              {impact.actions?.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {impact.actions.map((a, i) => (
                    <div key={i} className="mono" style={{
                      padding: '6px 12px', borderRadius: 'var(--r-sm)',
                      background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.1)',
                      fontSize: 10, color: 'var(--accent-3)', lineHeight: 1.5,
                    }}>
                      [{String(i + 1).padStart(2, '0')}] {a}
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
