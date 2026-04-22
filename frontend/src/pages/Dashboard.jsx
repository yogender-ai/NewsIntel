import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

/* ── Typewriter Hook — character by character ─────────────────── */
function Typewriter({ text, speed = 18, delay = 0 }) {
  const [displayed, setDisplayed] = useState('');
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const startTimer = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(startTimer);
  }, [delay]);

  useEffect(() => {
    if (!started || !text) return;
    setDisplayed('');
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(timer);
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed, started]);

  if (!started) return null;

  return (
    <span dangerouslySetInnerHTML={{
      __html: displayed.replace(
        /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g,
        (m) => m.length > 3 ? `<strong style="color:var(--t1);font-weight:600">${m}</strong>` : m
      )
    }} />
  );
}

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
      {/* Cross hairs */}
      <div style={{ position:'absolute', left:'50%', top:0, bottom:0, width:1, background:'rgba(0,212,255,0.05)' }} />
      <div style={{ position:'absolute', top:'50%', left:0, right:0, height:1, background:'rgba(0,212,255,0.05)' }} />
      {entries.map(([name, score], i) => {
        const angle = angleStep * i - Math.PI / 2;
        const radius = 30 + (score / maxScore) * 60;
        const x = 50 + Math.cos(angle) * radius;
        const y = 50 + Math.sin(angle) * radius;
        const color = score >= 70 ? 'var(--neg)' : score >= 40 ? 'var(--warn)' : 'var(--pos)';
        const lx = 50 + Math.cos(angle) * (radius + 16);
        const ly = 50 + Math.sin(angle) * (radius + 16);
        return (
          <React.Fragment key={name}>
            <div className="radar-dot" style={{
              left: `${x}%`, top: `${y}%`, background: color,
              width: 4 + (score / maxScore) * 6, height: 4 + (score / maxScore) * 6,
            }} />
            <div className="radar-label" style={{ left: `${lx}%`, top: `${ly}%`, color }}>
              {name.slice(0, 10)}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ── Time ago ─────────────────────────────────────────────────── */
function timeAgo(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  } catch { return ''; }
}

/* ── Signal Strength Bar ──────────────────────────────────────── */
function SignalBar({ score }) {
  const bars = 5;
  const filled = Math.ceil((score || 0.5) * bars);
  return (
    <div style={{ display: 'flex', gap: 1, alignItems: 'flex-end', height: 14 }}>
      {Array.from({ length: bars }).map((_, i) => (
        <div key={i} style={{
          width: 3,
          height: 4 + i * 2.5,
          borderRadius: 1,
          background: i < filled ? 'var(--accent)' : 'var(--bg-elevated)',
          transition: 'background 0.3s',
          opacity: i < filled ? 1 : 0.3,
        }} />
      ))}
    </div>
  );
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
    try { setData(await api.getDashboard([], [])); }
    catch (e) { setError(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const now = new Date();
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  const tickerItems = useMemo(() => {
    if (!data?.articles) return [];
    return data.articles.map(a => ({
      title: a.title, sentiment: a.sentiment?.label, source: a.source,
    }));
  }, [data]);

  /* ── Loading ─────────────────────────────────────────────── */
  if (loading) return (
    <div>
      {/* Fake ticker shimmer */}
      <div className="ticker-wrap" style={{ margin: '0 -32px 20px' }}>
        <div style={{ display: 'flex', gap: 40, padding: '0 20px' }}>
          {[1,2,3].map(i => <div key={i} className="skel" style={{ width: 300, height: 12, flexShrink: 0 }} />)}
        </div>
      </div>
      <div style={{ padding: '0 0 20px' }}>
        <div className="skel" style={{ width: 240, height: 22, marginBottom: 8 }} />
        <div className="skel" style={{ width: 180, height: 10 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, marginBottom: 24 }} className="g2">
        <div className="panel" style={{ minHeight: 200, background: 'var(--bg-1)' }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 20, alignItems: 'center' }}>
              <div className="skel" style={{ width: 24, height: 14, borderRadius: 4 }} />
              <div className="skel" style={{ width: `${95 - i * 12}%`, height: 14 }} />
            </div>
          ))}
        </div>
        <div className="panel" style={{ minHeight: 200, background: 'var(--bg-1)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div className="skel" style={{ width: 160, height: 160, borderRadius: '50%' }} />
        </div>
      </div>
      {[1,2,3,4,5,6].map(i => (
        <div key={i} className="skel wire-skel" style={{ width: '100%', height: 52, marginBottom: 3, borderRadius: 6 }} />
      ))}
    </div>
  );

  const brief = data?.daily_brief || '';
  const articles = data?.articles || [];
  const tension = data?.tension_index || {};
  const impact = data?.impact || {};
  const clusters = data?.clusters || [];

  // Build lookup map for clusters
  const articleMap = {};
  articles.forEach(a => { articleMap[a.id] = a; });

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
                <span className="mono" style={{ fontSize: 9, color: 'var(--t4)', letterSpacing: 1 }}>{item.source}</span>
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
            <h1 className="glitch-text" data-text="INTELLIGENCE FEED" style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px' }}>
              INTELLIGENCE FEED
            </h1>
            <span className="badge-live">LIVE</span>
          </div>
          <p className="mono" style={{ fontSize: 10, color: 'var(--t3)', letterSpacing: 1.5 }}>
            {time} · {data?.sources_count || 0} SOURCES · {data?.live ? 'LIVE NEWS' : 'CACHED'} · GATEWAY
          </p>
        </div>
        <button className="btn" onClick={() => load(true)}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
          REFRESH
        </button>
      </div>

      {error && (
        <div className="panel fin" style={{ marginBottom: 16, padding: '10px 16px', borderColor: 'var(--neg)' }}>
          <p className="mono" style={{ fontSize: 11, color: 'var(--neg)' }}>ERR: {error}</p>
        </div>
      )}

      {/* ══ STATS STRIP ════════════════════════════════════════ */}
      {(() => {
        const pos = articles.filter(a => a.sentiment?.label === 'POSITIVE').length;
        const neg = articles.filter(a => a.sentiment?.label === 'NEGATIVE').length;
        const neu = articles.length - pos - neg;
        const topTension = tensionArr[0];
        return (
          <div className="fin d1" style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12,
            marginBottom: 20,
          }}>
            {[
              { label: 'SOURCES', value: data?.sources_count || 0, color: 'var(--accent)', icon: '◈' },
              { label: 'POSITIVE', value: pos, color: 'var(--pos)', icon: '▲' },
              { label: 'NEGATIVE', value: neg, color: 'var(--neg)', icon: '▼' },
              { label: 'TOP TENSION', value: topTension ? topTension[0].slice(0,8) : '—', color: 'var(--warn)', icon: '◉', sub: topTension ? topTension[1] : '' },
            ].map((s, i) => (
              <div key={i} style={{
                padding: '12px 16px',
                background: 'linear-gradient(145deg, rgba(10,15,24,0.5), rgba(7,11,20,0.7))',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-md)',
                borderTop: `2px solid ${s.color}`,
              }}>
                <div className="mono" style={{ fontSize: 8, color: 'var(--t4)', letterSpacing: 1.5, marginBottom: 4 }}>
                  {s.icon} {s.label}
                </div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: s.color }}>
                  {s.value}
                </div>
                {s.sub && <div className="mono" style={{ fontSize: 8, color: 'var(--t4)', marginTop: 2 }}>SCORE: {s.sub}</div>}
              </div>
            ))}
          </div>
        );
      })()}

      {/* ══ ROW 1: BRIEF + RADAR ═══════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, marginBottom: 24 }} className="g2">
        <div className="panel fin d1" style={{ borderLeft: '2px solid var(--accent)' }}>
          <div className="panel-head">
            <div className="panel-title">
              <span style={{ color: 'var(--accent)' }}>▸</span> DAILY BRIEF
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SignalBar score={bullets.length / 5} />
              <span className="label">GEMINI 2.5</span>
            </div>
          </div>

          {bullets.length > 0 ? (
            <div>
              {bullets.map((b, i) => (
                <div key={i} className="typewriter-line">
                  <span className="mono" style={{
                    fontSize: 11, fontWeight: 700, color: 'var(--accent)',
                    width: 24, flexShrink: 0, opacity: 0.7,
                  }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--t2)' }}>
                    <Typewriter text={b} speed={12} delay={i * 1200} />
                  </p>
                </div>
              ))}
              <span className="type-cursor" />
            </div>
          ) : brief ? (
            <p className="mono" style={{ fontSize: 12, lineHeight: 1.8, color: 'var(--t2)' }}>{brief}</p>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 0' }}>
              <div className="pulse-dot" />
              <p className="mono" style={{ fontSize: 10, color: 'var(--t4)' }}>SYNTHESIZING INTELLIGENCE BRIEF...</p>
            </div>
          )}
        </div>

        <div className="panel fin d2">
          <div className="panel-head">
            <div className="panel-title">
              <span style={{ color: 'var(--warn)' }}>◉</span> RADAR
            </div>
            <span className="label" style={{ color: 'var(--t4)' }}>TENSION</span>
          </div>
          <TensionRadar entries={tensionArr} />
        </div>
      </div>

      {/* ══ ROW 2: WIRE FEED (CLUSTERED) ═════════════════════════ */}
      <div className="fin d3" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="panel-title">
            <span style={{ color: 'var(--accent-2)' }}>◆</span> WIRE FEED
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {clusters.length > 0 && <span className="label" style={{ color: 'var(--accent-2)' }}>{clusters.length} THREADS</span>}
            <span className="label">{articles.length} STORIES</span>
          </div>
        </div>

        <div className="wire-feed">
          {/* Sentiment breakdown bar */}
          {(() => {
            const pos = articles.filter(a => a.sentiment?.label === 'POSITIVE').length;
            const neg = articles.filter(a => a.sentiment?.label === 'NEGATIVE').length;
            const total = articles.length || 1;
            return (
              <div style={{ display: 'flex', height: 3, borderRadius: 2, overflow: 'hidden', marginBottom: 8, gap: 2 }}>
                <div style={{ width: `${(pos/total)*100}%`, background: 'var(--pos)', transition: 'width 0.6s var(--ease)' }} />
                <div style={{ flex: 1, background: 'var(--t4)', opacity: 0.3 }} />
                <div style={{ width: `${(neg/total)*100}%`, background: 'var(--neg)', transition: 'width 0.6s var(--ease)' }} />
              </div>
            );
          })()}

          {clusters.length > 0 ? (
            clusters.map((cluster, ci) => {
              const clusterArticles = cluster.article_ids
                .map(id => articleMap[id])
                .filter(Boolean);
              const isMulti = clusterArticles.length > 1;

              if (!isMulti) {
                // Single article — render as normal wire strip
                const a = clusterArticles[0];
                if (!a) return null;
                const u = getUrg(a?.sentiment);
                const sentClass = a?.sentiment?.label === 'POSITIVE' ? 'pos' : a?.sentiment?.label === 'NEGATIVE' ? 'neg' : 'neutral';
                const ago = timeAgo(a.published);
                return (
                  <div key={ci} className="cluster-single wire-enter" style={{ animationDelay: `${0.08 + ci * 0.06}s` }}>
                    <div className="wire-strip"
                      onClick={() => navigate('/story', { state: {
                        article: { id: a.id, title: a.title, text: a.text_preview || a.title, source: a.source, url: a.url }
                      }})}
                    >
                      <div className={`urgency-bar urgency-bar-${u.l}`} />
                      <div style={{ minWidth: 0 }}>
                        <span className="wire-source">{a.source}</span>
                        {ago && <span className="wire-time">{ago}</span>}
                      </div>
                      <span className="wire-title">{a.title}</span>
                      {a?.sentiment && <span className={`wire-badge wire-badge-${sentClass}`}>{a.sentiment.label}</span>}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {a.url && <a href={a.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="wire-external">↗</a>}
                        <span className="wire-arrow">→</span>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={ci} className="cluster-thread wire-enter" style={{ animationDelay: `${0.08 + ci * 0.06}s` }}>
                  <div className="cluster-head">
                    <div className="cluster-icon">◆</div>
                    <span className="cluster-title">{cluster.thread_title}</span>
                    <span className="cluster-count">{clusterArticles.length} SOURCES</span>
                    {cluster.summary && <span className="cluster-summary">{cluster.summary}</span>}
                  </div>
                  {clusterArticles.map((a, i) => {
                    const u = getUrg(a?.sentiment);
                    const sentClass = a?.sentiment?.label === 'POSITIVE' ? 'pos' : a?.sentiment?.label === 'NEGATIVE' ? 'neg' : 'neutral';
                    const ago = timeAgo(a.published);
                    return (
                      <div key={a.id} className="wire-strip"
                        onClick={() => navigate('/story', { state: {
                          article: { id: a.id, title: a.title, text: a.text_preview || a.title, source: a.source, url: a.url }
                        }})}
                      >
                        <div className={`urgency-bar urgency-bar-${u.l}`} />
                        <div style={{ minWidth: 0 }}>
                          <span className="wire-source">{a.source}</span>
                          {ago && <span className="wire-time">{ago}</span>}
                        </div>
                        <span className="wire-title">{a.title}</span>
                        {a?.sentiment && <span className={`wire-badge wire-badge-${sentClass}`}>{a.sentiment.label}</span>}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {a.url && <a href={a.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="wire-external">↗</a>}
                          <span className="wire-arrow">→</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })
          ) : (
            // Fallback: unclustered
            articles.map((a, i) => {
              const u = getUrg(a?.sentiment);
              const sentClass = a?.sentiment?.label === 'POSITIVE' ? 'pos' : a?.sentiment?.label === 'NEGATIVE' ? 'neg' : 'neutral';
              const ago = timeAgo(a.published);
              return (
                <div key={a.id} className="wire-strip wire-enter" style={{ animationDelay: `${0.1 + i * 0.06}s` }}
                  onClick={() => navigate('/story', { state: {
                    article: { id: a.id, title: a.title, text: a.text_preview || a.title, source: a.source, url: a.url }
                  }})}
                >
                  <div className={`urgency-bar urgency-bar-${u.l}`} />
                  <div style={{ minWidth: 0 }}>
                    <span className="wire-source">{a.source}</span>
                    {ago && <span className="wire-time">{ago}</span>}
                  </div>
                  <span className="wire-title">{a.title}</span>
                  {a?.sentiment && <span className={`wire-badge wire-badge-${sentClass}`}>{a.sentiment.label}</span>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {a.url && <a href={a.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="wire-external">↗</a>}
                    <span className="wire-arrow">→</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ══ ROW 3: IMPACT ══════════════════════════════════════ */}
      {impact && (impact.headline || impact.why_it_matters) && (
        <div className="panel panel-gradient fin d5" style={{ borderLeft: '2px solid var(--accent-3)' }}>
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
                    <div key={i} className="action-item">
                      <span className="action-num">[{String(i + 1).padStart(2, '0')}]</span> {a}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ STATUS BAR ═════════════════════════════════════════ */}
      <div className="fin d6" style={{
        marginTop: 32, padding: '10px 0',
        borderTop: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div className="mono" style={{ fontSize: 9, color: 'var(--t4)', display: 'flex', gap: 16 }}>
          <span>PIPELINE: RSS → GATEWAY → HF + GEMINI</span>
          <span>CACHE: 10MIN TTL</span>
          <span>MODEL: GEMINI-2.5-FLASH</span>
        </div>
        <div className="mono" style={{ fontSize: 9, color: 'var(--t4)' }}>
          {data?.generated_at ? `GENERATED: ${new Date(data.generated_at).toLocaleTimeString()}` : ''}
        </div>
      </div>
    </div>
  );
}
