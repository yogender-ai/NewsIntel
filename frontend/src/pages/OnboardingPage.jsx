import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { completeOnboarding } from '../api';
import { Zap, Globe, Newspaper, TrendingUp, Shield, Cpu, Flame, Heart, 
         Landmark, Swords, Leaf, Mic2, Loader, ChevronRight, Sparkles } from 'lucide-react';

const CATEGORIES = [
  { id: 'geopolitics', label: 'Geopolitics', icon: <Globe size={20} />, color: '#8b5cf6' },
  { id: 'technology', label: 'Technology', icon: <Cpu size={20} />, color: '#06b6d4' },
  { id: 'markets', label: 'Markets & Finance', icon: <TrendingUp size={20} />, color: '#10b981' },
  { id: 'defense', label: 'Defense & Security', icon: <Shield size={20} />, color: '#ef4444' },
  { id: 'climate', label: 'Climate & Energy', icon: <Leaf size={20} />, color: '#22c55e' },
  { id: 'health', label: 'Health & Science', icon: <Heart size={20} />, color: '#ec4899' },
  { id: 'politics', label: 'Politics', icon: <Landmark size={20} />, color: '#f59e0b' },
  { id: 'conflict', label: 'Conflict & Crisis', icon: <Swords size={20} />, color: '#f97316' },
  { id: 'entertainment', label: 'Entertainment', icon: <Mic2 size={20} />, color: '#a855f7' },
  { id: 'breaking', label: 'Breaking News', icon: <Flame size={20} />, color: '#ef4444' },
];

const REGIONS = [
  { id: 'global', label: '🌍 Global', desc: 'All regions' },
  { id: 'asia', label: '🌏 Asia Pacific', desc: 'India, China, Japan, SEA' },
  { id: 'americas', label: '🌎 Americas', desc: 'US, Canada, Latin America' },
  { id: 'europe', label: '🇪🇺 Europe', desc: 'EU, UK, Russia' },
  { id: 'mena', label: '🕌 Middle East & Africa', desc: 'MENA, Sub-Saharan Africa' },
];

export default function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedRegions, setSelectedRegions] = useState(['global']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const toggleCategory = (id) => {
    setSelectedCategories(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const toggleRegion = (id) => {
    setSelectedRegions(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const handleComplete = async () => {
    if (selectedCategories.length < 2) {
      setError('Please select at least 2 categories');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await completeOnboarding(user.uid, {
        preferred_categories: selectedCategories,
        preferred_regions: selectedRegions,
      });
      localStorage.setItem('onboarded', 'true');
      navigate('/');
    } catch (err) {
      // Even if the backend call fails, allow them through
      localStorage.setItem('onboarded', 'true');
      navigate('/');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 20px', position: 'relative', zIndex: 1,
    }}>
      <div style={{
        width: '100%', maxWidth: '640px',
        background: 'linear-gradient(180deg, rgba(30,20,60,0.85) 0%, rgba(10,5,20,0.95) 100%)',
        border: '1px solid rgba(139,92,246,0.25)', borderRadius: '28px',
        boxShadow: '0 30px 100px rgba(139,92,246,0.2), inset 0 1px 0 rgba(255,255,255,0.08)',
        padding: '48px 40px', animation: 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{
            width: '56px', height: '56px', margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #a855f7, #6366f1)', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 30px rgba(168,85,247,0.4)',
          }}>
            <Zap size={28} color="#fff" />
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#fff', margin: '0 0 8px', letterSpacing: '-0.5px' }}>
            Welcome, {user?.displayName?.split(' ')[0] || 'Agent'}
          </h1>
          <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0, lineHeight: '1.5' }}>
            Personalize your intelligence feed. Select what matters to you.
          </p>

          {/* Step indicator */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '20px' }}>
            {[1, 2].map(s => (
              <div key={s} style={{
                width: s === step ? '32px' : '8px', height: '8px',
                borderRadius: '4px', transition: 'all 0.3s',
                background: s === step ? 'linear-gradient(90deg, #a855f7, #6366f1)' : 'rgba(255,255,255,0.1)',
              }} />
            ))}
          </div>
        </div>

        {error && (
          <div style={{
            padding: '10px 16px', background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px',
            color: '#fca5a5', fontSize: '12px', marginBottom: '20px', textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        {/* Step 1: Categories */}
        {step === 1 && (
          <div>
            <div style={{ fontSize: '12px', color: '#8b5cf6', fontWeight: '700', letterSpacing: '1.5px', marginBottom: '16px' }}>
              <Newspaper size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
              SELECT YOUR INTERESTS (min 2)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              {CATEGORIES.map(cat => {
                const selected = selectedCategories.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    onClick={() => toggleCategory(cat.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '14px 16px', borderRadius: '14px', cursor: 'pointer',
                      border: selected ? `2px solid ${cat.color}` : '2px solid rgba(255,255,255,0.06)',
                      background: selected ? `${cat.color}18` : 'rgba(255,255,255,0.02)',
                      color: selected ? cat.color : '#94a3b8',
                      transition: 'all 0.25s', fontSize: '13px', fontWeight: '600',
                      boxShadow: selected ? `0 0 20px ${cat.color}20` : 'none',
                    }}
                  >
                    <span style={{ opacity: selected ? 1 : 0.5, transition: 'opacity 0.2s' }}>{cat.icon}</span>
                    {cat.label}
                    {selected && <Sparkles size={12} style={{ marginLeft: 'auto', color: cat.color }} />}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => { if (selectedCategories.length >= 2) setStep(2); else setError('Please select at least 2 categories'); }}
              disabled={selectedCategories.length < 2}
              style={{
                width: '100%', marginTop: '24px', padding: '14px',
                background: selectedCategories.length >= 2
                  ? 'linear-gradient(135deg, #8b5cf6, #6366f1)'
                  : 'rgba(255,255,255,0.05)',
                border: 'none', borderRadius: '14px', color: '#fff',
                fontSize: '14px', fontWeight: '700', cursor: selectedCategories.length >= 2 ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                transition: 'all 0.3s', opacity: selectedCategories.length >= 2 ? 1 : 0.5,
                boxShadow: selectedCategories.length >= 2 ? '0 4px 30px rgba(139,92,246,0.4)' : 'none',
              }}
            >
              Continue <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Step 2: Regions */}
        {step === 2 && (
          <div>
            <div style={{ fontSize: '12px', color: '#8b5cf6', fontWeight: '700', letterSpacing: '1.5px', marginBottom: '16px' }}>
              <Globe size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
              SELECT YOUR REGIONS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {REGIONS.map(region => {
                const selected = selectedRegions.includes(region.id);
                return (
                  <button
                    key={region.id}
                    onClick={() => toggleRegion(region.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '14px',
                      padding: '16px 18px', borderRadius: '14px', cursor: 'pointer',
                      border: selected ? '2px solid #8b5cf6' : '2px solid rgba(255,255,255,0.06)',
                      background: selected ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.02)',
                      transition: 'all 0.25s', textAlign: 'left',
                      boxShadow: selected ? '0 0 20px rgba(139,92,246,0.15)' : 'none',
                    }}
                  >
                    <span style={{ fontSize: '24px' }}>{region.label.split(' ')[0]}</span>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: selected ? '#c084fc' : '#e2e8f0' }}>
                        {region.label.split(' ').slice(1).join(' ')}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{region.desc}</div>
                    </div>
                    {selected && <Sparkles size={14} style={{ marginLeft: 'auto', color: '#8b5cf6' }} />}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  flex: 1, padding: '14px', background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px',
                  color: '#94a3b8', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
                }}
              >
                Back
              </button>
              <button
                onClick={handleComplete}
                disabled={saving}
                style={{
                  flex: 2, padding: '14px',
                  background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                  border: 'none', borderRadius: '14px', color: '#fff',
                  fontSize: '14px', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  boxShadow: '0 4px 30px rgba(139,92,246,0.4)',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? <Loader size={16} className="spin" /> : <Zap size={16} />}
                {saving ? 'Setting up...' : 'Launch Intelligence Feed'}
              </button>
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '10px', color: '#475569' }}>
          Your preferences shape your AI-powered news feed
        </div>
      </div>
    </div>
  );
}
