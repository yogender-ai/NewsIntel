import { useCallback, useEffect, useMemo, useState } from 'react'

const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const STAGES = [
  { id: 'fetch', label: 'WELLHEAD', sub: 'RSS intake' },
  { id: 'images', label: 'SEPARATOR', sub: 'image gate' },
  { id: 'dedupe', label: 'STILL', sub: 'dedupe crude' },
  { id: 'hf', label: 'TREATER', sub: 'NER + sentiment' },
  { id: 'llm', label: 'CRACKER', sub: 'LLM refine' },
  { id: 'signals', label: 'BLEND', sub: 'pulse score' },
  { id: 'snapshot', label: 'TANK FARM', sub: 'snapshot' },
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
    const poll = setInterval(load, 4000)
    const tick = setInterval(() => setClock(new Date()), 1000)
    return () => {
      clearInterval(poll)
      clearInterval(tick)
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

  const pressure = useMemo(() => {
    if (!stats.fetched) return 12
    return Math.min(96, Math.round((stats.signals || 0) / Math.max(stats.fetched, 1) * 100) + 20)
  }, [stats])

  return (
    <div className={`yard ${flowing ? 'flowing' : ''}`}>
      <div className="flare" />
      <header className="top">
        <div>
          <p className="eyebrow">NEWSINTEL // CRUDE LINE</p>
          <h1>Oil pipeline</h1>
          <p className="lede">Live intake from wellhead to tank farm. This site is only the line — not the news desk.</p>
        </div>
        <div className="top-right">
          <div className="readout">
            <span>UTC {clock.toISOString().slice(11, 19)}</span>
            <b className={data?.circuit_ai ? 'bad' : 'ok'}>{data?.circuit_ai ? 'AI CIRCUIT OPEN' : 'CIRCUIT CLOSED'}</b>
            <b>{data?.lock ? 'VALVE LOCKED' : 'VALVE OPEN'}</b>
            <b>{data?.cooldown ? 'COOLING' : 'READY'}</b>
          </div>
          <button disabled={busy} onClick={kick}>{busy ? 'Opening valve…' : 'Force a run'}</button>
        </div>
      </header>

      {error && <div className="banner">{error}</div>}

      <section className="gauges">
        <Gauge label="Fetched" value={stats.fetched ?? '—'} />
        <Gauge label="Image pass" value={stats.accepted ?? '—'} />
        <Gauge label="Rejected" value={stats.rejected_no_image ?? '—'} />
        <Gauge label="Signals" value={stats.signals ?? '—'} />
        <Gauge label="Line pressure" value={`${pressure}%`} hot />
        <Gauge label="Last status" value={(latest?.status || 'idle').toUpperCase()} />
      </section>

      <section className="line">
        {STAGES.map((stage, index) => {
          const state = stageState(latest, stage.id, index)
          const found = (latest?.stages || []).find((s) => s.name === stage.id) || {}
          const counts = found.counts || {}
          return (
            <div key={stage.id} className={`unit ${state}`}>
              {index > 0 && <div className="pipe"><i /></div>}
              <div className="tower">
                <div className="flame" />
                <div className="tank">
                  <span className="level" />
                </div>
                <strong>{stage.label}</strong>
                <small>{stage.sub}</small>
                <em>{found.elapsed_ms ? `${found.elapsed_ms} ms` : state === 'live' ? 'flowing' : 'standby'}</em>
                <p>{Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(' · ') || 'no cut yet'}</p>
              </div>
            </div>
          )
        })}
      </section>

      <section className="log">
        <h2>Run tickets</h2>
        <div className="tickets">
          {(data?.recent || []).length === 0 && <p className="empty">No crude has moved yet. Force a run or wait for the hourly pump.</p>}
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
