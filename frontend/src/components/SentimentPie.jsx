import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Info } from 'lucide-react';

const SENTIMENT_COLORS = {
  Positive: '#34d399',
  Negative: '#f43f5e',
  Neutral: '#a78bfa',
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  const total = entry.payload.total || 0;
  const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;
  return (
    <div className="chart-tooltip">
      <p style={{ color: entry.payload.fill, fontWeight: 600 }}>{entry.name}</p>
      <p className="chart-tooltip-detail">
        {entry.value} article{entry.value !== 1 ? 's' : ''} · <span style={{ color: '#f0f0f5' }}>{pct}%</span>
      </p>
    </div>
  );
};

export default function SentimentPie({ data = [] }) {
  if (!data.length) return null;

  const total = data.reduce((s, d) => s + d.value, 0);
  const enriched = data.map(d => ({ ...d, total }));

  // Generate plain-English explanation
  const dominant = data.reduce((a, b) => b.value > a.value ? b : a, data[0]);
  const dominantPct = Math.round((dominant.value / total) * 100);
  
  let explanation = '';
  if (dominant.name === 'Neutral') {
    explanation = `Out of ${total} articles, ${dominant.value} are neutral (${dominantPct}%) — the media is largely balanced on this topic without strong positive or negative bias.`;
  } else if (dominant.name === 'Positive') {
    explanation = `${dominant.value} out of ${total} articles (${dominantPct}%) carry a positive tone — the media sentiment leans optimistic on this topic.`;
  } else {
    explanation = `${dominant.value} out of ${total} articles (${dominantPct}%) have negative sentiment — the coverage is highlighting concerns or criticism.`;
  }

  return (
    <div className="chart-card glass">
      <h3>
        <TrendingUp size={15} style={{ color: 'var(--accent-emerald)' }} />
        Sentiment Breakdown
      </h3>
      <div className="chart-explanation">
        <Info size={11} />
        <span>{explanation}</span>
      </div>
      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={enriched}
              cx="50%"
              cy="45%"
              innerRadius={50}
              outerRadius={85}
              paddingAngle={4}
              dataKey="value"
              nameKey="name"
              stroke="none"
              animationBegin={200}
              animationDuration={800}
            >
              {enriched.map((entry, i) => (
                <Cell
                  key={i}
                  fill={SENTIMENT_COLORS[entry.name] || '#6366f1'}
                  fillOpacity={0.9}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="pie-center-label">
          <span className="pie-center-value">{dominantPct}%</span>
          <span className="pie-center-name">{dominant.name}</span>
        </div>
        {/* Legend */}
        <div className="chart-legend">
          {data.map((entry, i) => {
            const pct = Math.round((entry.value / total) * 100);
            return (
              <div key={i} className="chart-legend-item">
                <span
                  className="chart-legend-dot"
                  style={{ background: SENTIMENT_COLORS[entry.name] || '#6366f1' }}
                />
                <span className="chart-legend-label">{entry.name}</span>
                <span className="chart-legend-value">{entry.value} ({pct}%)</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
