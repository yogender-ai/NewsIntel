import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import Explain from '../components/Explain';
import { ErrorState, Loading } from '../components/States';

/* Plain-language description of every stage, so the pipeline reads as a story
   rather than seven opaque lozenges. */
const STAGES = [
  { id: 'fetch', label: 'Collect', copy: 'Pull the latest items from every RSS feed we follow.' },
  { id: 'images', label: 'Image gate', copy: 'Drop items with no usable image — they read badly as cards.' },
  { id: 'dedupe', label: 'Deduplicate', copy: 'Remove stories we already have, matching on URL and near-identical titles.' },
  { id: 'hf', label: 'Extract', copy: 'Pull out named entities and sentiment from each article.' },
  { id: 'llm', label: 'Interpret', copy: 'The language model writes the summary, the “why it matters”, and an importance score.' },
  { id: 'rag_index', label: 'Index for search', copy: 'Split each story into passages and embed them so Ask can retrieve them.' },
  { id: 'snapshot', label: 'Publish', copy: 'Write the cached snapshot the dashboard reads.' },
];

function fmt(ms) {
  if (ms == null) return '—';
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export default function Pipeline() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    try {
      setData(await api.pipelineMonitor());
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const tick = () => api.pipelineMonitor().then(
      (next) => { if (!cancelled) { setData(next); setError(null); setBusy(false); } },
      (err) => { if (!cancelled) { setError(err); setBusy(false); } },
    );
    tick();
    const timer = setInterval(tick, 10000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  const latest = data?.latest;
  const stageMap = Object.fromEntries((latest?.stages || []).map((s) => [s.name, s]));
  const runTotal = (latest?.stages || []).reduce((sum, s) => sum + (s.elapsed_ms || 0), 0);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Pipeline</h1>
          <p className="page-sub">
            Every step between a publisher’s feed and the story on your dashboard —
            with real timings and counts, including what got thrown away.
          </p>
        </div>
        <button className="btn btn-sm" onClick={load}>
          <RefreshCw size={14} aria-hidden="true" /> Refresh
        </button>
      </header>

      {busy && !data && <Loading label="Loading pipeline status" />}
      {error && <ErrorState error={error} onRetry={load} title="Monitor unavailable" />}

      {data && (
        <>
          <section className="status-row">
            <div className="status card">
              <small>Last run</small>
              <b className={`status-${latest?.status || 'none'}`}>{latest?.status || 'never run'}</b>
              <span className="hint">{latest?.trigger ? `triggered by ${latest.trigger}` : ''}</span>
            </div>
            <div className="status card">
              <small>Total time</small>
              <b className="mono">{fmt(runTotal)}</b>
              <span className="hint">across all stages</span>
            </div>
            <div className="status card">
              <small>Stories published</small>
              <b className="mono">{latest?.stats?.signals ?? '—'}</b>
              <span className="hint">from {latest?.stats?.fetched ?? '—'} collected</span>
            </div>
            <div className="status card">
              <small>Ingest lock</small>
              <b>{data.lock ? 'held' : 'open'}</b>
              <span className="hint">{data.cooldown ? 'cooling down' : 'ready'}</span>
            </div>
          </section>

          {latest?.error && (
            <div className="notice notice-error card" role="alert">
              <strong>The last run failed.</strong>
              <p className="mono hint" style={{ margin: 0 }}>{latest.error}</p>
            </div>
          )}

          <section className="stages">
            {STAGES.map((stage, i) => {
              const s = stageMap[stage.id];
              const done = Boolean(s?.finished_at || s?.counts);
              const counts = s?.counts || {};
              const failed = counts.error;
              return (
                <div key={stage.id} className={`stage card ${done ? 'is-done' : 'is-pending'} ${failed ? 'is-failed' : ''}`}>
                  <div className="stage-rail" aria-hidden="true">
                    <span className="stage-dot">{i + 1}</span>
                    {i < STAGES.length - 1 && <span className="stage-line" />}
                  </div>
                  <div className="grow">
                    <div className="row spread gap-3 wrap">
                      <strong>{stage.label}</strong>
                      <span className="mono hint">{done ? fmt(s?.elapsed_ms) : 'not run'}</span>
                    </div>
                    <p className="hint stage-copy">{stage.copy}</p>
                    {done && Object.keys(counts).length > 0 && (
                      <div className="trace-facts">
                        {Object.entries(counts).map(([k, v]) => (
                          <span key={k} className={`fact mono ${k === 'error' ? 'fact-error' : ''}`}>
                            {k.replace(/_/g, ' ')}: <b>{String(v)}</b>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </section>

          {data.recent?.length > 0 && (
            <section>
              <h2 className="sources-head">Recent runs</h2>
              <div className="runs">
                {data.recent.map((run) => (
                  <div className="run card" key={run.id}>
                    <div className="row spread gap-2 wrap">
                      <span className={`tag status-tag-${run.status}`}>{run.status}</span>
                      <span className="hint mono">{fmt(run.elapsed_ms)}</span>
                    </div>
                    <div className="hint mono run-stats">
                      collected {run.stats?.fetched ?? '—'} · kept {run.stats?.deduped ?? '—'} ·
                      published {run.stats?.signals ?? '—'} · indexed {run.stats?.rag_chunks ?? '—'}
                    </div>
                    <span className="hint">
                      {run.started_at ? new Date(run.started_at).toLocaleString() : ''} · {run.trigger}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
