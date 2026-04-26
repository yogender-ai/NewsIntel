import { Clock, Layers, Radio } from 'lucide-react';
import { formatRelativeTime } from '../../lib/dashboardAdapter';

const statusLabel = {
  enriched: 'AI enriched',
  pending: 'Analysis pending',
  failed: 'Analysis unavailable',
  rules_only: 'Rules only',
};

function EntityChip({ entity }) {
  const name = typeof entity === 'string' ? entity : entity?.name;
  const type = typeof entity === 'string' ? '' : entity?.type;
  if (!name) return null;
  return <span className="entity-chip">{name}{type ? <small>{type}</small> : null}</span>;
}

export default function TopShiftCard({ shift, onOpen }) {
  const isEnriched = shift.aiStatus === 'enriched';

  return (
    <button className={`top-shift-card ai-${shift.aiStatus}`} onClick={() => onOpen(shift)}>
      <div className="shift-rank">{shift.rank}</div>
      <div className="shift-visual">
        {shift.imageUrl ? <img src={shift.imageUrl} alt="" /> : <Radio size={26} />}
      </div>
      <div className="shift-body">
        <div className="shift-meta">
          {shift.category && <span>{shift.category}</span>}
          <em>{statusLabel[shift.aiStatus] || statusLabel.rules_only}</em>
          {isEnriched && shift.sentiment && <strong className={`sentiment-badge sentiment-${shift.sentiment}`}>{shift.sentiment}</strong>}
        </div>
        <h3>{shift.headline}</h3>
        {isEnriched && shift.summary ? <p>{shift.summary}</p> : <p className="empty-copy">{statusLabel[shift.aiStatus] || statusLabel.rules_only}</p>}
        {isEnriched && shift.impactLine ? <p className="impact-copy">{shift.impactLine}</p> : null}
        {isEnriched && shift.entities?.length ? (
          <div className="entity-row">
            {shift.entities.slice(0, 4).map((entity) => <EntityChip key={entity.name || entity} entity={entity} />)}
          </div>
        ) : null}
        <div className="shift-foot">
          <small><Clock size={13} /> {formatRelativeTime(shift.updatedAt) || 'Updated time unavailable'}</small>
          <small><Layers size={13} /> {shift.sourceCount ?? '-'} sources</small>
        </div>
      </div>
    </button>
  );
}
