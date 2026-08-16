import { memo, useCallback, useEffect, useMemo, useState } from 'react'

const API = (import.meta.env.VITE_API_URL || 'https://oil-pipeline.onrender.com').replace(/\/$/, '')

const COLUMNS = [
  { id: 'ingest', n: '1', title: 'DATA INGESTION', sub: 'Collecting RSS in real time', color: 'cyan' },
  { id: 'backend', n: '2', title: 'BACKEND PROCESSING', sub: 'Stories land in Postgres', color: 'gold' },
  { id: 'filter', n: '3', title: 'FILTERING', sub: 'Noise, images, duplicates', color: 'violet' },
  { id: 'ai', n: '4', title: 'AI ANALYSIS', sub: 'HF then LLM through Cloud Command', color: 'green' },
  { id: 'rank', n: '5', title: 'RANKING', sub: 'Pulse, exposure, importance', color: 'amber' },
  { id: 'front', n: '6', title: 'FRONTEND', sub: 'Live desk on NewsIntel', color: 'blue' },
]

const STAGE_COPY = {
  fetch: { title: 'RSS / Field Feeds', blurb: 'Raw stories after RSS, before the database.' },
  backend: { title: 'Backend Server', blurb: 'Imaged stories accepted into Postgres.' },
  images: { title: 'Image Gate', blurb: 'Kept only if a real article image exists.' },
  validate: { title: 'Data Validation', blurb: 'Title, URL, source, and image all present.' },
  dedupe: { title: 'Deduplication', blurb: 'Repeats dropped. New or reused rows stay.' },
  pre_ai: { title: 'Before AI', blurb: 'Text as fetched, before NER / LLM.' },
  hf: { title: 'After AI', blurb: 'Entities, sentiment, rewritten title and why it matters.' },
  signals: { title: 'Ranking Engine', blurb: 'Pulse, exposure, and importance on the desk.' },
  frontend: { title: 'Dashboard / Frontend', blurb: 'What NewsIntel is showing right now.' },
}

function getJson(path, opts) {
  return fetch(`${API}${path}`, opts).then(async (res) => {
    const text = await res.text()
    if (!res.ok && res.status !== 202) throw new Error(`${res.status} ${text}`)
    return text ? JSON.parse(text) : {}
  })
}

function stageOf(latest, name) {
  return (latest?.stages || []).find((s) => s.name === name) || null
}

const STAGE_NEXT = {
  fetch: 'images',
  images: 'dedupe',
  dedupe: 'hf',
  hf: 'signals',
  llm: 'signals',
  signals: 'snapshot',
  snapshot: 'snapshot',
}

function phaseFromName(name) {
  if (!name) return null
  if (name === 'llm') return 'hf'
  if (['fetch', 'images', 'dedupe', 'hf', 'signals', 'snapshot'].includes(name)) return name
  return null
}

function currentPhase(latest, flowing, liveStage) {
  if (!flowing) return 'idle'
  const fromSse = phaseFromName(liveStage)
  if (fromSse) return fromSse
  const names = (latest?.stages || []).map((s) => s.name)
  if (!names.includes('fetch')) return 'fetch'
  if (!names.includes('images')) return 'images'
  if (!names.includes('dedupe')) return 'dedupe'
  if (!names.includes('hf') && !names.includes('llm')) return 'hf'
  if (!names.includes('signals')) return 'signals'
  return 'snapshot'
}

function nodeState(latest, names, flowing) {
  const found = names.map((name) => stageOf(latest, name)).filter(Boolean)
  if (latest?.status === 'failed' && names.some((n) => ['hf', 'llm'].includes(n))) return 'fault'
  if (flowing && found.length && !found.every((s) => s.finished_at || s.counts)) return 'live'
  if (flowing && !found.length) return 'idle'
  if (found.some((s) => s.finished_at || s.counts)) return 'done'
  if (latest?.status === 'succeeded' || latest?.status === 'partial') return 'done'
  return 'idle'
}

export default function App() {
  const [view, setView] = useState('flow')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [live, setLive] = useState(false)
  const [events, setEvents] = useState([])
  const [open, setOpen] = useState(null)
  const [inspect, setInspect] = useState(null)
  const [inspecting, setInspecting] = useState(false)
  const [liveStage, setLiveStage] = useState(null)

  const load = useCallback(async () => {
    try {
      const payload = await getJson('/api/pipeline/monitor')
      setData(payload)
      setError('')
    } catch (err) {
      setError(err.message.slice(0, 180))
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const source = new EventSource(`${API}/api/pipeline/stream`)
    source.onopen = () => setLive(true)
    source.onerror = () => setLive(false)
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data || '{}')
        if (payload.type === 'hello') {
          setLive(true)
          return
        }
        setEvents((current) => [payload, ...current].slice(0, 24))
        if (payload.type === 'stage' && payload.name) {
          setLiveStage(payload.status === 'done' ? (STAGE_NEXT[payload.name] || payload.name) : payload.name)
        }
        if (payload.type === 'snapshot') setLiveStage('snapshot')
        if (payload.type === 'stage' || payload.type === 'snapshot') load()
      } catch {
        // keepalive
      }
    }
    const poll = setInterval(load, 12000)
    return () => {
      source.close()
      clearInterval(poll)
    }
  }, [load])

  const openStage = async (stage) => {
    setOpen(stage)
    setInspecting(true)
    try {
      setInspect(await getJson(`/api/pipeline/inspect?stage=${encodeURIComponent(stage)}`))
    } catch (err) {
      setInspect({ stage, items: [], error: err.message.slice(0, 160) })
    } finally {
      setInspecting(false)
    }
  }

  const kick = async () => {
    setBusy(true)
    setError('')
    try {
      setLiveStage('fetch')
      await getJson('/api/pipeline/kick', { method: 'POST' })
      await load()
    } catch (err) {
      setError(err.message.slice(0, 180))
    } finally {
      setBusy(false)
    }
  }

  const latest = data?.latest
  const stats = latest?.stats || {}
  const flowing = latest?.status === 'running' || data?.lock
  const deps = data?.deps || {}
  const hf = deps.huggingface || {}
  const cc = deps.cloud_command || {}
  const hfFault = hf.stage === 'RUNTIME_ERROR' || hf.stage === 'BUILD_ERROR'
  const system = flowing ? 'FLOWING' : error || latest?.status === 'failed' || hfFault ? 'FAULT' : 'OPERATIONAL'

  const counts = useMemo(() => ({
    fetched: stats.fetched ?? 0,
    accepted: stats.accepted ?? 0,
    rejected: stats.rejected_no_image ?? 0,
    unique: stats.deduped ?? 0,
    hf: stats.hf_ok ?? 0,
    llm: stats.llm_ok ?? 0,
    signals: stats.signals ?? 0,
  }), [stats])

  const fetchS = nodeState(latest, ['fetch'], flowing)
  const imageS = nodeState(latest, ['images'], flowing)
  const dedupeS = nodeState(latest, ['dedupe'], flowing)
  const hfS = hfFault ? 'fault' : nodeState(latest, ['hf'], flowing)
  const llmS = nodeState(latest, ['llm'], flowing)
  const sigS = nodeState(latest, ['signals'], flowing)
  const snapS = nodeState(latest, ['snapshot'], flowing)
  const phase = currentPhase(latest, flowing, liveStage)
  useEffect(() => {
    if (!flowing && liveStage && liveStage !== 'snapshot') setLiveStage(null)
  }, [flowing, liveStage])

  return (
    <div className="scada">
      <div className="live-bg" aria-hidden="true">
        <i /><i /><i /><i />
        <span className="scan" />
        <span className="grid" />
      </div>
      <aside className="rail">
        <div className="brand">
          <span className="drop" />
          <b>OIL</b>
        </div>
        <Nav label="Flow Monitor" active={view === 'flow'} onClick={() => setView('flow')} />
        <Nav label="Alerts" active={view === 'alerts'} onClick={() => setView('alerts')} />
        <Nav label="Logs" active={view === 'logs'} onClick={() => setView('logs')} />
        <Nav label="Settings" active={view === 'settings'} onClick={() => setView('settings')} />
      </aside>

      <div className="stage">
        <header className="bar">
          <div className="bar-left">
            <span className="drop" />
            <h1>OIL PIPELINE — REAL TIME FLOW</h1>
          </div>
          <div className="bar-right">
            <span className="sys">
              System Status:
              <b className={system === 'OPERATIONAL' ? 'ok' : system === 'FLOWING' ? 'go' : 'bad'}>● {system}</b>
            </span>
            <Clock />
            <span className={`stream ${live ? 'on' : ''}`}>{live ? 'SSE LIVE' : 'RECONNECT'}</span>
            <button className="force" disabled={busy || flowing} onClick={kick}>
              {busy ? 'Opening valve…' : flowing ? 'Flowing…' : 'Force a run'}
            </button>
          </div>
        </header>

        {error && <div className="fault">{error}</div>}

        {view === 'flow' && (
          <div className={`board ${flowing ? 'moving' : 'idle'} flow-${phase} ${live ? 'is-live' : ''}`}>
            <p className="hint">
              {phase === 'idle' ? 'Line closed. Only the desk feeds back to the backend. Force a run to open the valves.'
                : phase === 'fetch' ? 'Valves open. Crude is moving RSS → backend.'
                : phase === 'images' ? 'Image gate + validation.'
                : phase === 'dedupe' ? 'Deduping repeats.'
                : phase === 'hf' ? 'AI model is on this cut.'
                : phase === 'signals' ? 'Ranking and insights.'
                : 'Pushing the snapshot to the desk.'}
            </p>
            <div className="cols">
              {COLUMNS.map((col) => (
                <div key={col.id} className={`col col-${col.color}`}>
                  <p className="col-n">{col.n}. {col.title}</p>
                  <small>{col.sub}</small>
                </div>
              ))}
            </div>

            <div className="diagram tight">
              <FlowPipes />

              <div className="nodes">
                <Node x="10%" y="50%" state={live ? 'live' : fetchS} color="cyan" title="RSS / Field Feeds" status="LIVE" meta={`${counts.fetched} fetched`} icon="wifi" onClick={() => openStage('fetch')} />
                <Node x="26%" y="50%" state={live ? 'live' : 'done'} color="gold" title="Backend Server" status="LIVE" meta="Postgres + worker" icon="server" onClick={() => openStage('backend')} />
                <Node x="43%" y="22%" state={imageS} color="violet" title="Image Gate" status={imageS === 'done' ? 'ACTIVE' : imageS.toUpperCase()} meta={`${counts.rejected} rejected`} icon="funnel" small onClick={() => openStage('images')} />
                <Node x="43%" y="50%" state={imageS} color="violet" title="Data Validation" status={imageS === 'done' ? 'ACTIVE' : imageS.toUpperCase()} meta={`${counts.accepted} kept`} icon="funnel" small onClick={() => openStage('validate')} />
                <Node x="43%" y="78%" state={dedupeS} color="violet" title="Deduplication" status={dedupeS === 'done' ? 'ACTIVE' : dedupeS.toUpperCase()} meta={counts.unique ? `${counts.unique} new` : `${counts.accepted} reused`} icon="funnel" small onClick={() => openStage('dedupe')} />
                <Node x="61%" y="36%" state={hfS} color="green" title="AI Model" status={hfFault ? 'FAULT' : (hf.stage === 'RUNNING' ? 'LIVE' : (hf.stage || 'STANDBY'))} meta={`HF ${counts.hf} · LLM ${counts.llm}`} icon="brain" onClick={() => openStage('hf')} />
                <Mini x="61%" y="60%" label="Before AI" on={Boolean(counts.accepted)} onClick={() => openStage('pre_ai')} />
                <Mini x="61%" y="70%" label="After AI" on={counts.hf > 0 || counts.llm > 0} onClick={() => openStage('hf')} />
                <Mini x="61%" y="80%" label="Risk Assessment" on={sigS === 'done'} onClick={() => openStage('signals')} />
                <Node x="77%" y="42%" state={sigS} color="amber" title="Ranking Engine" status={sigS === 'done' ? 'LIVE' : sigS.toUpperCase()} meta={`${counts.signals} signals`} icon="trophy" onClick={() => openStage('signals')} />
                <Node x="77%" y="72%" state={sigS} color="amber" title="Prioritized Insights" status={sigS === 'done' ? 'LIVE' : sigS.toUpperCase()} meta="pulse + exposure" icon="list" small onClick={() => openStage('signals')} />
                <Node x="92%" y="50%" state={live ? 'live' : snapS} color="blue" title="Dashboard / Frontend" status="LIVE" meta="newsintel.yogender1.me" icon="monitor" onClick={() => openStage('frontend')} />
              </div>

              <div className="loop">
                <span className="loop-card">
                  Feedback Loop
                  <b className="ok">● ACTIVE</b>
                  <em>Force a run also syncs NewsIntel. Snapshot writes back.</em>
                </span>
              </div>
            </div>

            <footer className="legend">
              <div>
                <b>LEGEND</b>
                <span><i className="solid" /> Live / flowing</span>
                <span><i className="dash" /> Feedback</span>
              </div>
              <div className="deps">
                <span className={cc.ok ? 'ok' : 'bad'}>Cloud Command {cc.ok ? 'UP' : 'DOWN'}</span>
                <span className={hfFault ? 'bad' : 'ok'}>Hugging Face {hf.stage || 'UNKNOWN'}</span>
                <span className="ok">{counts.signals} live signals</span>
              </div>
            </footer>
          </div>
        )}

        {view === 'logs' && <Logs recent={data?.recent || []} events={events} />}
        {view === 'alerts' && <Alerts latest={latest} hf={hf} cc={cc} circuit={data?.circuit_ai} />}
        {view === 'settings' && <Settings deps={deps} latest={latest} />}
      </div>

      {open && (
        <InspectDrawer
          stage={open}
          loading={inspecting}
          data={inspect}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  )
}

function InspectDrawer({ stage, loading, data, onClose }) {
  const copy = STAGE_COPY[stage] || { title: stage, blurb: '' }
  const items = data?.items || []
  const rejected = data?.rejected || []
  const dropped = data?.dropped || []
  const dive = stage === 'fetch' || stage === 'rss'
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className={`inspect-overlay ${dive ? 'dive-rss' : ''}`} onMouseDown={onClose}>
      {dive && (
        <div className="dive-tunnel" aria-hidden="true">
          <span /><span /><span /><span />
        </div>
      )}
      <aside className="drawer" onMouseDown={(event) => event.stopPropagation()}>
      <header>
        <div>
          <small>{dive ? 'ENTERING RSS FIELD' : 'STAGE INSPECT'}</small>
          <h2>{copy.title}</h2>
          <p>{copy.blurb}</p>
        </div>
        <button type="button" className="drawer-close" onClick={onClose} aria-label="Close">×</button>
      </header>
      {loading && <p className="empty">Reading the line…</p>}
      {data?.error && <p className="fault">{data.error}</p>}
      {!loading && items.length === 0 && <p className="empty">No rows sitting here yet. Force a run, then click again.</p>}
      <ul>
        {items.map((item, index) => (
          <li key={`${item.url || item.title}-${index}`}>
            {item.image_url && <img src={item.image_url} alt="" />}
            <div>
              <b>{item.title}</b>
              <small>{[item.source, item.category, item.gate, item.sentiment, item.importance, item.pulse != null ? `pulse ${Math.round(item.pulse)}` : ''].filter(Boolean).join(' · ')}</small>
              {item.summary && <p>{item.summary}</p>}
            </div>
          </li>
        ))}
      </ul>
      {rejected.length > 0 && stage === 'images' && (
        <>
          <h3>Rejected — no image</h3>
          <ul>
            {rejected.map((item, index) => (
              <li key={`r-${index}`}><div><b>{item.title}</b><small>{item.source}</small></div></li>
            ))}
          </ul>
        </>
      )}
      {dropped.length > 0 && stage === 'dedupe' && (
        <>
          <h3>Dropped as duplicates</h3>
          <ul>
            {dropped.map((item, index) => (
              <li key={`d-${index}`}><div><b>{item.title}</b><small>{item.source}</small></div></li>
            ))}
          </ul>
        </>
      )}
    </aside>
    </div>
  )
}

function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(tick)
  }, [])
  return <time>{now.toLocaleTimeString('en-US', { hour12: true })}</time>
}

const SEGMENTS = [
  { id: 'rss-back', d: 'M 120 280 H 312', color: '#22d3ee', n: 5, dur: 1.6 },
  { id: 'back-valid', d: 'M 312 280 H 516', color: '#38bdf8', n: 5, dur: 1.6 },
  { id: 'valid-ai', d: 'M 516 280 H 732', color: '#67e8f9', n: 5, dur: 1.6 },
  { id: 'ai-rank', d: 'M 732 280 H 924', color: '#34d399', n: 4, dur: 1.5 },
  { id: 'rank-desk', d: 'M 924 280 H 1104', color: '#38bdf8', n: 4, dur: 1.5 },
  { id: 'to-image', d: 'M 516 280 V 128', color: '#a78bfa', n: 3, dur: 1.3 },
  { id: 'to-dedupe', d: 'M 516 280 V 432', color: '#a78bfa', n: 3, dur: 1.3 },
  { id: 'to-ai', d: 'M 732 280 V 206', color: '#34d399', n: 3, dur: 1.2 },
  { id: 'to-risk', d: 'M 732 280 V 400', color: '#34d399', n: 3, dur: 1.2 },
  { id: 'to-insights', d: 'M 924 280 V 400', color: '#f59e0b', n: 3, dur: 1.2 },
  { id: 'loop', d: 'M 1104 300 C 1104 500 120 500 120 300', color: '#22d3ee', n: 6, dur: 3.2 },
]

const FlowPipes = memo(function FlowPipes() {
  return (
    <svg className="pipes" viewBox="0 0 1200 560" preserveAspectRatio="none">
      <defs>
        <filter id="glow"><feGaussianBlur stdDeviation="3.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        {SEGMENTS.map((seg) => (
          <path key={seg.id} id={`p-${seg.id}`} d={seg.d} fill="none" />
        ))}
      </defs>
      {SEGMENTS.map((seg) => (
        <path key={`${seg.id}-body`} d={seg.d} className={`pipe-body ${seg.id === 'loop' ? 'feedback' : ''} ${seg.id.startsWith('rss') || seg.id === 'back-valid' || seg.id === 'valid-ai' || seg.id === 'ai-rank' || seg.id === 'rank-desk' ? 'spine' : ''}`} />
      ))}
      {SEGMENTS.flatMap((seg) =>
        Array.from({ length: seg.n }, (_, i) => (
          <circle key={`${seg.id}-${i}`} r={seg.id === 'loop' ? 4 : 6} fill={seg.color} className={`packet packet-${seg.id}`} filter="url(#glow)">
            <animateMotion dur={`${seg.dur}s`} begin={`${(i * seg.dur) / seg.n}s`} repeatCount="indefinite">
              <mpath href={`#p-${seg.id}`} />
            </animateMotion>
          </circle>
        ))
      )}
      <Valve x="216" y="280" label="IN" />
      <Valve x="414" y="280" label="MID" />
      <g className="pipe-break" transform="translate(624 280)">
        <path d="M -28 -7 H -8 L -4 7 H -28 Z" className="break-flange" />
        <path d="M 28 -7 H 8 L 4 7 H 28 Z" className="break-flange" />
        <path d="M -6 -16 L 2 -4 M 4 6 L -2 16 M 0 -10 L 8 2" className="break-spark" />
        <text y="32" textAnchor="middle" className="break-label">BREAK</text>
      </g>
      <Valve x="1014" y="280" label="OUT" />
    </svg>
  )
}, () => true)

function Valve({ x, y, label }) {
  return (
    <g className="valve" transform={`translate(${x} ${y})`}>
      <circle r="15" className="valve-body" />
      <rect className="valve-handle" x="-2.2" y="-17" width="4.4" height="34" rx="2" />
      <circle r="4.5" className="valve-hub" />
      <text y="28" textAnchor="middle" className="valve-label">{label}</text>
    </g>
  )
}

function Node({ x, y, state, color, title, status, meta, icon, small, onClick }) {
  return (
    <button type="button" className={`node ${color} ${state} ${small ? 'small' : ''}`} style={{ left: x, top: y }} onClick={onClick}>
      <div className="glyph">{icon === 'wifi' ? '◉' : icon === 'server' ? '▣' : icon === 'funnel' ? '▽' : icon === 'brain' ? '⌘' : icon === 'trophy' ? '▲' : icon === 'list' ? '☰' : '▣'}</div>
      <strong>{title}</strong>
      <em className={state === 'fault' ? 'bad' : 'ok'}>● {status}</em>
      <small>{meta}</small>
    </button>
  )
}

function Mini({ x, y, label, on, onClick }) {
  return (
    <button type="button" className={`mini ${on ? 'on' : ''}`} style={{ left: x, top: y }} onClick={onClick}>
      {label} <b>{on ? 'OPEN' : 'IDLE'}</b>
    </button>
  )
}

function Logs({ recent, events }) {
  return (
    <section className="panel-page">
      <h2>Run tickets</h2>
      <div className="tickets">
        {recent.length === 0 && <p className="empty">No crude has moved yet.</p>}
        {recent.map((run) => (
          <article key={run.id}>
            <header><b>{run.status}</b><span>{run.trigger}</span></header>
            <p>fetched {run.stats?.fetched ?? '—'} · kept {run.stats?.accepted ?? '—'} · rejected {run.stats?.rejected_no_image ?? '—'} · signals {run.stats?.signals ?? '—'}</p>
            <small>{run.started_at}{run.elapsed_ms != null ? ` · ${run.elapsed_ms}ms` : ''}</small>
          </article>
        ))}
      </div>
      <h2>Live stream</h2>
      <ul className="stream-log">
        {events.length === 0 && <li>Waiting for stage events…</li>}
        {events.map((item, i) => (
          <li key={`${item.at}-${i}`}>
            <b>{item.type}</b> {item.name || ''} {item.status || ''} {item.counts ? JSON.stringify(item.counts) : ''}
          </li>
        ))}
      </ul>
    </section>
  )
}

function Alerts({ latest, hf, cc, circuit }) {
  const rows = []
  if (latest?.status === 'failed') rows.push({ level: 'bad', text: `Last run failed: ${latest.error || 'no error body'}` })
  if (!cc.ok) rows.push({ level: 'bad', text: 'Cloud Command gateway is not answering.' })
  if (hf.stage === 'RUNTIME_ERROR') rows.push({ level: 'bad', text: 'Hugging Face space is in RUNTIME_ERROR.' })
  else if (hf.stage && hf.stage !== 'RUNNING') rows.push({ level: 'warn', text: `Hugging Face space is ${hf.stage}.` })
  if (circuit) rows.push({ level: 'warn', text: 'AI circuit is open. LLM calls are cooling down.' })
  if (!rows.length) rows.push({ level: 'ok', text: 'No alerts. Line is clean.' })
  return (
    <section className="panel-page">
      <h2>Alerts</h2>
      {rows.map((row) => <p key={row.text} className={`alert ${row.level}`}>{row.text}</p>)}
    </section>
  )
}

function Settings({ deps, latest }) {
  return (
    <section className="panel-page">
      <h2>Line settings</h2>
      <pre>{JSON.stringify({ deps, last_run: latest && { id: latest.id, status: latest.status, trigger: latest.trigger } }, null, 2)}</pre>
    </section>
  )
}

function Nav({ label, active, onClick }) {
  return (
    <button className={active ? 'active' : ''} onClick={onClick}>{label}</button>
  )
}
