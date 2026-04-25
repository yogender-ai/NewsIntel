import { Bell, RefreshCw, User } from 'lucide-react';
import FreshnessBadge from './FreshnessBadge';
import { formatRelativeTime } from '../../lib/dashboardAdapter';

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

export default function TopHeader({ user, cache, refreshing, onRefresh, alertCount }) {
  const displayName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'there';
  const updated = formatRelativeTime(cache?.cachedAt);
  return (
    <header className="wp-top-header">
      <div>
        <span className="wp-kicker">HOME / WORLD PULSE</span>
        <h1>{greeting()}, {displayName}</h1>
        <p>Here’s what’s moving the world right now.</p>
      </div>
      <div className="wp-header-actions">
        <FreshnessBadge cache={cache} />
        <button className="wp-icon-btn" onClick={onRefresh} disabled={refreshing} title="Refresh">
          <RefreshCw size={18} className={refreshing ? 'spin' : ''} />
          <span>{updated ? `Updated ${updated}` : 'Refresh'}</span>
        </button>
        <button className="wp-icon-only" title="Alerts">
          <Bell size={18} />
          {alertCount > 0 && <b>{alertCount}</b>}
        </button>
        <div className="wp-user">
          {user?.photoURL ? <img src={user.photoURL} alt="" /> : <User size={18} />}
          <span>{displayName}</span>
        </div>
      </div>
    </header>
  );
}

