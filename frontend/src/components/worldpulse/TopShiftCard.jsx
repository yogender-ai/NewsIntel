import { Clock, Radio } from 'lucide-react';
import { formatRelativeTime } from '../../lib/dashboardAdapter';

const impactColor = { critical: '#DC2626', signal: '#F59E0B', watch: '#00E5A0', noise: '#52525B' };
const impactBg = { critical: 'rgba(220,38,38,0.1)', signal: 'rgba(245,158,11,0.1)', watch: 'rgba(0,229,160,0.1)', noise: 'rgba(82,82,91,0.1)' };

export default function TopShiftCard({ shift, onOpen, index }) {
  const impact = shift.impactLevel ? String(shift.impactLevel).toLowerCase() : null;
  const relativeTime = formatRelativeTime(shift.updatedAt);
  
  return (
    <button className={`wp-card shift-card-advanced ai-${shift.aiStatus}`} onClick={() => onOpen(shift)}>
      <div className="sca-rank">{shift.rank || index + 1}</div>
      
      <div className="sca-visual">
        {shift.imageUrl ? (
          <img
            src={shift.imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="sca-placeholder">
            <Radio size={32} color="#8B5CF6" />
          </div>
        )}
      </div>
      
      <div className="sca-body">
        {shift.category && <span className="sca-category">{shift.category}</span>}
        <h3 className="sca-headline">{shift.headline}</h3>
        {shift.summary ? <p className="sca-summary">{shift.summary}</p> : null}
      </div>
      
      <div className="sca-foot">
        {impact && (
          <div className="sca-impact" style={{ color: impactColor[impact], background: impactBg[impact] }}>
            <span className="sca-impact-dot" style={{ background: impactColor[impact] }} />
            {shift.impactLevel}
          </div>
        )}
        {relativeTime && (
          <div className="sca-time">
            <Clock size={12} />
            {relativeTime}
          </div>
        )}
      </div>
    </button>
  );
}
