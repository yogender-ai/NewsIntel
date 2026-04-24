import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Bell, BellOff, Check, CheckCheck, ChevronRight, Info, Shield, Zap } from 'lucide-react';
import { usePersonalization } from '../context/PersonalizationContext';

const SEVERITY_CONFIG = {
  critical: { icon: AlertTriangle, color: '#f2554e', bg: '#fff1f1', label: 'CRITICAL' },
  warning: { icon: Shield, color: '#f28c24', bg: '#fff4e2', label: 'WARNING' },
  info: { icon: Info, color: '#5076ff', bg: '#eef3ff', label: 'INFO' },
};

function AlertCard({ alert, onResolve, onNavigate }) {
  const config = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.info;
  const Icon = config.icon;
  const isNew = alert.unread && !alert.resolved;
  const created = alert.created_at ? new Date(alert.created_at) : new Date();
  const timeStr = created.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' +
    created.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div className={`alert-card ${alert.resolved ? 'resolved' : ''} ${isNew ? 'unread' : ''}`}>
      <div className="alert-icon" style={{ background: config.bg }}>
        <Icon size={18} style={{ color: config.color }} />
      </div>
      <div className="alert-body">
        <div className="alert-top">
          <span className="alert-severity" style={{ color: config.color, background: config.bg }}>
            {config.label}
          </span>
          {isNew && <span className="alert-new-badge">NEW</span>}
          <span className="alert-time">{timeStr}</span>
        </div>
        <p className="alert-message">{alert.message}</p>
        {alert.signal_id && (
          <button className="alert-signal-link" onClick={() => onNavigate(alert.signal_id)}>
            View signal <ChevronRight size={13} />
          </button>
        )}
      </div>
      {!alert.resolved && (
        <button className="alert-resolve" onClick={() => onResolve(alert.id)} title="Resolve">
          <Check size={16} />
        </button>
      )}
      {alert.resolved && (
        <span className="alert-resolved-badge"><CheckCheck size={14} /> Resolved</span>
      )}
    </div>
  );
}

export default function AlertsPage() {
  const navigate = useNavigate();
  const { alerts, unreadAlertCount, resolveAlert, resolveAllAlerts } = usePersonalization();
  const [filter, setFilter] = useState('all'); // all | unresolved | critical | warning | info

  const filteredAlerts = useMemo(() => {
    let list = [...alerts];
    if (filter === 'unresolved') list = list.filter(a => !a.resolved);
    else if (filter === 'critical') list = list.filter(a => a.severity === 'critical');
    else if (filter === 'warning') list = list.filter(a => a.severity === 'warning');
    else if (filter === 'info') list = list.filter(a => a.severity === 'info');
    return list;
  }, [alerts, filter]);

  const unresolvedAlerts = alerts.filter(a => !a.resolved);
  const criticalCount = alerts.filter(a => a.severity === 'critical' && !a.resolved).length;
  const warningCount = alerts.filter(a => a.severity === 'warning' && !a.resolved).length;
  const infoCount = alerts.filter(a => a.severity === 'info' && !a.resolved).length;

  const handleNavigate = (signalId) => {
    navigate('/dashboard', { state: { openSignalId: signalId } });
  };

  return (
    <div className="alerts-page fin">
      <header className="alerts-header">
        <div>
          <h1>Smart Alerts</h1>
          <p>Intelligent notifications based on your tracked topics, entities, and exposure thresholds.</p>
        </div>
        <div className="alerts-summary">
          <div className={`alert-summary-badge ${criticalCount ? 'has-items' : ''}`}>
            <AlertTriangle size={16} />
            <b>{criticalCount}</b>
            <span>Critical</span>
          </div>
          <div className={`alert-summary-badge ${warningCount ? 'has-items' : ''}`}>
            <Shield size={16} />
            <b>{warningCount}</b>
            <span>Warning</span>
          </div>
          <div className={`alert-summary-badge ${infoCount ? 'has-items' : ''}`}>
            <Info size={16} />
            <b>{infoCount}</b>
            <span>Info</span>
          </div>
        </div>
      </header>

      <div className="alerts-controls">
        <div className="alerts-filters">
          {[
            { key: 'all', label: `All (${alerts.length})` },
            { key: 'unresolved', label: `Active (${unresolvedAlerts.length})` },
            { key: 'critical', label: 'Critical' },
            { key: 'warning', label: 'Warnings' },
            { key: 'info', label: 'Info' },
          ].map(f => (
            <button key={f.key} className={filter === f.key ? 'active' : ''} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
        {unresolvedAlerts.length > 0 && (
          <button className="btn-resolve-all" onClick={resolveAllAlerts}>
            <CheckCheck size={15} /> Resolve All
          </button>
        )}
      </div>

      {filteredAlerts.length === 0 ? (
        <div className="alerts-empty">
          <BellOff size={36} />
          <h2>{filter === 'all' ? 'No alerts yet' : 'No matching alerts'}</h2>
          <p>
            {filter === 'all'
              ? 'Alerts are generated when tracked entities move, exposure crosses thresholds, or critical signals appear.'
              : 'Try a different filter to see more alerts.'
            }
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
            <Zap size={15} /> Go to Dashboard
          </button>
        </div>
      ) : (
        <div className="alerts-list">
          {filteredAlerts.map(alert => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onResolve={resolveAlert}
              onNavigate={handleNavigate}
            />
          ))}
        </div>
      )}

      {/* Info footer */}
      <div className="alerts-footer">
        <Bell size={15} />
        <div>
          <b>How alerts work</b>
          <p>
            Alerts fire when: a signal hits CRITICAL tier, your exposure crosses 80, a tracked entity moves to SIGNAL/CRITICAL,
            or a topic's pulse delta exceeds ±12. All thresholds are tuned to your profile.
          </p>
        </div>
      </div>
    </div>
  );
}
