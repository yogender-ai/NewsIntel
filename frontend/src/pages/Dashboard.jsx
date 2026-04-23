import React, { useEffect, useState, useCallback, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { AppContext } from '../App';

/* ── Typewriter Hook ─────────────────────────────────────────────────── */
function useTypewriter(text, speed = 12) {
  const [displayed, setDisplayed] = useState('');
  const [typing, setTyping] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!text) { setDisplayed(''); return; }
    setDisplayed('');
    setTyping(true);
    let i = 0;
    ref.current = setInterval(() => {
      setDisplayed(prev => prev + text.charAt(i));
      i++;
      if (i >= text.length) { clearInterval(ref.current); setTyping(false); }
    }, speed);
    return () => clearInterval(ref.current);
  }, [text, speed]);

  return { displayed, typing };
}

/* ── Time Ago ────────────────────────────────────────────────────────── */
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const min = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (min < 0) return 'just now';
  if (min < 60) return `${min}m`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

/* ── Sentiment color helper ──────────────────────────────────────────── */
function sentColor(label) {
  if (!label) return 'var(--text-3)';
  const l = label.toUpperCase();
  if (l === 'POSITIVE') return 'var(--pos)';
  if (l === 'NEGATIVE') return 'var(--neg)';
  return 'var(--text-2)';
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pipeline, setPipeline] = useState(0);
  const [expandedClusters, setExpandedClusters] = useState({});
  const navigate = useNavigate();
  const fetched = useRef(false);
  const { setHeadlines } = useContext(AppContext);

  const load = useCallback(async (force = false) => {
    if (fetched.current && !force) return;
    fetched.current = true;
    setLoading(true);
    setError(null);
    setPipeline(1);

    try {
      const t1 = setTimeout(() => setPipeline(2), 600);
      const t2 = setTimeout(() => setPipeline(3), 1200);

      const res = await api.getDashboard([], [], force);
      clearTimeout(t1);
      clearTimeout(t2);
      setData(res);
      setPipeline(5);

      // Feed headlines to the global ticker
      if (res.clusters?.length) {
        setHeadlines(res.clusters.map(c => c.thread_title || c.title || ''));
      } else if (res.articles?.length) {
        setHeadlines(res.articles.slice(0, 5).map(a => a.title));
      }
    } catch (e) {
      setError(e.message);
      setPipeline(0);
    }
    setLoading(false);
  }, [setHeadlines]);

  useEffect(() => { load(); }, [load]);

  // ── Derived data ──
  const brief = data?.daily_brief || '';
  const articles = data?.articles || [];
  const clusters = data?.clusters || [];
  const tension = data?.tension_index || {};
  const impact = data?.impact || {};
  const { displayed: briefText, typing } = useTypewriter(brief);

  // Build article lookup for cluster rendering
  const articleMap = {};
  articles.forEach(a => { articleMap[a.id] = a; });

  // Sentiment stats
  const posCount = articles.filter(a => a.sentiment?.label === 'POSITIVE').length;
  const negCount = articles.filter(a => a.sentiment?.label === 'NEGATIVE').length;
  const neuCount = articles.length - posCount - negCount;

  // Toggle cluster expand
  const toggleCluster = (i) => setExpandedClusters(prev => ({ ...prev, [i]: !prev[i] }));

  // ── Pipeline stages ──
  const stages = [
    { num: '01', label: 'GATEWAY CONNECTION' },
    { num: '02', label: 'INGEST NEWS RSS' },
    { num: '03', label: 'HUGGINGFACE NLP' },
    { num: '04', label: 'GEMINI SYNTHESIS' },
    { num: '05', label: 'INTEL READY' },
  ];

  return (
    <div className="dashboard-grid">

      {/* ════════ ZONE 1: LEFT — Operations Panel ════════ */}
      <div className="zone-pipeline">

        {/* Pipeline */}
        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <span className="mono-label">SYSTEM STATUS</span>
            <button onClick={() => load(true)} disabled={loading} className="wire-btn">
              {loading ? '⟳ REFRESHING...' : '⟳ FORCE REFRESH'}
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {stages.map((s, i) => (
              <div key={i} className={`pipeline-stage ${pipeline >= i + 1 ? 'active' : ''}`}>
                <div className="stage-num">{s.num}</div>
                <div className="stage-desc">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        {data && (
          <div className="panel fin">
            <span className="mono-label" style={{ marginBottom: 16, display: 'block' }}>FEED METRICS</span>
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Sources ingested</span>
                <span className="mono" style={{ fontSize: 13, color: 'var(--theme-main)' }}>{data.sources_count || articles.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Story threads</span>
                <span className="mono" style={{ fontSize: 13, color: 'var(--theme-main)' }}>{clusters.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Sentiment</span>
                <span style={{ display: 'flex', gap: 8 }}>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--pos)' }}>+{posCount}</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--text-2)' }}>~{neuCount}</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--neg)' }}>-{negCount}</span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Radar */}
        {data && (
          <div className="panel fin">
            <span className="mono-label" style={{ marginBottom: 14, display: 'block' }}>TENSION RADAR</span>
            <div className="radar-ring" style={{ width: 160, height: 160, margin: '0 auto' }}>
              <div className="radar-sweep" />
              {Object.entries(tension).slice(0, 5).map(([region, score], i) => {
                const angle = (i / 5) * Math.PI * 2;
                const r = 30 + (score / 100) * 35;
                return (
                  <div key={region} className="radar-dot" title={`${region}: ${score}`} style={{
                    top: `${50 + Math.sin(angle) * r}%`,
                    left: `${50 + Math.cos(angle) * r}%`,
                    color: score > 60 ? 'var(--neg)' : score > 30 ? 'var(--warn)' : 'var(--pos)',
                    background: 'currentColor',
                  }} />
                );
              })}
            </div>
            {Object.keys(tension).length > 0 && (
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                {Object.entries(tension).slice(0, 5).map(([region, score]) => (
                  <span key={region} className="mono" style={{
                    fontSize: 9, padding: '2px 6px',
                    background: 'var(--bg-elevated)', borderRadius: 3,
                    color: score > 60 ? 'var(--neg)' : score > 30 ? 'var(--warn)' : 'var(--pos)',
                  }}>
                    {region} {score}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ════════ ZONE 2: CENTER — Cluster Intelligence Feed ════════ */}
      <div className="zone-clusters">

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 16 }}>
            <div className="pulse-glow" style={{ width: 16, height: 16, background: 'var(--theme-main)', borderRadius: '50%' }} />
            <span className="mono" style={{ fontSize: 12, color: 'var(--theme-main)', letterSpacing: 2 }}>PROCESSING INTELLIGENCE FEED...</span>
          </div>
        ) : error ? (
          <div className="panel" style={{ borderColor: 'var(--neg)' }}>
            <span className="mono-label" style={{ color: 'var(--neg)' }}>SYSTEM ERROR</span>
            <p style={{ marginTop: 8, fontSize: 13, color: 'var(--text-2)' }}>{error}</p>
            <button onClick={() => load(true)} className="wire-btn" style={{ marginTop: 12 }}>RETRY</button>
          </div>
        ) : clusters.length > 0 ? (
          clusters.map((cluster, ci) => {
            const clusterArticles = (cluster.article_ids || [])
              .map(id => articleMap[String(id)])
              .filter(Boolean);
            const isExpanded = expandedClusters[ci] !== false; // default expanded

            return (
              <div key={ci} className="cluster-thread" style={{ animation: `fadeIn 0.4s var(--ease) forwards ${ci * 0.08}s`, opacity: 0 }}>
                <div className="cluster-header" onClick={() => toggleCluster(ci)}>
                  <div style={{ flex: 1 }}>
                    <div className="cluster-meta" style={{ marginBottom: 8 }}>
                      <span className="badge sources">{clusterArticles.length} SOURCE{clusterArticles.length !== 1 ? 'S' : ''}</span>
                    </div>
                    <div className="cluster-title">{cluster.thread_title}</div>
                    {cluster.summary && <div className="cluster-summary">{cluster.summary}</div>}
                  </div>
                  <span style={{ fontSize: 14, color: 'var(--text-3)', transition: '0.3s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)' }}>▸</span>
                </div>

                {isExpanded && clusterArticles.length > 0 && (
                  <div className="cluster-body">
                    {clusterArticles.map((art, j) => (
                      <div key={j} className="wire-strip">
                        <div className="wire-source">{art.source?.substring(0, 14)}</div>
                        <div className="wire-title" style={{ cursor: 'pointer' }} onClick={() => navigate('/story', { state: { article: art } })}>
                          {art.title}
                        </div>
                        <span className="badge" style={{
                          background: art.sentiment?.label === 'POSITIVE' ? 'rgba(0,230,118,0.1)' : art.sentiment?.label === 'NEGATIVE' ? 'rgba(255,51,102,0.1)' : 'rgba(120,120,140,0.1)',
                          color: sentColor(art.sentiment?.label),
                          border: 'none', fontSize: 8,
                        }}>
                          {art.sentiment?.label || 'N/A'}
                        </span>
                        <div className="wire-time">{timeAgo(art.published)}</div>
                        <a href={art.url} target="_blank" rel="noopener noreferrer" className="wire-btn" title="Original Source">↗</a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        ) : articles.length > 0 ? (
          /* Fallback: no clusters, show articles flat */
          articles.map((art, i) => (
            <div key={i} className="wire-strip" style={{ marginBottom: 4, animation: `fadeIn 0.3s ease forwards ${i * 0.05}s`, opacity: 0 }}>
              <div className="wire-source">{art.source?.substring(0, 14)}</div>
              <div className="wire-title" style={{ cursor: 'pointer' }} onClick={() => navigate('/story', { state: { article: art } })}>
                {art.title}
              </div>
              <div className="wire-time">{timeAgo(art.published)}</div>
              <a href={art.url} target="_blank" rel="noopener noreferrer" className="wire-btn">↗</a>
            </div>
          ))
        ) : (
          <div className="panel" style={{ textAlign: 'center', padding: 40 }}>
            <span className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>NO INTELLIGENCE DATA AVAILABLE</span>
          </div>
        )}
      </div>

      {/* ════════ ZONE 3: RIGHT — Synthesis Terminal ════════ */}
      <div className="zone-brief">

        {/* Daily Brief */}
        <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span className="mono-label">DAILY BRIEF</span>
            <span className="mono" style={{ fontSize: 9, color: 'var(--theme-main)', opacity: 0.7 }}>GEMINI 2.5 FLASH</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ display: 'grid', gap: 8 }}>
                {[200, 160, 180, 140, 120].map((w, i) => (
                  <div key={i} className="skel" style={{ width: `${w}px`, height: 12 }} />
                ))}
              </div>
            ) : brief ? (
              <div className="typewriter">
                {briefText}
                {typing && <span className="typewriter-cursor" />}
              </div>
            ) : (
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>[No brief generated]</span>
            )}
          </div>
        </div>

        {/* Impact / So What */}
        {impact?.headline && (
          <div className="panel fin">
            <span className="mono-label" style={{ marginBottom: 12, display: 'block' }}>IMPACT ANALYSIS</span>
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, lineHeight: 1.4 }}>{impact.headline}</p>
            {impact.why_it_matters && (
              <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 12 }}>{impact.why_it_matters}</p>
            )}
            {impact.actions?.length > 0 && (
              <div style={{ display: 'grid', gap: 6 }}>
                {impact.actions.map((action, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span className="mono" style={{ fontSize: 10, color: 'var(--theme-main)', marginTop: 2 }}>→</span>
                    <span style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>{action}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
