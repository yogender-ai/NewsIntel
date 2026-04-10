import { Trophy, Shield, TrendingUp } from 'lucide-react';

const MOCK_LEADERBOARD = [
  {
    name: 'Isaac Chen',
    role: 'Sonowest Exralyst',
    badge: 'Ruythings',
    score: '+214',
    avatar: null,
    opinion: 'Temporary talks between US & Iran from brave moves, watching for impacts. Dollar & Energy Sector Mop.',
    tags: ['Bensing', 'OI', 'Iran ceasefire'],
    time: '19 hours ago',
  },
];

export default function AnalystLeaderboard({ analysts = null }) {
  const displayAnalysts = analysts || MOCK_LEADERBOARD;

  return (
    <div className="analyst-leaderboard-panel">
      <div className="leaderboard-header">
        <Trophy size={13} />
        <span>ANALYST LEADERBOARD</span>
      </div>

      <div className="leaderboard-list">
        {displayAnalysts.map((analyst, idx) => (
          <div key={idx} className="leaderboard-card">
            <div className="leaderboard-card-top">
              <div className="leaderboard-avatar">
                {analyst.avatar ? (
                  <img src={analyst.avatar} alt={analyst.name} />
                ) : (
                  <div className="leaderboard-avatar-placeholder">
                    {analyst.name.split(' ').map(n => n[0]).join('')}
                  </div>
                )}
              </div>
              <div className="leaderboard-info">
                <div className="leaderboard-name">
                  {analyst.name}
                  <Shield size={10} className="leaderboard-verified" />
                </div>
                <div className="leaderboard-role">{analyst.role}</div>
                {analyst.badge && (
                  <span className="leaderboard-badge">{analyst.badge}</span>
                )}
              </div>
              <div className="leaderboard-score">
                <TrendingUp size={12} />
                <span>{analyst.score}</span>
              </div>
            </div>

            <p className="leaderboard-opinion">{analyst.opinion}</p>

            <div className="leaderboard-tags">
              {analyst.tags.map((tag, i) => (
                <span key={i} className="leaderboard-tag">{tag}</span>
              ))}
            </div>

            <div className="leaderboard-time">{analyst.time}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
