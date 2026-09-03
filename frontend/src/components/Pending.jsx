import { useEffect, useState } from 'react';

/* The API sleeps on Render's free tier, so a submit can sit for 30-60s while the
   container boots. Without visible motion that reads as a dead button and people
   assume the account was never created — so a request in flight always shows a
   spinner, a running clock, and an escalating explanation of the wait. */

export function Spinner({ size = 15 }) {
  return (
    <svg
      className="spin btn-spinner" width={size} height={size} viewBox="0 0 24 24"
      fill="none" aria-hidden="true" focusable="false"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* Ticks once a second while `active`, and resets when a new attempt starts. */
export function useElapsed(active) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) { setSeconds(0); return undefined; }
    const started = Date.now();
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 250);
    return () => clearInterval(id);
  }, [active]);
  return seconds;
}

function phase(seconds) {
  if (seconds < 4) return 'Talking to the server…';
  if (seconds < 12) return 'Waking the server — it goes to sleep when nobody is using it.';
  return 'Still waking up. A cold start takes up to a minute; this will finish on its own.';
}

/* Progress is deliberately not a fake percentage: the bar is an indeterminate
   sweep, and the seconds counter is the honest signal that work is happening. */
export function PendingNotice({ active, seconds }) {
  if (!active) return null;
  return (
    <div className="pending" role="status" aria-live="polite">
      <div className="pending-bar"><span /></div>
      <p className="pending-text">
        {phase(seconds)} <span className="pending-clock">{seconds}s</span>
      </p>
    </div>
  );
}
