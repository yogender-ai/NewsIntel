import { useState, useEffect, useRef } from 'react';
import { Globe, Calendar } from 'lucide-react';

const EVENTS = {
  '01-01': 'New Year\'s Day',
  '02-14': 'Valentine\'s Day',
  '03-17': 'St. Patrick\'s Day',
  '04-22': 'Earth Day',
  '10-31': 'Halloween',
  '12-25': 'Christmas Day'
};

const TIMEZONES = [
  { name: 'New York', tz: 'America/New_York' },
  { name: 'London', tz: 'Europe/London' },
  { name: 'Tokyo', tz: 'Asia/Tokyo' },
  { name: 'Dubai', tz: 'Asia/Dubai' }
];

export default function LiveClock() {
  const [now, setNow] = useState(new Date());
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const time = now.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  });

  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  
  // Custom mock event
  const monthDay = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todayEvent = EVENTS[monthDay] || 'Standard Operations';

  return (
    <div className="live-clock" id="live-clock" ref={containerRef} style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setIsOpen(!isOpen)}>
      <span className="clock-time">{time}</span>
      <span className="clock-date">{dateStr}</span>
      
      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: '8px', zIndex: 100,
          background: 'rgba(15, 15, 24, 0.95)', backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px',
          padding: '16px', minWidth: '220px', boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
          animation: 'fadeInUp 0.2s ease-out backwards', cursor: 'default'
        }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
            <Calendar size={14} color="#8b5cf6" />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Today's Event</span>
              <span style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 'bold' }}>{todayEvent}</span>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Globe size={12} /> Global Times
            </span>
            {TIMEZONES.map(tz => (
              <div key={tz.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#94a3b8' }}>{tz.name}</span>
                <span style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 'bold', fontFamily: 'monospace' }}>
                  {now.toLocaleTimeString('en-US', { timeZone: tz.tz, hour: '2-digit', minute: '2-digit', hour12: true })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
