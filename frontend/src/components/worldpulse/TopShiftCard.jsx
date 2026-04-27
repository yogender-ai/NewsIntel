import { Clock, Layers, Radio } from 'lucide-react';
import { formatRelativeTime } from '../../lib/dashboardAdapter';

const impactColor = { high: '#ff9ba9', medium: '#ffd38a', low: '#7ee7c4' };
const impactBg = { high: 'rgba(255,155,169,0.1)', medium: 'rgba(255,211,138,0.1)', low: 'rgba(126,231,196,0.1)' };

function getImpact(shift) {
  const pulse = shift.pulse ?? 0;
  if (pulse >= 70) return 'high';
  if (pulse >= 40) return 'medium';
  return 'low';
}

function EntityChip({ entity }) {
  const name = typeof entity === 'string' ? entity : entity?.name;
  const type = typeof entity === 'string' ? '' : entity?.type;
  if (!name) return null;
  return <span className="entity-chip">{name}{type ? <small>{type}</small> : null}</span>;
}

export default function TopShiftCard({ shift, onOpen, index }) {
  const isEnriched = shift.aiStatus === 'enriched';
  const impact = getImpact(shift);

  return (
    <button className={`top-shift-card ai-${shift.aiStatus}`} onClick={() => onOpen(shift)}>
      <div className="shift-rank">{shift.rank}</div>
      <div className="shift-visual">
        {shift.imageUrl ? <img src={shift.imageUrl} alt="" /> : <Radio size={26} />}
      </div>
      <div className="shift-body">
        <div className="shift-meta">
          {shift.category && <span>{shift.category}</span>}
        </div>
        <h3>{shift.headline}</h3>
        {isEnriched && shift.summary ? <p>{shift.summary}</p> : <p className="empty-copy">Analysis pending</p>}
        <div className="shift-foot">
          <small className="shift-impact" style={{ color: impactColor[impact], background: impactBg[impact] }}>
            <span className="shift-impact-dot" style={{ background: impactColor[impact] }} />
            {impact === 'high' ? 'High' : impact === 'medium' ? 'Medium' : 'Low'} Impact
          </small>
          <small><Clock size={13} /> {formatRelativeTime(shift.updatedAt) || 'Just now'}</small>
        </div>
      </div>
    </button>
  );
}
