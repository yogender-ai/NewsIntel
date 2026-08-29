import { useId, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { GLOSSARY } from '../lib/glossary';

export default function Explain({ topic, children }) {
  const entry = GLOSSARY[topic];
  const [open, setOpen] = useState(false);
  const id = useId();
  if (!entry) return children ?? null;

  return (
    <span className="explain">
      {children ?? entry.term}
      <button
        type="button"
        className="explain-btn"
        aria-label={`What does ${entry.term} mean?`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        <HelpCircle size={13} aria-hidden="true" />
      </button>
      {open && (
        <span className="explain-pop card" id={id} role="tooltip">
          <b>{entry.term}</b>
          <span className="explain-short">{entry.short}</span>
          <span className="explain-long">{entry.long}</span>
        </span>
      )}
    </span>
  );
}
