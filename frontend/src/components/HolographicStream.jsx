import { useNavigate } from 'react-router-dom';
import { Activity, Zap } from 'lucide-react';

export default function HolographicStream({ headlines = [] }) {
  const navigate = useNavigate();

  if (!headlines || headlines.length === 0) return null;

  // Duplicate for seamless infinite scroll
  const streamData = [...headlines, ...headlines, ...headlines];

  return (
    <div className="holographic-stream-container" style={{
      width: '100%',
      background: 'rgba(5, 8, 15, 0.9)',
      borderTop: '1px solid rgba(250, 204, 21, 0.2)',
      borderBottom: '1px solid rgba(250, 204, 21, 0.2)',
      padding: '12px 0',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      boxShadow: '0 0 30px rgba(250, 204, 21, 0.1) inset'
    }}>
      {/* Side Glow Effects */}
      <div style={{ position: 'absolute', left: 0, width: '100px', height: '100%', background: 'linear-gradient(90deg, #05080f 20%, transparent)', zIndex: 2 }} />
      <div style={{ position: 'absolute', right: 0, width: '100px', height: '100%', background: 'linear-gradient(270deg, #05080f 20%, transparent)', zIndex: 2 }} />

      {/* Title block */}
      <div style={{
        position: 'absolute', left: 0, zIndex: 3, 
        background: '#05080f', 
        padding: '0 20px', display: 'flex', alignItems: 'center', gap: '8px',
        color: 'var(--accent-orange)', fontWeight: 600, fontSize: '12px', letterSpacing: '2px', borderRight: '1px solid rgba(255,255,255,0.1)'
      }}>
        <Activity size={14} className="pulse-animation" />
        LIVE INTEL
      </div>

      {/* Running Stream */}
      <div className="holographic-marquee" style={{
        display: 'flex',
        whiteSpace: 'nowrap',
        animation: 'holographic-scroll 60s linear infinite',
        paddingLeft: '140px'
      }}>
        <style>
          {`
            @keyframes holographic-scroll {
              0% { transform: translateX(0); }
              100% { transform: translateX(-33.33%); }
            }
            .holo-item:hover {
              color: var(--accent-orange) !important;
              text-shadow: 0 0 8px rgba(250, 204, 21, 0.6);
            }
          `}
        </style>

        {streamData.map((h, i) => (
          <div 
            key={i} 
            className="holo-item"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              marginRight: '60px',
              cursor: 'pointer',
              color: '#cbd5e1',
              fontFamily: 'monospace',
              fontSize: '14px',
              transition: 'all 0.2s',
              gap: '12px'
            }}
            onClick={() => navigate(`/search/${encodeURIComponent(h.title.split(' ').slice(0, 5).join(' '))}`)}
          >
            <span style={{ color: 'rgba(250, 204, 21, 0.4)', fontSize: '10px' }}>{h.is_trusted ? '[VERIFIED]' : '[RAW]'}</span>
            <span>{h.title.toUpperCase()}</span>
            <Zap size={10} style={{ color: 'rgba(255,255,255,0.2)' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
