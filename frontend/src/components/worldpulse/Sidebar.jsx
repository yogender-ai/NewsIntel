import { Activity, Bell, Bookmark, Compass, Home, Map, Orbit, Pencil, Search, Settings, ShieldQuestion, Star } from 'lucide-react';
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
  onStories,
  onAsk,
  onPipeline,
  activeItem = 'home',
}) {
  const topics = asArray(preferences?.topics);
  const regions = asArray(preferences?.regions);
  const entities = asArray(preferences?.entities);

  const handleNav = (callback) => {
    callback();
  };

  return (
    <aside className="wp-sidebar">
      <div className="wp-brand">
        <div>NEWS<span>INTEL</span><sup>R</sup></div>
        <p>Global intelligence, simplified.</p>
      </div>

      <nav className="wp-nav">
        <button className={activeItem === 'home' ? 'active' : ''} onClick={() => handleNav(onHome)}><Home size={17} /> Home</button>
        <button className={activeItem === 'orbit' ? 'active' : ''} onClick={() => handleNav(onOrbit)}><Orbit size={17} /> Orbit</button>
        <button className={activeItem === 'stories' ? 'active' : ''} onClick={() => handleNav(onStories || (() => onLocked('Open a story from any live signal card.')))}><Bookmark size={17} /> Stories</button>
        <button className={activeItem === 'map' ? 'active' : ''} onClick={() => handleNav(onMap)}><Map size={17} /> Map</button>
        <button className={activeItem === 'simulator' ? 'active' : ''} onClick={() => handleNav(onSimulator)}><ShieldQuestion size={17} /> Simulator</button>
        <button className={activeItem === 'pipeline' ? 'active' : ''} onClick={() => handleNav(onPipeline || (() => onLocked('Pipeline monitor is opening from Home.')))}><Activity size={17} /> Pipeline</button>
        <button className={activeItem === 'watchlist' ? 'active' : ''} onClick={() => handleNav(onWatchlist)}><Star size={17} /> Watchlist</button>
        <button className={activeItem === 'alerts' ? 'active' : ''} onClick={() => handleNav(onAlerts)}><Bell size={17} /> Alerts</button>
        <button className={activeItem === 'settings' ? 'active' : ''} onClick={() => handleNav(onSettings)}><Settings size={17} /> Settings</button>
      </nav>

      <div className="wp-sidebar-scroll">
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
      </div>

      <button className="ask-ni" onClick={onAsk || (() => onLocked('Ask NewsIntel is available on the Home screen.'))}>
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
