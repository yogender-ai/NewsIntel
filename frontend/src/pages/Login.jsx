import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth-context';

export default function Login() {
  const { login, isAuthed, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  if (loading) return <div className="auth-page" />;
  if (isAuthed) return <Navigate to="/today" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const account = await login(email, password);
      navigate(account?.profile?.onboarded ? '/today' : '/welcome', { replace: true });
    } catch (err) {
      setError(err.message || 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <h1 className="auth-brand">News<span>Intel</span></h1>
        <p className="auth-tagline">
          The news that changes your decisions — and why it changes them.
        </p>

        <form onSubmit={submit} className="stack gap-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email" className="input" type="email" autoComplete="email" required
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password" className="input" type="password" autoComplete="current-password" required
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="form-error" role="alert">{error}</p>}

          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="auth-alt">
          New here? <Link to="/signup">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
