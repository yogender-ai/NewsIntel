import React, { useEffect, useState, useRef } from 'react';
import { Activity, Database, BrainCircuit, Shield, Zap, CheckCircle2 } from 'lucide-react';

const PIPELINE_STEPS = [
  { id: 'connect', label: 'CONNECTING SOURCES', icon: Activity, duration: 1800 },
  { id: 'ingest', label: 'INGESTING FEEDS', icon: Database, duration: 2200 },
  { id: 'analyze', label: 'AI ANALYSIS', icon: BrainCircuit, duration: 2600 },
  { id: 'score', label: 'SCORING SIGNALS', icon: Zap, duration: 1400 },
  { id: 'secure', label: 'SECURING PIPELINE', icon: Shield, duration: 1000 },
];

export default function TransparentPipeline() {
  const [activeStep, setActiveStep] = useState(0);
  const [particles, setParticles] = useState([]);
  const canvasRef = useRef(null);

  useEffect(() => {
    let idx = 0;
    const advance = () => {
      if (idx >= PIPELINE_STEPS.length) return;
      setActiveStep(idx);
      idx++;
      if (idx < PIPELINE_STEPS.length) {
        setTimeout(advance, PIPELINE_STEPS[idx - 1].duration);
      }
    };
    advance();
  }, []);

  // Particle system
  useEffect(() => {
    const iv = setInterval(() => {
      setParticles(prev => {
        const now = Date.now();
        const filtered = prev.filter(p => now - p.born < 2000);
        return [...filtered, {
          id: now,
          born: now,
          x: Math.random() * 100,
          y: Math.random() * 100,
          size: 1 + Math.random() * 3,
          hue: 220 + Math.random() * 120,
        }];
      });
    }, 80);
    return () => clearInterval(iv);
  }, []);

  // Canvas neural network effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    let raf;
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      ctx.scale(dpr, dpr);
    };
    resize();

    const nodes = Array.from({ length: 40 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      nodes.forEach(n => {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > window.innerWidth) n.vx *= -1;
        if (n.y < 0 || n.y > window.innerHeight) n.vy *= -1;
      });
      // Draw connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 180) {
            const alpha = (1 - dist / 180) * 0.08;
            ctx.strokeStyle = `rgba(139,92,246,${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }
      // Draw nodes
      nodes.forEach(n => {
        ctx.beginPath();
        ctx.arc(n.x, n.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(139,92,246,0.15)';
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const progress = Math.min(100, ((activeStep + 1) / PIPELINE_STEPS.length) * 100);

  return (
    <div className="pipeline-overlay-v2">
      <canvas ref={canvasRef} className="pipeline-neural-canvas" />

      <div className="pipeline-center">
        {/* Animated ring */}
        <div className="pipeline-ring-wrap">
          <svg viewBox="0 0 120 120" className="pipeline-ring-svg">
            <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(139,92,246,0.08)" strokeWidth="2" />
            <circle
              cx="60" cy="60" r="54" fill="none"
              stroke="url(#pipeGrad)" strokeWidth="2.5" strokeLinecap="round"
              strokeDasharray={`${progress * 3.39} ${339 - progress * 3.39}`}
              transform="rotate(-90 60 60)"
              style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.22,1,0.36,1)' }}
            />
            <defs>
              <linearGradient id="pipeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="50%" stopColor="#5eead4" />
                <stop offset="100%" stopColor="#c084fc" />
              </linearGradient>
            </defs>
          </svg>
          <div className="pipeline-ring-center">
            <span className="pipeline-pct">{Math.round(progress)}%</span>
          </div>
        </div>

        {/* Step list */}
        <div className="pipeline-steps-list">
          {PIPELINE_STEPS.map((step, i) => {
            const Icon = step.icon;
            const isDone = i < activeStep;
            const isActive = i === activeStep;
            return (
              <div key={step.id} className={`pipeline-step-item ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`}>
                <div className="pipeline-step-icon">
                  {isDone ? <CheckCircle2 size={16} /> : <Icon size={16} />}
                </div>
                <span className="pipeline-step-label">{step.label}</span>
                {isActive && <div className="pipeline-step-pulse" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating particles */}
      {particles.map(p => (
        <div
          key={p.id}
          className="pipeline-particle"
          style={{
            left: `${p.x}%`, top: `${p.y}%`,
            width: p.size, height: p.size,
            background: `hsl(${p.hue}, 70%, 65%)`,
            animationDuration: '2s',
          }}
        />
      ))}
    </div>
  );
}
