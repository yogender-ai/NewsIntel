import { Clock, Layers, Radio } from 'lucide-react';
import { formatRelativeTime } from '../../lib/dashboardAdapter';

const impactColor = { critical: '#ff9ba9', signal: '#ffd38a', watch: '#7ee7c4', noise: '#a0a0b8' };
const impactBg = { critical: 'rgba(255,155,169,0.1)', signal: 'rgba(255,211,138,0.1)', watch: 'rgba(126,231,196,0.1)', noise: 'rgba(160,160,184,0.1)' };

export default function TopShiftCard({ shift, onOpen, index }) {
  const isEnriched = shift.aiStatus === 'enriched';
  const impact = (shift.impactLevel || 'noise').toLowerCase();
  
  return (
    <button className={`wp-card shift-card-advanced ai-${shift.aiStatus}`} onClick={() => onOpen(shift)}>
      <div className="sca-rank">{shift.rank || index + 1}</div>
      
      <div className="sca-visual">
        {shift.imageUrl ? (
          <img src={shift.imageUrl} alt="" />
        ) : (
          <div className="sca-placeholder">
            <Radio size={32} color="#8da2ff" />
          </div>
        )}
      </div>
      
      <div className="sca-body">
        {shift.category && <span className="sca-category">{shift.category}</span>}
        <h3 className="sca-headline">{shift.headline}</h3>
        {shift.summary ? <p className="sca-summary">{shift.summary}</p> : null}
      </div>
      
      <div className="sca-foot">
        <div className="sca-impact" style={{ color: impactColor[impact], background: impactBg[impact] }}>
          <span className="sca-impact-dot" style={{ background: impactColor[impact] }} />
          {shift.impactLevel || 'Noise'} Impact
        </div>
        <div className="sca-time">
          <Clock size={12} />
          {formatRelativeTime(shift.updatedAt) || 'Just now'}
        </div>
      </div>
    </button>
  );
}
