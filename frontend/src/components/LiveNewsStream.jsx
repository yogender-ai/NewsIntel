import { useState, useEffect } from 'react';
import { Radio, MonitorPlay } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const CHANNELS = [
  { id: 'alj', name: 'Al Jazeera', url: 'https://www.youtube.com/embed/gCNeDWCI0vo?autoplay=1&mute=1&controls=0&modestbranding=1' },
  { id: 'sky', name: 'Sky News', url: 'https://www.youtube.com/embed/9Auq9mYxFEE?autoplay=1&mute=1&controls=0&modestbranding=1' },
  { id: 'nbc', name: 'NBC News', url: 'https://www.youtube.com/embed/FPTAWOSw-2M?autoplay=1&mute=1&controls=0&modestbranding=1' },
  { id: 'abc', name: 'ABC News', url: 'https://www.youtube.com/embed/W1ilCy6XrmI?autoplay=1&mute=1&controls=0&modestbranding=1' },
];

export default function LiveNewsStream() {
  const { t } = useLanguage();
  const [activeChannel, setActiveChannel] = useState(CHANNELS[0]);

  useEffect(() => {
    const handleSwitch = (e) => {
       const targetId = e.detail;
       const ch = CHANNELS.find(c => c.id === targetId);
       if (ch) setActiveChannel(ch);
    };
    window.addEventListener('SWITCH_LIVE_CHANNEL', handleSwitch);
    return () => window.removeEventListener('SWITCH_LIVE_CHANNEL', handleSwitch);
  }, []);

  return (
    <div className="live-news-stream-container scroll-reveal" style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div className="stream-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6'
          }}>
            <MonitorPlay size={18} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 500, color: '#fff', letterSpacing: '0.5px' }}>Global Comms</h3>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="live-dot" style={{background: '#3b82f6', boxShadow: '0 0 8px #3b82f6'}} /> {t('live')} Feed
            </div>
          </div>
        </div>
      </div>

      {/* Video Player */}
      <div className="stream-player-wrapper" style={{ 
        position: 'relative', 
        width: '100%', 
        paddingTop: '56.25%', // 16:9 Aspect Ratio
        borderRadius: '8px',
        overflow: 'hidden',
        background: 'transparent',
      }}>
        <iframe
          src={activeChannel.url}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none', pointerEvents: 'none' }}
          allow="autoplay; encrypted-media"
          allowFullScreen
        />
      </div>

      {/* Channel Switcher */}
      <div className="channel-switcher" style={{ marginTop: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
          {CHANNELS.map(ch => (
            <button
              key={ch.id}
              onClick={() => setActiveChannel(ch)}
              style={{
                background: 'transparent',
                border: 'none',
                color: activeChannel.id === ch.id ? '#3b82f6' : 'var(--text-secondary)',
                padding: '4px 0',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderBottom: activeChannel.id === ch.id ? '2px solid #3b82f6' : '2px solid transparent'
              }}
            >
              {activeChannel.id === ch.id && <Radio size={12} className="live-pulse" color="#3b82f6" />}
              {ch.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
