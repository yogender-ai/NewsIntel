import { useState, useEffect, useRef } from 'react';

const CHARS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:.-\'",!?&()';
const FLIP_DURATION = 40; // ms per character flip step (faster = snappier)
const STAGGER_DELAY = 15; // ms between each character starting
const DISPLAY_LENGTH = 56; // fewer chars = bigger each char

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

export default function SplitFlapDisplay({ headlines = [], interval = 12000 }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (headlines.length <= 1) return;

    const timer = setInterval(() => {
      setIsActive(true);
      setKey(k => k + 1);
      setCurrentIndex(prev => (prev + 1) % headlines.length);
    }, interval);

    return () => clearInterval(timer);
  }, [headlines.length, interval]);

  if (!headlines.length) return null;

  const currentHeadline = headlines[currentIndex] || {};
  const rawTitle = (currentHeadline.title || '').toUpperCase();
  const title = rawTitle.length > DISPLAY_LENGTH 
    ? rawTitle.slice(0, DISPLAY_LENGTH - 3) + '...' 
    : rawTitle;
  const source = currentHeadline.source || '';
  const chars = title.padEnd(DISPLAY_LENGTH, ' ').split('');

  return (
    <div className="split-flap-container" id="split-flap">
      <div className="split-flap-header">
        <div className="flap-indicator">
          <span className="flap-live-dot" />
          <span>DEPARTURES</span>
        </div>
        <div className="flap-counter">
          {currentIndex + 1} / {headlines.length}
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
