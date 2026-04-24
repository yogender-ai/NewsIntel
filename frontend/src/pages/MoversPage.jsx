import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDown, ArrowUp, Building2, ChevronsUpDown, Eye, Gauge, Globe2, Hash,
  Minus, Plus, Search, TrendingUp, User, Zap
} from 'lucide-react';
import { usePersonalization } from '../context/PersonalizationContext';
import PulseChart from '../components/PulseChart';

const TOPIC_COLORS = {
  tech: '#6c4df6', ai: '#8b5cf6', markets: '#10b981', politics: '#f59e0b',
  defense: '#ef4444', crypto: '#f97316', climate: '#22d3ee', healthcare: '#ec4899',
  space: '#3b82f6', trade: '#eab308', auto: '#14b8a6', telecom: '#6366f1',
  'real-estate': '#f43e5e', media: '#a855f7', education: '#0ea5e9', legal: '#64748b',
};

function DeltaStrip({ deltas }) {
  if (!deltas?.length) return null;
  return (
    <div className="movers-delta-strip">
      <div className="delta-strip-label">Topic Pulse Delta (24h)</div>
      <div className="delta-strip-grid">
        {deltas.map(d => {
          const tone = d.delta > 0 ? 'up' : d.delta < 0 ? 'down' : 'flat';
          const Icon = d.delta > 0 ? ArrowUp : d.delta < 0 ? ArrowDown : Minus;
          return (
            <div key={d.topic} className={`delta-strip-cell ${tone}`}>
              <span className="dsc-topic">{d.label || d.topic}</span>
              <div className="dsc-value">
                <Icon size={14} />
                <b>{d.delta > 0 ? '+' : ''}{Math.round(d.delta)}</b>
              </div>
              <span className="dsc-pulse">Pulse: {Math.round(d.current)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EntityManager({ entities, trackedEntities, onTrackEntity }) {
  const [newEntity, setNewEntity] = useState('');
  const [entityType, setEntityType] = useState('ORG');

  const handleAdd = () => {
    const name = newEntity.trim();
    if (!name) return;
    onTrackEntity(name, entityType);
    setNewEntity('');
  };

  return (
    <div className="entity-manager">
      <div className="em-header">
        <h3><Building2 size={16} /> Tracked Entities</h3>
        <span className="em-count">{trackedEntities.length} active</span>
      </div>

      <div className="em-add-row">
        <div className="em-input-group">
          <Search size={14} />
          <input
            type="text"
            placeholder="Add company, person, or topic..."
            value={newEntity}
            onChange={e => setNewEntity(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
        </div>
        <select value={entityType} onChange={e => setEntityType(e.target.value)}>
          <option value="ORG">Company</option>
          <option value="PERSON">Person</option>
          <option value="GPE">Region</option>
          <option value="TOPIC">Topic</option>
        </select>
        <button className="btn-mini primary" onClick={handleAdd} disabled={!newEntity.trim()}>
          <Plus size={14} /> Add
        </button>
      </div>

      {trackedEntities.length > 0 ? (
        <div className="em-list">
          {trackedEntities.map((ent, i) => (
            <div key={ent.entity_name || i} className="em-entity">
              <div className="em-entity-info">
                <b>{ent.entity_name}</b>
                <span className="em-type">{ent.entity_type || 'ENTITY'}</span>
              </div>
              <div className="em-entity-meta">
                <span>Weight: {ent.follow_weight || 1}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="em-empty">
          <p>Track companies, people, or topics to boost signal relevance and receive targeted alerts.</p>
        </div>
      )}
    </div>
  );
}

function ExposureNetworkViz({ network }) {
  if (!network?.nodes?.length) return null;

  const nodes = network.nodes;
  const edges = network.edges;
  const svgW = 500;
  const svgH = 320;
  const cx = svgW / 2;
  const cy = svgH / 2;

  // Layout: user at center, topics in inner ring, signals in outer ring
  const userNode = nodes.find(n => n.type === 'user');
  const topicNodes = nodes.filter(n => n.type === 'topic');
  const entityNodes = nodes.filter(n => n.type === 'entity');
  const signalNodes = nodes.filter(n => n.type === 'signal');

  const positioned = {};
  if (userNode) positioned[userNode.id] = { x: cx, y: cy, node: userNode };

  const innerRadius = 80;
  topicNodes.forEach((n, i) => {
    const angle = (i / Math.max(topicNodes.length, 1)) * Math.PI * 2 - Math.PI / 2;
    positioned[n.id] = { x: cx + Math.cos(angle) * innerRadius, y: cy + Math.sin(angle) * innerRadius, node: n };
  });

  entityNodes.forEach((n, i) => {
    const angle = (i / Math.max(entityNodes.length, 1)) * Math.PI * 2 - Math.PI / 4;
    positioned[n.id] = { x: cx + Math.cos(angle) * (innerRadius + 30), y: cy + Math.sin(angle) * (innerRadius + 30), node: n };
  });

  const outerRadius = 140;
  signalNodes.forEach((n, i) => {
    const angle = (i / Math.max(signalNodes.length, 1)) * Math.PI * 2 - Math.PI / 2;
    positioned[n.id] = { x: cx + Math.cos(angle) * outerRadius, y: cy + Math.sin(angle) * outerRadius, node: n };
  });

  const typeColors = { user: '#6c4df6', topic: '#f28c24', entity: '#10b981', signal: '#5076ff' };

  return (
    <div className="exposure-network-viz">
      <h3><Globe2 size={16} /> Exposure Network</h3>
      <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: svgH }}>
        {/* Edges */}
        {edges.map((e, i) => {
          const from = positioned[e.from];
          const to = positioned[e.to];
          if (!from || !to) return null;
          return (
            <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke="rgba(108,77,246,0.15)" strokeWidth="1.5" />
          );
        })}
        {/* Nodes */}
        {Object.values(positioned).map(({ x, y, node }) => (
          <g key={node.id}>
            <circle cx={x} cy={y} r={node.type === 'user' ? 18 : node.type === 'signal' ? 10 : 12}
              fill={typeColors[node.type] || '#6c4df6'} fillOpacity="0.15"
              stroke={typeColors[node.type] || '#6c4df6'} strokeWidth="2" />
            <text x={x} y={y + (node.type === 'user' ? 32 : 22)} textAnchor="middle"
              fontSize={node.type === 'user' ? '10' : '8'} fontWeight="700"
              fill="#4a4560">
              {(node.label || '').slice(0, 18)}
            </text>
            {node.type === 'user' && (
              <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="900" fill="#6c4df6">
                <User size={14} />You
              </text>
            )}
          </g>
        ))}
      </svg>
      <div className="en-legend">
        <span><i style={{ background: typeColors.user }} /> You</span>
        <span><i style={{ background: typeColors.topic }} /> Topics</span>
        <span><i style={{ background: typeColors.entity }} /> Entities</span>
        <span><i style={{ background: typeColors.signal }} /> Signals</span>
      </div>
    </div>
  );
}

export default function MoversPage() {
  const navigate = useNavigate();
  const {
    signals, dailyDelta, pulseHistory, trackedEntities, exposureNetwork,
    topicIds, exposureScore, trackEntity, recordOpen, TOPIC_LABELS, words,
  } = usePersonalization();

  const [historyWindow, setHistoryWindow] = useState('30d');

  // Top movers: signals sorted by absolute delta
  const topMovers = useMemo(() => {
    return [...signals]
      .filter(s => s.delta?.value != null)
      .sort((a, b) => Math.abs(b.delta.value || 0) - Math.abs(a.delta.value || 0))
      .slice(0, 10);
  }, [signals]);

  const handleOpen = (signal) => {
    recordOpen(signal);
    navigate('/dashboard', { state: { openSignalId: signal.id } });
  };

  // Select chart data based on window
  const chartTopics = topicIds.slice(0, 6);

  return (
    <div className="movers-page fin">
      <header className="movers-header">
        <div>
          <h1>Movers & Intelligence</h1>
          <p>Topic pulse trends, entity tracking, and signal movement analysis.</p>
        </div>
        <div className="movers-exposure-pill">
          <Gauge size={18} />
          <div>
            <b>{Math.round(exposureScore)}</b>
            <span>Exposure Score</span>
          </div>
        </div>
      </header>

      {/* Daily Delta Strip */}
      <DeltaStrip deltas={dailyDelta} />

      {/* Pulse History Charts */}
      <section className="movers-section">
        <div className="movers-section-header">
          <h2><TrendingUp size={18} /> Pulse History</h2>
          <div className="history-window-toggle">
            {['7d', '30d'].map(w => (
              <button key={w} className={historyWindow === w ? 'active' : ''} onClick={() => setHistoryWindow(w)}>
                {w}
              </button>
            ))}
          </div>
        </div>
        <div className="pulse-charts-grid">
          {chartTopics.length > 0 ? chartTopics.map(topic => {
            const data = pulseHistory[topic] || [];
            const sliced = historyWindow === '7d' ? data.slice(-168) : data;
            return (
              <PulseChart
                key={topic}
                data={sliced}
                label={TOPIC_LABELS[topic] || topic}
                color={TOPIC_COLORS[topic] || '#6c4df6'}
                height={140}
              />
            );
          }) : (
            <div className="pulse-chart-empty">
              <span>Set up your interests to see pulse history</span>
            </div>
          )}
        </div>
      </section>

      {/* Top Movers */}
      <section className="movers-section">
        <h2><ChevronsUpDown size={18} /> Top Movers</h2>
        {topMovers.length > 0 ? (
          <div className="top-movers-list">
            {topMovers.map((signal, idx) => {
              const tone = signal.delta.tone;
              const Icon = tone === 'up' ? ArrowUp : tone === 'down' ? ArrowDown : Minus;
              return (
                <div key={signal.id} className={`mover-row ${tone}`} onClick={() => handleOpen(signal)}>
                  <span className="mover-rank">#{idx + 1}</span>
                  <div className="mover-info">
                    <span className={`tier-badge tier-${(signal.signal_tier || 'signal').toLowerCase()}`}>
                      {signal.signal_tier}
                    </span>
                    <b>{words(signal.thread_title, 10)}</b>
                  </div>
                  <div className="mover-delta">
                    <Icon size={15} />
                    <span>{signal.delta.value > 0 ? '+' : ''}{signal.delta.value}</span>
                  </div>
                  <div className="mover-pulse">
                    <em>Pulse</em>
                    <b>{Math.round(signal.pulse.score)}</b>
                  </div>
                  <Eye size={16} className="mover-open" />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="movers-empty">
            <p>Delta tracking starts after enough baseline data is collected. Keep using the dashboard.</p>
          </div>
        )}
      </section>

      {/* Entity Manager + Exposure Network side by side */}
      <div className="movers-bottom-grid">
        <EntityManager
          entities={[]}
          trackedEntities={trackedEntities}
          onTrackEntity={trackEntity}
        />
        <ExposureNetworkViz network={exposureNetwork} />
      </div>
    </div>
  );
}
