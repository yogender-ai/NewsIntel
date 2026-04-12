import { useState, useEffect, useRef } from 'react';
import { Radio, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
const CHANNELS = [
  { id: 'alj', name: 'Al Jazeera', url: 'https://www.youtube.com/embed/live_stream?channel=UCNye-wNBqNL5ZzHSJj3l8Bg&autoplay=1&mute=1' },
  { id: 'sky', name: 'Sky News UK', url: 'https://www.youtube.com/embed/live_stream?channel=UCoMdktPbSTixAyNGwb-PUYA&autoplay=1&mute=1' },
  { id: 'nbc', name: 'NBC News', url: 'https://www.youtube.com/embed/live_stream?channel=UCeY0bbntWzzVIaj2z3QigXg&autoplay=1&mute=1' },
  { id: 'dw', name: 'DW News', url: 'https://www.youtube.com/embed/live_stream?channel=UCknLrEdhRCp1aegoMqRaCZg&autoplay=1&mute=1' },
  { id: 'france24', name: 'France 24', url: 'https://www.youtube.com/embed/live_stream?channel=UCQfwfsi5VrQ8yKZ-UOWISsg&autoplay=1&mute=1' },
  { id: 'cna', name: 'CNA', url: 'https://www.youtube.com/embed/live_stream?channel=UC83jt4dlz1Gjl58fzQrrKZg&autoplay=1&mute=1' },
  { id: 'wion', name: 'WION India', url: 'https://www.youtube.com/embed/live_stream?channel=UC_gUM8rL-LrgCAA9058O-Ww&autoplay=1&mute=1' },
  { id: 'ndtv', name: 'NDTV 24x7', url: 'https://www.youtube.com/embed/live_stream?channel=UCVQhC-u8-MwcB6A2F2qU40w&autoplay=1&mute=1' },
  { id: 'trt', name: 'TRT World', url: 'https://www.youtube.com/embed/live_stream?channel=UC7fWeaHhqgM4Ry-RMpM2YYw&autoplay=1&mute=1' },
  { id: 'abc_us', name: 'ABC News', url: 'https://www.youtube.com/embed/live_stream?channel=UCBi2mrWuNuyYy4gbM6fU18Q&autoplay=1&mute=1' }
];

export default function LiveNewsStream() {
  const { t } = useLanguage();
  const [activeChannel, setActiveChannel] = useState(CHANNELS[0]);
  const [viewerCount, setViewerCount] = useState('25.4K');
  const scrollRef = useRef(null);

  const scrollLeft = () => {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: -200, behavior: 'smooth' });
  };

  const scrollRight = () => {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: 200, behavior: 'smooth' });
  };

  useEffect(() => {
    const handleSwitch = (e) => {
       const targetId = e.detail;
       const ch = CHANNELS.find(c => c.id === targetId);
       if (ch) setActiveChannel(ch);
    };
    window.addEventListener('SWITCH_LIVE_CHANNEL', handleSwitch);
    return () => window.removeEventListener('SWITCH_LIVE_CHANNEL', handleSwitch);
  }, []);

  // Simulate viewer count updates
  useEffect(() => {
    const interval = setInterval(() => {
      const base = 15000 + Math.floor(Math.random() * 30000);
      if (base >= 1000) {
        setViewerCount(`${(base / 1000).toFixed(1)}K`);
      } else {
        setViewerCount(base.toString());
      }
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="live-news-stream-v2">
      {/* Stream Header */}
      <div className="stream-v2-header">
        <div className="stream-v2-channel-info">
          <div className="stream-v2-verified">
          </div>
          <div className="stream-v2-names">
            <span className="stream-v2-name">{activeChannel.name} | Live</span>
            <span className="stream-v2-sub">
              <span className="stream-v2-live-badge">● LIVE</span>
              {viewerCount}
            </span>
          </div>
        </div>
      </div>

      {/* Video Player */}
      <div className="stream-v2-player">
        <iframe
          src={activeChannel.url}
          className="stream-v2-iframe"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
        {/* Live Overlay */}
        <div className="stream-v2-overlay">
          <div className="stream-v2-live-indicator">
            <div className="stream-live-dot-pulse" />
            LIVE
          </div>
        </div>
      </div>

      {/* Viewer Count */}
      <div className="stream-v2-viewers">
        <Users size={12} />
        <span>{viewerCount} viewers</span>
      </div>

      {/* Channel Switcher */}
      <div className="stream-v2-channels-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
        <button onClick={scrollLeft} className="stream-scroll-arrow">
          <ChevronLeft size={14} />
        </button>
        <div className="stream-v2-channels" ref={scrollRef}>
          {CHANNELS.map(ch => (
            <button
              key={ch.id}
              onClick={() => setActiveChannel(ch)}
              className={`stream-v2-channel-btn ${activeChannel.id === ch.id ? 'active' : ''}`}
            >
              <span className="stream-ch-name">{ch.name}</span>
              {activeChannel.id === ch.id && <Radio size={10} className="pulse-animation" />}
            </button>
          ))}
        </div>
        <button onClick={scrollRight} className="stream-scroll-arrow">
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
