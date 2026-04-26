import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, X } from 'lucide-react';
import { api } from '../api';
import Sidebar from '../components/worldpulse/Sidebar';
import LockedNavToast from '../components/worldpulse/LockedNavToast';

const presets = [
  'What if oil prices spike 25% over the next 30 days?',
  'What if China-Taiwan tensions escalate in 30 days?',
  'What if AI regulation shocks semiconductor demand?',
  'What if recession risk rises sharply this quarter?',
];

export default function SimulatorPage() {
  const navigate = useNavigate();
  const [scenario, setScenario] = useState('');
  const [assumptions, setAssumptions] = useState({ time_horizon: '30d', severity: 'medium', market_reaction: 'medium' });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lockedToast, setLockedToast] = useState('');

  const run = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const response = await api.simulate({ scenario, assumptions });
      setResult(response.result);
    } catch (err) {
      setError((err?.message || 'Scenario failed.').replace(/^\d+:\s*/, '').slice(0, 220));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="world-pulse-page simulator-page">
      <Sidebar
        preferences={{ hasPreferences: false, topics: [], regions: [], entities: [] }}
        activeItem="simulator"
        onHome={() => navigate('/dashboard')}
        onOrbit={() => navigate('/orbit')}
        onMap={() => navigate('/map')}
        onSimulator={() => {}}
        onLocked={setLockedToast}
        onWatchlist={() => navigate('/watchlist')}
        onAlerts={() => navigate('/alerts')}
        onSetFocus={() => navigate('/onboarding')}
        onSettings={() => navigate('/settings')}
      />
      <main className="world-pulse-main simulator-main">
        <header className="orbit-header">
          <div>
            <div className="wp-kicker">Home / Scenario Simulator</div>
            <h1>Scenario Simulator</h1>
            <p>Scenario analysis using recent events, relationships, geo metadata, and AI reasoning.</p>
          </div>
        </header>
        <section className="simulator-layout">
          <div className="wp-card scenario-input-panel">
            <div className="wp-section-head"><span>Ask what might happen next</span></div>
            <textarea value={scenario} onChange={(event) => setScenario(event.target.value)} placeholder="What if..." />
            <div className="preset-row">{presets.map((item) => <button key={item} onClick={() => setScenario(item)}>{item.replace('What if ', '').replace('?', '')}</button>)}</div>
            <div className="orbit-controls sim-controls">
              <label>Time<select value={assumptions.time_horizon} onChange={(event) => setAssumptions({ ...assumptions, time_horizon: event.target.value })}><option value="7d">7d</option><option value="30d">30d</option><option value="90d">90d</option></select></label>
              <label>Severity<select value={assumptions.severity} onChange={(event) => setAssumptions({ ...assumptions, severity: event.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
              <label>Markets<select value={assumptions.market_reaction} onChange={(event) => setAssumptions({ ...assumptions, market_reaction: event.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
            </div>
            <button className="orbit-story-button run-scenario" onClick={run} disabled={loading || scenario.trim().length < 12}><Play size={16} /> {loading ? 'Running...' : 'Run Scenario'}</button>
          </div>
          <div className="wp-card scenario-result-panel">
            {loading && <div className="wp-loading"><span /></div>}
            {error && <div className="wp-error"><b>Scenario unavailable</b><span>{error}</span><button onClick={() => setError('')}><X size={14} /></button></div>}
            {!loading && !error && !result && <div className="orbit-empty"><h2>Ask what might happen next.</h2><p>No result is generated until the backend AI returns scenario JSON.</p></div>}
            {result && (
              <div className="scenario-result">
                <div className="scenario-score"><b>{result.impact_score}</b><span>impact</span><b>{result.confidence}</b><span>confidence</span></div>
                <p className="scenario-disclaimer">{result.disclaimer || 'Scenario analysis, not prediction.'}</p>
                <section><h3>Summary</h3><p>{result.summary}</p></section>
                <section><h3>Impact Areas</h3>{result.impact_areas?.map((item) => <div className="orbit-connection" key={item.area}><b>{item.area} · {item.score}</b><small>{item.direction}</small><p>{item.explanation}</p></div>)}</section>
                <section><h3>Chain Reaction</h3>{result.chain_reaction?.map((item) => <div className="orbit-connection" key={item.step}><b>{item.step}. {item.title}</b><p>{item.description}</p></div>)}</section>
                <section><h3>Possible Outcomes</h3>{result.possible_outcomes?.map((item) => <div className="orbit-connection" key={item.label}><b>{item.label} · {item.probability}%</b><p>{item.description}</p></div>)}</section>
                <section><h3>Recommended Actions</h3>{result.recommended_actions?.length ? result.recommended_actions.map((item) => <p key={item}>{item}</p>) : <p className="empty-copy">No actions returned.</p>}</section>
              </div>
            )}
          </div>
        </section>
      </main>
      <LockedNavToast message={lockedToast} />
    </div>
  );
}
