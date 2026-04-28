import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Filter, Globe2, Layers, RefreshCw, ShieldAlert, Sparkles, X } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/worldpulse/Sidebar';
import LockedNavToast from '../components/worldpulse/LockedNavToast';
import WorldMap from '../components/worldpulse/WorldMap';
import { compactLabel } from '../lib/dashboardAdapter';

function colorFor(region, mode) {
  if (mode === 'opportunity' || region.opportunity === 'high') return '#45e5a8';
  if (region.risk === 'high') return '#ff4d5f';
  if (region.risk === 'medium') return '#ff9f2e';
  return '#5b7cfa';
}

function MapStats({ regions }) {
  const rows = [
    { label: 'High Impact', value: regions.filter((region) => region.risk === 'high').length, icon: ShieldAlert, color: '#ff4d5f' },
    { label: 'Moderate', value: regions.filter((region) => region.risk === 'medium').length, icon: AlertTriangle, color: '#ff9f2e' },
    { label: 'Low Impact', value: regions.filter((region) => region.risk === 'low').length, icon: Globe2, color: '#45e5a8' },
    { label: 'Opportunities', value: regions.filter((region) => ['high', 'medium'].includes(region.opportunity)).length, icon: Sparkles, color: '#5b7cfa' },
  ];
  return (
    <section className="map-stats">
      {rows.map((row) => {
        const Icon = row.icon;
        return (
          <div className="wp-card map-stat" key={row.label}>
            <i style={{ color: row.color, background: `${row.color}18` }}><Icon size={18} /></i>
            <span>{row.label}</span>
            <b>{row.value}</b>
          </div>
        );
      })}
    </section>
  );
}

export default function MapPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState({ layers: [], regions: [] });
  const [prefs, setPrefs] = useState(null);
  const [timeWindow, setTimeWindow] = useState('7d');
  const [layer, setLayer] = useState('all');
  const [mode, setMode] = useState('risk');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lockedToast, setLockedToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const mapResult = await api.getMapSignals(layer, timeWindow);
      setData({ layers: mapResult?.layers || [], regions: Array.isArray(mapResult?.regions) ? mapResult.regions : [] });
      setPrefs({ data: { preferred_categories: mapResult?.layers || [], preferred_regions: mapResult?.regions_used || [] } });
    } catch (err) {
      setError((err?.message || 'Unable to load map signals.').replace(/^\d+:\s*/, '').slice(0, 180));
      setData({ layers: [], regions: [] });
    } finally {
      setLoading(false);
    }
  }, [layer, timeWindow]);

  useEffect(() => {
    if (!user) return undefined;
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [user, load]);

  const topRegions = useMemo(() => [...data.regions].sort((a, b) => b.intensity - a.intensity), [data.regions]);
  const topics = prefs?.data?.preferred_categories || [];
  const selectedRegion = selected || topRegions[0] || null;

  return (
    <div className="world-pulse-page signal-map-page">
      <Sidebar
        preferences={{ hasPreferences: Boolean(topics.length), topics, regions: prefs?.data?.preferred_regions || [], entities: [] }}
        activeItem="map"
        onHome={() => navigate('/dashboard')}
        onOrbit={() => navigate('/orbit')}
        onStories={() => navigate('/stories')}
        onMap={load}
        onSimulator={() => navigate('/simulator')}
        onLocked={setLockedToast}
        onWatchlist={() => navigate('/watchlist')}
        onAlerts={() => navigate('/alerts')}
        onSetFocus={() => navigate('/onboarding')}
        onSettings={() => navigate('/settings')}
      />
      <main className="world-pulse-main map-main">
        <header className="orbit-header ni-screen-header">
          <div>
            <h1>Signal Map</h1>
            <p>Live intensity of events and opportunities across the world.</p>
          </div>
          <div className="ni-header-tools">
            <button className="wp-icon-btn" onClick={() => setMode(mode === 'risk' ? 'opportunity' : 'risk')}><Filter size={16} /> {mode === 'risk' ? 'Risk' : 'Opportunity'}</button>
            <button className="wp-icon-btn" onClick={load} disabled={loading}><RefreshCw size={18} /> Refresh</button>
          </div>
        </header>

        <MapStats regions={data.regions} />
        <section className="orbit-controls wp-card map-controls">
          <label><Layers size={15} /> Window<select value={timeWindow} onChange={(event) => setTimeWindow(event.target.value)}><option value="24h">24h</option><option value="7d">7d</option><option value="30d">30d</option></select></label>
          <label><Globe2 size={15} /> Layer<select value={layer} onChange={(event) => setLayer(event.target.value)}><option value="all">All</option>{data.layers.map((item) => <option key={item} value={item}>{compactLabel(item)}</option>)}</select></label>
          <button className={mode === 'risk' ? 'toggle active' : 'toggle'} onClick={() => setMode('risk')}>Risk</button>
          <button className={mode === 'opportunity' ? 'toggle active' : 'toggle'} onClick={() => setMode('opportunity')}>Opportunity</button>
        </section>

        {loading ? <div className="wp-loading"><span /></div> : (
          <>
            {error && <div className="wp-error"><b>Map unavailable</b><span>{error}</span><button onClick={load}>Retry</button></div>}
            {!data.regions.length ? (
              <section className="wp-card orbit-empty"><h2>No geographic signals detected yet.</h2><p>Regions appear only when event text or AI entities contain real locations.</p></section>
            ) : (
              <section className="map-layout">
                <div className="abstract-world-map">
                  <WorldMap
                    regions={data.regions.map((region) => ({
                      ...region,
                      color: colorFor(region, mode),
                      label: [mode === 'risk' ? region.risk : region.opportunity, `${region.event_count} events`].filter(Boolean).join(' / '),
                    }))}
                    onRegionSelect={setSelected}
                  />
                  <div className="map-legend"><span>Signal intensity</span><i /><b>Very high</b></div>
                </div>
                <aside className="orbit-list wp-card map-side-panel">
                  <div className="wp-section-head"><span>{selectedRegion?.name || 'Top Regions'}</span></div>
                  {selectedRegion && (
                    <div className="selected-map-signal">
                      <b>{selectedRegion.intensity}</b>
                      <span>Pulse intensity</span>
                      <p>{selectedRegion.event_count} live events / {mode === 'risk' ? selectedRegion.risk : selectedRegion.opportunity} {mode}</p>
                    </div>
                  )}
                  {topRegions.map((region) => (
                    <button key={region.id} onClick={() => setSelected(region)}>
                      <b>{region.name}</b>
                      <span>intensity {region.intensity} / {region.event_count} events / {mode === 'risk' ? region.risk : region.opportunity}</span>
                    </button>
                  ))}
                </aside>
              </section>
            )}
          </>
        )}
      </main>
      {selected && (
        <aside className="shift-drawer orbit-drawer">
          <button className="drawer-close" onClick={() => setSelected(null)}><X size={18} /></button>
          <span>{selected.id}</span>
          <h2>{selected.name}</h2>
          <div className="drawer-grid">
            <div><small>Intensity</small><b>{selected.intensity}</b></div>
            <div><small>Delta</small><b>{selected.delta >= 0 ? `+${selected.delta}` : selected.delta}</b></div>
            <div><small>Risk</small><b>{selected.risk}</b></div>
            <div><small>Opportunity</small><b>{selected.opportunity}</b></div>
          </div>
          <section>
            <h3>Top events</h3>
            {selected.top_events?.map((event) => (
              <div className="orbit-connection" key={event.id}>
                <b>{event.title}</b>
                <small>pulse {event.pulse} / {compactLabel(event.category)}</small>
                <p>{event.why_it_matters || 'Impact is still being confirmed.'}</p>
                <button className="orbit-story-button" onClick={() => navigate('/story', { state: { article: { id: event.id, title: event.title, text_preview: event.why_it_matters, source: 'NewsIntel Map', pulse_score: event.pulse } } })}>Open Story</button>
              </div>
            ))}
          </section>
        </aside>
      )}
      <LockedNavToast message={lockedToast} />
    </div>
  );
}
