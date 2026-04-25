import { CircleDashed } from 'lucide-react';

export default function EmptyState({ title, body }) {
  return (
    <div className="wp-empty">
      <CircleDashed size={22} />
      <b>{title}</b>
      {body && <p>{body}</p>}
    </div>
  );
}

