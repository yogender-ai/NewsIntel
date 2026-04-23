import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

const TOPICS = [
  { id: 'tech', label: 'Technology', icon: '⚡' },
  { id: 'politics', label: 'Geopolitics', icon: '🌐' },
  { id: 'markets', label: 'Markets & Finance', icon: '📈' },
  { id: 'ai', label: 'AI & ML', icon: '🧠' },
  { id: 'climate', label: 'Climate & Energy', icon: '🌍' },
  { id: 'healthcare', label: 'Healthcare & Pharma', icon: '🏥' },
  { id: 'defense', label: 'Defense & Security', icon: '🛡' },
  { id: 'crypto', label: 'Crypto & Web3', icon: '₿' },
  { id: 'space', label: 'Space & Aerospace', icon: '🚀' },
  { id: 'trade', label: 'Supply Chain & Trade', icon: '🚢' },
  { id: 'auto', label: 'Automotive & EVs', icon: '🚗' },
  { id: 'telecom', label: 'Telecom & 5G', icon: '📡' },
  { id: 'real-estate', label: 'Real Estate', icon: '🏗' },
  { id: 'media', label: 'Media & Entertainment', icon: '🎬' },
  { id: 'education', label: 'Education & EdTech', icon: '🎓' },
  { id: 'legal', label: 'Legal & Regulation', icon: '⚖️' },
];

const REGIONS = [
  { id: 'global', label: 'Global (All)', flag: '🌍' },
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
  { id: 'uk', label: 'United Kingdom', flag: '🇬🇧' },
  { id: 'canada', label: 'Canada', flag: '🇨🇦' },
  { id: 'australia', label: 'Australia & NZ', flag: '🇦🇺' },
];

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [topics, setTopics] = useState([]);
  const [regions, setRegions] = useState([]);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const toggle = (item, list, set) => {
    // Special: if "global" is selected, deselect all others; if selecting a region while global is on, deselect global
    if (item === 'global' && list !== topics) {
      set(['global']);
      return;
    }
    if (list.includes('global') && item !== 'global' && list !== topics) {
      set([item]);
      return;
    }
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
    <div style={{ maxWidth: 580, margin: '60px auto 0' }}>

      {/* Progress bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 48 }}>
        {[1, 2].map(s => (
          <div key={s} style={{
            flex: 1, height: 2, borderRadius: 1,
            background: step >= s ? 'var(--accent)' : 'var(--bg-elevated)',
            transition: 'background 0.4s var(--ease)',
            boxShadow: step >= s ? '0 0 8px var(--accent-glow)' : 'none',
          }} />
        ))}
      </div>

      {step === 1 && (
        <div className="fin">
          <span className="mono-label" style={{ marginBottom: 12, display: 'block' }}>STEP 01 · INTELLIGENCE INTERESTS</span>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 8 }}>
            What intelligence do you need?
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>
            Select topics to track. Your feed will prioritize stories matching these interests.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 40 }}>
            {TOPICS.map(t => (
              <button key={t.id}
                className={`chip ${topics.includes(t.id) ? 'chip-sel' : ''}`}
                onClick={() => toggle(t.id, topics, setTopics)}
              >{t.icon} {t.label}</button>
            ))}
          </div>
          <button className="btn btn-primary" style={{ width: '100%', padding: 14, fontSize: 14 }}
            onClick={() => setStep(2)} disabled={topics.length < 2}>
            Continue →
          </button>
          {topics.length < 2 && (
            <p style={{ fontSize: 10, color: 'var(--text-3)', textAlign: 'center', marginTop: 8 }}>Select at least 2 topics</p>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="fin">
          <span className="mono-label" style={{ marginBottom: 12, display: 'block' }}>STEP 02 · REGIONS</span>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 8 }}>
            Where in the world?
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>
            We track tension levels and surface intelligence from these regions.
            Select <strong style={{ color: 'var(--accent)' }}>Global</strong> for worldwide coverage.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 40 }}>
            {REGIONS.map(r => (
              <button key={r.id}
                className={`chip ${regions.includes(r.id) ? 'chip-sel' : ''}`}
                onClick={() => toggle(r.id, regions, setRegions)}
                style={r.id === 'global' ? { borderColor: regions.includes('global') ? 'var(--accent)' : 'var(--accent-border)', fontWeight: 700 } : {}}
              >{r.flag} {r.label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn" onClick={() => setStep(1)}>← Back</button>
            <button className="btn btn-primary" style={{ flex: 1, padding: 14, fontSize: 14 }}
              onClick={handleComplete} disabled={regions.length < 1 || saving}>
              {saving ? 'Launching...' : 'Launch Dashboard →'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
