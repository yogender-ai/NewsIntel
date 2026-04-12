import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Activity, Radio } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

// Using direct YouTube video embeds for reliable live streams
const CHANNELS = [
  { id: 'alj', name: 'Al Jazeera', url: 'https://www.youtube.com/embed/gCNeDWCI0vo?autoplay=1&mute=1' },
  { id: 'sky', name: 'Sky News', url: 'https://www.youtube.com/embed/9Auq9mYxFEE?autoplay=1&mute=1' },
  { id: 'fra24', name: 'France 24', url: 'https://www.youtube.com/embed/h3MuIUNCCzI?autoplay=1&mute=1' },
  { id: 'dw', name: 'DW News', url: 'https://www.youtube.com/embed/NvqKZHpKs-g?autoplay=1&mute=1' },
  { id: 'cna', name: 'CNA', url: 'https://www.youtube.com/embed/XWq5kBlakcQ?autoplay=1&mute=1' },
  { id: 'ndtv', name: 'NDTV', url: 'https://www.youtube.com/embed/WB0Skeuvyvc?autoplay=1&mute=1' },
  { id: 'wion', name: 'WION', url: 'https://www.youtube.com/embed/U6bPF6pJo54?autoplay=1&mute=1' },
  { id: 'abc', name: 'ABC Australia', url: 'https://www.youtube.com/embed/W1ilCy6XrmI?autoplay=1&mute=1' },
  { id: 'euronews', name: 'Euronews', url: 'https://www.youtube.com/embed/pSyvn5LEXrs?autoplay=1&mute=1' },
  { id: 'trt', name: 'TRT World', url: 'https://www.youtube.com/embed/CV5Fooi8YJE?autoplay=1&mute=1' }
];

export default function LiveNewsStream() {
  const [activeChannel, setActiveChannel] = useState(CHANNELS[0]);
  const [loading, setLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);
  const scrollRef = useRef(null);
  const { t } = useLanguage();

  const handleScroll = (direction) => {
    if (scrollRef.current) {
      const amount = direction === 'left' ? -200 : 200;
      scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    setLoading(true);
    setIframeError(false);
    // Fallback timeout: if iframe doesn't load in 8s, hide loader
    const timeout = setTimeout(() => setLoading(false), 8000);
    return () => clearTimeout(timeout);
  }, [activeChannel]);

  return (
    <div className="stream-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="stream-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: '#e2e8f0' }}>
          <Activity size={18} className="text-red-500" />
          {t('liveIntelligenceFeed', 'liveIntelligenceFeed')}
        </h3>
        <span className="live-badge" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#10b981', fontWeight: 'bold' }}>
          <Radio size={12} className="animate-pulse" />
          SATCOM ACTIVE
        </span>
      </div>

      <div className="video-wrapper" style={{ background: '#0a0b14', borderRadius: '12px', overflow: 'hidden', position: 'relative', flex: 1, minHeight: '260px' }}>
        {loading && (
          <div className="loader-overlay" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, background: '#05070f' }}>
             <div className="map-loader-ring" />
             <span style={{ marginLeft: '12px', color: '#8b5cf6', fontSize: '12px', fontWeight: 'bold' }}>ESTABLISHING SECURE UPLINK...</span>
          </div>
        )}
        
        <iframe
          key={activeChannel.id}
          src={activeChannel.url}
          title={activeChannel.name}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          onLoad={() => setLoading(false)}
          onError={() => { setLoading(false); setIframeError(true); }}
          style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
        />
      </div>

      <div className="channel-carousel-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
        <button className="carousel-btn" onClick={() => handleScroll('left')} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ChevronLeft size={16} />
        </button>
        
        <div 
          className="channel-list horizontal-scroll" 
          ref={scrollRef}
          style={{ flex: 1, display: 'flex', gap: '10px', overflowX: 'auto', scrollbarWidth: 'none', padding: '4px 0' }}
        >
          {CHANNELS.map(channel => (
            <button
              key={channel.id}
              onClick={() => setActiveChannel(channel)}
              style={{ 
                whiteSpace: 'nowrap', flexShrink: 0, padding: '8px 16px', borderRadius: '8px', border: '1px solid',
                background: activeChannel.id === channel.id ? 'rgba(139,92,246,0.2)' : 'rgba(10,5,20,0.6)',
                borderColor: activeChannel.id === channel.id ? '#8b5cf6' : 'rgba(255,255,255,0.1)',
                color: activeChannel.id === channel.id ? '#fff' : '#94a3b8',
                fontWeight: activeChannel.id === channel.id ? 'bold' : 'normal',
                cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              {channel.name}
            </button>
          ))}
        </div>

        <button className="carousel-btn" onClick={() => handleScroll('right')} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
