import React, { useEffect, useState, useCallback, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { AppContext } from '../App';
import { useAuth } from '../context/AuthContext';

/* ── Typewriter (FIXED — no first-char cutoff) ───────────────────── */
function useTypewriter(text, speed = 16) {
  const [displayed, setDisplayed] = useState('');
  const [typing, setTyping] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    if (!text) { setDisplayed(''); return; }
    setDisplayed('');
    setTyping(true);
    let i = 0;
    timer.current = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(timer.current);
        setTyping(false);
      }
    }, speed);
    return () => clearInterval(timer.current);
  }, [text, speed]);

  return { displayed, typing };
}

/* ── Helpers ──────────────────────────────────────────────────────── */
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const min = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (min < 0) return 'now';
  if (min < 60) return `${min}m`;
  if (min < 1440) return `${Math.floor(min / 60)}h`;
  return `${Math.floor(min / 1440)}d`;
}

function sentClass(label) {
  if (!label) return 'neu';
  const l = label.toUpperCase();
  return l === 'POSITIVE' ? 'pos' : l === 'NEGATIVE' ? 'neg' : 'neu';
}

/* ── Tension Bars (replaced broken radar) ────────────────────────── */
const TensionIndex = ({ tension }) => {
  const entries = Object.entries(tension).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (entries.length === 0) return null;

  return (
    <div className="panel fin" style={{ padding: 20 }}>
      <div className="label" style={{ marginBottom: 14 }}>TENSION INDEX</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {entries.map(([region, score]) => (
          <div key={region} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="mono" style={{ fontSize: 10, color: 'var(--text-2)', width: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {region}
            </span>
            <div style={{ flex: 1, height: 4, background: 'var(--bg-elevated)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${score}%`, borderRadius: 2,
                background: score > 65 ? 'var(--neg)' : score > 35 ? 'var(--warn)' : 'var(--pos)',
                transition: 'width 0.8s var(--ease)',
              }} />
            </div>
            <span className="mono" style={{
              fontSize: 10, minWidth: 22, textAlign: 'right',
              color: score > 65 ? 'var(--neg)' : score > 35 ? 'var(--warn)' : 'var(--pos)',
            }}>{score}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── Story Graph (thread visualization) ──────────────────────────── */
const StoryGraph = ({ count, pulse }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '8px 0 4px' }}>
    {Array.from({ length: count }).map((_, i) => (
      <React.Fragment key={i}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--theme-main)', boxShadow: '0 0 6px var(--theme-main)' }} />
        {i < count - 1 && <div style={{ width: 16, height: 1, background: 'var(--theme-border)' }} />}
      </React.Fragment>
    ))}
    <span className="mono" style={{ fontSize: 9, color: 'var(--text-3)', marginLeft: 8 }}>{count} SOURCE{count !== 1 ? 'S' : ''}</span>
    {pulse && <span className="badge pulse" style={{ marginLeft: 'auto' }}>PULSE {pulse}</span>}
  </div>
);

export default function Dashboard() {
  const { user } = useAuth();
  const { setHeadlines } = useContext(AppContext);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});
  const navigate = useNavigate();
  const fetched = useRef(false);

  const load = useCallback(async (force = false) => {
    if (fetched.current && !force) return;
    fetched.current = true;
    setLoading(true);
    setError(null);

    try {
      const res = await api.getDashboard([], [], force);
      setData(res);

      // Feed ticker headlines
      if (res.clusters?.length) {
        setHeadlines(res.clusters.map(c => c.thread_title || '').filter(Boolean));
      } else if (res.articles?.length) {
        setHeadlines(res.articles.slice(0, 6).map(a => a.title));
      }

      // Default expand all
      const exp = {};
      (res.clusters || []).forEach((_, i) => { exp[i] = true; });
      setExpanded(exp);

      // Dynamic theme based on content
      if (res.articles?.length) {
        const txt = JSON.stringify(res.articles.map(a => a.title)).toLowerCase();
        const el = document.querySelector('.app-container');
        if (el) {
          if (txt.includes('market') || txt.includes('stock') || txt.includes('economy')) el.className = 'app-container theme-markets';
          else if (txt.includes('trump') || txt.includes('china') || txt.includes('nato') || txt.includes('election')) el.className = 'app-container theme-politics';
          else if (txt.includes('ai') || txt.includes('openai') || txt.includes('deep')) el.className = 'app-container theme-ai';
          else if (txt.includes('military') || txt.includes('war') || txt.includes('defense')) el.className = 'app-container theme-defense';
          else el.className = 'app-container theme-tech';
        }
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [setHeadlines]);

  useEffect(() => { load(); }, [load]);

  const toggle = (i) => setExpanded(p => ({ ...p, [i]: !p[i] }));

  // Derived
  const brief = data?.daily_brief || '';
  const articles = data?.articles || [];
  const clusters = data?.clusters || [];
  const tension = data?.tension_index || {};
  const impact = data?.impact || {};
  const { displayed: briefText, typing } = useTypewriter(brief);

  // Article lookup
  const artMap = {};
  articles.forEach(a => { artMap[String(a.id)] = a; });

  // Sentiment stats
  const posCount = articles.filter(a => a.sentiment?.label === 'POSITIVE').length;
  const negCount = articles.filter(a => a.sentiment?.label === 'NEGATIVE').length;
  const neuCount = articles.length - posCount - negCount;

  return (
    <div className="dashboard-grid">

      {/* ════════ LEFT — Operations Panel ════════ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>

        {/* Operator + Refresh */}
        <div className="panel fin" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div className="label">OPERATOR</div>
            <button onClick={() => load(true)} disabled={loading} className="wire-btn">
              {loading ? '⟳ LOADING...' : '⟳ REFRESH'}
            </button>
          </div>
          {user && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {user.photoURL && <img src={user.photoURL} alt="" style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--theme-border)' }} />}
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{user.displayName}</div>
                <div className="mono" style={{ fontSize: 9, color: 'var(--pos)' }}>SESSION_ACTIVE</div>
              </div>
            </div>
          )}
        </div>

        {/* Feed Metrics */}
        {data && (
          <div className="panel fin" style={{ padding: 20 }}>
            <div className="label" style={{ marginBottom: 14 }}>FEED METRICS</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {[
                ['Sources', data.sources_count || articles.length],
                ['Threads', clusters.length],
                ['Entities', articles.reduce((s, a) => s + (a.entities?.length || 0), 0)],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{k}</span>
                  <span className="mono" style={{ fontSize: 14, color: 'var(--theme-main)', fontWeight: 700 }}>{v}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-2)' }}>Sentiment</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span className="badge pos">▲{posCount}</span>
                  <span className="badge neu">—{neuCount}</span>
                  <span className="badge neg">▼{negCount}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tension */}
        <TensionIndex tension={tension} />
      </div>

      {/* ════════ CENTER — Intelligence Feed ════════ */}
      <div style={{ overflowY: 'auto', paddingRight: 4 }}>

        {/* Inline Ticker */}
        {data && (
          <div className="ticker-wrap" style={{ marginBottom: 14, borderRadius: 'var(--br)' }}>
            <div className="ticker-tag">LIVE</div>
            <div className="ticker-move">
              {[...articles, ...articles].slice(0, 16).map((a, i) => (
                <div key={i} className="ticker-item">
                  <span style={{ color: 'var(--theme-main)', fontWeight: 700 }}>//</span> {a.title}
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && !data ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 400, gap: 16 }}>
            <div className="pulse-glow" style={{ width: 14, height: 14, background: 'var(--theme-main)', borderRadius: '50%' }} />
            <span className="mono" style={{ fontSize: 11, color: 'var(--theme-main)', letterSpacing: 2 }}>PROCESSING INTELLIGENCE...</span>
          </div>
        ) : error ? (
          <div className="panel" style={{ borderColor: 'var(--neg)', padding: 24 }}>
            <div className="label" style={{ color: 'var(--neg)', marginBottom: 8 }}>PIPELINE ERROR</div>
            <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>{error}</p>
            <button onClick={() => load(true)} className="wire-btn">RETRY</button>
          </div>
        ) : clusters.length > 0 ? (
          clusters.map((cluster, ci) => {
            const cArts = (cluster.article_ids || []).map(id => artMap[String(id)]).filter(Boolean);
            const isOpen = expanded[ci];

            return (
              <div key={ci} className="cluster-thread fin" style={{ animationDelay: `${ci * 0.06}s` }}>
                <div className="cluster-header" onClick={() => toggle(ci)}>
                  <div style={{ flex: 1 }}>
                    <StoryGraph count={cArts.length} pulse={cluster.pulse_score} />
                    <div className="cluster-title">{cluster.thread_title}</div>
                    {cluster.summary && <div className="cluster-summary">{cluster.summary}</div>}
                  </div>
                  <span className="mono" style={{
                    fontSize: 16, color: 'var(--text-3)', transition: '0.3s',
                    transform: isOpen ? 'rotate(90deg)' : 'none', display: 'inline-block',
                  }}>▸</span>
                </div>

                {isOpen && cArts.length > 0 && (
                  <div className="cluster-body">
                    {cArts.map((art, j) => (
                      <div key={j} className="wire-strip" style={{ cursor: 'pointer' }} onClick={() => navigate('/story', { state: { article: art } })}>
                        <span className="mono" style={{ fontSize: 10, color: 'var(--theme-main)', width: 90, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {art.source?.toUpperCase()}
                        </span>
                        <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{art.title}</span>
                        <span className={`badge ${sentClass(art.sentiment?.label)}`}>{art.sentiment?.label || '—'}</span>
                        <span className="mono" style={{ fontSize: 9, color: 'var(--text-3)', flexShrink: 0 }}>{timeAgo(art.published)}</span>
                        <a href={art.url} target="_blank" rel="noopener noreferrer" className="wire-btn" onClick={e => e.stopPropagation()}>↗</a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        ) : articles.length > 0 ? (
          articles.map((art, i) => (
            <div key={i} className="wire-strip fin" style={{ animationDelay: `${i * 0.04}s`, cursor: 'pointer' }}
              onClick={() => navigate('/story', { state: { article: art } })}>
              <span className="mono" style={{ fontSize: 10, color: 'var(--theme-main)', width: 90 }}>{art.source?.toUpperCase()}</span>
              <span style={{ fontSize: 12, flex: 1 }}>{art.title}</span>
              <span className={`badge ${sentClass(art.sentiment?.label)}`}>{art.sentiment?.label || '—'}</span>
              <span className="mono" style={{ fontSize: 9, color: 'var(--text-3)' }}>{timeAgo(art.published)}</span>
            </div>
          ))
        ) : (
          <div className="panel" style={{ textAlign: 'center', padding: 40 }}>
            <span className="mono" style={{ color: 'var(--text-3)' }}>NO INTELLIGENCE DATA</span>
          </div>
        )}
      </div>

      {/* ════════ RIGHT — Synthesis Terminal ════════ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>

        {/* Daily Brief */}
        <div className="panel fin" style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', minHeight: 200 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <div className="label">DAILY BRIEF</div>
            <span className="mono" style={{ fontSize: 9, color: 'var(--text-3)' }}>OpenRouter / Gemini</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading && !data ? (
              <div style={{ display: 'grid', gap: 8 }}>
                {[180, 150, 170, 130].map((w, i) => (
                  <div key={i} className="skel" style={{ width: w, maxWidth: '100%', height: 11 }} />
                ))}
              </div>
            ) : brief ? (
              <div className="typewriter">
                {briefText}
                {typing && <span className="typewriter-cursor" />}
              </div>
            ) : (
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>[Awaiting AI synthesis...]</span>
            )}
          </div>
        </div>

        {/* Impact */}
        {impact?.headline && (
          <div className="panel fin" style={{ padding: 20 }}>
            <div className="label" style={{ marginBottom: 10 }}>EXECUTIVE IMPACT</div>
            <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, lineHeight: 1.4 }}>{impact.headline}</p>
            {impact.why_it_matters && (
              <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 10 }}>{impact.why_it_matters}</p>
            )}
            {impact.actions?.length > 0 && (
              <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                {impact.actions.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ color: 'var(--theme-main)', fontSize: 11, marginTop: 1 }}>▸</span>
                    <span style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5 }}>{a}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Transparency */}
        {data && (
          <div className="panel fin" style={{ padding: 16, fontSize: 10, fontFamily: 'var(--mono)' }}>
            <div className="label" style={{ marginBottom: 8, fontSize: 9 }}>PIPELINE TRANSPARENCY</div>
            <div style={{ color: 'var(--text-3)', display: 'grid', gap: 4 }}>
              <div>PROVIDERS: <span style={{ color: 'var(--text-2)' }}>OpenRouter → Gemini → HuggingFace</span></div>
              <div>TOPICS: <span style={{ color: 'var(--text-2)' }}>{(data.topics_used || []).join(', ') || 'default'}</span></div>
              <div>GENERATED: <span style={{ color: 'var(--text-2)' }}>{data.generated_at ? new Date(data.generated_at).toLocaleTimeString() : '—'}</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
