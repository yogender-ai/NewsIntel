import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, RefreshCw } from 'lucide-react';
import { api } from '../api';
import Sidebar from '../components/worldpulse/Sidebar';
import LockedNavToast from '../components/worldpulse/LockedNavToast';

const STAGE_ORDER = ['fetch', 'images', 'dedupe', 'hf', 'llm', 'signals', 'snapshot'];

export default function PipelinePage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [lockedToast, setLockedToast] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await api.getPipelineMonitor());
      setError('');
    } catch (err) {
      setError((err?.message || 'Monitor unavailable').slice(0, 180));
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 8000);
    return () => window.clearInterval(timer);
  }, [load]);

  const latest = data?.latest;
  const stageMap = Object.fromEntries((latest?.stages || []).map((stage) => [stage.name, stage]));

  return (
    <div className="world-pulse-page">
      <Sidebar
        activeItem="pipeline"
        onHome={() => navigate('/dashboard')}
        onOrbit={() => navigate('/orbit')}
        onStories={() => navigate('/stories')}
        onMap={() => navigate('/map')}
        onSimulator={() => navigate('/simulator')}
        onPipeline={() => navigate('/pipeline')}
        onLocked={setLockedToast}
        onWatchlist={() => navigate('/watchlist')}
        onAlerts={() => navigate('/alerts')}
        onSettings={() => navigate('/settings')}
      />
      <main className="world-pulse-main">
        <header className="ni-screen-header">
          <div>
            <h1>Pipeline</h1>
            <p>Live ingest health — fetch to snapshot, with counts and time per stage.</p>
          </div>
          <button className="wp-icon-btn" onClick={load}><RefreshCw size={16} /> Refresh</button>
        </header>

        {error && <div className="wp-error"><b>Monitor unavailable</b><span>{error}</span></div>}

        <section className="pipeline-status-row">
          <article className="wp-card"><small>Lock</small><b>{data?.lock ? 'HELD' : 'OPEN'}</b></article>
          <article className="wp-card"><small>Cooldown</small><b>{data?.cooldown ? 'HOT' : 'COLD'}</b></article>
          <article className="wp-card"><small>AI circuit</small><b>{data?.circuit_ai ? 'OPEN' : 'OK'}</b></article>
          <article className="wp-card"><small>Latest</small><b>{latest?.status || '—'}</b></article>
        </section>

        <section className="pipeline-rail wp-card">
          {STAGE_ORDER.map((id, index) => {
            const stage = stageMap[id] || {};
            const counts = stage.counts || {};
            const live = latest?.status === 'running' && !stage.finished_at && (index === 0 || stageMap[STAGE_ORDER[index - 1]]?.finished_at);
            return (
              <div key={id} className={`pipeline-node ${stage.finished_at ? 'done' : ''} ${live ? 'live' : ''}`}>
                <i />
                <strong>{id}</strong>
                <span>{stage.elapsed_ms ? `${stage.elapsed_ms}ms` : live ? 'running' : 'idle'}</span>
                <small>{Object.entries(counts).map(([key, value]) => `${key} ${value}`).join(' · ') || '—'}</small>
              </div>
            );
          })}
        </section>

        <section className="pipeline-runs">
          {(data?.recent || []).map((run) => (
            <article className="wp-card" key={run.id}>
              <div className="story-tile-top">
                <span>{run.trigger}</span>
                <b>{run.status}</b>
              </div>
              <p>
                fetched {run.stats?.fetched ?? '—'} · images in {run.stats?.accepted ?? '—'} ·
                rejected {run.stats?.rejected_no_image ?? '—'} · signals {run.stats?.signals ?? '—'}
              </p>
              <small>{run.started_at} {run.elapsed_ms != null ? `· ${run.elapsed_ms}ms` : ''}</small>
            </article>
          ))}
        </section>
      </main>
      <LockedNavToast message={lockedToast} />
    </div>
  );
}
