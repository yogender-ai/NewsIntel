import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

const CHARS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:.-\'",!?&()';
const FLIP_DURATION = 35; // ms per character flip step (faster = snappier)
const STAGGER_DELAY = 12; // ms between each character starting
const DISPLAY_LENGTH = 140; // increased for more words

function FlapChar({ targetChar, delay = 0, isActive }) {
  const [displayChar, setDisplayChar] = useState(' ');
  const [flipping, setFlipping] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!isActive) return;

    const timeout = setTimeout(() => {
      const target = (targetChar || ' ').toUpperCase();
      const startIdx = CHARS.indexOf(displayChar) >= 0 ? CHARS.indexOf(displayChar) : 0;
      const endIdx = CHARS.indexOf(target) >= 0 ? CHARS.indexOf(target) : 0;

      if (startIdx === endIdx) return;

      setFlipping(true);
      let currentIdx = startIdx;

      intervalRef.current = setInterval(() => {
        currentIdx = (currentIdx + 1) % CHARS.length;
        setDisplayChar(CHARS[currentIdx]);

        if (currentIdx === endIdx) {
          clearInterval(intervalRef.current);
          setFlipping(false);
        }
      }, FLIP_DURATION);
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [targetChar, isActive]);

  return (
    <span className={`flap-char ${flipping ? 'flipping' : ''} ${displayChar === ' ' ? 'space' : ''}`}>
      <span className="flap-top" />
      <span className="flap-inner">{displayChar}</span>
      <span className="flap-divider" />
    </span>
  );
}

export default function SplitFlapDisplay({ headlines = [], interval = 15000 }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (headlines.length <= 1) return;

    const timer = setInterval(() => {
      handleNext();
    }, interval);

    return () => clearInterval(timer);
  }, [headlines.length, interval, currentIndex]);

  const handleNext = (e) => {
    if(e) e.stopPropagation();
    setIsActive(true);
    setKey(k => k + 1);
    setCurrentIndex(prev => (prev + 1) % headlines.length);
  };

  const handlePrev = (e) => {
    if(e) e.stopPropagation();
    setIsActive(true);
    setKey(k => k + 1);
    setCurrentIndex(prev => (prev - 1 + headlines.length) % headlines.length);
  };

  const handleRefresh = (e) => {
    if(e) e.stopPropagation();
    setIsActive(true);
    setKey(k => k + 1);
  };

  if (!headlines.length) return null;

  const currentHeadline = headlines[currentIndex] || {};
  const rawTitle = (currentHeadline.title || '').toUpperCase();
  const title = rawTitle.length > DISPLAY_LENGTH 
    ? rawTitle.slice(0, DISPLAY_LENGTH - 3) + '...' 
    : rawTitle;
  const source = currentHeadline.source || '';
  const chars = title.padEnd(DISPLAY_LENGTH, ' ').split('');

  return (
    <div className="split-flap-container" id="split-flap" style={{ cursor: 'pointer', transition: 'all 0.3s' }} onClick={() => {
      if (currentHeadline.title) {
        window.location.href = `/search/${encodeURIComponent(currentHeadline.title.split(' ').slice(0, 6).join(' '))}`;
      }
    }}>
      <div className="split-flap-header">
        <div className="flap-indicator">
          <span className="flap-live-dot" />
          <span>DEPARTURES</span>
        </div>
        <div className="flap-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={handlePrev} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Previous">
            <ChevronLeft size={16} />
          </button>
          <div className="flap-counter">
            {currentIndex + 1} / {headlines.length}
          </div>
          <button onClick={handleNext} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Next">
            <ChevronRight size={16} />
          </button>
          <button onClick={handleRefresh} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', marginLeft: '8px' }} title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>
      <div className="split-flap-board" key={key}>
        {chars.map((char, i) => (
          <FlapChar
            key={`${key}-${i}`}
            targetChar={char}
            delay={i * STAGGER_DELAY}
            isActive={isActive}
          />
        ))}
      </div>
      {source && (
        <div className="flap-source">
          <span className="flap-source-label">SOURCE</span>
          <span className="flap-source-name">{source}</span>
          {currentHeadline.time_ago && (
            <span className="flap-source-time">{currentHeadline.time_ago}</span>
          )}
        </div>
      )}
    </div>
  );
}
