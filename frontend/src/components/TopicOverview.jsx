import { useState } from 'react';
import { Shield, Sparkles, AlertTriangle, Zap, TrendingUp, BarChart, Info, ChevronDown, ChevronUp, Search, Target, Activity, Brain } from 'lucide-react';

const RISK_EXPLANATIONS = {
  low: "The situation is stable with minimal disruption expected. Headlines are mostly informational and don't signal immediate concern. Markets and daily life are unlikely to be affected.",
  medium: "There are notable developments that warrant attention. Some headlines suggest emerging tensions, policy shifts, or events that could escalate. Stay informed as the situation evolves.",
  high: "Significant and urgent developments detected. Multiple sources are reporting on high-impact events that could affect markets, policy, or public safety. Immediate attention recommended.",
};

const MARKET_EXPLANATIONS = {
  positive: "The news coverage suggests developments that are generally favorable for markets — think growth signals, positive earnings, supportive policy, or de-escalation of tensions.",
  negative: "The coverage indicates headwinds for markets — rising tensions, regulatory crackdowns, disappointing data, or instability that could spook investors.",
  mixed: "The news landscape is sending conflicting signals — some headlines point to opportunity while others flag risk. Markets may see increased volatility.",
  neutral: "Current coverage doesn't carry significant market-moving implications. The stories are largely informational without strong bullish or bearish signals.",
};

const CONFIDENCE_EXPLANATIONS = {
  high: "High confidence — based on analysis of multiple credible sources with consistent reporting. The AI models had strong agreement on key themes and sentiment.",
  medium: "Moderate confidence — based on a reasonable number of sources but with some variance in reporting angles. Additional context could sharpen the analysis.",
  low: "Lower confidence — limited sources, conflicting reports, or rapidly evolving situation where facts are still emerging. Take this analysis as a starting point.",
};

export default function TopicOverview({ analysis, onThemeSearch }) {
  const [expandedSections, setExpandedSections] = useState({});

  if (!analysis) return null;

  const {
    overview = '',
    key_themes = [],
    keywords = [],
    risk_level = 'medium',
    risk_reason = '',
    breaking = false,
    market_impact = 'neutral',
    market_reason = '',
    confidence = 0.5,
    confidence_reason = '',
  } = analysis;

  const confidencePercent = Math.round((confidence || 0.5) * 100);
  const confidenceLevel = confidencePercent >= 70 ? 'high' : confidencePercent >= 40 ? 'medium' : 'low';

  const toggleSection = (key) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className={`topic-overview glass ${breaking ? 'breaking-active' : ''}`}>
      {breaking && (
        <div className="breaking-banner-enhanced">
          <div className="breaking-pulse" />
          <Zap size={12} />
          <span>Breaking News Detected</span>
          <div className="breaking-pulse" />
        </div>
      )}

      <div className="overview-content-v4">
        {/* Left: Main Analysis */}
        <div className="overview-main">
          <div className="overview-header-row">
            <h3>
              <div className="overview-icon-wrapper">
                <Brain size={16} />
              </div>
              AI Intelligence Brief
            </h3>
            <div className="overview-powered-by">
              <Sparkles size={10} />
              Gemini 2.0
            </div>
          </div>

          <p className="overview-paragraph">{overview}</p>

          {/* Key Themes — Clickable */}
          {key_themes.length > 0 && (
            <div className="overview-block-v4">
              <div className="block-title-v4">
                <TrendingUp size={12} />
                Key Themes
                <button
                  className="explain-toggle"
                  onClick={() => toggleSection('themes')}
                  title="What are these?"
                >
                  <Info size={11} />
                </button>
              </div>
              {expandedSections.themes && (
                <div className="explain-box">
                  <Info size={11} />
                  These are the dominant narratives identified across all analyzed articles. Click any theme to search for more news on that specific topic.
                </div>
              )}
              <div className="theme-tags-v4">
                {key_themes.map((t, i) => (
                  <button
                    key={i}
                    className="theme-tag-v4"
                    onClick={() => onThemeSearch?.(t)}
                    title={`Search for "${t}"`}
                  >
                    <Search size={9} />
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Keywords */}
          {keywords.length > 0 && (
            <div className="overview-block-v4">
              <div className="block-title-v4">
                <Sparkles size={12} />
                Key Entities & Terms
                <button
                  className="explain-toggle"
                  onClick={() => toggleSection('keywords')}
                >
                  <Info size={11} />
                </button>
              </div>
              {expandedSections.keywords && (
                <div className="explain-box">
                  <Info size={11} />
                  These are the most important names, organizations, and terms extracted from the news coverage. They represent the key players and concepts in this story.
                </div>
              )}
              <div className="keywords-section-v4">
                {keywords.map((kw, i) => (
                  <button
                    key={i}
                    className="keyword-v4"
                    onClick={() => onThemeSearch?.(kw)}
                  >
                    {kw}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Metrics Panel */}
        <div className="metrics-panel">
          {/* Risk Level */}
          <div className="metric-card">
            <div className="metric-header">
              <Shield size={12} />
              <span>Risk Level</span>
              <button className="explain-toggle" onClick={() => toggleSection('risk')}>
                <Info size={10} />
              </button>
            </div>
            <div className={`metric-value-large ${risk_level}`}>
              {risk_level.toUpperCase()}
            </div>
            <div className="risk-meter-v4">
              <div className={`risk-meter-fill-v4 ${risk_level}`} />
            </div>
            {risk_reason && <p className="metric-reason">{risk_reason}</p>}
            {expandedSections.risk && (
              <div className="explain-box small">
                <Info size={10} />
                {RISK_EXPLANATIONS[risk_level] || RISK_EXPLANATIONS.medium}
              </div>
            )}
          </div>

          {/* Market Impact */}
          <div className="metric-card">
            <div className="metric-header">
              <Activity size={12} />
              <span>Market Impact</span>
              <button className="explain-toggle" onClick={() => toggleSection('market')}>
                <Info size={10} />
              </button>
            </div>
            <div className={`metric-value-medium market-${market_impact}`}>
              <div className={`market-indicator ${market_impact}`}>
                {market_impact === 'positive' ? '↗' : market_impact === 'negative' ? '↘' : market_impact === 'mixed' ? '↕' : '→'}
              </div>
              {market_impact.charAt(0).toUpperCase() + market_impact.slice(1)}
            </div>
            {market_reason && <p className="metric-reason">{market_reason}</p>}
            {expandedSections.market && (
              <div className="explain-box small">
                <Info size={10} />
                {MARKET_EXPLANATIONS[market_impact] || MARKET_EXPLANATIONS.neutral}
              </div>
            )}
          </div>

          {/* Confidence Score */}
          <div className="metric-card">
            <div className="metric-header">
              <Target size={12} />
              <span>AI Confidence</span>
              <button className="explain-toggle" onClick={() => toggleSection('confidence')}>
                <Info size={10} />
              </button>
            </div>
            <div className="confidence-visual">
              <svg viewBox="0 0 80 80" className="confidence-ring">
                <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                <circle
                  cx="40" cy="40" r="32"
                  fill="none"
                  stroke={confidencePercent >= 70 ? 'var(--accent-emerald)' : confidencePercent >= 40 ? 'var(--accent-amber)' : 'var(--accent-rose)'}
                  strokeWidth="6"
                  strokeDasharray={`${confidencePercent * 2.01} 201`}
                  strokeLinecap="round"
                  transform="rotate(-90 40 40)"
                  className="confidence-ring-fill"
                />
                <text x="40" y="44" textAnchor="middle" className="confidence-text">
                  {confidencePercent}%
                </text>
              </svg>
            </div>
            {confidence_reason && <p className="metric-reason">{confidence_reason}</p>}
            {expandedSections.confidence && (
              <div className="explain-box small">
                <Info size={10} />
                {CONFIDENCE_EXPLANATIONS[confidenceLevel]}
              </div>
            )}
          </div>

          {/* Breaking News Badge */}
          {breaking && (
            <div className="metric-card breaking-card">
              <AlertTriangle size={14} />
              <span>Breaking / Developing Story</span>
              <p className="metric-reason">One or more headlines represent a breaking or rapidly developing news event. Information may change as the story unfolds.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
