import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, Activity, Play } from 'lucide-react';
import { fetchTrending, analyzeTopic } from '../api';

export default function VoiceAnalystAI() {
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState('offline'); // offline, initializing, idle, listening, analyzing, speaking
  const [transcript, setTranscript] = useState('');
  const [systemMessage, setSystemMessage] = useState('System Offline. Awaiting authentication.');
  const recognitionRef = useRef(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      
      recognitionRef.current.onresult = async (event) => {
        const text = event.results[0][0].transcript;
        setTranscript(text);
        setStatus('analyzing');
        setSystemMessage(`Analyzing intelligence on: "${text}"`);
        
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
        setSystemMessage('Awaiting voice input...');
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
    
    // Try to find a premium/professional sounding voice
    const voices = window.speechSynthesis.getVoices();
    const prefVoice = voices.find(v => v.name.includes('Google UK English Male') || v.name.includes('Samantha') || v.name.includes('Daniel')) || voices[0];
    if (prefVoice) utterance.voice = prefVoice;
    
    utterance.pitch = 0.9;
    utterance.rate = 1.05;

    utterance.onstart = () => {
      setStatus('speaking');
      setSystemMessage(`Broadcasting: "${text.substring(0, 40)}..."`);
    };
    utterance.onend = () => {
      setStatus('idle');
      setSystemMessage('Awaiting your orders.');
    };

    window.speechSynthesis.speak(utterance);
  };

  const startCommandCenter = async () => {
    setIsActive(true);
    setStatus('initializing');
    setSystemMessage('Connecting to global feeds...');
    
    try {
      const data = await fetchTrending();
      const headlines = data?.headlines?.slice(0, 2).map(h => h.title) || ["Markets stabilize after tech rally", "Global weather anomalies reported"];
      
      const introText = `Welcome to the Command Center. Global feeds synchronized. Today's top intelligence: ${headlines[0]}. Also, ${headlines[1]}. Awaiting your orders.`;
      speak(introText);
    } catch (e) {
      speak("Welcome to the Command Center. Database connection limited, but I am listening.");
    }
  };

  const toggleListen = () => {
    if (!recognitionRef.current) {
        setSystemMessage("Speech Recognition not supported in this browser.");
        return;
    }
    if (status === 'listening') {
      recognitionRef.current.stop();
      setStatus('idle');
    } else {
      window.speechSynthesis.cancel();
      recognitionRef.current.start();
      setStatus('listening');
      setSystemMessage('Listening...');
      setTranscript('');
    }
  };

  if (!isActive) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999
      }}>
        <button onClick={startCommandCenter} style={{
          background: 'none', border: '1px solid var(--accent-orange)', color: 'var(--accent-orange)',
          padding: '20px 40px', fontSize: '24px', letterSpacing: '4px', textTransform: 'uppercase',
          cursor: 'pointer', borderRadius: '4px', boxShadow: '0 0 20px rgba(250, 204, 21, 0.2)',
          transition: 'all 0.3s', display: 'flex', alignItems: 'center', gap: '16px'
        }}>
          <Play size={24} /> Enter Command Center
        </button>
        <p style={{ color: 'var(--text-secondary)', marginTop: '20px', letterSpacing: '1px', fontSize: '12px' }}>
          INITIALIZATION SEQUENCE REQUIRES AUDIO PERMISSION
        </p>
      </div>
    );
  }

  return (
    <div className="voice-ai-module" style={{
      background: 'rgba(10, 15, 30, 0.8)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderLeft: status === 'listening' ? '3px solid #ef4444' : status === 'speaking' ? '3px solid #3b82f6' : '3px solid var(--accent-orange)',
      borderRadius: '8px',
      padding: '16px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      minWidth: '300px'
    }}>
      <button 
        onClick={toggleListen}
        style={{
          background: status === 'listening' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.05)',
          color: status === 'listening' ? '#ef4444' : 'var(--text-primary)',
          border: 'none',
          padding: '12px',
          borderRadius: '50%',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s',
          outline: 'none'
        }}
      >
        {status === 'listening' ? <Mic size={20} className="pulse-animation" /> : <MicOff size={20} />}
      </button>

      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-orange)', letterSpacing: '1px' }}>V.O.I.C.E ANALYST</span>
          {status === 'speaking' && <Volume2 size={12} color="#3b82f6" />}
          {status === 'analyzing' && <Activity size={12} className="spin" color="var(--accent-orange)" />}
        </div>
        <div style={{ 
          color: 'var(--text-secondary)', 
          fontSize: '13px', 
          fontFamily: 'monospace',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '250px'
        }}>
          {systemMessage}
        </div>
      </div>
    </div>
  );
}
