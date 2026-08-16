import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, X } from 'lucide-react'
import { api } from '../api'
import Sidebar from '../components/worldpulse/Sidebar'
import LockedNavToast from '../components/worldpulse/LockedNavToast'
import { normalizeDashboardData } from '../lib/dashboardAdapter'

const MODES = [
  { id: 'escalation', label: 'Escalate' },
  { id: 'policy', label: 'Policy' },
  { id: 'confidence', label: 'Shock' },
]

function seedPrompt(shift, mode) {
  const subject = shift.headline || shift.title || 'this signal'
  if (mode === 'policy') return `What if "${subject}" triggers a policy response in 30 days?`
  if (mode === 'confidence') return `What if "${subject}" creates a confidence shock in 30 days?`
  return `What if "${subject}" escalates in 30 days?`
}

function Ring({ value, label }) {
  const score = Math.max(0, Math.min(100, Number(value) || 0))
  const r = 42
  const c = 2 * Math.PI * r
  const dash = (score / 100) * c
  return (
    <div className="simx-ring">
      <svg viewBox="0 0 108 108">
        <circle cx="54" cy="54" r={r} className="track" />
        <circle cx="54" cy="54" r={r} className="fill" strokeDasharray={`${dash} ${c}`} />
      </svg>
      <b>{score}</b>
      <small>{label}</small>
    </div>
  )
}

export default function SimulatorPage() {
  const navigate = useNavigate()
  const [scenario, setScenario] = useState('')
  const [mode, setMode] = useState('escalation')
  const [assumptions, setAssumptions] = useState({ time_horizon: '30d', severity: 'medium', market_reaction: 'medium' })
  const [dashboard, setDashboard] = useState(null)
  const [result, setResult] = useState(null)
  const [runMeta, setRunMeta] = useState(null)
  const [evidence, setEvidence] = useState([])
  const [selectedSeed, setSelectedSeed] = useState(null)
  const [loading, setLoading] = useState(false)
  const [phase, setPhase] = useState('')
  const [contextError, setContextError] = useState('')
  const [error, setError] = useState('')
  const [lockedToast, setLockedToast] = useState('')
  const [openDetail, setOpenDetail] = useState(null)

  useEffect(() => {
    api.getCachedDashboard()
      .then(setDashboard)
      .catch((err) => setContextError((err?.message || 'No live seeds').replace(/^\d+:\s*/, '').slice(0, 140)))
  }, [])

  const normalized = useMemo(() => normalizeDashboardData({ dashboard, preferences: null, alerts: null, user: null }), [dashboard])
  const seeds = useMemo(() => normalized.topShifts.slice(0, 4), [normalized.topShifts])

  const pick = (shift) => {
    setSelectedSeed(shift)
    setScenario(seedPrompt(shift, mode))
  }

  const run = async () => {
    const text = scenario.trim()
    if (text.length < 8) return
    setLoading(true)
    setError('')
    setResult(null)
    setEvidence([])
    setPhase('desk')
    const tick = window.setTimeout(() => setPhase('web'), 400)
    const tick2 = window.setTimeout(() => setPhase('model'), 900)
    try {
      const response = await api.simulate({
        scenario: text,
        base_event_id: selectedSeed?.id || null,
        assumptions: { ...assumptions, mode, seed_headline: selectedSeed?.headline || null },
      })
      setResult(response.result)
      setEvidence(Array.isArray(response.sources) ? response.sources : [])
      setRunMeta({
        deskCount: response.desk_count ?? 0,
        webCount: response.web_count ?? 0,
      })
    } catch (err) {
      setError((err?.message || 'Scenario failed.').replace(/^\d+:\s*/, '').slice(0, 180))
    } finally {
      window.clearTimeout(tick)
      window.clearTimeout(tick2)
      setPhase('')
      setLoading(false)
    }
  }

  const outcomes = result?.possible_outcomes || []
  const cites = (result?.citations?.length ? result.citations : evidence).slice(0, 8)

  return (
    <div className="world-pulse-page simulator-page simx">
      <Sidebar
        preferences={{ hasPreferences: Boolean(normalized.preferences?.topics?.length), topics: normalized.preferences?.topics || [], regions: normalized.preferences?.regions || [], entities: [] }}
        activeItem="simulator"
        onHome={() => navigate('/dashboard')}
        onOrbit={() => navigate('/orbit')}
        onStories={() => navigate('/stories')}
        onMap={() => navigate('/map')}
        onSimulator={() => {}}
        onLocked={setLockedToast}
        onWatchlist={() => navigate('/watchlist')}
        onAlerts={() => navigate('/alerts')}
        onSetFocus={() => navigate('/onboarding')}
        onSettings={() => navigate('/settings')}
      />
      <main className="world-pulse-main simulator-main">
        <header className="simx-head">
          <div>
            <h1>What if</h1>
            <p>Tap a live signal. Watch impact. Current lights up while it runs.</p>
          </div>
          <a className="simx-current" href="https://oil-pipeline.vercel.app" target="_blank" rel="noreferrer">Open Current</a>
        </header>

        <section className="simx-launch">
          <div className="simx-modes">
            {MODES.map((item) => (
              <button key={item.id} type="button" className={mode === item.id ? 'on' : ''} onClick={() => {
                setMode(item.id)
                if (selectedSeed) setScenario(seedPrompt(selectedSeed, item.id))
              }}>{item.label}</button>
            ))}
          </div>
          <div className="simx-seeds">
            {contextError && <span className="simx-warn">{contextError}</span>}
            {seeds.map((shift) => (
              <button key={shift.id} type="button" className={selectedSeed?.id === shift.id ? 'on' : ''} onClick={() => pick(shift)}>
                <em>{shift.category || 'LIVE'}</em>
                <b>{shift.headline}</b>
                <i>{Number.isFinite(Number(shift.pulse)) ? Math.round(Number(shift.pulse)) : '—'}</i>
              </button>
            ))}
          </div>
          <div className="simx-go">
            <input
              value={scenario}
              onChange={(event) => { setScenario(event.target.value); setSelectedSeed(null) }}
              placeholder="Or type a what-if…"
              onKeyDown={(event) => { if (event.key === 'Enter') run() }}
            />
            <div className="simx-dials">
              {[['7d', '30d', '90d'], ['low', 'medium', 'high'], ['low', 'medium', 'high']].map((opts, idx) => {
                const keys = ['time_horizon', 'severity', 'market_reaction']
                const labels = ['Horizon', 'Heat', 'Market']
                const key = keys[idx]
                return (
                  <label key={key}>
                    <span>{labels[idx]}</span>
                    <select value={assumptions[key]} onChange={(event) => setAssumptions({ ...assumptions, [key]: event.target.value })}>
                      {opts.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </label>
                )
              })}
            </div>
            <button type="button" className="simx-run" onClick={run} disabled={loading || scenario.trim().length < 8}>
              <Play size={16} /> {loading ? 'Live' : 'Run'}
            </button>
          </div>
        </section>

        {loading && (
          <ol className="simx-pipe">
            <li className={phase === 'desk' || phase === 'web' || phase === 'model' ? 'on' : ''}>Desk</li>
            <li className={phase === 'web' || phase === 'model' ? 'on' : ''}>Web</li>
            <li className={phase === 'model' ? 'on' : ''}>Model</li>
          </ol>
        )}
        {error && <div className="simx-error">{error} <button type="button" onClick={() => setError('')}><X size={14} /></button></div>}

        {!result && !loading && (
          <div className="simx-idle">
            <span>No walls of text. Pick a story and read the board.</span>
          </div>
        )}

        {result && (
          <section className="simx-board">
            <div className="simx-gauges">
              <Ring value={result.impact_score} label="Impact" />
              <Ring value={result.confidence} label="Proof" />
              <p className="simx-blurb">{(result.summary || '').split('. ')[0]}.</p>
            </div>

            <div className="simx-areas">
              {(result.impact_areas || []).map((item) => {
                const score = Math.max(0, Math.min(100, Number(item.score) || 0))
                return (
                  <button type="button" key={item.area} className="simx-area" onClick={() => setOpenDetail(openDetail === item.area ? null : item.area)} title={item.explanation}>
                    <span>{item.area}</span>
                    <b>{score}</b>
                    <i style={{ width: `${score}%` }} />
                    {openDetail === item.area && <em>{item.explanation}</em>}
                  </button>
                )
              })}
            </div>

            <div className="simx-chain">
              {(result.chain_reaction || []).map((item, index) => (
                <div key={item.step || index} className="simx-step">
                  <i>{item.step || index + 1}</i>
                  <b>{item.title}</b>
                </div>
              ))}
            </div>

            <div className="simx-mix">
              {outcomes.map((item) => (
                <div key={item.label} className="simx-out" style={{ flex: Math.max(8, Number(item.probability) || 1) }} title={item.description}>
                  <b>{item.probability}%</b>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>

            <div className="simx-chips">
              {cites.map((item, index) => (
                item.url
                  ? <a key={`${item.url}-${index}`} href={item.url} target="_blank" rel="noreferrer" className={item.origin === 'web' ? 'web' : 'desk'}>{item.origin === 'web' ? 'WEB' : 'DESK'} {item.title}</a>
                  : <span key={`${item.title}-${index}`} className={item.origin === 'web' ? 'web' : 'desk'}>{item.origin === 'web' ? 'WEB' : 'DESK'} {item.title}</span>
              ))}
              {runMeta && <small>{runMeta.deskCount} desk · {runMeta.webCount} web</small>}
            </div>

            {(result.desk_impact || []).length > 0 && (
              <div className="simx-moves">
                {result.desk_impact.map((item) => (
                  <span key={item.signal_id}><b>{item.effect}</b> {item.title}</span>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
      <LockedNavToast message={lockedToast} />
    </div>
  )
}
