import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { TrendingUp, Loader } from 'lucide-react';
import { fetchSentimentTrends } from '../api';

export default function SentimentTrend({ topic }) {
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!topic) return;
    (async () => {
      setLoading(true);
      const data = await fetchSentimentTrends(topic);
      setTrends(data.trends || []);
      setLoading(false);
    })();
  }, [topic]);

  if (loading) {
    return (
      <div className="chart-card sentiment-trend-card">
        <div className="chart-header">
          <TrendingUp size={16} />
          <h4>Sentiment Trend</h4>
        </div>
        <div className="chart-loading">
          <Loader size={20} className="spin" />
          <p>Loading trend data...</p>
        </div>
      </div>
    );
  }

  if (trends.length === 0) {
    return (
      <div className="chart-card sentiment-trend-card">
        <div className="chart-header">
          <TrendingUp size={16} />
          <h4>Sentiment Trend</h4>
        </div>
        <div className="chart-empty">
          <p>Search this topic more times to build trend data over time.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chart-card sentiment-trend-card">
      <div className="chart-header">
        <TrendingUp size={16} />
        <h4>Sentiment Over Time</h4>
        <span className="chart-badge">{trends.length} data points</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={trends} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="redGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              background: 'rgba(15,15,20,0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#f8fafc',
              fontSize: '12px'
            }}
          />
          <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
          <Area type="monotone" dataKey="positive" stroke="#10b981" fill="url(#greenGrad)" strokeWidth={2} name="Positive" />
          <Area type="monotone" dataKey="negative" stroke="#f43f5e" fill="url(#redGrad)" strokeWidth={2} name="Negative" />
          <Area type="monotone" dataKey="neutral" stroke="#3b82f6" fill="url(#blueGrad)" strokeWidth={2} name="Neutral" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
