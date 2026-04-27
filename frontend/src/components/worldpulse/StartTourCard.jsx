import { ArrowRight, Sparkles } from 'lucide-react';

export default function StartTourCard({ onStart }) {
  return (
    <section className="tour-card">
      <div>
        <div className="tour-kicker"><Sparkles size={13} /> New to NewsIntel?</div>
        <p>Take a 1-min tour to unlock the power of real-time intelligence.</p>
      </div>
      <button onClick={onStart}>Start Tour <ArrowRight size={14} /></button>
    </section>
  );
}
