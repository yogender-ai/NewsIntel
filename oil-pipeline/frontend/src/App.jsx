import { useCallback, useEffect, useState } from 'react'

const API = (import.meta.env.VITE_API_URL || 'https://oil-pipeline.onrender.com').replace(/\/$/, '')
const STAGES = [
  { id: 'fetch', label: 'INGEST', sub: 'RSS intake' },
  { id: 'images', label: 'IMAGE GATE', sub: 'keep only imaged news' },
  { id: 'dedupe', label: 'DEDUPE', sub: 'drop repeats' },
  { id: 'hf', label: 'NER + SENTIMENT', sub: 'Hugging Face' },
  { id: 'llm', label: 'LLM INTEL', sub: 'title + why it matters' },
  { id: 'signals', label: 'SIGNALS', sub: 'pulse score' },
  { id: 'snapshot', label: 'SNAPSHOT', sub: 'push to the desk' },
]

async function getJson(path, opts) {
  const res = await fetch(`${API}${path}`, opts)
  if (!res.ok && res.status !== 202) throw new Error(`${res.status} ${await res.text()}`)
  return res.json()
}

function stageState(latest, id, index) {
  const stages = latest?.stages || []
  const found = stages.find((s) => s.name === id)
  if (found?.finished_at || found?.counts) return 'hot'
  if (latest?.status === 'running' && index === stages.length) return 'live'
  if (latest?.status === 'running') return 'idle'
  if (latest) return 'done'
  return 'idle'
}

export default function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [clock, setClock] = useState(() => new Date())
  const [live, setLive] = useState(false)
  const [events, setEvents] = useState([])

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
        setEvents((current) => [{ at: payload.at, type: payload.type, name: payload.name, status: payload.status, counts: payload.counts }, ...current].slice(0, 12))
        if (payload.type === 'stage' || payload.type === 'snapshot') load()
      } catch {
        // ignore keepalive
      }
    }
    const poll = setInterval(load, 15000)
    return () => {
      source.close()
      clearInterval(poll)
    }
  }, [load])

  const kick = async () => {
    setBusy(true)
    try {
      const secret = import.meta.env.VITE_INGEST_SECRET || ''
      await getJson('/api/admin/ingest-now?force=1', {
        method: 'POST',
        headers: secret ? { 'X-Ingest-Secret': secret } : {},
      })
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

  return (
    <div className="shell">
      <header className="top">
        <div>
          <p className="eyebrow">NEWSINTEL // LIVE LINE</p>
          <h1>Oil pipeline</h1>
          <p className="lede">
            Watch a story move from RSS to the NewsIntel desk in real time.
            Cards without images never leave the gate.
          </p>
        </div>
        <div className="top-right">
          <div className="readout">
            <span className="pill">UTC {clock.toISOString().slice(11, 19)}</span>
            <b className={`pill ${live ? 'live' : ''}`}>{live ? 'STREAM LIVE' : 'RECONNECTING'}</b>
            <b className={`pill ${data?.circuit_ai ? 'bad' : 'ok'}`}>{data?.circuit_ai ? 'AI OPEN' : 'AI READY'}</b>
            <b className="pill">{data?.lock || flowing ? 'RUNNING' : 'IDLE'}</b>
          </div>
          <button disabled={busy} onClick={kick}>{busy ? 'Starting…' : 'Force a run'}</button>
        </div>
      </header>

      {error && <div className="banner">{error}</div>}

      <section className="gauges">
        <Gauge label="Fetched" value={stats.fetched ?? '—'} />
        <Gauge label="Image pass" value={stats.accepted ?? '—'} hot />
        <Gauge label="Rejected" value={stats.rejected_no_image ?? '—'} />
        <Gauge label="Signals" value={stats.signals ?? '—'} />
        <Gauge label="HF ok" value={stats.hf_ok ?? '—'} />
        <Gauge label="Last status" value={(latest?.status || 'idle').toUpperCase()} />
      </section>

      <section className="line">
        {STAGES.map((stage, index) => {
          const state = stageState(latest, stage.id, index)
          const found = (latest?.stages || []).find((s) => s.name === stage.id) || {}
          const counts = found.counts || {}
          return (
            <div key={stage.id} className={`unit ${state}`}>
              <div className="dot" />
              <strong>{stage.label}</strong>
              <small>{stage.sub}</small>
              <em>{found.elapsed_ms ? `${found.elapsed_ms} ms` : state === 'live' ? 'running' : 'standby'}</em>
              <p>{Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(' · ') || 'waiting'}</p>
            </div>
          )
        })}
      </section>

      <section className="log">
        <h2>Recent runs</h2>
        <div className="tickets">
          {(data?.recent || []).length === 0 && <p className="empty">No run yet. Force one or wait for the hourly tick.</p>}
          {(data?.recent || []).map((run) => (
            <article key={run.id}>
              <header>
                <b>{run.status}</b>
                <span>{run.trigger}</span>
              </header>
              <p>
                fetched {run.stats?.fetched ?? '—'} · kept {run.stats?.accepted ?? '—'} ·
                rejected {run.stats?.rejected_no_image ?? '—'} · signals {run.stats?.signals ?? '—'}
              </p>
              <small>{run.started_at}{run.elapsed_ms != null ? ` · ${run.elapsed_ms}ms` : ''}</small>
            </article>
          ))}
        </div>
        <ul className="events">
          {events.length === 0 && <li>Waiting for live stage events…</li>}
          {events.map((item, index) => (
            <li key={`${item.at}-${index}`}>
              <b>{item.type}</b> {item.name || ''} {item.status || ''} {item.counts ? JSON.stringify(item.counts) : ''}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function Gauge({ label, value, hot }) {
  return (
    <div className={`gauge ${hot ? 'hot' : ''}`}>
      <small>{label}</small>
      <b>{value}</b>
    </div>
  )
}
