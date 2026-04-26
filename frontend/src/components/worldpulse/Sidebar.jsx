import { Bell, Compass, Home, Map, Orbit, Search, Settings, ShieldQuestion, Star } from 'lucide-react';
import { compactLabel } from '../../lib/dashboardAdapter';

export default function Sidebar({
  preferences,
  onHome,
  onOrbit,
  onMap,
  onSimulator,
  onWatchlist,
  onAlerts,
  onSetFocus,
  onSettings,
}) {
  const nav = [
    ['Orbit', <Orbit size={17} />, onOrbit],
    ['Map', <Map size={17} />, onMap],
    ['Simulator', <ShieldQuestion size={17} />, onSimulator],
    ['Watchlist', <Star size={17} />, onWatchlist],
    ['Alerts', <Bell size={17} />, onAlerts],
  ];

  return (
    <aside className="wp-sidebar">
      <div className="wp-brand">
        <div>NEWS<span>INTEL</span></div>
        <p>Global Intelligence, Simplified.</p>
      </div>

      <nav className="wp-nav">
        <button className="active" onClick={onHome}><Home size={17} /> Home</button>
        {nav.map(([label, icon, action]) => (
          <button key={label} onClick={action}>
            {icon} {label}
          </button>
        ))}
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

      <button className="ask-disabled" onClick={onSimulator}>
        <Search size={16} />
        <span>Ask NewsIntel</span>
      </button>
    </aside>
  );
}
