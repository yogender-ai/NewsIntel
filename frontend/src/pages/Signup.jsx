import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth-context';

export default function Signup() {
  const { signup, isAuthed, loading } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  if (loading) return <div className="auth-page" />;
  if (isAuthed) return <Navigate to="/today" replace />;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const weak = form.password.length > 0 && form.password.length < 8;
  const noMix = form.password.length >= 8 && (/^\d+$/.test(form.password) || /^[A-Za-z]+$/.test(form.password));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signup(form.email, form.password, form.name);
      navigate('/welcome', { replace: true });
    } catch (err) {
      setError(err.message || 'Could not create the account.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <h1 className="auth-brand">News<span>Intel</span></h1>
        <p className="auth-tagline">
          Tell us what you do. We’ll tell you which news actually moves your world.
        </p>

        <form onSubmit={submit} className="stack gap-4">
          <div>
            <label className="label" htmlFor="name">Your name</label>
            <input id="name" className="input" autoComplete="name" value={form.name} onChange={set('name')} />
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email" className="input" type="email" autoComplete="email" required
              value={form.email} onChange={set('email')}
            />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password" className="input" type="password" autoComplete="new-password" required
              value={form.password} onChange={set('password')}
              aria-describedby="pw-hint"
            />
            <p className="hint" id="pw-hint" style={{ marginTop: 6 }}>
              {weak ? 'At least 8 characters.'
                : noMix ? 'Mix letters and numbers.'
                : 'At least 8 characters, mixing letters and numbers.'}
            </p>
          </div>

          {error && <p className="form-error" role="alert">{error}</p>}

          <button className="btn btn-primary" type="submit" disabled={busy || weak || noMix}>
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </form>

        <p className="auth-alt">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
