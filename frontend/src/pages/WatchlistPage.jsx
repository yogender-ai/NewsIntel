import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, Eye, Search, Target, Trash2, X, Zap } from 'lucide-react';
import { usePersonalization } from '../context/PersonalizationContext';
import Sidebar from '../components/worldpulse/Sidebar';
import LockedNavToast from '../components/worldpulse/LockedNavToast';
import { api } from '../api';

export default function WatchlistPage() {
  const navigate = useNavigate();
  const {
    allSignals, savedIds, trackedIds, watchedSignals, savedThreads,
    unsaveSignal, untrackSignal,
    recordOpen, words,
  } = usePersonalization();

  const [tab, setTab] = useState('saved');
  const [searchQuery, setSearchQuery] = useState('');
  const [lockedToast, setLockedToast] = useState('');
  const [prefs, setPrefs] = useState(null);

  useEffect(() => {
    api.getPreferences().then(r => setPrefs(r?.data || null)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!lockedToast) return;
    const t = setTimeout(() => setLockedToast(''), 2200);
    return () => clearTimeout(t);
  }, [lockedToast]);

  const topics = useMemo(() => {
    const raw = prefs?.preferred_categories;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') try { return JSON.parse(raw); } catch { return []; }
    return [];
  }, [prefs]);

  const savedSignals = useMemo(() => {
    const savedSet = new Set([...savedIds, ...savedThreads.map(s => s.thread_id)]);
    return allSignals.filter(s => savedSet.has(s.id));
  }, [allSignals, savedIds, savedThreads]);

  const trackedSignals = useMemo(() => {
    const trackedSet = new Set([...trackedIds, ...watchedSignals.map(s => s.signal_id)]);
    return allSignals.filter(s => trackedSet.has(s.id));
  }, [allSignals, trackedIds, watchedSignals]);

  const activeList = tab === 'saved' ? savedSignals : trackedSignals;
  const filtered = searchQuery
    ? activeList.filter(s =>
        (s.thread_title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.summary || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : activeList;

  const handleOpen = (signal) => {
    recordOpen(signal);
    navigate('/dashboard', { state: { openSignalId: signal.id } });
  };

  return (
    <div className="world-pulse-page watchlist-wp-page">
      <Sidebar
        preferences={{ hasPreferences: Boolean(topics.length), topics, regions: [], entities: [] }}
        activeItem="watchlist"
        onHome={() => navigate('/dashboard')}
        onOrbit={() => navigate('/orbit')}
        onStories={() => navigate('/stories')}
        onMap={() => navigate('/map')}
        onSimulator={() => navigate('/simulator')}
        onLocked={setLockedToast}
        onWatchlist={() => {}}
        onAlerts={() => navigate('/alerts')}
        onSetFocus={() => navigate('/onboarding')}
        onSettings={() => navigate('/settings')}
      />
      <main className="world-pulse-main watchlist-main">
        <header className="ni-screen-header">
          <div>
            <h1>Your Watchlist</h1>
            <p>Saved and tracked signals from your personalized intelligence feed.</p>
          </div>
          <div className="watchlist-stats-row">
            <div className="watchlist-stat-badge">
              <Bookmark size={16} />
              <b>{savedSignals.length}</b>
              <span>Saved</span>
            </div>
            <div className="watchlist-stat-badge">
              <Target size={16} />
              <b>{trackedSignals.length}</b>
              <span>Tracked</span>
            </div>
          </div>
        </header>

        <div className="watchlist-controls">
          <div className="watchlist-tabs">
            <button className={tab === 'saved' ? 'active' : ''} onClick={() => setTab('saved')}>
              <Bookmark size={15} /> Saved ({savedSignals.length})
            </button>
            <button className={tab === 'tracked' ? 'active' : ''} onClick={() => setTab('tracked')}>
              <Target size={15} /> Tracked ({trackedSignals.length})
            </button>
          </div>
          <div className="watchlist-search">
            <Search size={15} />
            <input
              type="text"
              placeholder="Filter signals..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="watchlist-empty wp-card">
            {tab === 'saved' ? <Bookmark size={28} /> : <Target size={28} />}
            <h2>{searchQuery ? 'No matching signals' : tab === 'saved' ? 'No saved signals yet' : 'No tracked signals yet'}</h2>
            <p>
              {searchQuery
                ? 'Try a different search term.'
                : tab === 'saved'
                  ? 'Save signals from your feed to bookmark them here.'
                  : 'Track signals to follow their movement over time.'
              }
            </p>
            {!searchQuery && (
              <button className="orbit-story-button" onClick={() => navigate('/dashboard')}>
                <Zap size={15} /> Explore Signals
              </button>
            )}
          </div>
        ) : (
          <div className="watchlist-grid">
            {filtered.map(signal => {
              const tone = signal.signal_tier ? signal.signal_tier.toLowerCase() : 'unclassified';
              const pulseScore = Number.isFinite(Number(signal.pulse?.score)) ? Math.round(Number(signal.pulse.score)) : '-';
              const exposureScore = Number.isFinite(Number(signal.exposure?.score)) ? Math.round(Number(signal.exposure.score)) : '-';
              const confidence = Number.isFinite(Number(signal.confidence)) ? `${Number(signal.confidence)}%` : '-';
              return (
                <article key={signal.id} className={`wp-card watchlist-card tone-${tone}`}>
                  <div className="wc-top">
                    {signal.signal_tier && <span className={`tier-badge tier-${tone}`}>{signal.signal_tier}</span>}
                    {signal.updatedAgo && <span className="wc-time">{signal.updatedAgo}</span>}
                  </div>
                  <h3 onClick={() => handleOpen(signal)}>{signal.thread_title || signal.id}</h3>
                  <p>{words(signal.whyLine || signal.summary, 18)}</p>
                  <div className="wc-scores">
                    <div className="wc-score">
                      <em>Pulse</em>
                      <strong>{pulseScore}</strong>
                    </div>
                    <div className="wc-score">
                      <em>Exposure</em>
                      <strong>{exposureScore}</strong>
                    </div>
                    <div className="wc-score">
                      <em>Confidence</em>
                      <strong>{confidence}</strong>
                    </div>
                    {signal.delta?.value != null && (
                      <div className={`wc-delta ${signal.delta.tone}`}>
                        {signal.delta.value > 0 ? '+' : ''}{signal.delta.value}
                      </div>
                    )}
                  </div>
                  {signal.why_relevant?.factors?.length > 0 && (
                    <div className="wc-reasons">
                      {signal.why_relevant.factors.slice(0, 3).map((f, i) => (
                        <span key={i}>{f.label} <b>+{Math.round(f.points || 0)}</b></span>
                      ))}
                    </div>
                  )}
                  <div className="wc-actions">
                    <button className="wp-icon-btn" onClick={() => handleOpen(signal)}>
                      <Eye size={14} /> Open
                    </button>
                    {tab === 'saved' && (
                      <button className="wp-icon-btn danger" onClick={() => unsaveSignal(signal)}>
                        <Trash2 size={14} /> Unsave
                      </button>
                    )}
                    {tab === 'tracked' && (
                      <button className="wp-icon-btn danger" onClick={() => untrackSignal(signal)}>
                        <X size={14} /> Untrack
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
      <LockedNavToast message={lockedToast} />
    </div>
  );
}
