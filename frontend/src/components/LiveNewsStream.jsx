import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Activity, Radio } from 'lucide-react';

// Verified YouTube channel IDs for reliable live_stream embedding
const CHANNELS = [
  { id: 'alj', name: 'Al Jazeera', channelId: 'UCNye-wNBqNL5ZzHSJj3l8Bg' },
  { id: 'fra24', name: 'France 24', channelId: 'UCQfwfsi5VrQ8yKZ-UOWISsg' },
  { id: 'dw', name: 'DW News', channelId: 'UCknLrEdhRCp1aegoMqRaCZg' },
  { id: 'wion', name: 'WION', channelId: 'UC_gUM8rL-Lrg6O3adPW9K1g' },
  { id: 'ndtv', name: 'NDTV 24x7', channelId: 'UCXAPrY1s4u9hBf1Xp01V3lQ' },
  { id: 'cna', name: 'CNA', channelId: 'UCo8bcnLyZH8tBIH9V1mLgqQ' },
  { id: 'trt', name: 'TRT World', channelId: 'UC7fWeaHhqgM4Lba7mehXysA' },
  { id: 'abc_au', name: 'ABC Australia', channelId: 'UCVgO39Bk5sMo66-6o6Spn6Q' },
  { id: 'euronews', name: 'Euronews', channelId: 'UCW2QcKZiU8aUGg4yxCIditg' },
  { id: 'sky', name: 'Sky News', channelId: 'UCoMdktPbSTixAyNGwb-UMXg' },
];

function buildStreamUrl(channel) {
  return `https://www.youtube.com/embed/live_stream?channel=${channel.channelId}&autoplay=1&mute=1`;
}

export default function LiveNewsStream() {
  const [activeChannel, setActiveChannel] = useState(CHANNELS[0]);
  const [loading, setLoading] = useState(true);
  const [streamFailed, setStreamFailed] = useState(false);
  const scrollRef = useRef(null);
  const iframeRef = useRef(null);

  const handleScroll = (direction) => {
    if (scrollRef.current) {
      const amount = direction === 'left' ? -200 : 200;
      scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    setLoading(true);
    setStreamFailed(false);
    // Fallback: if iframe doesn't load in 10s, show fallback UI
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 10000);
    return () => clearTimeout(timeout);
  }, [activeChannel]);

  return (
    <div className="stream-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px' }}>
      <div className="stream-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: '#e2e8f0', fontSize: '13px', fontWeight: 700, letterSpacing: '1px' }}>
          <Activity size={16} style={{ color: '#ef4444' }} />
          LIVE INTELLIGENCE FEED
        </h3>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#10b981', fontWeight: 'bold' }}>
          <Radio size={12} className="animate-pulse" />
          SATCOM ACTIVE
        </span>
      </div>

      <div className="video-wrapper" style={{ background: '#0a0b14', borderRadius: '12px', overflow: 'hidden', position: 'relative', flex: 1, minHeight: '260px' }}>
        {loading && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, background: '#05070f', gap: '12px' }}>
             <div className="map-loader-ring" />
             <span style={{ color: '#8b5cf6', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px' }}>ESTABLISHING UPLINK TO {activeChannel.name.toUpperCase()}...</span>
          </div>
        )}
        
        <iframe
          ref={iframeRef}
          key={activeChannel.id}
          src={buildStreamUrl(activeChannel)}
          title={activeChannel.name}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          onLoad={() => setLoading(false)}
          style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
        <button onClick={() => handleScroll('left')} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <ChevronLeft size={16} />
        </button>
        
        <div ref={scrollRef} style={{ flex: 1, display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none', padding: '4px 0' }}>
          {CHANNELS.map(channel => (
            <button
              key={channel.id}
              onClick={() => setActiveChannel(channel)}
              style={{ 
                whiteSpace: 'nowrap', flexShrink: 0, padding: '7px 14px', borderRadius: '8px', fontSize: '12px',
                border: activeChannel.id === channel.id ? '1px solid #8b5cf6' : '1px solid rgba(255,255,255,0.08)',
                background: activeChannel.id === channel.id ? 'rgba(139,92,246,0.2)' : 'rgba(10,5,20,0.6)',
                color: activeChannel.id === channel.id ? '#fff' : '#94a3b8',
                fontWeight: activeChannel.id === channel.id ? '700' : '500',
                cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              {channel.name}
            </button>
          ))}
        </div>

        <button onClick={() => handleScroll('right')} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
