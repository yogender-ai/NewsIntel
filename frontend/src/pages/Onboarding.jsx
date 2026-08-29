import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useAuth } from '../context/auth-context';
import { REGIONS, SENIORITY, TOPICS } from '../lib/taxonomy';

const STEPS = ['Interests', 'Where', 'About you'];

export default function Onboarding() {
  const { account, profile, saveProfile, loading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [topics, setTopics] = useState(profile?.topics ?? []);
  const [regions, setRegions] = useState(profile?.regions ?? []);
  const [about, setAbout] = useState({
    occupation: profile?.occupation ?? '',
    role_title: profile?.role_title ?? '',
    industry: profile?.industry ?? '',
    seniority: profile?.seniority ?? '',
    country: profile?.country ?? '',
    self_description: profile?.self_description ?? '',
  });

  const preview = useMemo(() => {
    const bits = [about.seniority, about.role_title || about.occupation].filter(Boolean).join(' ');
    const where = about.country ? ` in ${about.country}` : '';
    const field = about.industry ? `, working in ${about.industry}` : '';
    return bits ? `${bits}${where}${field}.` : '';
  }, [about]);

  if (loading) return null;
  if (!account) return <Navigate to="/login" replace />;

  const toggle = (list, setList, id, { exclusive } = {}) => {
    if (exclusive && id === 'global') {
      setList(list.includes('global') ? [] : ['global']);
      return;
    }
    const next = list.includes(id) ? list.filter((x) => x !== id) : [...list.filter((x) => x !== 'global'), id];
    setList(next);
  };

  const canNext = step === 0 ? topics.length >= 2 : step === 1 ? regions.length >= 1 : true;

  const finish = async () => {
    setBusy(true);
    setError('');
    try {
      await saveProfile({
        topics, regions, ...about,
        onboarded: true, onboarding_step: STEPS.length,
      });
      navigate('/today', { replace: true });
    } catch (err) {
      setError(err.message || 'Could not save your preferences.');
      setBusy(false);
    }
  };

  return (
    <div className="onboard">
      <ol className="onboard-steps" aria-label="Progress">
        {STEPS.map((label, i) => (
          <li key={label} className={i === step ? 'is-current' : i < step ? 'is-done' : ''}>
            <span className="onboard-dot">{i < step ? <Check size={12} /> : i + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <section className="onboard-panel">
          <h1>What should we watch for you?</h1>
          <p className="onboard-lead">
            Pick at least two. These decide which newsrooms we read on your behalf —
            you can change them any time.
          </p>
          <div className="chip-grid">
            {TOPICS.map((t) => (
              <button
                key={t.id} type="button" className="chip chip-lg"
                aria-pressed={topics.includes(t.id)}
                onClick={() => toggle(topics, setTopics, t.id)}
              >
                <span className="chip-lg-text">
                  <strong>{t.label}</strong>
                  <small>{t.blurb}</small>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="onboard-panel">
          <h1>Anywhere in particular?</h1>
          <p className="onboard-lead">
            We’ll weight stories from these places more heavily. Choose “Everywhere” if
            you don’t want a regional bias.
          </p>
          <div className="chip-row">
            {REGIONS.map((r) => (
              <button
                key={r.id} type="button" className="chip"
                aria-pressed={regions.includes(r.id)}
                onClick={() => toggle(regions, setRegions, r.id, { exclusive: true })}
              >
                {r.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="onboard-panel">
          <h1>Who are you?</h1>
          <p className="onboard-lead">
            This is the part that makes NewsIntel different. Knowing what you do lets us
            explain <em>how a story affects you specifically</em> — not just what happened.
            Everything here is optional, but the more you say, the sharper that gets.
          </p>

          <div className="form-grid">
            <div>
              <label className="label" htmlFor="occupation">What do you do?</label>
              <input
                id="occupation" className="input" placeholder="Supply chain manager"
                value={about.occupation}
                onChange={(e) => setAbout({ ...about, occupation: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="industry">Industry</label>
              <input
                id="industry" className="input" placeholder="Consumer electronics"
                value={about.industry}
                onChange={(e) => setAbout({ ...about, industry: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="role">Job title</label>
              <input
                id="role" className="input" placeholder="Head of Logistics"
                value={about.role_title}
                onChange={(e) => setAbout({ ...about, role_title: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="seniority">Level</label>
              <select
                id="seniority" className="select" value={about.seniority}
                onChange={(e) => setAbout({ ...about, seniority: e.target.value })}
              >
                <option value="">Prefer not to say</option>
                {SENIORITY.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="country">Country</label>
              <input
                id="country" className="input" placeholder="India"
                value={about.country}
                onChange={(e) => setAbout({ ...about, country: e.target.value })}
              />
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <label className="label" htmlFor="self">In your own words</label>
            <textarea
              id="self" className="textarea"
              placeholder="I import electronics components from Asia into the EU and plan freight budgets each quarter."
              value={about.self_description}
              onChange={(e) => setAbout({ ...about, self_description: e.target.value })}
              aria-describedby="self-hint"
            />
            <p className="hint" id="self-hint">
              One or two sentences about your work and what you worry about. This is the
              single strongest signal we have for matching news to you.
            </p>
          </div>

          {preview && (
            <p className="onboard-preview">
              We’ll read the news as: <strong>{preview}</strong>
            </p>
          )}
        </section>
      )}

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="onboard-actions">
        {step > 0 && (
          <button className="btn" onClick={() => setStep((s) => s - 1)} disabled={busy}>
            <ArrowLeft size={15} aria-hidden="true" /> Back
          </button>
        )}
        <div className="grow" />
        {step < STEPS.length - 1 ? (
          <button className="btn btn-primary" onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
            Continue <ArrowRight size={15} aria-hidden="true" />
          </button>
        ) : (
          <button className="btn btn-primary" onClick={finish} disabled={busy}>
            {busy ? 'Setting up…' : 'Open my briefing'}
          </button>
        )}
      </div>

      {step === 0 && topics.length < 2 && (
        <p className="hint onboard-req">Choose at least two topics to continue.</p>
      )}
    </div>
  );
}
