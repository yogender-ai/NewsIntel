import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Users } from 'lucide-react';

const COLORS = [
  '#6366f1', '#a855f7', '#22d3ee', '#34d399', '#fbbf24',
  '#f43f5e', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316',
];

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
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
      <p style={{ color: '#f0f0f5', fontWeight: 600 }}>
        {payload[0].payload.name}
      </p>
      <p style={{ color: '#9494a8', marginTop: 4 }}>
        Mentions: <span style={{ color: '#6366f1', fontWeight: 600 }}>{payload[0].value}</span>
      </p>
    </div>
  );
};

export default function EntityChart({ data = [] }) {
  if (!data.length) return null;

  // Take top 8
  const chartData = data.slice(0, 8);

  return (
    <div className="chart-card glass">
      <h3>
        <Users size={15} style={{ color: 'var(--accent-cyan)' }} />
        Key Entities
      </h3>
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
            />
            <YAxis
              dataKey="name"
              type="category"
              width={90}
              tick={{ fill: '#9494a8', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={false} />
            <Bar dataKey="count" radius={[0, 5, 5, 0]} maxBarSize={22}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.75} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
