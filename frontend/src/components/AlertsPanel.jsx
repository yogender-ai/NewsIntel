import { useState, useEffect } from 'react';
import { Bell, Shield, AlertTriangle, ArrowUpRight, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ALL_ALERTS = [
  { title: 'Markets bracing for Trump\'s Iran ceasefire — global indices in freefall', source: 'Bloomberg', tags: ['Economic Impact'], time: 18, verified: true, engagement: 31400, urgent: true },
  { title: 'US, Iran reach historic ceasefire framework agreement', source: 'Reuters', tags: ['Iran Ceasefire'], time: 42, engagement: 28700, urgent: false, status: 'CONFIRMED' },
  { title: 'Hurricane season likely to be most intense in decades', source: 'NOAA', tags: ['Climate'], time: 60, verified: false, engagement: 12300, urgent: false },
  { title: 'NASDAQ circuit breaker triggered after intraday swing exceeds 7%', source: 'CNBC', tags: ['Stock Markets'], time: 8, engagement: 45200, urgent: true },
  { title: 'EU imposes emergency sanctions on Russian oil imports', source: 'FT', tags: ['Geopolitics', 'Oil'], time: 25, engagement: 19800, urgent: true },
  { title: 'Gold hits all time high at $2,450/oz amid uncertainty', source: 'WSJ', tags: ['Commodities'], time: 55, engagement: 8900, urgent: false },
];

const FILTER_CHIPS = ['Geopolitics', 'US Dollar', 'Stock Markets', 'Oil Prices'];

function formatTime(mins) {
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function formatEng(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}

export default function AlertsPanel({ alerts = null }) {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState(null);
  const [liveAlerts, setLiveAlerts] = useState(ALL_ALERTS.slice(0, 3));
  const [rotateIdx, setRotateIdx] = useState(3);

  // Rotate alerts every 10 seconds and update engagement
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveAlerts(prev => {
        const updated = prev.map(a => ({
          ...a,
          engagement: a.engagement + Math.floor(Math.random() * 100) + 10,
          time: a.time + 1,
        }));
        // Replace oldest alert with next from pool
        const next = ALL_ALERTS[rotateIdx % ALL_ALERTS.length];
        updated[Math.floor(Math.random() * updated.length)] = { ...next, engagement: next.engagement + Math.floor(Math.random() * 500) };
        return updated;
      });
      setRotateIdx(prev => prev + 1);
    }, 10000);
    return () => clearInterval(interval);
  }, [rotateIdx]);

  const displayAlerts = alerts || liveAlerts;

  return (
    <div className="alerts-panel">
      <div className="alerts-header">
        <div className="alerts-title">
          <Bell size={14} className="alerts-bell-icon" />
          <span>ALERTS</span>
          <span style={{ fontSize: '9px', color: '#64748b', marginLeft: '4px' }}>LIVE</span>
        </div>
      </div>

      <div className="alerts-list">
        {displayAlerts.map((alert, idx) => (
          <div key={`${alert.title.slice(0,10)}-${idx}`} className={`alert-card ${alert.urgent ? 'urgent' : ''}`}
            onClick={() => navigate(`/search/${encodeURIComponent(alert.title.split(' ').slice(0, 4).join(' '))}`)}>
            <div className="alert-card-avatar">
              <div className="alert-avatar-icon">
                {alert.urgent ? <AlertTriangle size={14} /> : <Shield size={14} />}
              </div>
            </div>
            <div className="alert-card-content">
              <div className="alert-card-title">{alert.title}</div>
              <div className="alert-card-meta">
                <span className="alert-source">{alert.source}</span>
                {alert.tags.map((tag, i) => (<span key={i} className="alert-tag">{tag}</span>))}
                {alert.status && <span className={`alert-status ${alert.status.toLowerCase()}`}>{alert.status}</span>}
              </div>
            </div>
            <div className="alert-card-right">
              <span className="alert-engagement"><ArrowUpRight size={10} />{formatEng(alert.engagement)}</span>
              <span className="alert-time">{formatTime(alert.time)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="alerts-filters">
        {FILTER_CHIPS.map((chip, i) => (
          <button key={i} className={`alert-filter-chip ${activeFilter === chip ? 'active' : ''}`}
            onClick={() => setActiveFilter(activeFilter === chip ? null : chip)}>{chip}</button>
        ))}
      </div>
    </div>
  );
}
