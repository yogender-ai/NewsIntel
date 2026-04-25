import { Clock, Layers, Radio } from 'lucide-react';
import { formatRelativeTime } from '../../lib/dashboardAdapter';

export default function TopShiftCard({ shift, onOpen }) {
  return (
    <button className="top-shift-card" onClick={() => onOpen(shift)}>
      <div className="shift-rank">{shift.rank}</div>
      <div className="shift-visual">
        {shift.imageUrl ? <img src={shift.imageUrl} alt="" /> : <Radio size={26} />}
      </div>
      <div className="shift-body">
        <div className="shift-meta">
          {shift.category && <span>{shift.category}</span>}
          {shift.impactLevel && <em>{shift.impactLevel}</em>}
        </div>
        <h3>{shift.headline}</h3>
        {shift.summary && <p>{shift.summary}</p>}
        <div className="shift-foot">
          <small><Clock size={13} /> {formatRelativeTime(shift.updatedAt) || 'Updated time unavailable'}</small>
          <small><Layers size={13} /> {shift.sourceCount ?? '—'} sources</small>
        </div>
      </div>
    </button>
  );
}

