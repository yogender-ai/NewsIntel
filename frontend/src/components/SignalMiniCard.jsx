import React from 'react';
import { Bookmark, Eye, GitBranch, Info, Target, X } from 'lucide-react';

/* Compact signal card for Watchlist & Movers pages */
export default function SignalMiniCard({ signal, onOpen, onSave, onTrack, onDismiss, onGraph, compact }) {
  if (!signal) return null;
  const tone = signal.signal_tier ? signal.signal_tier.toLowerCase() : 'unclassified';
  const pulseScore = Number.isFinite(Number(signal.pulse?.score ?? signal.pulse_score)) ? Math.round(Number(signal.pulse?.score ?? signal.pulse_score)) : '-';
  const exposureScore = Number.isFinite(Number(signal.exposure?.score ?? signal.exposure_score ?? signal.relevance_score)) ? Math.round(Number(signal.exposure?.score ?? signal.exposure_score ?? signal.relevance_score)) : '-';

  return (
    <div className={`signal-mini-card tone-${tone}`}>
      <div className="mini-card-top">
        {signal.signal_tier && <span className={`tier-badge tier-${tone}`}>{signal.signal_tier}</span>}
        <span className="mini-card-time">{signal.updatedAgo || ''}</span>
      </div>
      <h3>{signal.thread_title || signal.id}</h3>
      {!compact && <p>{signal.whyLine || signal.summary || ''}</p>}
      <div className="mini-card-scores">
        <span className="mini-score">
          <em>Pulse</em>
          <b>{pulseScore}</b>
        </span>
        <span className="mini-score">
          <em>Exposure</em>
          <b>{exposureScore}</b>
        </span>
        {signal.confidence != null && (
          <span className="mini-score">
            <em>Confidence</em>
            <b>{typeof signal.confidence === 'number' && signal.confidence <= 1 ? Math.round(signal.confidence * 100) : signal.confidence}%</b>
          </span>
        )}
      </div>
      <div className="mini-card-actions">
        {onOpen && <button className="btn-mini primary" onClick={() => onOpen(signal)}><Eye size={14} /> Open</button>}
        {onTrack && (
          <button className={`btn-mini ${signal.tracked ? 'active' : ''}`} onClick={() => onTrack(signal)}>
            <Target size={14} /> {signal.tracked ? 'Tracked' : 'Track'}
          </button>
        )}
        {onSave && (
          <button className={`btn-mini ${signal.saved ? 'active' : ''}`} onClick={() => onSave(signal)}>
            <Bookmark size={14} /> {signal.saved ? 'Saved' : 'Save'}
          </button>
        )}
        {onGraph && <button className="btn-mini" onClick={() => onGraph(signal)}><GitBranch size={14} /> Graph</button>}
        {onDismiss && <button className="btn-mini danger" onClick={() => onDismiss(signal)}><X size={14} /></button>}
      </div>
    </div>
  );
}
