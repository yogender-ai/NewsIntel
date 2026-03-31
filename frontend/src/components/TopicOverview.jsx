import { Shield, Sparkles, AlertTriangle, Zap, TrendingUp, BarChart } from 'lucide-react';

export default function TopicOverview({ analysis }) {
  if (!analysis) return null;

  const {
    overview = '',
    key_themes = [],
    keywords = [],
    risk_level = 'medium',
    risk_reason = '',
    breaking = false,
    market_impact = 'neutral',
    confidence = 0.5,
  } = analysis;

  const confidencePercent = Math.round((confidence || 0.5) * 100);

  return (
    <div className="topic-overview glass">
      {breaking && (
        <div className="breaking-banner">
          <Zap size={12} />
          <span>Breaking News Detected</span>
        </div>
      )}

      <div className="overview-content">
        <div className="overview-text">
          <h3>
            <Sparkles size={16} style={{ color: 'var(--accent-purple)' }} />
            AI Intelligence Brief
          </h3>
          <p>{overview}</p>

          <div className="overview-sections">
            {key_themes.length > 0 && (
              <div className="overview-block">
                <div className="block-title">
                  <TrendingUp size={12} />
                  Key Themes
                </div>
                <div className="theme-tags">
                  {key_themes.map((t, i) => (
                    <span key={i} className="theme-tag">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {keywords.length > 0 && (
              <div className="overview-block">
                <div className="block-title">
                  <Sparkles size={12} />
                  Keywords
                </div>
                <div className="keywords-section">
                  {keywords.map((kw, i) => (
                    <span key={i} className="keyword">{kw}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="risk-panel">
          <div className="risk-badge">
            <span className="risk-badge-label">
              <Shield size={11} style={{ marginRight: 4 }} />
              Risk Level
            </span>
            <div className={`risk-meter ${risk_level}`}>
              <div className="risk-meter-fill" />
            </div>
            <span className={`risk-badge-value ${risk_level}`}>
              {risk_level}
            </span>
            {risk_reason && (
              <span className="risk-badge-reason">{risk_reason}</span>
            )}
          </div>

          {market_impact && market_impact !== 'neutral' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 4,
              fontSize: '0.68rem',
              fontWeight: 600,
              background: market_impact === 'positive' ? 'rgba(52,211,153,0.08)' :
                         market_impact === 'negative' ? 'rgba(244,63,94,0.08)' :
                         'rgba(251,191,36,0.08)',
              color: market_impact === 'positive' ? 'var(--accent-emerald)' :
                     market_impact === 'negative' ? 'var(--accent-rose)' :
                     'var(--accent-amber)',
              border: `1px solid ${market_impact === 'positive' ? 'rgba(52,211,153,0.15)' :
                                   market_impact === 'negative' ? 'rgba(244,63,94,0.15)' :
                                   'rgba(251,191,36,0.15)'}`,
            }}>
              <BarChart size={10} />
              Market: {market_impact}
            </div>
          )}

          {breaking && (
            <div className="breaking-badge">
              <AlertTriangle size={12} />
              <span>Breaking</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
