import { useState, useEffect } from 'react';
import { Bell, AlertTriangle, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchTrending } from '../api';

export default function AlertsPanel({ alerts = null }) {
  const navigate = useNavigate();
  const [liveAlerts, setLiveAlerts] = useState([]);

  useEffect(() => {
    fetchTrending().then(data => {
      if (data?.headlines?.length > 0) {
        // Pick the most critical/high severity headlines for alerts
        const sorted = [...data.headlines].sort((a, b) => {
          const sevOrder = { critical: 3, high: 2, medium: 1, low: 0 };
          return (sevOrder[b.severity] || 0) - (sevOrder[a.severity] || 0);
        });
        const mapped = sorted.slice(0, 4).map((hl, i) => ({
          title: hl.title,
          source: hl.source || 'Global',
          tags: [hl.event_label || 'BREAKING'].filter(t => t !== 'ALERT'),
          time_ago: hl.time_ago || hl.published || '',
          urgent: hl.severity === 'critical',
          link: hl.link,
        }));
        setLiveAlerts(mapped);
      }
    }).catch(() => {});
  }, []);

  const displayAlerts = alerts || liveAlerts;

  if (displayAlerts.length === 0) return null;

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
          <div key={`${alert.title?.slice(0,10)}-${idx}`} className={`alert-card ${alert.urgent ? 'urgent' : ''}`}
            onClick={() => {
              if (alert.link) {
                window.open(alert.link, '_blank');
              } else {
                navigate(`/search/${encodeURIComponent(alert.title.split(' ').slice(0, 4).join(' '))}`);
              }
            }}>
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
              </div>
            </div>
            <div className="alert-card-right">
              {alert.time_ago && <span className="alert-time">{alert.time_ago}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
