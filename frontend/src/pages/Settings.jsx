import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/worldpulse/Sidebar';
import LockedNavToast from '../components/worldpulse/LockedNavToast';
import { Pencil, Shield, Trash2, User, Info, ChevronRight } from 'lucide-react';

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);
  const [lockedToast, setLockedToast] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getPreferences();
        if (res.status === 'success' && res.data) setPrefs(res.data);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!lockedToast) return;
    const t = setTimeout(() => setLockedToast(''), 2200);
    return () => clearTimeout(t);
  }, [lockedToast]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.deleteAccount();
      await logout();
      navigate('/login');
    } catch (e) {
      console.error(e);
      setLockedToast('Failed to delete account data. Try again.');
    }
    setDeleting(false);
  };

  const cats = useMemo(() => {
    const raw = prefs?.preferred_categories;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') try { return JSON.parse(raw); } catch { return []; }
    return [];
  }, [prefs]);

  const regs = useMemo(() => {
    const raw = prefs?.preferred_regions;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') try { return JSON.parse(raw); } catch { return []; }
    return [];
  }, [prefs]);

  return (
    <div className="world-pulse-page settings-wp-page">
      <Sidebar
        preferences={{ hasPreferences: Boolean(cats.length || regs.length), topics: cats, regions: regs, entities: [] }}
        activeItem="settings"
        onHome={() => navigate('/dashboard')}
        onOrbit={() => navigate('/orbit')}
        onStories={() => navigate('/stories')}
        onMap={() => navigate('/map')}
        onSimulator={() => navigate('/simulator')}
        onLocked={setLockedToast}
        onWatchlist={() => navigate('/watchlist')}
        onAlerts={() => navigate('/alerts')}
        onSetFocus={() => navigate('/onboarding')}
        onSettings={() => {}}
      />
      <main className="world-pulse-main settings-main">
        <header className="ni-screen-header">
          <div>
            <h1>Account Settings</h1>
            <p>Manage your intelligence profile, preferences, and account data.</p>
          </div>
        </header>

        <div className="settings-grid">
          {/* User Info */}
          {user && (
            <section className="wp-card settings-section">
              <div className="settings-section-head"><User size={16} /> <span>Account</span></div>
              <div className="settings-user-row">
                {user.photoURL && (
                  <img src={user.photoURL} alt="" className="settings-avatar" />
                )}
                <div>
                  <div className="settings-name">{user.displayName}</div>
                  <div className="settings-email">{user.email}</div>
                  {user.uid && <div className="settings-uid">Account ID: {user.uid}</div>}
                </div>
              </div>
            </section>
          )}

          {/* Intelligence Profile */}
          <section className="wp-card settings-section">
            <div className="settings-section-head">
              <Shield size={16} /> <span>Intelligence Profile</span>
              <button className="wp-icon-btn" onClick={() => navigate('/onboarding')}><Pencil size={13} /> Edit</button>
            </div>
            {loading ? (
              <div className="settings-loading">Loading profile...</div>
            ) : prefs ? (
              <>
                <div className="settings-pref-block">
                  <span className="settings-pref-label">Tracked Topics</span>
                  <div className="settings-chips">
                    {cats.length > 0 ? cats.map(c => (
                      <span key={c} className="settings-chip">{c}</span>
                    )) : <span className="settings-empty-text">None set</span>}
                  </div>
                </div>
                <div className="settings-pref-block">
                  <span className="settings-pref-label">Tracked Regions</span>
                  <div className="settings-chips">
                    {regs.length > 0 ? regs.map(r => (
                      <span key={r} className="settings-chip">{r}</span>
                    )) : <span className="settings-empty-text">None set</span>}
                  </div>
                </div>
              </>
            ) : (
              <div className="settings-no-prefs">
                <p>No intelligence profile is saved yet.</p>
                <button className="orbit-story-button" onClick={() => navigate('/onboarding')}>
                  Configure Profile <ChevronRight size={14} />
                </button>
              </div>
            )}
          </section>

          {/* How Scores Work */}
          <section className="wp-card settings-section">
            <div className="settings-section-head">
              <Info size={16} /> <span>How Scores Work</span>
              <button className="wp-icon-btn" onClick={() => setShowMethodology(v => !v)}>
                {showMethodology ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="settings-desc">Transparent methodology for Delta, Pulse, Exposure, and Signal Tiers.</p>
            {showMethodology && (
              <div className="settings-methodology">
                {[
                  ['Daily Delta', 'Current Pulse minus the previous 24h baseline. Shows topic movement once enough history exists.'],
                  ['Pulse Score', '0-100 intensity score using velocity, source count, sentiment, entity impact, and user relevance.'],
                  ['Exposure Score', 'How much a signal may affect you based on topics, entities, regions, and interaction history.'],
                  ['Signal Tier', 'Critical, Signal, Watch, and Noise thresholds turn scores into action priority.'],
                ].map(([title, body]) => (
                  <div key={title} className="settings-method-card">
                    <div className="settings-method-title">{title}</div>
                    <div className="settings-method-body">{body}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="wp-card settings-section settings-danger">
            <div className="settings-section-head danger">
              <Trash2 size={16} /> <span>Account Data</span>
            </div>
            <p className="settings-desc">
              This will permanently delete your saved preferences and log you out.
              You will need to configure your intelligence profile again on the next login.
            </p>
            {!confirmDelete ? (
              <button className="wp-icon-btn danger" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={14} /> Delete Account Data
              </button>
            ) : (
              <div className="settings-confirm-row">
                <button className="wp-icon-btn danger-fill" onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Deleting...' : 'Confirm Deletion'}
                </button>
                <button className="wp-icon-btn" onClick={() => setConfirmDelete(false)}>Cancel</button>
              </div>
            )}
          </section>
        </div>
      </main>
      <LockedNavToast message={lockedToast} />
    </div>
  );
}
