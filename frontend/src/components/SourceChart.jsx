import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Building2, Shield, Info } from 'lucide-react';

const COLORS = [
  '#a855f7', '#6366f1', '#22d3ee', '#34d399', '#fbbf24',
  '#f43f5e', '#ec4899', '#8b5cf6',
];

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <p style={{ color: '#f0f0f5', fontWeight: 600 }}>{data.name}</p>
        {data.is_trusted && <Shield size={10} style={{ color: 'var(--accent-emerald)' }} />}
      </div>
      <p className="chart-tooltip-detail">
        {payload[0].value} article{payload[0].value !== 1 ? 's' : ''} from this outlet
        {data.is_trusted && <span style={{ color: 'var(--accent-emerald)' }}> · Verified Source</span>}
      </p>
    </div>
  );
};

export default function SourceChart({ data = [] }) {
  if (!data.length) return null;

  const chartData = data.slice(0, 8);
  const totalArticles = chartData.reduce((s, d) => s + d.count, 0);
  const trustedCount = chartData.filter(d => d.is_trusted).length;
  const topSource = chartData[0];

  let explanation = `Your news comes from ${chartData.length} different outlets. "${topSource.name}" contributes the most with ${topSource.count} article${topSource.count !== 1 ? 's' : ''}.`;
  if (trustedCount > 0) {
    explanation += ` ${trustedCount} of ${chartData.length} sources are verified trusted outlets.`;
  }

  return (
    <div className="chart-card glass">
      <h3>
        <Building2 size={15} style={{ color: 'var(--accent-purple)' }} />
        News Sources
      </h3>
      <div className="chart-explanation">
        <Info size={11} />
        <span>{explanation}</span>
      </div>
      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
          >
            <XAxis
              type="number"
              tick={{ fill: '#55556a', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <YAxis
              dataKey="name"
              type="category"
              width={100}
              tick={({ x, y, payload }) => {
                const source = chartData.find(d => d.name === payload.value);
                return (
                  <g transform={`translate(${x},${y})`}>
                    <text
                      x={0}
                      y={0}
                      dy={4}
                      textAnchor="end"
                      fill={source?.is_trusted ? '#34d399' : '#9494a8'}
                      fontSize={11}
                      fontWeight={source?.is_trusted ? 500 : 400}
                    >
                      {source?.is_trusted ? '✓ ' : ''}{payload.value}
                    </text>
                  </g>
                );
              }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={false} />
            <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={20}>
              {chartData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.is_trusted ? '#34d399' : COLORS[i % COLORS.length]}
                  fillOpacity={entry.is_trusted ? 0.85 : 0.7}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
