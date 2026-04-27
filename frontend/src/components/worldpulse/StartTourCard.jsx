import { ArrowRight, Zap } from 'lucide-react';

export default function StartTourCard({ onStart }) {
  return (
    <section 
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 24px',
        background: 'linear-gradient(90deg, rgba(141, 162, 255, 0.05), rgba(126, 231, 196, 0.05))',
        border: '1px solid rgba(141, 162, 255, 0.1)',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        marginTop: '12px'
      }}
    >
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(141, 162, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8da2ff' }}>
          <Zap size={20} />
        </div>
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#f8fafc', margin: '0 0 4px 0', letterSpacing: '0.02em' }}>Initialize Command Center</h3>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Configure your intelligence feeds and alerts.</p>
        </div>
      </div>
      <button 
        onClick={onStart}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 16px',
          background: '#8da2ff',
          color: '#0f172a',
          border: 'none',
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: 800,
          cursor: 'pointer',
          transition: 'transform 0.2s, background 0.2s',
          boxShadow: '0 4px 12px rgba(141, 162, 255, 0.3)'
        }}
        onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.background = '#a5b4fc'; }}
        onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.background = '#8da2ff'; }}
      >
        START SETUP <ArrowRight size={14} />
      </button>
    </section>
  );
}
