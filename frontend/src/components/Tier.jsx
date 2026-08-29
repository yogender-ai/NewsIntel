const MAP = {
  CRITICAL: { cls: 'tag-critical', label: 'Critical' },
  SIGNAL: { cls: 'tag-signal', label: 'Signal' },
  WATCH: { cls: 'tag-watch', label: 'Watch' },
  CALM: { cls: 'tag-calm', label: 'Calm' },
};

export default function Tier({ tier }) {
  const t = MAP[String(tier || '').toUpperCase()] || { cls: 'tag-neutral', label: tier || 'Unranked' };
  return <span className={`tag ${t.cls}`}>{t.label}</span>;
}
