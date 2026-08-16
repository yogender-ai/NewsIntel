import { memo, useCallback, useEffect, useMemo, useState } from 'react'

const API = (import.meta.env.VITE_API_URL || 'https://oil-pipeline.onrender.com').replace(/\/$/, '')
const NEWSINTEL = (import.meta.env.VITE_NEWSINTEL_URL || 'https://newsintel-xvhe.onrender.com').replace(/\/$/, '')

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
    if (!res.ok && res.status !== 202) throw new Error(`${res.status} ${text.slice(0, 160)}`)
    if (text.trim().startsWith('<')) throw new Error('Backend link is down')
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
  if (String(name).startsWith('ask')) return 'hf'
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
  const [askLive, setAskLive] = useState(null)

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
          if (String(payload.name).startsWith('ask')) {
            setAskLive(payload.name)
            setLiveStage(payload.name)
            if (payload.status === 'done' && payload.name === 'ask-ai') {
              window.setTimeout(() => setAskLive(null), 4000)
            }
          } else {
            setLiveStage(payload.status === 'done' ? (STAGE_NEXT[payload.name] || payload.name) : payload.name)
          }
        }
        if (payload.type === 'snapshot') setLiveStage('snapshot')
        if (payload.type === 'stage' || payload.type === 'snapshot') load()
      } catch {
        // keepalive
      }
    }
    const askSource = new EventSource(`${NEWSINTEL}/api/pipeline/stream`)
    askSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data || '{}')
        if (payload.type === 'stage' && String(payload.name || '').startsWith('ask')) {
          setAskLive(payload.name)
          setLiveStage(payload.name)
          if (payload.status === 'done' && payload.name === 'ask-ai') {
            window.setTimeout(() => setAskLive(null), 4000)
          }
        }
      } catch {
        // keepalive
      }
    }
    const poll = setInterval(load, 12000)
    return () => {
      source.close()
      askSource.close()
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
  const flowing = latest?.status === 'running' || data?.lock || Boolean(askLive)
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
  const tanks = data?.tanks || {}
  const phase = currentPhase(latest, flowing, liveStage)
  useEffect(() => {
    if (!flowing && liveStage && liveStage !== 'snapshot') setLiveStage(null)
  }, [flowing, liveStage])

  return (
    <div className="scada">
      <LiveWorld />
      <aside className="rail">
        <div className="brand">
          <span className="drop" />
          <b>CURRENT</b>
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
            <h1>CURRENT — LIVE NEWS FLOW</h1>
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
          <div className={`board ${error ? 'fault' : flowing ? 'moving' : 'idle'} ${error ? '' : `flow-${phase}`} ${live && !error ? 'is-live' : ''}`}>
            <p className="hint">
              {phase === 'idle' ? 'Line closed. Only the desk feeds back to the backend. Force a run to open the valves.'
                : phase === 'fetch' ? 'Valves open. Crude is moving RSS → backend.'
                : phase === 'images' ? 'Image gate + validation.'
                : phase === 'dedupe' ? 'Deduping repeats.'
                : phase === 'hf' ? 'Ask / AI line: desk + web + model.'
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
                <Tank x="10%" y="50%" color="cyan" title="RSS / Field Feeds" status={phase === 'fetch' ? 'LIVE' : 'IDLE'} dropping={phase === 'fetch'} fault={Boolean(error)} tank={tanks.fetch} icon="wifi" onClick={() => openStage('fetch')} />
                <Tank x="26%" y="50%" color="gold" title="Backend Server" status="LIVE" dropping={phase === 'fetch' || phase === 'images'} fault={Boolean(error)} tank={tanks.backend} icon="server" onClick={() => openStage('backend')} />
                <Tank x="26%" y="78%" color="blue" title="Database" status="7 DAY HOLD" dropping={phase === 'images' || phase === 'snapshot'} fault={Boolean(error)} tank={tanks.database} icon="list" onClick={() => openStage('backend')} />
                <Tank x="43%" y="22%" color="violet" title="Image Gate" status={imageS === 'done' ? 'ACTIVE' : imageS.toUpperCase()} dropping={phase === 'images'} fault={Boolean(error)} tank={tanks.images} icon="funnel" small onClick={() => openStage('images')} />
                <Tank x="43%" y="50%" color="violet" title="Data Validation" status={imageS === 'done' ? 'ACTIVE' : imageS.toUpperCase()} dropping={phase === 'images'} fault={Boolean(error)} tank={tanks.images} icon="funnel" small onClick={() => openStage('validate')} />
                <Tank x="43%" y="78%" color="violet" title="Deduplication" status={dedupeS === 'done' ? 'ACTIVE' : dedupeS.toUpperCase()} dropping={phase === 'dedupe'} fault={Boolean(error)} tank={tanks.backend} icon="funnel" small onClick={() => openStage('dedupe')} />
                <Tank x="61%" y="36%" color="green" title="AI Model" status={hfFault ? 'FAULT' : (hf.stage === 'RUNNING' ? 'LIVE' : (hf.stage || 'STANDBY'))} dropping={phase === 'hf'} fault={hfFault || Boolean(error)} tank={tanks.hf} icon="brain" onClick={() => openStage('hf')} />
                <Mini x="61%" y="60%" label="Before AI" on={Boolean(counts.accepted)} onClick={() => openStage('pre_ai')} />
                <Mini x="61%" y="70%" label="After AI" on={counts.hf > 0 || counts.llm > 0} onClick={() => openStage('hf')} />
                <Mini x="61%" y="80%" label="Risk Assessment" on={sigS === 'done'} onClick={() => openStage('signals')} />
                <Tank x="77%" y="42%" color="amber" title="Ranking Engine" status={sigS === 'done' ? 'LIVE' : sigS.toUpperCase()} dropping={phase === 'signals'} fault={Boolean(error)} tank={tanks.signals} icon="trophy" onClick={() => openStage('signals')} />
                <Tank x="77%" y="72%" color="amber" title="Prioritized Insights" status={sigS === 'done' ? 'LIVE' : sigS.toUpperCase()} dropping={phase === 'signals'} fault={Boolean(error)} tank={tanks.signals} icon="list" small onClick={() => openStage('signals')} />
                <Tank x="92%" y="50%" color="blue" title="Dashboard / Frontend" status="LIVE" dropping={phase === 'snapshot'} fault={Boolean(error)} tank={tanks.signals} icon="monitor" onClick={() => openStage('frontend')} />
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
  { id: 'to-db', d: 'M 312 280 V 432', color: '#67e8f9', n: 3, dur: 1.4 },
  { id: 'loop', d: 'M 1104 300 C 1104 500 120 500 120 300', color: '#7dd3fc', n: 6, dur: 3.2 },
]

const FlowPipes = memo(function FlowPipes() {
  return (
    <svg className="pipes" viewBox="0 0 1200 560" preserveAspectRatio="none">
      <defs>
        <filter id="glow"><feGaussianBlur stdDeviation="3.6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <radialGradient id="dropGrad" cx="32%" cy="28%" r="78%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="38%" stopColor="#bae6fd" />
          <stop offset="72%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#0369a1" />
        </radialGradient>
        {SEGMENTS.map((seg) => (
          <path key={seg.id} id={`p-${seg.id}`} d={seg.d} fill="none" />
        ))}
      </defs>
      {SEGMENTS.map((seg) => (
        <path key={`${seg.id}-body`} d={seg.d} className={`pipe-body ${seg.id === 'loop' ? 'feedback' : ''} ${seg.id.startsWith('rss') || seg.id === 'back-valid' || seg.id === 'valid-ai' || seg.id === 'ai-rank' || seg.id === 'rank-desk' ? 'spine' : ''}`} />
      ))}
      {SEGMENTS.flatMap((seg) =>
        Array.from({ length: seg.n }, (_, i) => (
          <path key={`${seg.id}-${i}`} d="M0,-10 C4.6,-3 4.8,4.2 0,11 C-4.8,4.2 -4.6,-3 0,-10" fill="url(#dropGrad)" className={`packet packet-${seg.id}`} filter="url(#glow)">
            <animateMotion dur={`${seg.dur}s`} begin={`${(i * seg.dur) / seg.n}s`} repeatCount="indefinite" rotate="auto">
              <mpath href={`#p-${seg.id}`} />
            </animateMotion>
          </path>
        ))
      )}
      <Valve x="216" y="280" label="IN" />
      <Valve x="414" y="280" label="MID" />
      <Valve x="1014" y="280" label="OUT" />
    </svg>
  )
}, () => true)

function dayFill() {
  const now = new Date()
  return (now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds()) / 86400
}

function weekFill() {
  const now = new Date()
  const day = (now.getUTCDay() + 6) % 7
  return (day * 86400 + now.getUTCHours() * 3600 + now.getUTCMinutes() * 60) / (7 * 86400)
}

const MOTES = Array.from({ length: 22 }, (_, i) => ({
  left: `${(i * 53 + 7) % 100}%`,
  top: `${(i * 37 + 3) % 100}%`,
  s: 2 + (i % 6),
  d: `${-(i * 0.65)}s`,
  t: `${11 + (i % 9)}s`,
}))

const WORLD_BUBBLES = Array.from({ length: 16 }, (_, i) => ({
  left: `${3 + ((i * 17) % 94)}%`,
  s: 5 + (i % 9),
  d: `${-(i * 0.85)}s`,
  t: `${7 + (i % 8)}s`,
}))

function LiveWorld() {
  return (
    <div className="live-bg" aria-hidden="true">
      <div className="abyss" />
      <div className="glow-orb a" />
      <div className="glow-orb b" />
      <div className="glow-orb c" />
      <div className="surface-sheet" />
      <div className="caustic-field" />
      <div className="motes">
        {MOTES.map((mote, i) => (
          <i key={i} style={{ left: mote.left, top: mote.top, width: mote.s, height: mote.s, animationDelay: mote.d, animationDuration: mote.t }} />
        ))}
      </div>
      <div className="bg-bubbles">
        {WORLD_BUBBLES.map((bubble, i) => (
          <b key={i} style={{ left: bubble.left, width: bubble.s, height: bubble.s, animationDelay: bubble.d, animationDuration: bubble.t }} />
        ))}
      </div>
      <div className="vignette" />
    </div>
  )
}

function Tank({ x, y, color, title, status, dropping, fault, tank, icon, small, onClick }) {
  const accepted = Number(tank?.accepted || 0)
  const rejected = Number(tank?.rejected || 0)
  const total = accepted + rejected
  const ink = fault ? 0.72 : total ? rejected / total : 0
  const fill = Math.max(0.28, tank?.window === '7d' ? weekFill() : dayFill())
  return (
    <button
      type="button"
      className={`node tank ${color} ${fault ? 'fault' : ''} ${dropping ? 'dropping' : ''} ${small ? 'small' : ''}`}
      style={{ left: x, top: y, '--fill': fill, '--ink': ink }}
      onClick={onClick}
    >
      <div className="vessel" aria-hidden="true">
        <span className="lip" />
        <div className="glass">
          <span className="volume" />
          <span className="ink" />
          <span className="caustic" />
          <svg className="surf" viewBox="0 0 200 20" preserveAspectRatio="none">
            <path d="M0 10 Q 25 2 50 10 T 100 10 T 150 10 T 200 10 V20 H0 Z" />
            <path className="surf-b" d="M0 13 Q 25 7 50 13 T 100 13 T 150 13 T 200 13 V20 H0 Z" />
          </svg>
          <span className="sheen" />
          <span className="air"><i /><i /><i /><i /><i /></span>
          <span className="beads"><i /><i /><i /><i /><i /><i /></span>
          <span className="falls"><i /><i /><i /><i /><i /><i /></span>
          <span className="ripples"><i /><i /><i /></span>
        </div>
        <span className="foot" />
      </div>
      <div className="tank-ui">
        <div className="glyph">{icon === 'wifi' ? '◉' : icon === 'server' ? '▣' : icon === 'funnel' ? '▽' : icon === 'brain' ? '⌘' : icon === 'trophy' ? '▲' : icon === 'list' ? '☰' : '▣'}</div>
        <strong>{title}</strong>
        <em>{status}</em>
        <small>{tank?.window === '7d' ? '7 day cistern' : '24h cistern'}</small>
      </div>
      <div className="tip">
        <b>{title}</b>
        <span>Kept {accepted}</span>
        <span>Rejected {rejected}</span>
        <span>Window {tank?.window === '7d' ? '7 days' : 'today UTC'}</span>
        <span>Fill {Math.round(fill * 100)}%</span>
      </div>
    </button>
  )
}

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
