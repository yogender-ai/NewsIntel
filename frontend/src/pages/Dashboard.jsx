import React, { useEffect, useState, useCallback, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { AppContext } from '../App';

/* ── Typewriter Hook ─────────────────────────────────────────────────── */
function useTypewriter(text, speed = 14) {
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

/* ── Helpers ──────────────────────────────────────────────────────────── */
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const min = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (min < 0) return 'now';
  if (min < 60) return `${min}m`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function sentColor(label) {
  if (!label) return 'var(--text-3)';
  const l = label.toUpperCase();
  if (l === 'POSITIVE') return 'var(--pos)';
  if (l === 'NEGATIVE') return 'var(--neg)';
  return 'var(--text-2)';
}

function sentClass(label) {
  if (!label) return 'neu';
  const l = label.toUpperCase();
  if (l === 'POSITIVE') return 'positive';
  if (l === 'NEGATIVE') return 'negative';
  return 'neutral';
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pipeline, setPipeline] = useState(0);
  const [expanded, setExpanded] = useState({});
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
      const t1 = setTimeout(() => setPipeline(2), 500);
      const t2 = setTimeout(() => setPipeline(3), 1000);
      const t3 = setTimeout(() => setPipeline(4), 1800);

      const res = await api.getDashboard([], [], force);
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      setData(res);
      setPipeline(5);

      // Feed ticker
      if (res.clusters?.length) {
        setHeadlines(res.clusters.map(c => c.thread_title || '').filter(Boolean));
      } else if (res.articles?.length) {
        setHeadlines(res.articles.slice(0, 6).map(a => a.title));
      }

      // Default expand all clusters
      const exp = {};
      (res.clusters || []).forEach((_, i) => { exp[i] = true; });
      setExpanded(exp);
    } catch (e) {
      setError(e.message);
      setPipeline(0);
    }
    setLoading(false);
  }, [setHeadlines]);

  useEffect(() => { load(); }, [load]);

  // ── Derived ──
  const brief = data?.daily_brief || '';
  const articles = data?.articles || [];
  const clusters = data?.clusters || [];
  const tension = data?.tension_index || {};
  const impact = data?.impact || {};
  const { displayed: briefText, typing } = useTypewriter(brief);

  // Article lookup
  const artMap = {};
  articles.forEach(a => { artMap[String(a.id)] = a; });

  // Sentiment counts
  const posCount = articles.filter(a => a.sentiment?.label === 'POSITIVE').length;
  const negCount = articles.filter(a => a.sentiment?.label === 'NEGATIVE').length;
  const neuCount = articles.length - posCount - negCount;

  const toggle = (i) => setExpanded(p => ({ ...p, [i]: !p[i] }));

  const stages = [
    { n: '01', label: 'GATEWAY CONNECT', detail: 'Cloud Command' },
    { n: '02', label: 'NEWS INGEST', detail: 'Google News RSS' },
    { n: '03', label: 'NLP ANALYSIS', detail: 'HuggingFace (free)' },
    { n: '04', label: 'AI SYNTHESIS', detail: data?.model_used || 'Gemini 2.5 Flash' },
    { n: '05', label: 'INTEL READY', detail: `${data?.gemini_calls || 1} Gemini call` },
  ];

  return (
    <div className="dashboard-grid">

      {/* ════════ LEFT — Operations ════════ */}
      <div className="zone-pipeline">

        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <span className="mono-label">PIPELINE</span>
            <button onClick={() => load(true)} disabled={loading} className="wire-btn">
              {loading ? '⟳ LOADING...' : '⟳ REFRESH'}
            </button>
          </div>

          {stages.map((s, i) => (
            <div key={i} className={`pipeline-stage ${pipeline >= i + 1 ? 'active' : ''}`}>
              <div className="stage-num">{s.n}</div>
              <div style={{ flex: 1 }}>
                <div className="stage-desc">{s.label}</div>
                <div style={{ fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--mono)', marginTop: 2 }}>{s.detail}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Metrics */}
        {data && (
          <div className="panel fin">
            <span className="mono-label" style={{ marginBottom: 14, display: 'block' }}>METRICS</span>
            <div style={{ display: 'grid', gap: 8 }}>
              {[
                ['Sources', data.sources_count || articles.length],
                ['Threads', clusters.length],
                ['Entities', articles.reduce((s, a) => s + (a.entities?.length || 0), 0)],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{k}</span>
                  <span className="mono" style={{ fontSize: 14, color: 'var(--theme-main)', fontWeight: 700 }}>{v}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-2)' }}>Sentiment</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span className="badge positive" style={{ fontSize: 10 }}>▲ {posCount}</span>
                  <span className="badge neutral" style={{ fontSize: 10 }}>— {neuCount}</span>
                  <span className="badge negative" style={{ fontSize: 10 }}>▼ {negCount}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tension */}
        {data && Object.keys(tension).length > 0 && (
          <div className="panel fin">
            <span className="mono-label" style={{ marginBottom: 14, display: 'block' }}>TENSION INDEX</span>
            <div style={{ display: 'grid', gap: 6 }}>
              {Object.entries(tension)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(([region, score]) => (
                  <div key={region} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="mono" style={{ fontSize: 10, color: 'var(--text-2)', minWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {region}
                    </span>
                    <div style={{ flex: 1, height: 4, background: 'var(--bg-elevated)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${score}%`,
                        background: score > 65 ? 'var(--neg)' : score > 35 ? 'var(--warn)' : 'var(--pos)',
                        borderRadius: 2,
                        transition: 'width 0.8s var(--ease)',
                      }} />
                    </div>
                    <span className="mono" style={{ fontSize: 10, color: score > 65 ? 'var(--neg)' : score > 35 ? 'var(--warn)' : 'var(--pos)', minWidth: 20 }}>
                      {score}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* ════════ CENTER — Intelligence Feed ════════ */}
      <div className="zone-clusters">

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 16 }}>
            <div className="pulse-glow" style={{ width: 14, height: 14, background: 'var(--theme-main)', borderRadius: '50%' }} />
            <span className="mono" style={{ fontSize: 11, color: 'var(--theme-main)', letterSpacing: 2 }}>PROCESSING INTELLIGENCE...</span>
          </div>
        ) : error ? (
          <div className="panel" style={{ borderColor: 'var(--neg)' }}>
            <span className="mono-label" style={{ color: 'var(--neg)' }}>ERROR</span>
            <p style={{ marginTop: 8, fontSize: 13, color: 'var(--text-2)' }}>{error}</p>
            <button onClick={() => load(true)} className="wire-btn" style={{ marginTop: 12 }}>RETRY</button>
          </div>
        ) : clusters.length > 0 ? (
          clusters.map((cluster, ci) => {
            const cArts = (cluster.article_ids || []).map(id => artMap[String(id)]).filter(Boolean);
            const isOpen = expanded[ci];

            return (
              <div key={ci} className="cluster-thread" style={{ animation: `fadeIn 0.4s var(--ease) forwards ${ci * 0.06}s`, opacity: 0 }}>
                <div className="cluster-header" onClick={() => toggle(ci)}>
                  <div style={{ flex: 1 }}>
                    <div className="cluster-meta" style={{ marginBottom: 6 }}>
                      <span className="badge sources">{cArts.length} SOURCE{cArts.length !== 1 ? 'S' : ''}</span>
                    </div>
                    <div className="cluster-title">{cluster.thread_title}</div>
                    {cluster.summary && <div className="cluster-summary">{cluster.summary}</div>}
                  </div>
                  <span className="mono" style={{ fontSize: 16, color: 'var(--text-3)', transition: '0.3s', transform: isOpen ? 'rotate(90deg)' : 'none', display: 'inline-block' }}>▸</span>
                </div>

                {isOpen && cArts.length > 0 && (
                  <div className="cluster-body">
                    {cArts.map((art, j) => (
                      <div key={j} className="wire-strip">
                        <div className="wire-source">{art.source?.substring(0, 14)}</div>
                        <div className="wire-title" style={{ cursor: 'pointer' }} onClick={() => navigate('/story', { state: { article: art } })}>
                          {art.title}
                        </div>
                        <span className={`badge ${sentClass(art.sentiment?.label)}`} style={{ fontSize: 8 }}>
                          {art.sentiment?.label || '—'}
                        </span>
                        <div className="wire-time">{timeAgo(art.published)}</div>
                        <a href={art.url} target="_blank" rel="noopener noreferrer" className="wire-btn" title="Original">↗</a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        ) : articles.length > 0 ? (
          <div>
            <span className="mono-label" style={{ display: 'block', marginBottom: 12 }}>UNCLUSTERED FEED</span>
            {articles.map((art, i) => (
              <div key={i} className="wire-strip" style={{ marginBottom: 4, animation: `fadeIn 0.3s ease forwards ${i * 0.04}s`, opacity: 0 }}>
                <div className="wire-source">{art.source?.substring(0, 14)}</div>
                <div className="wire-title" style={{ cursor: 'pointer' }} onClick={() => navigate('/story', { state: { article: art } })}>
                  {art.title}
                </div>
                <span className={`badge ${sentClass(art.sentiment?.label)}`} style={{ fontSize: 8 }}>{art.sentiment?.label || '—'}</span>
                <div className="wire-time">{timeAgo(art.published)}</div>
                <a href={art.url} target="_blank" rel="noopener noreferrer" className="wire-btn">↗</a>
              </div>
            ))}
          </div>
        ) : (
          <div className="panel" style={{ textAlign: 'center', padding: 40 }}>
            <span className="mono" style={{ color: 'var(--text-3)' }}>NO DATA</span>
          </div>
        )}
      </div>

      {/* ════════ RIGHT — Synthesis ════════ */}
      <div className="zone-brief">

        {/* Brief */}
        <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 200 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span className="mono-label">DAILY BRIEF</span>
            <span className="mono" style={{ fontSize: 9, color: 'var(--text-3)' }}>{data?.model_used || 'GEMINI'}</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ display: 'grid', gap: 8 }}>
                {[180, 150, 170, 130, 110].map((w, i) => (
                  <div key={i} className="skel" style={{ width: w, maxWidth: '100%', height: 11 }} />
                ))}
              </div>
            ) : brief ? (
              <div className="typewriter">
                {briefText}
                {typing && <span className="typewriter-cursor" />}
              </div>
            ) : (
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>[Brief unavailable — API quota may be exceeded]</span>
            )}
          </div>
        </div>

        {/* Impact */}
        {impact?.headline && impact.headline !== 'Analysis temporarily unavailable' && (
          <div className="panel fin">
            <span className="mono-label" style={{ marginBottom: 10, display: 'block' }}>SO WHAT?</span>
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, lineHeight: 1.4 }}>{impact.headline}</p>
            {impact.why_it_matters && (
              <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 10 }}>{impact.why_it_matters}</p>
            )}
            {impact.actions?.length > 0 && (
              <div style={{ display: 'grid', gap: 5 }}>
                {impact.actions.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ color: 'var(--theme-main)', fontSize: 11 }}>→</span>
                    <span style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5 }}>{a}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* API Transparency */}
        {data && (
          <div className="panel fin" style={{ fontSize: 10, fontFamily: 'var(--mono)' }}>
            <span className="mono-label" style={{ marginBottom: 8, display: 'block', fontSize: 9 }}>TRANSPARENCY</span>
            <div style={{ color: 'var(--text-3)', display: 'grid', gap: 4 }}>
              <div>MODEL: <span style={{ color: 'var(--text-2)' }}>{data.model_used || 'gemini-2.5-flash'}</span></div>
              <div>GEMINI CALLS: <span style={{ color: 'var(--pos)' }}>{data.gemini_calls || 1}</span></div>
              <div>TOPICS: <span style={{ color: 'var(--text-2)' }}>{(data.topics_used || []).join(', ')}</span></div>
              <div>GENERATED: <span style={{ color: 'var(--text-2)' }}>{data.generated_at ? new Date(data.generated_at).toLocaleTimeString() : '—'}</span></div>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </div>
  );
}
