import { MessageSquare, ThumbsUp, ThumbsDown, Shield } from 'lucide-react';

const MOCK_ANALYSTS = [
  {
    name: 'Isaac Chen',
    role: 'Sentinel Strategist',
    avatar: null,
    badge: 'Ruythings',
    opinion: 'Markets are in full risk-on mode right, pricing in a swift Middle East ceasefire. I watch reaction at geopolitical flashpoints and with gravity.',
    upvotes: 12,
    downvotes: 7,
  },
];

export default function AnalystOpinions({ analysts = null }) {
  const displayAnalysts = analysts || MOCK_ANALYSTS;

  return (
    <div className="analyst-opinions-panel">
      <div className="analyst-opinions-header">
        <MessageSquare size={13} />
        <span>ANALYST OPINIONS</span>
      </div>

      <div className="analyst-opinions-list">
        {displayAnalysts.map((analyst, idx) => (
          <div key={idx} className="analyst-opinion-card">
            <div className="analyst-card-header">
              <div className="analyst-avatar">
                {analyst.avatar ? (
                  <img src={analyst.avatar} alt={analyst.name} />
                ) : (
                  <div className="analyst-avatar-placeholder">
                    {analyst.name.split(' ').map(n => n[0]).join('')}
                  </div>
                )}
              </div>
              <div className="analyst-info">
                <div className="analyst-name">
                  {analyst.name}
                  <Shield size={10} className="analyst-verified" />
                </div>
                <div className="analyst-role">{analyst.role}</div>
                {analyst.badge && (
                  <span className="analyst-badge">{analyst.badge}</span>
                )}
              </div>
            </div>

            <p className="analyst-opinion-text">
              {analyst.opinion}
            </p>

            <div className="analyst-opinion-actions">
              <button className="analyst-vote-btn">
                <ThumbsUp size={12} />
                <span>{analyst.upvotes}</span>
              </button>
              <button className="analyst-vote-btn">
                <ThumbsDown size={12} />
                <span>{analyst.downvotes}</span>
              </button>
              <span className="analyst-view-more">▸ View more stories</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
