import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth-context';
import { api } from '../lib/api';
import { REGIONS, SENIORITY, TOPICS } from '../lib/taxonomy';
import { useTheme } from '../context/theme-context';

export default function Settings() {
  const { account, profile, saveProfile, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [form, setForm] = useState({
    topics: profile?.topics ?? [],
    regions: profile?.regions ?? [],
    occupation: profile?.occupation ?? '',
    role_title: profile?.role_title ?? '',
    industry: profile?.industry ?? '',
    seniority: profile?.seniority ?? '',
    country: profile?.country ?? '',
    self_description: profile?.self_description ?? '',
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggle = (key, id) =>
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(id) ? f[key].filter((x) => x !== id) : [...f[key], id],
    }));

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await saveProfile(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  const destroy = async () => {
    try {
      await api.deleteAccount();
      await logout();
      navigate('/signup', { replace: true });
    } catch (err) {
      setError(err.message || 'Could not delete the account.');
    }
  };

  return (
    <div className="page page-narrow">
      <header className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="page-sub">Signed in as {account?.email}</p>
        </div>
      </header>

      <section className="card settings-block">
        <h2>Appearance</h2>
        <div className="chip-row">
          {['light', 'dark', 'system'].map((t) => (
            <button key={t} className="chip" aria-pressed={theme === t} onClick={() => setTheme(t)}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </section>

      <section className="card settings-block">
        <h2>Topics</h2>
        <p className="hint">What we read on your behalf.</p>
        <div className="chip-row">
          {TOPICS.map((t) => (
            <button key={t.id} className="chip" aria-pressed={form.topics.includes(t.id)}
              onClick={() => toggle('topics', t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section className="card settings-block">
        <h2>Regions</h2>
        <div className="chip-row">
          {REGIONS.map((r) => (
            <button key={r.id} className="chip" aria-pressed={form.regions.includes(r.id)}
              onClick={() => toggle('regions', r.id)}>
              {r.label}
            </button>
          ))}
        </div>
      </section>

      <section className="card settings-block">
        <h2>About you</h2>
        <p className="hint">
          Used to explain how each story affects your work. The more specific, the better
          the “what this means for you” lines get.
        </p>
        <div className="form-grid">
          <div>
            <label className="label" htmlFor="s-occ">Occupation</label>
            <input id="s-occ" className="input" value={form.occupation} onChange={set('occupation')} />
          </div>
          <div>
            <label className="label" htmlFor="s-ind">Industry</label>
            <input id="s-ind" className="input" value={form.industry} onChange={set('industry')} />
          </div>
          <div>
            <label className="label" htmlFor="s-role">Job title</label>
            <input id="s-role" className="input" value={form.role_title} onChange={set('role_title')} />
          </div>
          <div>
            <label className="label" htmlFor="s-sen">Level</label>
            <select id="s-sen" className="select" value={form.seniority} onChange={set('seniority')}>
              <option value="">Prefer not to say</option>
              {SENIORITY.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="s-country">Country</label>
            <input id="s-country" className="input" value={form.country} onChange={set('country')} />
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <label className="label" htmlFor="s-desc">In your own words</label>
          <textarea id="s-desc" className="textarea" value={form.self_description} onChange={set('self_description')} />
        </div>
      </section>

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="row gap-3">
        <button className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
        {saved && <span className="hint" role="status">Saved.</span>}
      </div>

      <section className="card settings-block danger">
        <h2>Delete account</h2>
        <p className="hint">Removes your profile, preferences and sessions. This cannot be undone.</p>
        {confirmDelete ? (
          <div className="row gap-2">
            <button className="btn btn-danger" onClick={destroy}>Yes, delete everything</button>
            <button className="btn" onClick={() => setConfirmDelete(false)}>Cancel</button>
          </div>
        ) : (
          <button className="btn" onClick={() => setConfirmDelete(true)}>Delete my account</button>
        )}
      </section>
    </div>
  );
}
