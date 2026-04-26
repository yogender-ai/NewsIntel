import { Bell, Compass, Home, Lock, Map, Orbit, Search, Settings, ShieldQuestion, Star } from 'lucide-react';
import { compactLabel } from '../../lib/dashboardAdapter';

export default function Sidebar({
  preferences,
  onHome,
  onLocked,
  onWatchlist,
  onAlerts,
  onSetFocus,
  onSettings,
}) {
  const locked = [
    ['Orbit', <Orbit size={17} />],
    ['Map', <Map size={17} />],
    ['Simulator', <ShieldQuestion size={17} />],
  ];

  return (
    <aside className="wp-sidebar">
      <div className="wp-brand">
        <div>NEWS<span>INTEL</span></div>
        <p>Global Intelligence, Simplified.</p>
      </div>

      <nav className="wp-nav">
        <button className="active" onClick={onHome}><Home size={17} /> Home</button>
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
        <h3><Compass size={15} /> My Focus</h3>
        {preferences?.hasPreferences ? (
          <>
            <div className="focus-block">
              <span>Topics</span>
              <div>{preferences.topics?.length ? preferences.topics.map((item) => <b key={item}>{compactLabel(item)}</b>) : <em>-</em>}</div>
            </div>
            <div className="focus-block">
              <span>Regions</span>
              <div>{preferences.regions?.length ? preferences.regions.map((item) => <b key={item}>{compactLabel(item)}</b>) : <em>-</em>}</div>
            </div>
            <div className="focus-block">
              <span>Entities</span>
              <div>{preferences.entities?.length ? preferences.entities.map((item) => <b key={item.entity_name || item.name || item}>{compactLabel(item.entity_name || item.name || item)}</b>) : <em>-</em>}</div>
            </div>
          </>
        ) : (
          <div className="focus-empty">
            <p>Set your focus to personalize signals</p>
            <button onClick={onSetFocus}>Set Focus</button>
          </div>
        )}
      </section>

      <button className="ask-disabled" onClick={() => onLocked('Ask NewsIntel is not available yet.')}>
        <Search size={16} />
        <span>Ask NewsIntel</span>
        <Lock size={13} />
      </button>
    </aside>
  );
}
