import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Activity, Database, BrainCircuit, Shield, Zap, CheckCircle2 } from 'lucide-react';

const PIPELINE_STEPS = [
  { id: 'connect', label: 'CONNECTING SOURCES', icon: Activity, duration: 2000 },
  { id: 'ingest', label: 'INGESTING FEEDS', icon: Database, duration: 2400 },
  { id: 'analyze', label: 'AI ANALYSIS', icon: BrainCircuit, duration: 2800 },
  { id: 'score', label: 'SCORING SIGNALS', icon: Zap, duration: 1800 },
  { id: 'secure', label: 'SECURING PIPELINE', icon: Shield, duration: 1200 },
];

const TOTAL_DURATION = PIPELINE_STEPS.reduce((s, step) => s + step.duration, 0);

export default function TransparentPipeline({ onComplete }) {
  const [activeStep, setActiveStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const canvasRef = useRef(null);
  const startRef = useRef(Date.now());

  // Advance steps & track progress
  useEffect(() => {
    const start = Date.now();
    startRef.current = start;
    let stepIdx = 0;
    let elapsed = 0;

    const timers = PIPELINE_STEPS.map((step, i) => {
      elapsed += (i > 0 ? PIPELINE_STEPS[i - 1].duration : 0);
      return setTimeout(() => {
        setActiveStep(i);
      }, elapsed);
    });

    // Smooth progress ticker
    const iv = setInterval(() => {
      const e = Date.now() - start;
      const pct = Math.min(100, (e / TOTAL_DURATION) * 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(iv);
        setDone(true);
        // Give a brief pause at 100% so user sees it
        setTimeout(() => {
          if (onComplete) onComplete();
        }, 600);
      }
    }, 30);

    return () => {
      timers.forEach(clearTimeout);
      clearInterval(iv);
    };
  }, [onComplete]);

  // Neural canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    let raf;
    const w = canvas.parentElement?.offsetWidth || 600;
    const h = canvas.parentElement?.offsetHeight || 400;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    ctx.scale(dpr, dpr);

    const nodes = Array.from({ length: 35 }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      nodes.forEach(n => {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
      });
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 160) {
            ctx.strokeStyle = `rgba(139,92,246,${(1 - dist / 160) * 0.06})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }
      nodes.forEach(n => {
        ctx.beginPath();
        ctx.arc(n.x, n.y, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(139,92,246,0.12)';
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className={`pipeline-overlay-v2 ${done ? 'pipeline-done' : ''}`}>
      <canvas ref={canvasRef} className="pipeline-neural-canvas" />
      <div className="pipeline-center">
        {/* Progress ring */}
        <div className="pipeline-ring-wrap">
          <svg viewBox="0 0 120 120" className="pipeline-ring-svg">
            <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(139,92,246,0.06)" strokeWidth="2" />
            <circle
              cx="60" cy="60" r="54" fill="none"
              stroke="url(#pipeGrad)" strokeWidth="2.5" strokeLinecap="round"
              strokeDasharray={`${progress * 3.39} ${339 - progress * 3.39}`}
              transform="rotate(-90 60 60)"
              style={{ transition: 'stroke-dasharray 0.15s linear' }}
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

        {/* Steps */}
        <div className="pipeline-steps-list">
          {PIPELINE_STEPS.map((step, i) => {
            const Icon = step.icon;
            const isDone = i < activeStep || done;
            const isActive = i === activeStep && !done;
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
    </div>
  );
}
