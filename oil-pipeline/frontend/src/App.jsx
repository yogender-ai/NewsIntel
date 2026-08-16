import { useCallback, useEffect, useMemo, useState } from 'react'

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
  const [clock, setClock] = useState(() => new Date())
  const [live, setLive] = useState(false)
  const [events, setEvents] = useState([])
  const [open, setOpen] = useState(null)
  const [inspect, setInspect] = useState(null)
  const [inspecting, setInspecting] = useState(false)

  const load = useCallback(async () => {
    try {
      const payload = await getJson('/api/pipeline/monitor')
      setData(payload)
      setError('')
    } catch (err) {
      setError(err.message.slice(0, 180))
    }
  }, [])

  useEffect(() => {
    load()
    const tick = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(tick)
  }, [load])

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
  const current = (latest?.stages || []).length
  const liveName = flowing ? (['fetch', 'images', 'dedupe', 'hf', 'llm', 'signals', 'snapshot'][current] || 'fetch') : ''

  return (
    <div className="scada">
      <div className="live-bg" aria-hidden="true">
        <i /><i /><i /><i />
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
            <time>{clock.toLocaleTimeString('en-US', { hour12: true })}</time>
            <span className={`stream ${live ? 'on' : ''}`}>{live ? 'SSE LIVE' : 'RECONNECT'}</span>
            <button className="force" disabled={busy || flowing} onClick={kick}>
              {busy ? 'Opening valve…' : flowing ? 'Flowing…' : 'Force a run'}
            </button>
          </div>
        </header>

        {error && <div className="fault">{error}</div>}

        {view === 'flow' && (
          <div className={`board ${flowing ? 'moving' : ''}`}>
            <p className="hint">Click a unit to see the stories sitting there. Force a run also syncs the NewsIntel desk.</p>
            <div className="cols">
              {COLUMNS.map((col) => (
                <div key={col.id} className={`col col-${col.color}`}>
                  <p className="col-n">{col.n}. {col.title}</p>
                  <small>{col.sub}</small>
                </div>
              ))}
            </div>

            <div className="diagram">
              <svg className="pipes" viewBox="0 0 1440 520" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="gCyan" x1="0" x2="1"><stop stopColor="#22d3ee" /><stop offset="1" stopColor="#38bdf8" /></linearGradient>
                  <linearGradient id="gGold" x1="0" x2="1"><stop stopColor="#fbbf24" /><stop offset="1" stopColor="#f59e0b" /></linearGradient>
                  <linearGradient id="gViolet" x1="0" x2="1"><stop stopColor="#a78bfa" /><stop offset="1" stopColor="#8b5cf6" /></linearGradient>
                  <linearGradient id="gGreen" x1="0" x2="1"><stop stopColor="#34d399" /><stop offset="1" stopColor="#10b981" /></linearGradient>
                  <linearGradient id="gAmber" x1="0" x2="1"><stop stopColor="#fbbf24" /><stop offset="1" stopColor="#f97316" /></linearGradient>
                  <linearGradient id="gBlue" x1="0" x2="1"><stop stopColor="#38bdf8" /><stop offset="1" stopColor="#60a5fa" /></linearGradient>
                  <filter id="glow"><feGaussianBlur stdDeviation="3.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                </defs>
                <Pipe d="M 150 250 H 300" grad="gCyan" on={live || flowing} live={liveName === 'fetch' || live} />
                <Pipe d="M 420 250 H 560" grad="gGold" on={live || flowing} live={liveName === 'images' || live} />
                <Pipe d="M 560 250 C 590 250 590 120 630 120" grad="gViolet" on={flowing} live={liveName === 'images'} />
                <Pipe d="M 560 250 H 630" grad="gViolet" on={flowing} live={liveName === 'images'} />
                <Pipe d="M 560 250 C 590 250 590 380 630 380" grad="gViolet" on={flowing} live={liveName === 'dedupe'} />
                <Pipe d="M 790 120 C 830 120 830 250 870 250" grad="gViolet" on={flowing} live={liveName === 'hf'} />
                <Pipe d="M 790 250 H 870" grad="gViolet" on={flowing} live={liveName === 'hf'} />
                <Pipe d="M 790 380 C 830 380 830 250 870 250" grad="gViolet" on={flowing} live={liveName === 'hf'} />
                <Pipe d="M 1010 250 H 1090" grad="gGreen" on={flowing} live={liveName === 'signals'} />
                <Pipe d="M 1010 250 C 1040 250 1040 360 1090 360" grad="gGreen" on={flowing} live={liveName === 'signals'} />
                <Pipe d="M 1230 250 H 1290" grad="gAmber" on={live || flowing} live={live} />
                <Pipe d="M 1230 360 C 1260 360 1260 250 1290 250" grad="gAmber" on={flowing} live={liveName === 'snapshot'} />
                <Pipe d="M 1360 310 C 1360 470 300 470 300 310" grad="gCyan" on={live} live={false} dash />
              </svg>

              <div className="nodes">
                <Node x="8%" y="42%" state={live ? 'live' : fetchS} color="cyan" title="RSS / Field Feeds" status="LIVE" meta={`${counts.fetched} fetched`} icon="wifi" onClick={() => openStage('fetch')} />
                <Node x="24%" y="42%" state={live ? 'live' : 'done'} color="gold" title="Backend Server" status="LIVE" meta="Postgres + worker" icon="server" onClick={() => openStage('backend')} />
                <Node x="44%" y="14%" state={imageS} color="violet" title="Image Gate" status={imageS === 'done' ? 'ACTIVE' : imageS.toUpperCase()} meta={`${counts.rejected} rejected`} icon="funnel" small onClick={() => openStage('images')} />
                <Node x="44%" y="42%" state={imageS} color="violet" title="Data Validation" status={imageS === 'done' ? 'ACTIVE' : imageS.toUpperCase()} meta={`${counts.accepted} kept`} icon="funnel" small onClick={() => openStage('validate')} />
                <Node x="44%" y="70%" state={dedupeS} color="violet" title="Deduplication" status={dedupeS === 'done' ? 'ACTIVE' : dedupeS.toUpperCase()} meta={counts.unique ? `${counts.unique} new` : `${counts.accepted} reused`} icon="funnel" small onClick={() => openStage('dedupe')} />
                <Node x="62%" y="34%" state={hfS} color="green" title="AI Model" status={hfFault ? 'FAULT' : (hf.stage === 'RUNNING' ? 'LIVE' : (hf.stage || 'STANDBY'))} meta={`HF ${counts.hf} · LLM ${counts.llm}`} icon="brain" onClick={() => openStage('hf')} />
                <Mini x="62%" y="58%" label="Before AI" on={Boolean(counts.accepted)} onClick={() => openStage('pre_ai')} />
                <Mini x="62%" y="66%" label="After AI" on={counts.hf > 0 || counts.llm > 0} onClick={() => openStage('hf')} />
                <Mini x="62%" y="74%" label="Risk Assessment" on={sigS === 'done'} onClick={() => openStage('signals')} />
                <Node x="79%" y="42%" state={sigS} color="amber" title="Ranking Engine" status={sigS === 'done' ? 'LIVE' : sigS.toUpperCase()} meta={`${counts.signals} signals`} icon="trophy" onClick={() => openStage('signals')} />
                <Node x="79%" y="66%" state={sigS} color="amber" title="Prioritized Insights" status={sigS === 'done' ? 'LIVE' : sigS.toUpperCase()} meta="pulse + exposure" icon="list" small onClick={() => openStage('signals')} />
                <Node x="93%" y="42%" state={live ? 'live' : snapS} color="blue" title="Dashboard / Frontend" status="LIVE" meta="newsintel.yogender1.me" icon="monitor" onClick={() => openStage('frontend')} />
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
  return (
    <aside className="drawer">
      <header>
        <div>
          <small>STAGE INSPECT</small>
          <h2>{copy.title}</h2>
          <p>{copy.blurb}</p>
        </div>
        <button onClick={onClose}>Close</button>
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
  )
}

function Pipe({ d, grad, on, live, dash }) {
  return (
    <g className={`pipe ${on ? 'on' : ''} ${live ? 'live' : ''} ${dash ? 'feedback' : ''}`}>
      <path d={d} className="pipe-body" />
      <path d={d} className="pipe-flow" stroke={`url(#${grad})`} />
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
