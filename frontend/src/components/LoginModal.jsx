import { useState } from 'react';
import { X, Zap, Loader } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

export default function LoginModal({ isOpen, onClose }) {
  const { loginWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      await loginWithGoogle();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to login with Google.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-modal-overlay" style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(5, 2, 10, 0.85)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeIn 0.3s ease-out'
    }}>
      <div className="login-modal-box" style={{
        width: '100%', maxWidth: '420px', padding: '40px 32px',
        background: 'linear-gradient(180deg, rgba(30, 20, 60, 0.9) 0%, rgba(15, 10, 30, 0.95) 100%)',
        border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '24px',
        boxShadow: '0 20px 80px rgba(139, 92, 246, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        position: 'relative', textAlign: 'center',
        transform: 'translateY(0)', animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none',
          color: '#94a3b8', cursor: 'pointer', transition: 'color 0.2s'
        }}>
          <X size={20} />
        </button>

        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #a855f7, #6366f1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(168, 85, 247, 0.4)' }}>
              <Zap size={20} color="#fff" />
            </div>
            <span style={{ fontSize: '24px', fontWeight: '800', color: '#fff', letterSpacing: '-0.5px' }}>NewsIntel</span>
          </div>
        </div>

        {/* Header Text */}
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '12px' }}>Sign in to NewsIntel</h2>
        <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '32px', lineHeight: '1.5' }}>
          Stay smart with personalized news and AI-powered insights.
        </p>

        {error && (
          <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '8px', color: '#fca5a5', fontSize: '12px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {/* Sign In Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button 
            onClick={handleGoogleLogin}
            disabled={loading}
            style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
            width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px',
            color: '#e2e8f0', fontSize: '14px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s', opacity: loading ? 0.7 : 1
          }}>
            {loading ? <Loader size={18} className="spin" /> : <img src="https://img.icons8.com/color/24/000000/google-logo.png" alt="Google" width="18" />}
            {loading ? 'Signing in...' : 'Continue with Google'}
          </button>
          
          <button 
            disabled
            style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
            width: '100%', padding: '12px', background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px',
            color: '#64748b', fontSize: '14px', fontWeight: '600', cursor: 'not-allowed',
            transition: 'all 0.2s'
          }}>
            <img src="https://img.icons8.com/ios-filled/24/64748b/github.png" alt="GitHub" width="18" />
            Continue with GitHub (Coming Soon)
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '24px 0' }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>or</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
        </div>

        <button 
          disabled
          style={{
          width: '100%', padding: '14px', background: 'rgba(139, 92, 246, 0.2)',
          border: 'none', borderRadius: '12px', color: '#a855f7', fontSize: '15px', fontWeight: '600',
          cursor: 'not-allowed', transition: 'all 0.3s'
        }}>
          Email Sign In
        </button>

        <div style={{ marginTop: '24px', fontSize: '10px', color: '#475569', lineHeight: '1.5' }}>
          By continuing, you agree to our <span style={{ color: '#64748b' }}>Terms of Service</span> and <span style={{ color: '#64748b' }}>Privacy Policy</span>
        </div>

      </div>
    </div>
  );
}
