import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Activity, Radio, CloudLightning } from 'lucide-react';
import ReactPlayer from 'react-player';
import { useLanguage } from '../context/LanguageContext';

const CHANNELS = [
  { id: 'alj', name: 'Al Jazeera', url: 'https://live-hls-web-aje.getaj.net/AJE/index.m3u8' },
  { id: 'sky', name: 'Sky News', url: 'https://skynews-live.akamaized.net/hls/live/2002347/skynews-international/master.m3u8' },
  { id: 'cbs', name: 'CBS News', url: 'https://cbsn-us.cbsnstream.cbsnews.com/out/v1/55a8648e8f134e82a470f83d562deeca/master.m3u8' },
  { id: 'abc_au', name: 'ABC News AU', url: 'https://abc-iview-mediapackagelin-2.akamaized.net/out/v1/6e1cc6d25ea0480ea099a5399d73bc4e/index.m3u8' },
  { id: 'dw', name: 'DW News', url: 'https://dwamdstream104.akamaized.net/hls/live/2015530/dwstream104/index.m3u8' },
  { id: 'france24', name: 'France 24', url: 'https://static.france24.com/live/F24_EN_HI_HLS/live_web.m3u8' },
  { id: 'cna', name: 'CNA', url: 'https://d2e1asnsl7br7b.cloudfront.net/7782e205e72f43aeb4a4809738cd0110/index.m3u8' },
  { id: 'wion', name: 'WION India', url: 'https://d15z0ph024ul31.cloudfront.net/wion/wion-abr/playlist.m3u8' },
  { id: 'ndtv', name: 'NDTV 24x7', url: 'https://ndtvindia-lh.akamaihd.net/i/ndtv24x7_1@300633/master.m3u8' },
  { id: 'trt', name: 'TRT World', url: 'https://tv-trtworld.live.trt.com.tr/master_720.m3u8' }
];

export default function LiveNewsStream() {
  const [activeChannel, setActiveChannel] = useState(CHANNELS[0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
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
    setError(false);
  }, [activeChannel]);

  return (
    <div className="stream-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="stream-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: '#e2e8f0' }}>
          <Activity size={18} className="text-red-500" />
          {t('liveIntelligenceFeed', 'LIVE INTELLIGENCE FEED')}
        </h3>
        <span className="live-badge" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#10b981', fontWeight: 'bold' }}>
          <Radio size={12} className="animate-pulse" />
          SATCOM ACTIVE
        </span>
      </div>

      <div className="video-wrapper" style={{ background: '#0a0b14', borderRadius: '12px', overflow: 'hidden', position: 'relative', flex: 1, minHeight: '260px' }}>
        {loading && !error && (
          <div className="loader-overlay" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, background: '#05070f' }}>
             <div className="map-loader-ring" />
             <span style={{ marginLeft: '12px', color: '#8b5cf6', fontSize: '12px', fontWeight: 'bold' }}>ESTABLISHING DOWNLINK...</span>
          </div>
        )}
        
        {error ? (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#1e1b4b', zIndex: 10 }}>
             <CloudLightning size={32} color="#ef4444" style={{ marginBottom: '12px' }} />
             <span style={{ color: '#f87171', fontSize: '14px', fontWeight: 'bold' }}>SIGNAL LOST</span>
             <span style={{ color: '#94a3b8', fontSize: '11px', marginTop: '4px' }}>Please select an alternate feed.</span>
          </div>
        ) : (
          <ReactPlayer 
             url={activeChannel.url} 
             playing={true} 
             controls={true} 
             width="100%" 
             height="100%" 
             onReady={() => setLoading(false)}
             onError={(e) => { console.warn('Stream Error', e); setLoading(false); setError(true); }}
             config={{ file: { forceHLS: true } }}
          />
        )}
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
