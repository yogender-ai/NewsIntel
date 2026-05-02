import React, { useEffect, useState, useRef } from 'react';
import { Activity, Database, BrainCircuit, Shield, Zap, CheckCircle2 } from 'lucide-react';

const PIPELINE_STEPS = [
  { id: 'connect', label: 'CONNECTING SOURCES', icon: Activity, duration: 800 },
  { id: 'ingest', label: 'INGESTING FEEDS', icon: Database, duration: 900 },
  { id: 'analyze', label: 'AI ANALYSIS', icon: BrainCircuit, duration: 1000 },
  { id: 'score', label: 'SCORING SIGNALS', icon: Zap, duration: 700 },
  { id: 'secure', label: 'SECURING PIPELINE', icon: Shield, duration: 600 },
];

const TOTAL_DURATION = PIPELINE_STEPS.reduce((s, step) => s + step.duration, 0); // ~4s total
const MIN_DISPLAY_TIME = 2000; // Minimum time to show the pipeline — covers backend

export default function TransparentPipeline({ onComplete, dataReady }) {
  const [activeStep, setActiveStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('running'); // running | finishing | done
  const onCompleteRef = useRef(onComplete);
  const dataReadyRef = useRef(dataReady);
  const startRef = useRef(Date.now());

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { dataReadyRef.current = dataReady; }, [dataReady]);

  // Advance steps & track progress — smooth timing that covers the backend load
  useEffect(() => {
    const start = Date.now();
    startRef.current = start;
    let killed = false;

    // Compute step offsets
    const offsets = [];
    let acc = 0;
    PIPELINE_STEPS.forEach((step) => {
      offsets.push(acc);
      acc += step.duration;
    });

    const timers = PIPELINE_STEPS.map((_, i) =>
      setTimeout(() => { if (!killed) setActiveStep(i); }, offsets[i])
    );

    // Smooth progress ticker — 60fps via RAF instead of setInterval
    let rafId = 0;

    const tick = () => {
      if (killed) return;
      const elapsed = Date.now() - start;

      // Phase 1: Normal timeline. Progress goes to 92% on the normal timeline.
      // This leaves headroom so the bar doesn't sit at 100% while the backend is still loading.
      const timelinePct = Math.min(100, (elapsed / TOTAL_DURATION) * 100);
      const cappedPct = dataReadyRef.current ? timelinePct : Math.min(timelinePct, 92);

      // If data is ready AND we've shown at least the minimum display time, finish gracefully.
      if (dataReadyRef.current && elapsed > MIN_DISPLAY_TIME) {
        // Smoothly ramp to 100% over 600ms
        setPhase('finishing');
        setProgress(100);
        setActiveStep(PIPELINE_STEPS.length - 1);

        // Wait for the CSS transition (600ms) then call onComplete
        setTimeout(() => {
          if (killed) return;
          setPhase('done');
          // Small breathing room before unmounting — let the fade-out start
          setTimeout(() => {
            if (onCompleteRef.current) onCompleteRef.current();
          }, 400);
        }, 600);

        killed = true;
        return;
      }

      // If the full timeline elapsed but data is NOT ready, hold at 92%
      if (timelinePct >= 100 && !dataReadyRef.current) {
        setProgress(92);
        rafId = requestAnimationFrame(tick);
        return;
      }

      setProgress(cappedPct);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      killed = true;
      timers.forEach(clearTimeout);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  const isDone = phase === 'done';
  const isFinishing = phase === 'finishing' || phase === 'done';

  return (
    <div className={`pipeline-overlay-v2 ${isDone ? 'pipeline-done' : ''} ${isFinishing ? 'pipeline-finishing' : ''}`}>
      {/* Lightweight CSS-only background instead of canvas — no thread blocking */}
      <div className="pipeline-ambient-bg" />

      <div className="pipeline-center">
        {/* Progress ring */}
        <div className="pipeline-ring-wrap">
          <svg viewBox="0 0 120 120" className="pipeline-ring-svg">
            <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(0,229,160,0.06)" strokeWidth="2" />
            <circle
              cx="60" cy="60" r="54" fill="none"
              stroke="url(#pipeGrad)" strokeWidth="2.5" strokeLinecap="round"
              strokeDasharray={`${progress * 3.39} ${339 - progress * 3.39}`}
              transform="rotate(-90 60 60)"
              className="pipeline-ring-progress"
            />
            <defs>
              <linearGradient id="pipeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00E5A0" />
                <stop offset="50%" stopColor="#8B5CF6" />
                <stop offset="100%" stopColor="#06B6D4" />
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
            const stepDone = i < activeStep || isFinishing;
            const isActive = i === activeStep && !isFinishing;
            return (
              <div key={step.id} className={`pipeline-step-item ${stepDone ? 'done' : ''} ${isActive ? 'active' : ''}`}>
                <div className="pipeline-step-icon">
                  {stepDone ? <CheckCircle2 size={16} /> : <Icon size={16} />}
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
