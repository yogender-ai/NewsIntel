import { useState, useEffect } from 'react';
import { Radio, MonitorPlay, Users, Eye } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const CHANNELS = [
  { id: 'aajtak', name: 'Aaj Tak | Live', badge: '🇮🇳', url: 'https://www.youtube.com/embed/UX6KM95AOHE?autoplay=1&mute=1' },
  { id: 'toi', name: 'Times of India | Live', badge: '🇮🇳', url: 'https://www.youtube.com/embed/dXhy8KoYuQM?autoplay=1&mute=1' },
  { id: 'bbc', name: 'BBC News | Live', badge: '🇬🇧', url: 'https://www.youtube.com/embed/dXhy8KoYuQM?autoplay=1&mute=1' },
  { id: 'republic', name: 'Republic TV', badge: '🇮🇳', url: 'https://www.youtube.com/embed/live_stream?channel=UCUnKswQoP7N6GvsTzrgFQSg&autoplay=1&mute=1' },
  { id: 'alj', name: 'Al Jazeera English', badge: '🟢', url: 'https://www.youtube.com/embed/live_stream?channel=UCNye-wNBqNL5ZzHSJj3l8Bg&autoplay=1&mute=1' }
];

export default function LiveNewsStream() {
  const { t } = useLanguage();
  const [activeChannel, setActiveChannel] = useState(CHANNELS[0]);
  const [viewerCount, setViewerCount] = useState('25.4K');

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
      <div className="stream-v2-channels">
        {CHANNELS.map(ch => (
          <button
            key={ch.id}
            onClick={() => setActiveChannel(ch)}
            className={`stream-v2-channel-btn ${activeChannel.id === ch.id ? 'active' : ''}`}
          >
            <span className="stream-ch-badge">{ch.badge}</span>
            <span className="stream-ch-name">{ch.name}</span>
            {activeChannel.id === ch.id && <Radio size={10} className="pulse-animation" />}
          </button>
        ))}
      </div>
    </div>
  );
}
