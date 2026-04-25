export default function StartTourCard({ onStart }) {
  return (
    <section className="tour-card">
      <div>
        <h2>New to NewsIntel?</h2>
        <p>Take a 1-minute tour to understand World Pulse, Delta, and Signals.</p>
      </div>
      <button onClick={onStart}>Start Tour</button>
    </section>
  );
}
