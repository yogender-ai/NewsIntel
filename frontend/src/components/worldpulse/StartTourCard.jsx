import { ArrowRight, Zap } from 'lucide-react';

export default function StartTourCard({ onStart }) {
  return (
    <section className="wp-card tour-init-card">
      <div className="tour-init-left">
        <div className="tour-init-icon">
          <Zap size={18} />
        </div>
        <div className="tour-init-text">
          <h3>Initialize Command Center</h3>
          <p>Configure your intelligence feeds and alerts.</p>
        </div>
      </div>
      <button className="tour-init-btn" onClick={onStart}>
        START SETUP <ArrowRight size={14} />
      </button>
    </section>
  );
}
