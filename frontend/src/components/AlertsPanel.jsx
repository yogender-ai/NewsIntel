import { useState } from 'react';
import { Bell, Shield, AlertTriangle, ArrowUpRight, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const MOCK_ALERTS = [
  {
    title: 'Markets bracing for Trump\'s iran ceasefire enttl global maices fivfile',
    source: 'Bloomberg',
    tags: ['Economic Impact'],
    time: '18m ago',
    verified: true,
    engagement: null,
    urgent: true,
  },
  {
    title: 'US, Iran Afres | +0.64D',
    source: 'Reuters',
    tags: ['ULA', 'Iran Ceasefire'],
    status: 'VERIFYING',
    time: '1h ago',
    engagement: '31.4k',
    urgent: false,
  },
  {
    title: 'Hurricane season likely to be intense, reports warn of elevated risk',
    source: 'Weather Channel',
    tags: ['Climate', '5-hole'],
    time: '1 hour',
    verified: false,
    engagement: null,
    urgent: false,
  },
];

const FILTER_CHIPS = ['Geopolitics', 'US Dollar', 'Stock Markets', 'Oil Prices'];

export default function AlertsPanel({ alerts = null }) {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState(null);
  const displayAlerts = alerts || MOCK_ALERTS;

  return (
    <div className="alerts-panel">
      <div className="alerts-header">
        <div className="alerts-title">
          <Bell size={14} className="alerts-bell-icon" />
          <span>ALERTS</span>
        </div>
        <div className="alerts-actions">
          <CheckCircle size={12} />
        </div>
      </div>

      <div className="alerts-list">
        {displayAlerts.map((alert, idx) => (
          <div
            key={idx}
            className={`alert-card ${alert.urgent ? 'urgent' : ''}`}
            onClick={() => navigate(`/search/${encodeURIComponent(alert.title.split(' ').slice(0, 4).join(' '))}`)}
          >
            <div className="alert-card-avatar">
              <div className="alert-avatar-icon">
                {alert.urgent ? (
                  <AlertTriangle size={14} />
                ) : (
                  <Shield size={14} />
                )}
              </div>
            </div>
            <div className="alert-card-content">
              <div className="alert-card-title">{alert.title}</div>
              <div className="alert-card-meta">
                <span className="alert-source">{alert.source}</span>
                {alert.tags.map((tag, i) => (
                  <span key={i} className="alert-tag">{tag}</span>
                ))}
                {alert.status && (
                  <span className={`alert-status ${alert.status.toLowerCase()}`}>
                    {alert.status}
                  </span>
                )}
              </div>
            </div>
            <div className="alert-card-right">
              {alert.engagement && (
                <span className="alert-engagement">
                  <ArrowUpRight size={10} />
                  {alert.engagement}
                </span>
              )}
              <span className="alert-time">{alert.time}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Chips */}
      <div className="alerts-filters">
        {FILTER_CHIPS.map((chip, i) => (
          <button
            key={i}
            className={`alert-filter-chip ${activeFilter === chip ? 'active' : ''}`}
            onClick={() => setActiveFilter(activeFilter === chip ? null : chip)}
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}
