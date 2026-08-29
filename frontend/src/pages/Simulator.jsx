import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Play } from 'lucide-react';
import { api } from '../lib/api';
import { topicLabel } from '../lib/taxonomy';
import { ErrorState } from '../components/States';

const MODES = [
  { id: 'escalation', label: 'Escalates', hint: 'The situation intensifies' },
  { id: 'policy', label: 'Policy response', hint: 'Regulators or governments act' },
  { id: 'confidence', label: 'Confidence shock', hint: 'Markets or public trust move' },
];

const HORIZONS = ['7d', '30d', '90d'];
const SEVERITY = ['low', 'medium', 'high'];

function seedPrompt(card, mode) {
  const subject = card?.title || 'this signal';
  if (mode === 'policy') return `What if "${subject}" triggers a policy response in 30 days?`;
  if (mode === 'confidence') return `What if "${subject}" creates a confidence shock in 30 days?`;
  return `What if "${subject}" escalates in 30 days?`;
}

function Meter({ value, label }) {
  const score = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="meter">
      <div className="meter-track" role="img" aria-label={`${label}: ${score} out of 100`}>
        <div className="meter-fill" style={{ width: `${score}%` }} />
      </div>
      <div className="row spread">
        <small className="hint">{label}</small>
        <b className="mono">{score}</b>
      </div>
    </div>
  );
}

const DIRECTION_CLASS = { up: 'tag-critical', down: 'tag-calm', flat: 'tag-neutral' };

export default function Simulator() {
  const [seeds, setSeeds] = useState([]);
  const [scenario, setScenario] = useState('');
  const [mode, setMode] = useState('escalation');
  const [horizon, setHorizon] = useState('30d');
  const [severity, setSeverity] = useState('medium');
  const [picked, setPicked] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.snapshot().then(
      (d) => { if (!cancelled) setSeeds((d?.feed || []).slice(0, 4)); },
      () => {},
    );
    return () => { cancelled = true; };
  }, []);

  const pick = (card) => {
    setPicked(card.id);
    setScenario(seedPrompt(card, mode));
  };

  const run = async () => {
    const text = scenario.trim();
    if (text.length < 8) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await api.simulate(text, {
        time_horizon: horizon, severity, market_reaction: severity,
      }, picked));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const parsed = useMemo(() => result?.result || {}, [result]);
  const areas = useMemo(() => parsed.impact_areas || [], [parsed]);

  return (
    <div className="page page-narrow">
      <header className="page-head">
        <div>
          <h1>What if…</h1>
          <p className="page-sub">
            Describe something that might happen. NewsIntel checks it against stories
            it has actually indexed, plus web background, and estimates what would move —
            with the sources it used.
          </p>
        </div>
      </header>

      {seeds.length > 0 && (
        <section className="card settings-block">
          <h2>Start from today’s news</h2>
          <p className="hint">Pick a story to base the scenario on, or write your own below.</p>
          <div className="chip-row" style={{ marginTop: 12 }}>
            {seeds.map((card) => (
              <button
                key={card.id} className="chip chip-lg" aria-pressed={picked === card.id}
                onClick={() => pick(card)}
              >
                <span className="chip-lg-text">
                  <strong>{card.title.slice(0, 58)}{card.title.length > 58 ? '…' : ''}</strong>
                  <small>{topicLabel(card.category)}</small>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="card settings-block">
        <label className="label" htmlFor="scenario">The scenario</label>
        <textarea
          id="scenario" className="textarea" value={scenario}
          placeholder="What if shipping through the Red Sea stays disrupted through the year?"
          onChange={(e) => setScenario(e.target.value)}
        />

        <div className="form-grid" style={{ marginTop: 14 }}>
          <div>
            <span className="label">Assume it…</span>
            <div className="chip-row">
              {MODES.map((m) => (
                <button key={m.id} className="chip chip-sm" aria-pressed={mode === m.id}
                  title={m.hint}
                  onClick={() => { setMode(m.id); if (picked) { const c = seeds.find((s) => s.id === picked); if (c) setScenario(seedPrompt(c, m.id)); } }}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="label">Over</span>
            <div className="chip-row">
              {HORIZONS.map((h) => (
                <button key={h} className="chip chip-sm" aria-pressed={horizon === h} onClick={() => setHorizon(h)}>{h}</button>
              ))}
            </div>
          </div>
          <div>
            <span className="label">Severity</span>
            <div className="chip-row">
              {SEVERITY.map((s) => (
                <button key={s} className="chip chip-sm" aria-pressed={severity === s} onClick={() => setSeverity(s)}>{s}</button>
              ))}
            </div>
          </div>
        </div>

        <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={run}
          disabled={busy || scenario.trim().length < 8}>
          <Play size={15} aria-hidden="true" /> {busy ? 'Working through it…' : 'Run scenario'}
        </button>
      </section>

      {error && <ErrorState error={error} onRetry={run} title="Couldn’t run that scenario" />}

      {result && (
        <>
          <section className="answer card">
            <p className="answer-text">{parsed.summary}</p>
            <div className="form-grid" style={{ marginTop: 18 }}>
              <Meter value={parsed.impact_score} label="Estimated impact" />
              <Meter value={parsed.confidence} label="Confidence in this read" />
            </div>
            <p className="hint" style={{ marginTop: 12, marginBottom: 0 }}>
              Based on {result.desk_count ?? 0} indexed {result.desk_count === 1 ? 'story' : 'stories'}
              {result.web_count ? ` and ${result.web_count} web sources` : ''}. Low confidence
              usually means thin coverage, not that the scenario is unlikely.
            </p>
          </section>

          {areas.length > 0 && (
            <section>
              <h2 className="sources-head">What would move</h2>
              {areas.map((a, i) => (
                <article className="card source" key={i}>
                  <div className="row spread gap-2 wrap">
                    <strong>{a.area}</strong>
                    <span className="row gap-2">
                      <span className={`tag ${DIRECTION_CLASS[a.direction] || 'tag-neutral'}`}>
                        {a.direction || 'unclear'}
                      </span>
                      <span className="mono hint">{a.score}</span>
                    </span>
                  </div>
                  <p className="hint" style={{ margin: '8px 0 0' }}>{a.explanation}</p>
                </article>
              ))}
            </section>
          )}

          {result.sources?.length > 0 && (
            <section>
              <h2 className="sources-head">Sources <span className="hint">({result.sources.length})</span></h2>
              {result.sources.map((s, i) => (
                <article className="card source" key={i}>
                  <div className="row spread gap-2 wrap">
                    <span className={`tag ${s.origin === 'web' ? 'tag-neutral' : 'tag-watch'}`}>
                      {s.origin === 'web' ? 'web background' : 'indexed story'}
                    </span>
                    {s.url && (
                      <a className="btn btn-sm" href={s.url} target="_blank" rel="noopener noreferrer">
                        Open <ExternalLink size={12} aria-hidden="true" />
                      </a>
                    )}
                  </div>
                  <h3 className="source-title">{s.title}</h3>
                </article>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
