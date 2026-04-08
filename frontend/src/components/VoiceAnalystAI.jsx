import { useState, useEffect, useRef } from 'react';
import { fetchTrending, analyzeTopic } from '../api';

export default function VoiceAnalystAI() {
  const [status, setStatus] = useState('idle'); // idle, listening, analyzing, speaking
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      
      recognitionRef.current.onresult = async (event) => {
        const text = event.results[0][0].transcript;
        setStatus('analyzing');
        
        try {
          const data = await analyzeTopic(text, 'global', true);
          let responseText = "I couldn't find definitive intelligence on that.";
          if (data && data.executive_summary) {
            responseText = data.executive_summary;
          } else if (data && data.headlines && data.headlines.length > 0) {
            responseText = "Here is what I found: " + data.headlines[0].title;
          }
          speak(responseText);
        } catch (e) {
          speak("Sorry, I encountered an error accessing the global database.");
        }
      };

      recognitionRef.current.onerror = (e) => {
        console.error(e);
        setStatus('idle');
      };

      recognitionRef.current.onend = () => {
        if (status === 'listening') setStatus('idle');
      };
    }
  }, []);

  const speak = (text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    
    const voices = window.speechSynthesis.getVoices();
    const prefVoice = voices.find(v => v.name.includes('Google UK English Male') || v.name.includes('Samantha') || v.name.includes('Daniel')) || voices[0];
    if (prefVoice) utterance.voice = prefVoice;
    
    utterance.pitch = 0.9;
    utterance.rate = 1.05;

    utterance.onstart = () => {
      setStatus('speaking');
    };
    utterance.onend = () => {
      setStatus('idle');
    };

    window.speechSynthesis.speak(utterance);
  };

  const toggleListen = () => {
    if (!recognitionRef.current) return;
    if (status === 'listening') {
      recognitionRef.current.stop();
      setStatus('idle');
    } else {
      window.speechSynthesis.cancel();
      recognitionRef.current.start();
      setStatus('listening');
    }
  };

  return (
    <div 
      onClick={toggleListen}
      title="Siri-Style AI Analyst"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        padding: '6px 12px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '20px',
        cursor: 'pointer',
        border: '1px solid rgba(255,255,255,0.05)',
        minWidth: '80px',
        height: '32px'
      }}
    >
      {status === 'idle' ? (
        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, letterSpacing: '1px' }}>V.O.I.C.E</span>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', height: '16px' }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              style={{
                width: '4px',
                background: status === 'listening' ? 'linear-gradient(to top, #ef4444, #f87171)' : 'linear-gradient(to top, #3b82f6, #60a5fa)',
                borderRadius: '2px',
                animation: `siri-wave 0.${5 + i}s infinite alternate ease-in-out`,
                animationDelay: `0.${i * 2}s`
              }}
            />
          ))}
        </div>
      )}
      <style>{`
        @keyframes siri-wave {
          0% { height: 4px; }
          100% { height: 16px; }
        }
      `}</style>
    </div>
  );
}
