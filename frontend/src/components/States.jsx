import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';

export function Loading({ label = 'Loading', rows = 3 }) {
  return (
    <div className="state-block" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 72, marginBottom: 10 }} />
      ))}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'Something went wrong' }) {
  const message = error?.message || String(error || 'Unknown error');
  return (
    <div className="state-block state-msg card" role="alert">
      <AlertTriangle size={22} className="state-icon state-icon-error" aria-hidden="true" />
      <h3>{title}</h3>
      <p className="hint">{message}</p>
      {onRetry && (
        <button className="btn btn-sm" onClick={onRetry}>
          <RefreshCw size={14} aria-hidden="true" /> Try again
        </button>
      )}
    </div>
  );
}

export function Empty({ title, hint, action }) {
  return (
    <div className="state-block state-msg card">
      <Inbox size={22} className="state-icon" aria-hidden="true" />
      <h3>{title}</h3>
      {hint && <p className="hint">{hint}</p>}
      {action}
    </div>
  );
}
