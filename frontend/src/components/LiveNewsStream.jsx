import { useState } from 'react';
import ReactPlayer from 'react-player/youtube';
import { Radio, MonitorPlay, Maximize, Loader } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const CHANNELS = [
  { id: 'alj', name: 'Al Jazeera', url: 'https://www.youtube.com/watch?v=gCNeDWCI0vo' },
  { id: 'sky', name: 'Sky News', url: 'https://www.youtube.com/watch?v=9Auq9mYxFEE' },
  { id: 'nbc', name: 'NBC News', url: 'https://www.youtube.com/watch?v=FPTAWOSw-2M' },
  { id: 'abc', name: 'ABC News', url: 'https://www.youtube.com/watch?v=W1ilCy6XrmI' },
];

export default function LiveNewsStream() {
  const { t } = useLanguage();
  const [activeChannel, setActiveChannel] = useState(CHANNELS[0]);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isReady, setIsReady] = useState(false);

  return (
    <div className="live-news-stream-container scroll-reveal" style={{
      background: 'rgba(10, 15, 30, 0.65)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '16px',
      padding: '24px',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Decorative Glow */}
      <div style={{
        position: 'absolute', top: 0, left: '20%', width: '60%', height: '1px',
        background: 'linear-gradient(90deg, transparent, var(--accent-orange), transparent)',
        opacity: 0.5
      }}/>

      <div className="stream-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '32px', height: '32px', background: 'rgba(250, 204, 21, 0.1)',
            borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-orange)'
          }}>
            <MonitorPlay size={16} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#fff', letterSpacing: '0.5px' }}>Global Comms</h3>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="live-dot" /> {t('live')} Feed
            </div>
          </div>
        </div>
        <button style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <Maximize size={16} />
        </button>
      </div>

      {/* Video Player */}
      <div className="stream-player-wrapper" style={{ 
        position: 'relative', 
        width: '100%', 
        paddingTop: '56.25%', // 16:9 Aspect Ratio
        borderRadius: '12px',
        overflow: 'hidden',
        background: '#000',
        border: '1px solid rgba(255,255,255,0.05)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.6)'
      }}>
        {!isReady && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--accent-orange)', zIndex: 5
          }}>
            <Loader className="spin" size={24} />
          </div>
        )}
        <ReactPlayer
          url={activeChannel.url}
          className="react-player"
          playing={isPlaying}
          controls={false}
          muted={true}
          width="100%"
          height="100%"
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
          onReady={() => setIsReady(true)}
          config={{
            youtube: {
              playerVars: { showinfo: 0, rel: 0, modestbranding: 1, fs: 0 }
            }
          }}
        />
      </div>

      {/* Channel Switcher */}
      <div className="channel-switcher" style={{ marginTop: 'auto', paddingTop: '24px' }}>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px' }}>
          {CHANNELS.map(ch => (
            <button
              key={ch.id}
              onClick={() => { setIsReady(false); setActiveChannel(ch); setIsPlaying(true); }}
              style={{
                background: activeChannel.id === ch.id ? 'rgba(250, 204, 21, 0.15)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${activeChannel.id === ch.id ? 'rgba(250, 204, 21, 0.4)' : 'transparent'}`,
                color: activeChannel.id === ch.id ? 'var(--accent-orange)' : 'var(--text-secondary)',
                padding: '10px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {activeChannel.id === ch.id && <Radio size={12} className="live-pulse" />}
              {ch.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
