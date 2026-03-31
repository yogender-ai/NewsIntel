import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp } from 'lucide-react';

const SENTIMENT_COLORS = {
  Positive: '#34d399',
  Negative: '#f43f5e',
  Neutral: '#fbbf24',
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  const total = entry.payload.total || 0;
  const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;
  return (
    <div
      style={{
        background: 'rgba(12, 12, 20, 0.95)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10,
        padding: '10px 16px',
        fontSize: '0.8rem',
        backdropFilter: 'blur(12px)',
      }}
    >
      <p style={{ color: entry.payload.fill, fontWeight: 600 }}>
        {entry.name}
      </p>
      <p style={{ color: '#9494a8', marginTop: 4 }}>
        {entry.value} article{entry.value !== 1 ? 's' : ''} · <span style={{ color: '#f0f0f5' }}>{pct}%</span>
      </p>
    </div>
  );
};

export default function SentimentPie({ data = [] }) {
  if (!data.length) return null;

  const total = data.reduce((s, d) => s + d.value, 0);
  const enriched = data.map(d => ({ ...d, total }));

  return (
    <div className="chart-card glass">
      <h3>
        <TrendingUp size={15} style={{ color: 'var(--accent-emerald)' }} />
        Sentiment Breakdown
      </h3>
      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={enriched}
              cx="50%"
              cy="45%"
              innerRadius={55}
              outerRadius={90}
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
                  fillOpacity={0.85}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Legend below */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 20,
          marginTop: -8,
        }}>
          {data.map((entry, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.75rem',
            }}>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: SENTIMENT_COLORS[entry.name] || '#6366f1',
                display: 'inline-block',
              }} />
              <span style={{ color: '#9494a8' }}>
                {entry.name} ({entry.value})
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
