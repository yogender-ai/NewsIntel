import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Users, Info } from 'lucide-react';

const COLORS = [
  '#6366f1', '#a855f7', '#22d3ee', '#34d399', '#fbbf24',
  '#f43f5e', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316',
];

const ENTITY_TYPE_LABELS = {
  PER: { label: 'Person', color: '#6366f1' },
  ORG: { label: 'Organization', color: '#a855f7' },
  LOC: { label: 'Location', color: '#22d3ee' },
  MISC: { label: 'Other', color: '#fbbf24' },
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  const typeInfo = ENTITY_TYPE_LABELS[data.type] || ENTITY_TYPE_LABELS.MISC;
  return (
    <div className="chart-tooltip">
      <p style={{ color: '#f0f0f5', fontWeight: 600 }}>{data.name}</p>
      <div className="chart-tooltip-row">
        <span className="entity-type-pill" style={{ background: typeInfo.color + '20', color: typeInfo.color }}>
          {typeInfo.label}
        </span>
      </div>
      <p className="chart-tooltip-detail">
        Mentioned <span style={{ color: '#6366f1', fontWeight: 600 }}>{payload[0].value} times</span> across articles
      </p>
    </div>
  );
};

export default function EntityChart({ data = [] }) {
  if (!data.length) return null;

  const chartData = data.slice(0, 8);
  const topEntity = chartData[0];
  const totalMentions = chartData.reduce((s, d) => s + d.count, 0);
  const uniqueTypes = [...new Set(chartData.map(d => d.type || 'MISC'))];

  const explanation = `These ${chartData.length} people, organizations, and places are mentioned most across all articles. "${topEntity.name}" leads with ${topEntity.count} mentions out of ${totalMentions} total.`;

  return (
    <div className="chart-card glass">
      <h3>
        <Users size={15} style={{ color: 'var(--accent-cyan)' }} />
        Key Entities
      </h3>
      <div className="chart-explanation">
        <Info size={11} />
        <span>{explanation}</span>
      </div>
      {/* Entity type legend */}
      <div className="entity-type-legend">
        {uniqueTypes.map(type => {
          const info = ENTITY_TYPE_LABELS[type] || ENTITY_TYPE_LABELS.MISC;
          return (
            <span key={type} className="entity-type-legend-item" style={{ color: info.color }}>
              <span className="entity-type-legend-dot" style={{ background: info.color }} />
              {info.label}
            </span>
          );
        })}
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
            <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={22}>
              {chartData.map((entry, i) => {
                const typeInfo = ENTITY_TYPE_LABELS[entry.type] || ENTITY_TYPE_LABELS.MISC;
                return (
                  <Cell key={i} fill={typeInfo.color} fillOpacity={0.8} />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
