import { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Play, Pause, SkipForward, SkipBack, Settings } from 'lucide-react';

export default function TextToSpeech({ headlines = [] }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [speed, setSpeed] = useState(1.0);
  const [showControls, setShowControls] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const utteranceRef = useRef(null);

  useEffect(() => {
    const loadVoices = () => {
      const v = window.speechSynthesis?.getVoices() || [];
      setVoices(v);
      // Pick the best available voice
      const neural = v.find(voice =>
        voice.name.includes('Neural') ||
        voice.name.includes('Natural') ||
        voice.name.includes('Online')
      );
      const microsoft = v.find(voice => voice.name.includes('Microsoft') && voice.name.includes('Online'));
      const google = v.find(voice => voice.name.includes('Google'));
      const english = v.find(voice => voice.lang.startsWith('en') && voice.localService === false);
      const fallback = v.find(voice => voice.lang.startsWith('en'));
      setSelectedVoice(neural || microsoft || google || english || fallback || v[0] || null);
    };

    loadVoices();
    window.speechSynthesis?.addEventListener?.('voiceschanged', loadVoices);
    return () => {
      window.speechSynthesis?.removeEventListener?.('voiceschanged', loadVoices);
      window.speechSynthesis?.cancel();
    };
  }, []);

  const speakHeadline = (index) => {
    if (!window.speechSynthesis || index >= headlines.length || index < 0) {
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentIndex(-1);
      return;
    }

    window.speechSynthesis.cancel();
    const headline = headlines[index];
    // Natural phrasing with pauses
    const text = `${headline.title}... From ${headline.source}.`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = speed;
    utterance.pitch = 1.05;
    utterance.volume = 1;

    if (selectedVoice) utterance.voice = selectedVoice;

    utterance.onend = () => {
      const next = index + 1;
      if (next < Math.min(headlines.length, 10)) {
        setCurrentIndex(next);
        setTimeout(() => speakHeadline(next), 800); // pause between headlines
      } else {
        setIsPlaying(false);
        setIsPaused(false);
        setCurrentIndex(-1);
      }
    };

    utterance.onerror = () => {
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentIndex(-1);
    };

    utteranceRef.current = utterance;
    setCurrentIndex(index);
    setIsPaused(false);
    window.speechSynthesis.speak(utterance);
  };

  const handlePlay = () => {
    if (!window.speechSynthesis) return;

    if (isPlaying && !isPaused) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    } else if (isPlaying && isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    } else {
      setIsPlaying(true);
      speakHeadline(0);
    }
  };

  const handleStop = () => {
    window.speechSynthesis?.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentIndex(-1);
  };

  const handleSkip = () => {
    if (!isPlaying) return;
    window.speechSynthesis.cancel();
    const next = currentIndex + 1;
    if (next < Math.min(headlines.length, 10)) {
      speakHeadline(next);
    } else {
      handleStop();
    }
  };

  const handlePrev = () => {
    if (!isPlaying) return;
    window.speechSynthesis.cancel();
    const prev = Math.max(0, currentIndex - 1);
    speakHeadline(prev);
  };

  if (!headlines.length || !window.speechSynthesis) return null;

  const maxHeadlines = Math.min(headlines.length, 10);
  const progress = isPlaying && currentIndex >= 0 ? ((currentIndex + 1) / maxHeadlines) * 100 : 0;

  return (
    <div className="tts-controls-v5" id="tts-controls">
      <div className="tts-main-row">
        <button
          className={`tts-play-btn ${isPlaying ? 'playing' : ''}`}
          onClick={handlePlay}
          title={isPlaying ? (isPaused ? 'Resume' : 'Pause') : 'Read headlines aloud'}
        >
          {isPlaying ? (
            isPaused ? <Play size={13} /> : <Pause size={13} />
          ) : (
            <Volume2 size={13} />
          )}
          {isPlaying ? (isPaused ? 'Resume' : 'Pause') : 'Listen'}
        </button>

        {isPlaying && (
          <>
            <button className="tts-nav-btn" onClick={handlePrev} title="Previous">
              <SkipBack size={11} />
            </button>
            <button className="tts-nav-btn" onClick={handleSkip} title="Next">
              <SkipForward size={11} />
            </button>
            <button className="tts-stop-btn" onClick={handleStop} title="Stop">
              <VolumeX size={11} />
            </button>
          </>
        )}

        <button
          className="tts-settings-btn"
          onClick={() => setShowControls(!showControls)}
          title="Settings"
        >
          <Settings size={11} />
        </button>
      </div>

      {isPlaying && (
        <div className="tts-progress-area">
          <div className="tts-progress-bar">
            <div className="tts-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="tts-progress-info">
            <div className="tts-wave-mini">
              {!isPaused && <><span /><span /><span /><span /><span /></>}
            </div>
            <span className="tts-reading-info">
              {isPaused ? 'Paused' : 'Reading'} {currentIndex + 1}/{maxHeadlines}
            </span>
          </div>
        </div>
      )}

      {showControls && (
        <div className="tts-settings-panel">
          <div className="tts-speed-control">
            <span>Speed</span>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
            />
            <span className="tts-speed-value">{speed.toFixed(1)}x</span>
          </div>
        </div>
      )}
    </div>
  );
}
