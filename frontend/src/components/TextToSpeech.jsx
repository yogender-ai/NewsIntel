import { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Play, Pause, SkipForward } from 'lucide-react';

export default function TextToSpeech({ headlines = [] }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const utteranceRef = useRef(null);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  const speakHeadline = (index) => {
    if (!window.speechSynthesis || index >= headlines.length || index < 0) {
      setIsPlaying(false);
      setCurrentIndex(-1);
      return;
    }

    window.speechSynthesis.cancel();
    const headline = headlines[index];
    const text = `${headline.title}. From ${headline.source}.`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;

    // Try to use a good voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.name.includes('Google') || v.name.includes('Microsoft') || v.name.includes('Samantha')
    ) || voices.find(v => v.lang.startsWith('en'));
    if (preferred) utterance.voice = preferred;

    utterance.onend = () => {
      const next = index + 1;
      if (next < Math.min(headlines.length, 5)) {
        setCurrentIndex(next);
        speakHeadline(next);
      } else {
        setIsPlaying(false);
        setCurrentIndex(-1);
      }
    };

    utterance.onerror = () => {
      setIsPlaying(false);
      setCurrentIndex(-1);
    };

    utteranceRef.current = utterance;
    setCurrentIndex(index);
    window.speechSynthesis.speak(utterance);
  };

  const handlePlay = () => {
    if (!window.speechSynthesis) return;

    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      setCurrentIndex(-1);
    } else {
      setIsPlaying(true);
      speakHeadline(0);
    }
  };

  const handleSkip = () => {
    if (!isPlaying) return;
    window.speechSynthesis.cancel();
    const next = currentIndex + 1;
    if (next < Math.min(headlines.length, 5)) {
      speakHeadline(next);
    } else {
      setIsPlaying(false);
      setCurrentIndex(-1);
    }
  };

  if (!headlines.length || !window.speechSynthesis) return null;

  return (
    <div className="tts-controls" id="tts-controls">
      <button
        className={`tts-play-btn ${isPlaying ? 'playing' : ''}`}
        onClick={handlePlay}
        title={isPlaying ? 'Stop reading' : 'Read headlines aloud'}
      >
        {isPlaying ? <VolumeX size={13} /> : <Volume2 size={13} />}
        {isPlaying ? 'Stop' : 'Listen'}
      </button>
      {isPlaying && (
        <>
          <button className="tts-skip-btn" onClick={handleSkip} title="Skip to next">
            <SkipForward size={12} />
          </button>
          <div className="tts-indicator">
            <div className="tts-wave">
              <span /><span /><span /><span /><span />
            </div>
            <span className="tts-reading-text">
              Reading {currentIndex + 1}/{Math.min(headlines.length, 5)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
