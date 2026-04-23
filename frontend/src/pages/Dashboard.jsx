import React, { useEffect, useState, useCallback, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { AppContext } from '../App';
import { useAuth } from '../context/AuthContext';

/* ── Typewriter (fixed first-char) ──────────────────────────────── */
function useTypewriter(text, speed = 14) {
  const [displayed, setDisplayed] = useState('');
  const [typing, setTyping] = useState(false);
  const timer = useRef(null);
  useEffect(() => {
    if (!text) { setDisplayed(''); return; }
    setDisplayed(''); setTyping(true);
    let i = 0;
    timer.current = setInterval(() => {
      i++; setDisplayed(text.slice(0, i));
      if (i >= text.length) { clearInterval(timer.current); setTyping(false); }
    }, speed);
    return () => clearInterval(timer.current);
  }, [text, speed]);
  return { displayed, typing };
}

function timeAgo(d) {
  if (!d) return '';
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 0) return 'now'; if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.floor(m / 60)}h`; return `${Math.floor(m / 1440)}d`;
}
function sentClass(l) { if (!l) return 'neu'; const u = l.toUpperCase(); return u === 'POSITIVE' ? 'pos' : u === 'NEGATIVE' ? 'neg' : 'neu'; }

/* ── Sentiment Sparkline ─────────────────────────────────────────── */
const SentimentSpark = ({ pos, neu, neg }) => {
  const total = pos + neu + neg || 1;
  return (
    <div style={{ display: 'flex', gap: 2, height: 32, alignItems: 'flex-end', padding: '4px 0' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: 3 }}>
        <div className="sparkline-bar" style={{ width: '100%', height: `${(pos / total) * 100}%`, background: 'var(--pos)', minHeight: 2 }} />
        <span className="mono" style={{ fontSize: 8, color: 'var(--pos)' }}>▲{pos}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: 3 }}>
        <div className="sparkline-bar" style={{ width: '100%', height: `${(neu / total) * 100}%`, background: 'var(--text-3)', minHeight: 2 }} />
        <span className="mono" style={{ fontSize: 8, color: 'var(--text-3)' }}>—{neu}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: 3 }}>
        <div className="sparkline-bar" style={{ width: '100%', height: `${(neg / total) * 100}%`, background: 'var(--neg)', minHeight: 2 }} />
        <span className="mono" style={{ fontSize: 8, color: 'var(--neg)' }}>▼{neg}</span>
      </div>
    </div>
  );
};

/* ── Tension Index ───────────────────────────────────────────────── */
const TensionIndex = ({ tension }) => {
  const entries = Object.entries(tension).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!entries.length) return null;
  return (
    <div className="panel panel-accent fin fin-d3" style={{ padding: 20 }}>
      <div className="label" style={{ marginBottom: 14 }}>TENSION INDEX</div>
      {entries.map(([region, score]) => {
        const color = score > 65 ? 'var(--neg)' : score > 35 ? 'var(--warn)' : 'var(--pos)';
        return (
          <div key={region} className="tension-row">
            <span className="tension-name">{region}</span>
            <div className="tension-track">
              <div className="tension-fill" style={{ width: `${score}%`, background: color, color }} />
            </div>
            <span className="tension-score" style={{ color }}>{score}</span>
          </div>
        );
      })}
    </div>
  );
};

/* ── Story Signal Graph ──────────────────────────────────────────── */
const StoryGraph = ({ count, pulse }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '10px 0 6px' }}>
    {Array.from({ length: Math.min(count, 6) }).map((_, i) => (
      <React.Fragment key={i}>
        <div className="graph-dot" />
        {i < count - 1 && <div className="graph-line" style={{ width: 14 }} />}
      </React.Fragment>
    ))}
    <span className="mono" style={{ fontSize: 9, color: 'var(--text-3)', marginLeft: 10 }}>
      {count} SOURCE{count !== 1 ? 'S' : ''}
    </span>
    {pulse != null && <span className="badge pulse" style={{ marginLeft: 'auto' }}>⚡ {pulse}</span>}
  </div>
);

/* ════════════════════════════════════════════════════════════════════ */
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
    setLoading(true); setError(null);
    try {
      const res = await api.getDashboard([], [], force);
      setData(res);
      if (res.clusters?.length) setHeadlines(res.clusters.map(c => c.thread_title).filter(Boolean));
      else if (res.articles?.length) setHeadlines(res.articles.slice(0, 6).map(a => a.title));
      const exp = {}; (res.clusters || []).forEach((_, i) => { exp[i] = true; }); setExpanded(exp);

      // Dynamic theme
      if (res.articles?.length) {
        const txt = JSON.stringify(res.articles.map(a => a.title)).toLowerCase();
        const el = document.querySelector('.app-container');
        if (el) {
          if (txt.match(/market|stock|econom|financ|invest/)) el.className = 'app-container theme-markets';
          else if (txt.match(/trump|china|nato|election|politic|congress|senate/)) el.className = 'app-container theme-politics';
          else if (txt.match(/\bai\b|openai|deepseek|llm|neural|machine learn/)) el.className = 'app-container theme-ai';
          else if (txt.match(/military|war|defense|missile|army|weapon/)) el.className = 'app-container theme-defense';
          else el.className = 'app-container theme-tech';
        }
      }
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [setHeadlines]);

  useEffect(() => { load(); }, [load]);
  const toggle = (i) => setExpanded(p => ({ ...p, [i]: !p[i] }));

  const articles = data?.articles || [];
  const clusters = data?.clusters || [];
  const tension = data?.tension_index || {};
  const impact = data?.impact || {};
  const { displayed: briefText, typing } = useTypewriter(data?.daily_brief);

  const artMap = {}; articles.forEach(a => { artMap[String(a.id)] = a; });
  const posC = articles.filter(a => a.sentiment?.label === 'POSITIVE').length;
  const negC = articles.filter(a => a.sentiment?.label === 'NEGATIVE').length;
  const neuC = articles.length - posC - negC;
  const entCount = articles.reduce((s, a) => s + (a.entities?.length || 0), 0);

  /* ── Loading State ───────────────────────────────────────────── */
  if (loading && !data) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '70vh', gap: 20 }}>
      <div className="pulse-glow" style={{ width: 16, height: 16, background: 'var(--accent)', borderRadius: '50%' }} />
      <span className="mono" style={{ fontSize: 11, color: 'var(--accent)', letterSpacing: 3 }}>SYNCHRONIZING INTELLIGENCE...</span>
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        {['RSS', 'NLP', 'AI', 'SYNTHESIS'].map((s, i) => (
          <span key={s} className="badge" style={{ background: 'var(--accent-dim)', color: 'var(--accent)', animationDelay: `${i * 0.15}s` }}>{s}</span>
        ))}
      </div>
    </div>
  );

  return (
    <div className="dashboard-grid">

      {/* ═══════ LEFT — Command Panel ═══════ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', paddingBottom: 20 }}>

        {/* Operator + Refresh */}
        <div className="panel fin" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div className="label">COMMAND</div>
            <button onClick={() => load(true)} disabled={loading} className="wire-btn">
              {loading ? '⟳ SYNCING...' : '⟳ REFRESH'}
            </button>
          </div>
          {user && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {user.photoURL && <img src={user.photoURL} alt="" style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--accent-border)' }} />}
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{user.displayName}</div>
                <div className="mono" style={{ fontSize: 9, color: 'var(--pos)', letterSpacing: 1 }}>● LIVE SESSION</div>
              </div>
            </div>
          )}
        </div>

        {/* Metrics */}
        {data && (
          <div className="panel panel-accent fin fin-d1" style={{ padding: 18 }}>
            <div className="label" style={{ marginBottom: 14 }}>FEED METRICS</div>
            <div className="stat-row"><span className="stat-label">Sources Ingested</span><span className="stat-value">{data.sources_count || articles.length}</span></div>
            <div className="stat-row"><span className="stat-label">Story Threads</span><span className="stat-value">{clusters.length}</span></div>
            <div className="stat-row"><span className="stat-label">Entities Detected</span><span className="stat-value">{entCount}</span></div>
            <div className="section-line" />
            <div className="label" style={{ marginBottom: 8, marginTop: 4, fontSize: 9, color: 'var(--text-3)' }}>SENTIMENT DISTRIBUTION</div>
            <SentimentSpark pos={posC} neu={neuC} neg={negC} />
          </div>
        )}

        {/* Tension */}
        <TensionIndex tension={tension} />

        {/* Transparency */}
        {data && (
          <div className="panel fin fin-d4" style={{ padding: 16 }}>
            <div className="label" style={{ marginBottom: 10, fontSize: 9 }}>PIPELINE</div>
            <div style={{ display: 'grid', gap: 5 }}>
              {[
                ['AI', 'OpenRouter → Gemini'],
                ['NLP', 'HuggingFace (free)'],
                ['NEWS', 'Google RSS'],
                ['GEN', data.generated_at ? new Date(data.generated_at).toLocaleTimeString() : '—'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="mono" style={{ fontSize: 9, color: 'var(--text-3)', letterSpacing: 1 }}>{k}</span>
                  <span className="mono" style={{ fontSize: 9, color: 'var(--text-2)' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══════ CENTER — Intelligence Feed ═══════ */}
      <div style={{ overflowY: 'auto', paddingBottom: 20 }}>

        {/* Ticker */}
        {data && articles.length > 0 && (
          <div className="ticker-wrap" style={{ marginBottom: 14, borderRadius: 'var(--br)' }}>
            <div className="ticker-tag">LIVE</div>
            <div className="ticker-move">
              {[...articles, ...articles].map((a, i) => (
                <div key={i} className="ticker-item">
                  <span className="ticker-sep">//</span> {a.title.toUpperCase()}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="panel" style={{ borderColor: 'var(--neg)', padding: 24, marginBottom: 14 }}>
            <div className="label" style={{ color: 'var(--neg)', marginBottom: 8 }}>PIPELINE ERROR</div>
            <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14 }}>{error}</p>
            <button onClick={() => load(true)} className="wire-btn">RETRY SYNC</button>
          </div>
        )}

        {/* Clusters */}
        {clusters.length > 0 ? clusters.map((cluster, ci) => {
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
                  fontSize: 18, color: 'var(--text-3)', transition: 'transform 0.3s var(--ease)',
                  transform: isOpen ? 'rotate(90deg)' : 'none', display: 'inline-block',
                }}>▸</span>
              </div>

              {isOpen && cArts.length > 0 && (
                <div className="cluster-body">
                  {cArts.map((art, j) => (
                    <div key={j} className="wire-strip" style={{ cursor: 'pointer' }}
                      onClick={() => navigate('/story', { state: { article: art } })}>
                      <span className="mono" style={{ fontSize: 10, color: 'var(--accent)', width: 90, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {art.source?.toUpperCase()}
                      </span>
                      <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-1)' }}>
                        {art.title}
                      </span>
                      <span className={`badge ${sentClass(art.sentiment?.label)}`}>{art.sentiment?.label || '—'}</span>
                      <span className="mono" style={{ fontSize: 9, color: 'var(--text-3)', flexShrink: 0 }}>{timeAgo(art.published)}</span>
                      <a href={art.url} target="_blank" rel="noopener noreferrer" className="wire-btn"
                        onClick={e => e.stopPropagation()} title="Read original">↗</a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        }) : articles.length > 0 && !loading ? (
          <div>
            <div className="label" style={{ marginBottom: 12 }}>UNCLUSTERED FEED</div>
            {articles.map((art, i) => (
              <div key={i} className="wire-strip fin" style={{ animationDelay: `${i * 0.04}s`, cursor: 'pointer' }}
                onClick={() => navigate('/story', { state: { article: art } })}>
                <span className="mono" style={{ fontSize: 10, color: 'var(--accent)', width: 90 }}>{art.source?.toUpperCase()}</span>
                <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{art.title}</span>
                <span className={`badge ${sentClass(art.sentiment?.label)}`}>{art.sentiment?.label || '—'}</span>
                <span className="mono" style={{ fontSize: 9, color: 'var(--text-3)' }}>{timeAgo(art.published)}</span>
              </div>
            ))}
          </div>
        ) : !loading ? (
          <div className="panel" style={{ textAlign: 'center', padding: 50 }}>
            <span className="mono" style={{ color: 'var(--text-3)', letterSpacing: 2 }}>NO INTELLIGENCE DATA</span>
          </div>
        ) : null}
      </div>

      {/* ═══════ RIGHT — Synthesis Terminal ═══════ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', paddingBottom: 20 }}>

        {/* Daily Brief */}
        <div className="panel panel-accent fin fin-d1" style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', minHeight: 200 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div className="label">STRATEGIC BRIEF</div>
            <span className="mono" style={{ fontSize: 9, color: 'var(--text-3)' }}>AI SYNTHESIS</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading && !data ? (
              <div style={{ display: 'grid', gap: 10 }}>
                {[200, 160, 180, 140, 120].map((w, i) => (
                  <div key={i} className="skel" style={{ width: w, maxWidth: '100%', height: 12 }} />
                ))}
              </div>
            ) : data?.daily_brief ? (
              <div className="typewriter">
                {briefText}
                {typing && <span className="typewriter-cursor" />}
              </div>
            ) : (
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>[Awaiting AI synthesis...]</span>
            )}
          </div>
        </div>

        {/* Executive Impact */}
        {impact?.headline && (
          <div className="panel fin fin-d2" style={{ padding: 20 }}>
            <div className="label" style={{ marginBottom: 12 }}>EXECUTIVE IMPACT</div>
            <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, lineHeight: 1.4, color: 'var(--text-0)' }}>{impact.headline}</p>
            {impact.why_it_matters && (
              <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.65, marginBottom: 12 }}>{impact.why_it_matters}</p>
            )}
            {impact.actions?.length > 0 && (
              <>
                <div className="section-line" />
                <div className="label" style={{ marginBottom: 8, fontSize: 9, color: 'var(--text-3)' }}>RECOMMENDED ACTIONS</div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {impact.actions.map((a, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <span style={{ color: 'var(--accent)', fontSize: 12, marginTop: 1, fontWeight: 700 }}>→</span>
                      <span style={{ fontSize: 11, color: 'var(--text-1)', lineHeight: 1.55 }}>{a}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Top Entities */}
        {articles.length > 0 && (() => {
          const ents = {};
          articles.forEach(a => (a.entities || []).forEach(e => {
            const k = e.name; ents[k] = (ents[k] || 0) + 1;
          }));
          const top = Object.entries(ents).sort((a, b) => b[1] - a[1]).slice(0, 12);
          if (!top.length) return null;
          return (
            <div className="panel fin fin-d3" style={{ padding: 20 }}>
              <div className="label" style={{ marginBottom: 12 }}>KEY ENTITIES</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {top.map(([name, cnt]) => (
                  <span key={name} style={{
                    padding: '4px 10px', fontSize: 10, fontFamily: 'var(--mono)',
                    background: cnt > 2 ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                    border: `1px solid ${cnt > 2 ? 'var(--accent-border)' : 'rgba(255,255,255,0.05)'}`,
                    borderRadius: 'var(--br)', color: cnt > 2 ? 'var(--accent)' : 'var(--text-2)',
                    display: 'inline-flex', gap: 5, alignItems: 'center',
                  }}>
                    {name}
                    {cnt > 1 && <span style={{ fontSize: 8, opacity: 0.5 }}>×{cnt}</span>}
                  </span>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
