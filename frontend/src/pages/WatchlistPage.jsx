import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, Eye, Search, Target, Trash2, X, Zap } from 'lucide-react';
import { usePersonalization } from '../context/PersonalizationContext';

export default function WatchlistPage() {
  const navigate = useNavigate();
  const {
    signals, allSignals, savedIds, trackedIds, watchedSignals, savedThreads,
    saveSignal, unsaveSignal, trackSignal, untrackSignal, dismissSignal,
    recordOpen, showToast, timeAgo, words,
  } = usePersonalization();

  const [tab, setTab] = useState('saved');
  const [searchQuery, setSearchQuery] = useState('');

  // Match watched/saved IDs to full signal objects
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
    <div className="watchlist-page fin">
      <header className="watchlist-header">
        <div>
          <h1>Your Watchlist</h1>
          <p>Signals you've saved and topics you're tracking. They rank higher in your feed.</p>
        </div>
        <div className="watchlist-stats">
          <div className="watchlist-stat">
            <Bookmark size={18} />
            <b>{savedSignals.length}</b>
            <span>Saved</span>
          </div>
          <div className="watchlist-stat">
            <Target size={18} />
            <b>{trackedSignals.length}</b>
            <span>Tracked</span>
          </div>
        </div>
      </header>

      <div className="watchlist-controls">
        <div className="watchlist-tabs">
          <button className={tab === 'saved' ? 'active' : ''} onClick={() => setTab('saved')}>
            <Bookmark size={15} /> Saved Signals ({savedSignals.length})
          </button>
          <button className={tab === 'tracked' ? 'active' : ''} onClick={() => setTab('tracked')}>
            <Target size={15} /> Tracked Signals ({trackedSignals.length})
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
        <div className="watchlist-empty">
          {tab === 'saved' ? <Bookmark size={32} /> : <Target size={32} />}
          <h2>{searchQuery ? 'No matching signals' : tab === 'saved' ? 'No saved signals yet' : 'No tracked signals yet'}</h2>
          <p>
            {searchQuery
              ? 'Try a different search term.'
              : tab === 'saved'
                ? 'Save signals from your feed to bookmark them here. Saved signals rank higher.'
                : 'Track signals to follow their movement. Tracked topics boost your exposure score.'
            }
          </p>
          {!searchQuery && (
            <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
              <Zap size={15} /> Explore Signals
            </button>
          )}
        </div>
      ) : (
        <div className="watchlist-grid">
          {filtered.map(signal => {
            const tone = signal.signal_tier?.toLowerCase() || 'signal';
            return (
              <article key={signal.id} className={`watchlist-card tone-${tone}`}>
                <div className="wc-top">
                  <span className={`tier-badge tier-${tone}`}>{signal.signal_tier || 'SIGNAL'}</span>
                  <span className="wc-time">{signal.updatedAgo}</span>
                </div>
                <h3 onClick={() => handleOpen(signal)}>{signal.thread_title || signal.id}</h3>
                <p>{words(signal.whyLine || signal.summary, 18)}</p>
                <div className="wc-scores">
                  <div className="wc-score">
                    <em>Pulse</em>
                    <strong>{Math.round(signal.pulse?.score || 50)}</strong>
                  </div>
                  <div className="wc-score">
                    <em>Exposure</em>
                    <strong>{Math.round(signal.exposure?.score || 50)}</strong>
                  </div>
                  <div className="wc-score">
                    <em>Confidence</em>
                    <strong>{signal.confidence || 0}%</strong>
                  </div>
                  {signal.delta?.value != null && (
                    <div className={`wc-delta ${signal.delta.tone}`}>
                      {signal.delta.value > 0 ? '+' : ''}{signal.delta.value}
                    </div>
                  )}
                </div>
                {/* Why relevant */}
                {signal.why_relevant?.factors?.length > 0 && (
                  <div className="wc-reasons">
                    {signal.why_relevant.factors.slice(0, 3).map((f, i) => (
                      <span key={i}>{f.label} <b>+{Math.round(f.points || 0)}</b></span>
                    ))}
                  </div>
                )}
                <div className="wc-actions">
                  <button className="btn-mini primary" onClick={() => handleOpen(signal)}>
                    <Eye size={14} /> Open Signal
                  </button>
                  {tab === 'saved' && (
                    <button className="btn-mini danger" onClick={() => unsaveSignal(signal)}>
                      <Trash2 size={14} /> Unsave
                    </button>
                  )}
                  {tab === 'tracked' && (
                    <button className="btn-mini danger" onClick={() => untrackSignal(signal)}>
                      <X size={14} /> Untrack
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
