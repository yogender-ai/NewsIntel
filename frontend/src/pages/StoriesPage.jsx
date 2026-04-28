import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, RefreshCw, Search } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/worldpulse/Sidebar';
import LockedNavToast from '../components/worldpulse/LockedNavToast';
import { compactLabel, formatRelativeTime } from '../lib/dashboardAdapter';

function normalizeStory(cluster) {
  const id = cluster.signal_id || cluster.thread_id || cluster.id;
  const sources = Array.isArray(cluster.sources) ? cluster.sources : [];
  const primarySource = sources.find((source) => source?.url) || sources[0] || {};
  return {
    id,
    title: cluster.thread_title || cluster.title || '',
    summary: cluster.summary || cluster.impact_line || cluster.why_it_matters || '',
    category: cluster.matched_preferences?.[0]?.label || cluster.category || '',
    tier: cluster.signal_tier || '',
    pulse: Number.isFinite(Number(cluster.pulse_score)) ? Math.round(Number(cluster.pulse_score)) : null,
    updatedAt: cluster.updated_at || cluster.last_seen_at || cluster.ai_enriched_at || null,
    source: primarySource.source || cluster.source || cluster.ai_provider_used || '',
    url: primarySource.url || cluster.source_url || cluster.url || '',
    sourceCount: sources.length || cluster.source_count || 0,
    raw: cluster,
  };
}

export default function StoriesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lockedToast, setLockedToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setDashboard(await api.getCachedDashboard());
    } catch (err) {
      setDashboard(null);
      setError((err?.message || 'Unable to load stories.').replace(/^\d+:\s*/, '').slice(0, 180));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [user, load]);

  useEffect(() => {
    if (!lockedToast) return undefined;
    const timer = window.setTimeout(() => setLockedToast(''), 2200);
    return () => window.clearTimeout(timer);
  }, [lockedToast]);

  const stories = useMemo(() => (
    (dashboard?.clusters || [])
      .map(normalizeStory)
      .filter((story) => story.id && story.title)
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
  ), [dashboard]);

  const filteredStories = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return stories;
    return stories.filter((story) => (
      `${story.title} ${story.summary} ${story.category} ${story.tier}`.toLowerCase().includes(needle)
    ));
  }, [stories, query]);

  const topics = dashboard?.topics_used || [];
  const regions = dashboard?.regions_used || [];

  const openStory = (story) => {
    navigate('/story', {
      state: {
        article: {
          ...story.raw,
          id: story.id,
          title: story.title,
          text_preview: story.summary,
          text: story.summary,
          source: story.source,
          url: story.url,
          sources: story.raw.sources || [],
          pulse_score: story.pulse,
          exposure_score: story.raw.exposure_score,
          sentiment: story.raw.sentiment,
          entities: story.raw.entities || [],
          signal_tier: story.tier || null,
        },
      },
    });
  };

  return (
    <div className="world-pulse-page stories-page">
      <Sidebar
        preferences={{ hasPreferences: Boolean(topics.length || regions.length), topics, regions, entities: dashboard?.tracked_entities || [] }}
        activeItem="stories"
        onHome={() => navigate('/dashboard')}
        onOrbit={() => navigate('/orbit')}
        onStories={load}
        onMap={() => navigate('/map')}
        onSimulator={() => navigate('/simulator')}
        onLocked={setLockedToast}
        onWatchlist={() => navigate('/watchlist')}
        onAlerts={() => navigate('/alerts')}
        onSetFocus={() => navigate('/onboarding')}
        onSettings={() => navigate('/settings')}
      />
      <main className="world-pulse-main stories-main">
        <header className="ni-screen-header">
          <div>
            <h1>Stories</h1>
            <p>Event-backed story threads from the latest dashboard snapshot.</p>
          </div>
          <div className="ni-header-tools">
            <label className="story-search">
              <Search size={15} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter stories" />
            </label>
            <button className="wp-icon-btn" onClick={load} disabled={loading}><RefreshCw size={16} /> Refresh</button>
          </div>
        </header>

        {loading ? <div className="wp-loading"><span /></div> : (
          <>
            {error && <div className="wp-error"><b>Stories unavailable</b><span>{error}</span><button onClick={load}>Retry</button></div>}
            {!filteredStories.length ? (
              <section className="watchlist-empty wp-card">
                <BookOpen size={28} />
                <h2>No stories returned.</h2>
                <p>Story threads appear when the backend snapshot includes ranked event clusters.</p>
              </section>
            ) : (
              <section className="stories-grid">
                {filteredStories.map((story) => (
                  <button key={story.id} className="wp-card story-tile" onClick={() => openStory(story)}>
                    <div className="story-tile-top">
                      {story.category && <span>{compactLabel(story.category)}</span>}
                      {story.tier && <b>{story.tier}</b>}
                    </div>
                    <h2>{story.title}</h2>
                    {story.summary && <p>{story.summary}</p>}
                    <div className="story-tile-meta">
                      {story.pulse != null && <span>Pulse {story.pulse}</span>}
                      {story.sourceCount ? <span>{story.sourceCount} sources</span> : null}
                      {story.updatedAt && <span>{formatRelativeTime(story.updatedAt)}</span>}
                    </div>
                  </button>
                ))}
              </section>
            )}
          </>
        )}
      </main>
      <LockedNavToast message={lockedToast} />
    </div>
  );
}
