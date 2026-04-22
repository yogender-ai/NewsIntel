import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

const TOPICS = [
  { id: 'tech', label: 'Technology', icon: '⚡' },
  { id: 'politics', label: 'Politics', icon: '🏛' },
  { id: 'markets', label: 'Markets', icon: '📈' },
  { id: 'ai', label: 'AI & ML', icon: '🤖' },
  { id: 'climate', label: 'Climate', icon: '🌍' },
  { id: 'healthcare', label: 'Healthcare', icon: '🏥' },
  { id: 'defense', label: 'Defense', icon: '🛡' },
  { id: 'energy', label: 'Energy', icon: '⚛' },
];

const REGIONS = [
  { id: 'us', label: 'United States', flag: '🇺🇸' },
  { id: 'china', label: 'China', flag: '🇨🇳' },
  { id: 'india', label: 'India', flag: '🇮🇳' },
  { id: 'europe', label: 'Europe', flag: '🇪🇺' },
  { id: 'middle-east', label: 'Middle East', flag: '🌙' },
  { id: 'russia', label: 'Russia', flag: '🇷🇺' },
  { id: 'japan', label: 'Japan', flag: '🇯🇵' },
  { id: 'latam', label: 'Latin America', flag: '🌎' },
];

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [topics, setTopics] = useState([]);
  const [regions, setRegions] = useState([]);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const toggle = (item, list, setList) => {
    setList(list.includes(item) ? list.filter(i => i !== item) : [...list, item]);
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      await api.savePreferences({
        display_name: '',
        email: '',
        preferred_categories: topics,
        preferred_regions: regions,
        youtube_channels: [],
        onboarded: true,
      });
    } catch (e) {
      console.error('Save failed:', e);
    }
    setSaving(false);
    navigate('/dashboard');
  };

  return (
    <div style={{ maxWidth: '560px', margin: '60px auto 0' }}>
      {/* Progress indicator */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '48px' }}>
        {[1, 2].map(s => (
          <div key={s} style={{
            flex: 1, height: '3px', borderRadius: '2px',
            background: step >= s ? 'var(--cyan)' : 'var(--bg-tertiary)',
            transition: 'background 0.3s var(--ease-out)',
          }} />
        ))}
      </div>

      {step === 1 && (
        <div className="fade-in">
          <p className="label" style={{ marginBottom: '12px', color: 'var(--cyan)' }}>STEP 1 OF 2</p>
          <h1 style={{ fontSize: '28px', fontWeight: 700, lineHeight: 1.2, marginBottom: '8px' }}>
            What do you care about?
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px', marginBottom: '32px' }}>
            We'll synthesize intelligence around these topics. Pick at least 2.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '40px' }}>
            {TOPICS.map(t => (
              <button
                key={t.id}
                className={`chip ${topics.includes(t.id) ? 'chip-selected' : ''}`}
                onClick={() => toggle(t.id, topics, setTopics)}
              >
                <span>{t.icon}</span> {t.label}
              </button>
            ))}
          </div>
          <button
            className="btn btn-primary"
            style={{ width: '100%', padding: '14px', fontSize: '15px' }}
            onClick={() => setStep(2)}
            disabled={topics.length < 2}
          >
            Continue
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="fade-in">
          <p className="label" style={{ marginBottom: '12px', color: 'var(--cyan)' }}>STEP 2 OF 2</p>
          <h1 style={{ fontSize: '28px', fontWeight: 700, lineHeight: 1.2, marginBottom: '8px' }}>
            Where in the world?
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px', marginBottom: '32px' }}>
            Select regions to track. We'll surface tension and stories from these areas.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '40px' }}>
            {REGIONS.map(r => (
              <button
                key={r.id}
                className={`chip ${regions.includes(r.id) ? 'chip-selected' : ''}`}
                onClick={() => toggle(r.id, regions, setRegions)}
              >
                <span>{r.flag}</span> {r.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn" style={{ flex: 1 }} onClick={() => setStep(1)}>
              Back
            </button>
            <button
              className="btn btn-primary"
              style={{ flex: 2, padding: '14px', fontSize: '15px' }}
              onClick={handleComplete}
              disabled={regions.length < 1 || saving}
            >
              {saving ? 'Saving...' : 'Launch Dashboard →'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
