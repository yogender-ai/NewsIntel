import { Clock, Layers, Radio } from 'lucide-react';
import { formatRelativeTime } from '../../lib/dashboardAdapter';

const impactColor = { critical: '#ff9ba9', signal: '#ffd38a', watch: '#7ee7c4', noise: '#a0a0b8' };
const impactBg = { critical: 'rgba(255,155,169,0.1)', signal: 'rgba(255,211,138,0.1)', watch: 'rgba(126,231,196,0.1)', noise: 'rgba(160,160,184,0.1)' };

function EntityChip({ entity }) {
  const name = typeof entity === 'string' ? entity : entity?.name;
  const type = typeof entity === 'string' ? '' : entity?.type;
  if (!name) return null;
  return <span className="entity-chip">{name}{type ? <small>{type}</small> : null}</span>;
}

export default function TopShiftCard({ shift, onOpen, index }) {
  const isEnriched = shift.aiStatus === 'enriched';
  const impact = (shift.impactLevel || 'noise').toLowerCase();
  
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
        {shift.summary ? <p>{shift.summary}</p> : null}
        <div className="shift-foot">
          <small className="shift-impact" style={{ color: impactColor[impact], background: impactBg[impact] }}>
            <span className="shift-impact-dot" style={{ background: impactColor[impact] }} />
            {shift.impactLevel || 'Noise'} Impact
          </small>
          <small><Clock size={13} /> {formatRelativeTime(shift.updatedAt) || 'Just now'}</small>
        </div>
      </div>
    </button>
  );
}
