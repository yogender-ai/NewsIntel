import { Bell, Compass, Home, Lock, Map, Orbit, Search, Settings, ShieldQuestion, Star } from 'lucide-react';
import { compactLabel } from '../../lib/dashboardAdapter';

const lockedMessages = {
  Orbit: 'Signal Orbit launches in Phase 2 — explore signals around your profile.',
  Map: 'Signal Map launches in Phase 3 — see pressure building globally.',
  Simulator: 'Scenario Simulator launches later — test what-if futures.',
  Watchlist: 'Watchlist returns in a later phase.',
  Alerts: 'Alerts return in a later phase.',
};

export default function Sidebar({ preferences, onLocked, onSetFocus, onSettings }) {
  const locked = [
    ['Orbit', Orbit],
    ['Map', Map],
    ['Simulator', ShieldQuestion],
    ['Watchlist', Star],
    ['Alerts', Bell],
  ];

  return (
    <aside className="wp-sidebar">
      <div className="wp-brand">
        <div>NEWS<span>INTEL</span></div>
        <p>Global Intelligence, Simplified.</p>
      </div>

      <nav className="wp-nav">
        <button className="active"><Home size={17} /> Home</button>
        {locked.map(([label, Icon]) => (
          <button key={label} className="locked" onClick={() => onLocked(lockedMessages[label])}>
            <Icon size={17} /> {label}<small>Soon</small><Lock size={13} />
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
              <div>{preferences.topics?.length ? preferences.topics.map((item) => <b key={item}>{compactLabel(item)}</b>) : <em>—</em>}</div>
            </div>
            <div className="focus-block">
              <span>Regions</span>
              <div>{preferences.regions?.length ? preferences.regions.map((item) => <b key={item}>{compactLabel(item)}</b>) : <em>—</em>}</div>
            </div>
            <div className="focus-block">
              <span>Entities</span>
              <div>{preferences.entities?.length ? preferences.entities.map((item) => <b key={item.entity_name || item.name || item}>{compactLabel(item.entity_name || item.name || item)}</b>) : <em>—</em>}</div>
            </div>
          </>
        ) : (
          <div className="focus-empty">
            <p>Set your focus to personalize signals</p>
            <button onClick={onSetFocus}>Set Focus</button>
          </div>
        )}
      </section>

      <div className="ask-disabled">
        <Search size={16} />
        <span>Ask NewsIntel — Coming soon</span>
      </div>
    </aside>
  );
}

