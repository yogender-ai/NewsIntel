import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getPreferences();
        if (res.status === 'success' && res.data) setPrefs(res.data);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.deleteAccount();
      await logout();
      navigate('/login');
    } catch (e) {
      console.error(e);
      alert('Failed to delete account data. Try again.');
    }
    setDeleting(false);
  };

  const cats = prefs?.preferred_categories ? JSON.parse(prefs.preferred_categories) : [];
  const regs = prefs?.preferred_regions ? JSON.parse(prefs.preferred_regions) : [];

  return (
    <div style={{ maxWidth: 600, margin: '40px auto 0' }}>
      <div className="label" style={{ marginBottom: 24 }}>ACCOUNT SETTINGS</div>

      {/* User Info */}
      {user && (
        <div className="panel fin" style={{ padding: 24, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            {user.photoURL && (
              <img src={user.photoURL} alt="" style={{ width: 48, height: 48, borderRadius: '50%', border: '2px solid var(--accent-border)' }} />
            )}
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{user.displayName}</div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>{user.email}</div>
              <div className="mono" style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 2 }}>UID: {user.uid?.slice(0, 12)}...</div>
            </div>
          </div>
        </div>
      )}

      {/* Current Preferences */}
      <div className="panel fin" style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="label">YOUR INTELLIGENCE PROFILE</div>
          <button className="wire-btn" onClick={() => navigate('/onboarding')}>EDIT →</button>
        </div>
        {loading ? (
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>Loading...</span>
        ) : prefs ? (
          <>
            <div style={{ marginBottom: 12 }}>
              <div className="mono" style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 6, letterSpacing: 1 }}>TRACKED TOPICS</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {cats.length > 0 ? cats.map(c => (
                  <span key={c} className="chip chip-sel" style={{ fontSize: 11, padding: '4px 10px' }}>{c}</span>
                )) : <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>None set</span>}
              </div>
            </div>
            <div>
              <div className="mono" style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 6, letterSpacing: 1 }}>TRACKED REGIONS</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {regs.length > 0 ? regs.map(r => (
                  <span key={r} className="chip chip-sel" style={{ fontSize: 11, padding: '4px 10px' }}>{r}</span>
                )) : <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>None set</span>}
              </div>
            </div>
          </>
        ) : (
          <div>
            <span className="mono" style={{ fontSize: 11, color: 'var(--warn)' }}>No preferences saved yet.</span>
            <button className="btn btn-primary" style={{ marginTop: 12, width: '100%' }} onClick={() => navigate('/onboarding')}>
              Set Up Your Feed →
            </button>
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="panel" style={{ padding: 24, borderColor: 'rgba(255,59,92,0.2)' }}>
        <div className="label" style={{ color: 'var(--neg)', marginBottom: 12 }}>DANGER ZONE</div>
        <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 16 }}>
          This will permanently delete your saved preferences and log you out. 
          You'll need to set up your intelligence profile again on next login.
        </p>
        {!confirmDelete ? (
          <button
            className="wire-btn"
            style={{ borderColor: 'rgba(255,59,92,0.3)', color: 'var(--neg)' }}
            onClick={() => setConfirmDelete(true)}
          >
            Delete My Account Data
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              className="btn"
              style={{ background: 'rgba(255,59,92,0.15)', color: '#ff3b5c', border: '1px solid rgba(255,59,92,0.3)', fontWeight: 700 }}
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Yes, Delete Everything'}
            </button>
            <button className="wire-btn" onClick={() => setConfirmDelete(false)}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}
