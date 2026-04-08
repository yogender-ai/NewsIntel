import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Play } from 'lucide-react';
import { fetchTrending, analyzeTopic } from '../api';

export default function VoiceAnalystAI() {
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState('offline'); // offline, initializing, idle, listening, analyzing, speaking
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
    
    // Try to find a premium/professional sounding voice
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

  const startCommandCenter = async () => {
    setIsActive(true);
    setStatus('initializing');
    
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

  if (!isActive) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999
      }}>
        <button onClick={startCommandCenter} style={{
          background: 'none', border: '1px solid #3b82f6', color: '#3b82f6',
          padding: '20px 40px', fontSize: '24px', letterSpacing: '4px', textTransform: 'uppercase',
          cursor: 'pointer', borderRadius: '4px', boxShadow: '0 0 40px rgba(59, 130, 246, 0.4)',
          transition: 'all 0.3s', display: 'flex', alignItems: 'center', gap: '16px'
        }}>
          <Play size={24} /> Enter Command Center
        </button>
      </div>
    );
  }

  // Determine elegant orb styling based on state
  let orbGlow = 'rgba(255,255,255,0.1)';
  let orbBorder = 'rgba(255,255,255,0.2)';
  let iconColor = '#fff';

  if (status === 'listening') {
    orbGlow = 'rgba(239, 68, 68, 0.6)'; // Red alert
    orbBorder = '#ef4444';
    iconColor = '#ef4444';
  } else if (status === 'speaking' || status === 'analyzing') {
    orbGlow = 'rgba(59, 130, 246, 0.5)'; // Siri blue
    orbBorder = '#3b82f6';
    iconColor = '#3b82f6';
  }

  return (
    <div style={{ position: 'relative' }}>
        {status === 'speaking' || status === 'listening' || status === 'analyzing' ? (
           <div className="orb-pulse-ring" style={{
               position: 'absolute', top: -10, left: -10, right: -10, bottom: -10,
               borderRadius: '50%', background: orbGlow, filter: 'blur(10px)',
               animation: 'pulse 1.5s infinite alternate'
           }} />
        ) : null}
        <button 
          onClick={toggleListen}
          title="V.O.I.C.E Analyst"
          style={{
            position: 'relative',
            width: '48px', height: '48px',
            background: 'rgba(10, 15, 30, 0.6)',
            backdropFilter: 'blur(10px)',
            border: `1px solid ${orbBorder}`,
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            zIndex: 10,
            boxShadow: `0 0 20px ${orbGlow}`
          }}
        >
          {status === 'listening' ? <Mic size={20} color={iconColor} className="pulse-animation" /> : <MicOff size={20} color={iconColor} />}
        </button>
    </div>
  );
}
