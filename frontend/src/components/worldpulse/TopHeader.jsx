import { useEffect, useState } from 'react';
import { Bell, RefreshCw, User } from 'lucide-react';
import FreshnessBadge from './FreshnessBadge';
import { formatRelativeTime } from '../../lib/dashboardAdapter';

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

export default function TopHeader({ user, cache, refreshing, onRefresh, onAlerts, alertCount }) {
  const displayName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'there';
  const updated = formatRelativeTime(cache?.cachedAt);
  const [time, setTime] = useState('');

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="wp-top-header">
      <div className="hero-greeting">
        <h1 className="hero-title">{greeting()}, <span>{displayName}</span></h1>
        <p className="hero-sub">Here's what's moving the world right now.</p>
      </div>
      <div className="wp-header-actions">
        <div className="hero-live-ticker">
          <span className="live-dot" />
          <span className="live-time">{time}</span>
          <span className="live-label">LIVE</span>
        </div>
        <FreshnessBadge cache={cache} />
        <button className="wp-icon-btn" onClick={onRefresh} disabled={refreshing} title="Refresh">
          <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
          <span>{refreshing ? 'Syncing…' : updated ? `${updated}` : 'Refresh'}</span>
        </button>
        <button className="wp-icon-only" title="Alerts" onClick={onAlerts}>
          <Bell size={16} />
          {alertCount > 0 && <b>{alertCount}</b>}
        </button>
        <div className="wp-user">
          {user?.photoURL ? <img src={user.photoURL} alt="" /> : <span className="wp-avatar-initial">{(displayName || '?')[0].toUpperCase()}</span>}
        </div>
      </div>
    </header>
  );
}
