import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

const TOPICS = [
  { id: 'tech', label: 'Technology', icon: '⚡' },
  { id: 'politics', label: 'Geopolitics', icon: '🌐' },
  { id: 'markets', label: 'Markets & Finance', icon: '📈' },
  { id: 'ai', label: 'AI & ML', icon: '🧠' },
  { id: 'climate', label: 'Climate & Energy', icon: '🌍' },
  { id: 'healthcare', label: 'Healthcare', icon: '🏥' },
  { id: 'defense', label: 'Defense & Security', icon: '🛡' },
  { id: 'crypto', label: 'Crypto & Web3', icon: '₿' },
  { id: 'space', label: 'Space', icon: '🚀' },
  { id: 'trade', label: 'Supply Chain', icon: '🚢' },
];

const REGIONS = [
  { id: 'us', label: 'United States', flag: '🇺🇸' },
  { id: 'china', label: 'China', flag: '🇨🇳' },
  { id: 'india', label: 'India', flag: '🇮🇳' },
  { id: 'europe', label: 'Europe', flag: '🇪🇺' },
  { id: 'middle-east', label: 'Middle East', flag: '🌙' },
  { id: 'russia', label: 'Russia & CIS', flag: '🇷🇺' },
  { id: 'japan-korea', label: 'Japan & Korea', flag: '🇯🇵' },
  { id: 'latam', label: 'Latin America', flag: '🌎' },
  { id: 'africa', label: 'Africa', flag: '🌍' },
  { id: 'southeast-asia', label: 'SE Asia', flag: '🇸🇬' },
];

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [topics, setTopics] = useState([]);
  const [regions, setRegions] = useState([]);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const toggle = (item, list, set) => {
    set(list.includes(item) ? list.filter(i => i !== item) : [...list, item]);
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      await api.savePreferences({
        display_name: '', email: '',
        preferred_categories: topics, preferred_regions: regions,
        youtube_channels: [], onboarded: true,
      });
    } catch (e) { console.error(e); }
    setSaving(false);
    navigate('/dashboard');
  };

  return (
    <div style={{ maxWidth: 540, margin: '60px auto 0' }}>
      {/* Progress */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 48 }}>
        {[1, 2].map(s => (
          <div key={s} style={{
            flex: 1, height: 2, borderRadius: 1,
            background: step >= s ? 'var(--accent)' : 'var(--bg-elevated)',
            transition: 'background 0.4s var(--ease)',
            boxShadow: step >= s ? '0 0 8px rgba(0,212,255,0.2)' : 'none',
          }} />
        ))}
      </div>

      {step === 1 && (
        <div className="fin">
          <p className="label" style={{ marginBottom: 12, color: 'var(--accent)' }}>STEP 1 · INTERESTS</p>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.6px', marginBottom: 6 }}>
            What intelligence do you need?
          </h1>
          <p style={{ color: 'var(--t3)', fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>
            Your feed will only surface stories relevant to these topics.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 40 }}>
            {TOPICS.map(t => (
              <button key={t.id}
                className={`chip ${topics.includes(t.id) ? 'chip-sel' : ''}`}
                onClick={() => toggle(t.id, topics, setTopics)}
              >{t.icon} {t.label}</button>
            ))}
          </div>
          <button className="btn btn-primary" style={{ width: '100%', padding: 14 }}
            onClick={() => setStep(2)} disabled={topics.length < 2}>
            Continue →
          </button>
          {topics.length < 2 && (
            <p style={{ fontSize: 10, color: 'var(--t4)', textAlign: 'center', marginTop: 8 }}>Select at least 2</p>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="fin">
          <p className="label" style={{ marginBottom: 12, color: 'var(--accent)' }}>STEP 2 · REGIONS</p>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.6px', marginBottom: 6 }}>
            Where in the world?
          </h1>
          <p style={{ color: 'var(--t3)', fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>
            We track tension levels and surface intelligence from these regions.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 40 }}>
            {REGIONS.map(r => (
              <button key={r.id}
                className={`chip ${regions.includes(r.id) ? 'chip-sel' : ''}`}
                onClick={() => toggle(r.id, regions, setRegions)}
              >{r.flag} {r.label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn" onClick={() => setStep(1)}>← Back</button>
            <button className="btn btn-primary" style={{ flex: 1, padding: 14 }}
              onClick={handleComplete} disabled={regions.length < 1 || saving}>
              {saving ? 'Saving...' : 'Launch Dashboard →'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
