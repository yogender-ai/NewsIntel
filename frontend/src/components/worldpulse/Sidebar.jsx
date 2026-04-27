import { Bell, Bookmark, Compass, Home, Lock, Map, Orbit, Pencil, Search, Settings, ShieldQuestion, Star } from 'lucide-react';
import { compactLabel } from '../../lib/dashboardAdapter';

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

export default function Sidebar({
  preferences,
  onHome,
  onOrbit,
  onMap,
  onSimulator,
  onLocked,
  onWatchlist,
  onAlerts,
  onSetFocus,
  onSettings,
  activeItem = 'home',
}) {
  const topics = asArray(preferences?.topics);
  const regions = asArray(preferences?.regions);
  const entities = asArray(preferences?.entities);
  const locked = [];

  return (
    <aside className="wp-sidebar">
      <div className="wp-brand">
        <div>NEWS<span>INTEL</span><sup>R</sup></div>
        <p>Global Intelligence, Simplified.</p>
      </div>

      <nav className="wp-nav">
        <button className={activeItem === 'home' ? 'active' : ''} onClick={onHome}><Home size={17} /> Home</button>
        <button className={activeItem === 'orbit' ? 'active' : ''} onClick={onOrbit}><Orbit size={17} /> Orbit</button>
        <button className={activeItem === 'stories' ? 'active' : ''} onClick={() => onLocked('Open a story from any live signal card.')}><Bookmark size={17} /> Stories</button>
        <button className={activeItem === 'map' ? 'active' : ''} onClick={onMap}><Map size={17} /> Map</button>
        <button className={activeItem === 'simulator' ? 'active' : ''} onClick={onSimulator}><ShieldQuestion size={17} /> Simulator</button>
        {locked.map(([label, icon]) => (
          <button key={label} className="locked" onClick={() => onLocked(`${label} is not available yet.`)}>
            {icon} {label}<small><Lock size={12} /></small>
          </button>
        ))}
        <button onClick={onWatchlist}><Star size={17} /> Watchlist</button>
        <button onClick={onAlerts}><Bell size={17} /> Alerts</button>
        <button onClick={onSettings}><Settings size={17} /> Settings</button>
      </nav>

      <section className="wp-focus">
        <h3>
          <Compass size={15} /> My Focus
          {preferences?.hasPreferences && (
            <button className="focus-edit-btn" onClick={onSetFocus}><Pencil size={11} /> Edit</button>
          )}
        </h3>
        {preferences?.hasPreferences ? (
          <>
            <div className="focus-block">
              <span>Topics</span>
              <div>{topics.length ? topics.map((item) => <b key={item}>{compactLabel(item)}</b>) : <em>-</em>}</div>
            </div>
            <div className="focus-block">
              <span>Regions</span>
              <div>{regions.length ? regions.map((item) => <b key={item}>{compactLabel(item)}</b>) : <em>-</em>}</div>
            </div>
            <div className="focus-block">
              <span>Entities</span>
              <div>{entities.length ? entities.map((item) => <b key={item.entity_name || item.name || item}>{compactLabel(item.entity_name || item.name || item)}</b>) : <em>-</em>}</div>
            </div>
          </>
        ) : (
          <div className="focus-empty">
            <p>Set your focus to personalize signals</p>
            <button onClick={onSetFocus}>Set Focus</button>
          </div>
        )}
      </section>

      <button className="ask-ni" onClick={() => onLocked('Ask NewsIntel is coming soon.')}>
        <Search size={16} />
        <div className="ask-ni-text">
          <span>Ask NewsIntel</span>
          <small>What do you want to know?</small>
        </div>
        <span className="ask-ni-arrow">-&gt;</span>
      </button>
    </aside>
  );
}
