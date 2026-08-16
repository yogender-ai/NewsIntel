import { useState, useRef, useEffect } from 'react';
import { Clock, Radio, Eye, TrendingUp, Zap } from 'lucide-react';
import { formatRelativeTime } from '../../lib/dashboardAdapter';

const impactColor = { critical: '#DC2626', signal: '#F59E0B', watch: '#00E5A0', noise: '#52525B' };
const impactBg = { critical: 'rgba(220,38,38,0.1)', signal: 'rgba(245,158,11,0.1)', watch: 'rgba(0,229,160,0.1)', noise: 'rgba(82,82,91,0.1)' };
const impactGlow = { critical: '0 0 20px rgba(220,38,38,0.15)', signal: '0 0 16px rgba(245,158,11,0.12)', watch: '0 0 16px rgba(0,229,160,0.12)', noise: 'none' };

export default function TopShiftCard({ shift, onOpen, index }) {
  const impact = shift.impactLevel ? String(shift.impactLevel).toLowerCase() : null;
  const relativeTime = formatRelativeTime(shift.updatedAt);
  const [imageUnavailable, setImageUnavailable] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isViewed, setIsViewed] = useState(false);
  const cardRef = useRef(null);
  const showImage = Boolean(shift.imageUrl) && !imageUnavailable;
  if (!shift.imageUrl) return null;

  // Intersection observer for entrance animation
  useEffect(() => {
    const el = cardRef.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsViewed(true);
        obs.disconnect();
      }
    }, { threshold: 0.2 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  
  return (
    <button
      ref={cardRef}
      className={`wp-card shift-card-advanced ai-${shift.aiStatus} ${isViewed ? 'shift-visible' : ''} ${impact === 'critical' ? 'shift-critical-glow' : ''}`}
      onClick={() => onOpen(shift)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ boxShadow: isHovered && impact ? impactGlow[impact] : undefined }}
    >
      {/* Rank badge with pulse */}
      <div className={`sca-rank ${impact === 'critical' ? 'sca-rank-critical' : ''}`}>
        <span className="sca-rank-number">{shift.rank || index + 1}</span>
        {impact === 'critical' && <div className="sca-rank-pulse" />}
      </div>
      
      {/* Visual thumbnail */}
      <div className="sca-visual">
        {showImage ? (
          <img
            src={shift.imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            referrerPolicy="no-referrer"
            onError={() => setImageUnavailable(true)}
          />
        ) : (
          <div className="sca-placeholder">
            <Radio size={32} color="#8B5CF6" />
            <div className="sca-placeholder-rings">
              <div className="sca-ring-1" />
              <div className="sca-ring-2" />
            </div>
          </div>
        )}
        {/* Hover overlay */}
        {isHovered && (
          <div className="sca-hover-overlay">
            <Eye size={20} />
            <span>View Details</span>
          </div>
        )}
      </div>
      
      {/* Content body */}
      <div className="sca-body">
        {shift.category && <span className="sca-category">{shift.category}</span>}
        <h3 className="sca-headline">{shift.headline}</h3>
        {shift.summary ? <p className="sca-summary">{shift.summary}</p> : null}
      </div>
      
      {/* Footer with enhanced impact display */}
      <div className="sca-foot">
        {impact && (
          <div className="sca-impact" style={{ color: impactColor[impact], background: impactBg[impact] }}>
            <span className="sca-impact-dot" style={{ background: impactColor[impact] }} />
            {impact === 'critical' && <Zap size={12} />}
            {shift.impactLevel}
          </div>
        )}
        {shift.mlSignalScore !== null && shift.mlSignalScore !== undefined && (
          <div className="sca-time sca-ml-badge">
            <TrendingUp size={12} />
            ML {Math.round(shift.mlSignalScore)}
          </div>
        )}
        {relativeTime && (
          <div className="sca-time">
            <Clock size={12} />
            {relativeTime}
          </div>
        )}
      </div>

      {/* Animated border glow on critical */}
      {impact === 'critical' && <div className="sca-critical-border" />}
    </button>
  );
}
