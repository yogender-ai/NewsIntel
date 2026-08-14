import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDownWideNarrow, Atom, BrainCircuit, Circle, Flame, GitBranch, Globe2, RefreshCw, Shield, Tags, X } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/worldpulse/Sidebar';
import LockedNavToast from '../components/worldpulse/LockedNavToast';
import { compactLabel } from '../lib/dashboardAdapter';

const categoryColors = {
  ai: '#818cf8',
  tech: '#22d3ee',
  markets: '#fbbf24',
  politics: '#f472b6',
  defense: '#fb923c',
  crypto: '#a78bfa',
  climate: '#34d399',
  healthcare: '#2dd4bf',
  energy: '#f97316',
  trade: '#38bdf8',
  auto: '#e879f9',
  education: '#4ade80',
  media: '#c084fc',
  legal: '#facc15',
};

const categoryIcons = {
  ai: BrainCircuit,
  tech: Atom,
  markets: Globe2,
  politics: Shield,
  defense: Shield,
  energy: Flame,
};

/* LiveCursor is now global in App.jsx */

function nodePoint(node, index, total) {
  // Distribute nodes into 3 orbital rings based on distance
  const dist = Number(node.distance ?? 0.5);
  let ringRadius;
  if (dist < 0.33) {
    ringRadius = 18 + dist * 30; // inner ring: 18-28%
  } else if (dist < 0.66) {
    ringRadius = 30 + (dist - 0.33) * 30; // mid ring: 30-40%
  } else {
    ringRadius = 38 + (dist - 0.66) * 28; // outer ring: 38-47%
  }
  // Spread nodes with slight random offset to avoid straight line
  const baseAngle = (Math.PI * 2 * index) / Math.max(total, 1) - Math.PI / 2;
  const jitter = ((index * 137.508) % 360) * (Math.PI / 180) * 0.15; // golden angle jitter
  const angle = baseAngle + jitter;
  return {
    x: 50 + Math.cos(angle) * ringRadius,
    y: 50 + Math.sin(angle) * ringRadius,
  };
}

function tierColor(node) {
  const tier = String(node.tier || node.signal_tier || '').toUpperCase();
  if (tier === 'CRITICAL') return '#fb7185';
  if (tier === 'SIGNAL') return '#5eead4';
  if (tier === 'WATCH') return '#fbbf24';
  if (tier === 'NOISE') return '#64748b';
  return categoryColors[node.category] || '#8da2ff';
}

function OrbitGraph({ nodes, edges, showLabels, onSelect, selectedId }) {
  const [hovered, setHovered] = useState(null);
  const points = useMemo(() => {
    const map = new Map();
    nodes.forEach((node, index) => map.set(node.id, nodePoint(node, index, nodes.length)));
    return map;
  }, [nodes]);
  const hotIds = useMemo(() => {
    if (!hovered && !selectedId) return null;
    const focus = hovered || selectedId;
    const linked = new Set([focus]);
    edges.forEach((edge) => {
      if (edge.from === focus) linked.add(edge.to);
      if (edge.to === focus) linked.add(edge.from);
    });
    return linked;
  }, [hovered, selectedId, edges]);

  return (
    <div className="signal-orbit-graph intel-orbit" style={{ position: 'relative', overflow: 'hidden', perspective: '800px' }}>
      <svg viewBox="0 0 100 100" aria-label="Signal relationship orbit" style={{ transformStyle: 'preserve-3d' }}>
        {/* Multiple orbital rings */}
        <circle cx="50" cy="50" r="12" className="orbit-ring" style={{ stroke: 'rgba(94, 234, 212, 0.06)', strokeWidth: '0.15' }} />
        <circle cx="50" cy="50" r="22" className="orbit-ring orbit-ring-inner" style={{ stroke: 'rgba(94, 234, 212, 0.1)', strokeWidth: '0.2' }} />
        <circle cx="50" cy="50" r="33" className="orbit-ring orbit-ring-mid" style={{ stroke: 'rgba(139, 92, 246, 0.1)', strokeWidth: '0.25', strokeDasharray: '2 3' }} />
        <circle cx="50" cy="50" r="42" className="orbit-ring orbit-ring-outer" style={{ stroke: 'rgba(167, 139, 250, 0.08)', strokeWidth: '0.2', strokeDasharray: '1 5' }} />
        <circle cx="50" cy="50" r="48" className="orbit-ring" style={{ stroke: 'rgba(251,113,133, 0.04)', strokeWidth: '0.1' }} />
        {edges.map((edge) => {
          const from = points.get(edge.from);
          const to = points.get(edge.to);
          if (!from || !to) return null;
          const active = !hotIds || hotIds.has(edge.from) && hotIds.has(edge.to);
          return (
            <line
              key={`${edge.from}-${edge.to}-${edge.type}`}
              x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              className={`orbit-edge edge-${edge.type}`}
              style={{ 
                '--edge-alpha': Math.max(0.22, Number(edge.confidence || 0.4)),
                stroke: 'url(#edge-grad)',
                strokeWidth: active ? 0.7 : 0.25,
                opacity: active ? 0.85 : 0.12
              }}
            />
          );
        })}
        <defs>
          <linearGradient id="edge-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5eead4" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.2" />
          </linearGradient>
        </defs>
      </svg>
      <button className="orbit-center-node" type="button" style={{ 
        boxShadow: '0 0 30px rgba(139, 92, 246, 0.4)', background: 'rgba(10,15,30,0.8)',
        backdropFilter: 'blur(8px)', border: '1px solid #8b5cf6' 
      }}>
        <Circle size={18} color="#c4b5fd" />
        <span style={{ color: '#fff' }}>Command</span>
      </button>
      {nodes.map((node, index) => {
        const point = points.get(node.id) || { x: 50, y: 50 };
        const color = tierColor(node);
        const Icon = categoryIcons[node.category] || Circle;
        const animDelay = `${index * 0.2}s`;
        const pulse = Number(node.pulse || 50);
        const size = Math.max(64, Math.min(118, (node.size || 76) * (0.7 + pulse / 200)));
        const dimmed = hotIds && !hotIds.has(node.id);
        return (
          <button
            key={node.id}
            className={`orbit-event-node orbit-${node.status || 'stable'} orbit-labeled-node ${selectedId === node.id ? 'orbit-selected' : ''}`}
            type="button"
            onClick={() => onSelect(node)}
            onMouseEnter={() => setHovered(node.id)}
            onMouseLeave={() => setHovered(null)}
            style={{
              left: `${point.x}%`, top: `${point.y}%`,
              width: `${size}px`, height: `${size}px`,
              '--node-color': color,
              animation: `nodeFloat 4s ease-in-out infinite alternate`,
              animationDelay: animDelay,
              opacity: dimmed ? 0.28 : 1,
              transform: 'translate(-50%, -50%)',
              boxShadow: `0 0 ${12 + pulse / 6}px ${color}55`,
              background: 'rgba(5,8,17,0.72)', backdropFilter: 'blur(6px)',
              border: `1px solid ${color}${selectedId === node.id ? 'cc' : '66'}`,
              zIndex: selectedId === node.id || hovered === node.id ? 4 : 2,
            }}
            title={node.title || node.label}
          >
            <i style={{ background: `${color}22`, color: color }}><Icon size={20} /></i>
            {showLabels && (
              <span style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                <b style={{ color: '#fff' }}>{compactLabel(node.category) || 'Signal'}</b>
                <strong style={{ color }}>{Math.round(node.pulse || 0)}</strong>
                {node.status && <small>{compactLabel(node.status)}</small>}
              </span>
            )}
          </button>
        );
      })}
      <style>{`
        @keyframes orbitSpinSlow { to { transform: rotate(360deg); } }
        @keyframes nodeFloat { 
          from { transform: translate(-50%, -50%) translateY(0px) scale(1); } 
          to { transform: translate(-50%, -50%) translateY(-6px) scale(1.05); } 
        }
      `}</style>
    </div>
  );
}

function OrbitDrawer({ node, edges, nodesById, onClose, onStory }) {
  if (!node) return null;
  const connected = edges
    .filter((edge) => edge.from === node.id || edge.to === node.id)
    .map((edge) => ({ edge, other: nodesById.get(edge.from === node.id ? edge.to : edge.from) }))
    .filter((item) => item.other);

  return (
    <aside className="shift-drawer orbit-drawer">
      <button className="drawer-close" onClick={onClose}><X size={18} /></button>
      {node.ai_status && <span>{node.ai_status}</span>}
      <h2>{node.label}</h2>
      <div className="drawer-grid">
        <div><small>Pulse</small><b>{node.pulse ?? '-'}</b></div>
        <div><small>Exposure</small><b>{node.exposure ?? '-'}</b></div>
        <div><small>Distance</small><b>{Math.round((node.distance ?? 0) * 100)}</b></div>
        <div><small>Status</small><b>{node.status || '-'}</b></div>
      </div>
      <section>
        <h3>Why it matters</h3>
        {node.why_it_matters ? <p>{node.why_it_matters}</p> : <p className="empty-copy">No impact note returned for this signal.</p>}
      </section>
      <section>
        <h3>Connected events</h3>
        {connected.length ? connected.map(({ edge, other }) => (
          <div className="orbit-connection" key={`${edge.from}-${edge.to}-${edge.type}`}>
            <b>{other.label}</b>
            <small>{edge.type} · {Math.round(Number(edge.confidence || 0) * 100)}%</small>
            {edge.evidence && <p>{edge.evidence}</p>}
          </div>
        )) : <p className="empty-copy">No validated relationships for this event yet.</p>}
      </section>
      <button className="orbit-story-button" onClick={() => onStory(node)}>Open Story Detail</button>
    </aside>
  );
}

export default function OrbitPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orbit, setOrbit] = useState({ center: null, nodes: [], edges: [] });
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lockedToast, setLockedToast] = useState('');
  const [topic, setTopic] = useState('all');
  const [relationship, setRelationship] = useState('all');
  const [sortBy, setSortBy] = useState('relevance');
  const [showLabels, setShowLabels] = useState(true);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [orbitResult, prefsResult] = await Promise.all([
        api.getOrbit(),
        api.getPreferences().catch(() => null),
      ]);
      setOrbit({
        center: orbitResult?.center || null,
        nodes: Array.isArray(orbitResult?.nodes) ? orbitResult.nodes : [],
        edges: Array.isArray(orbitResult?.edges) ? orbitResult.edges : [],
      });
      setPreferences(prefsResult);
    } catch (err) {
      setOrbit({ center: null, nodes: [], edges: [] });
      setError((err?.message || 'Unable to load Signal Orbit.').replace(/^\d+:\s*/, '').slice(0, 160));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [user, load]);

  useEffect(() => {
    if (!lockedToast) return undefined;
    const timer = window.setTimeout(() => setLockedToast(''), 2200);
    return () => window.clearTimeout(timer);
  }, [lockedToast]);

  const topics = useMemo(() => ['all', ...new Set(orbit.nodes.map((node) => node.category).filter(Boolean))], [orbit.nodes]);
  const relationships = useMemo(() => ['all', ...new Set(orbit.edges.map((edge) => edge.type).filter(Boolean))], [orbit.edges]);
  const filteredEdges = useMemo(
    () => orbit.edges.filter((edge) => relationship === 'all' || edge.type === relationship),
    [orbit.edges, relationship],
  );
  const connectedIds = useMemo(() => new Set(filteredEdges.flatMap((edge) => [edge.from, edge.to])), [filteredEdges]);
  const visibleNodes = useMemo(() => {
    const filtered = orbit.nodes.filter((node) => {
      if (topic !== 'all' && node.category !== topic) return false;
      if (relationship !== 'all' && !connectedIds.has(node.id)) return false;
      return true;
    });
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'pulse') return (b.pulse || 0) - (a.pulse || 0);
      if (sortBy === 'newest') return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
      return (b.exposure || 0) - (a.exposure || 0);
    });
    return sorted.slice(0, 14);
  }, [orbit.nodes, topic, relationship, connectedIds, sortBy]);
  const visibleIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);
  const visibleEdges = useMemo(
    () => filteredEdges.filter((edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to)),
    [filteredEdges, visibleIds],
  );
  const nodesById = useMemo(() => new Map(visibleNodes.map((node) => [node.id, node])), [visibleNodes]);
  const activeNode = selected || visibleNodes[0] || null;

  const openStory = (node) => navigate('/story', {
    state: {
      article: {
        id: node.id,
        title: node.title || node.label,
        text_preview: node.summary || node.why_it_matters,
        summary: node.summary || node.why_it_matters,
        source: node.source || node.sources?.[0]?.source || 'NewsIntel Orbit',
        url: node.source_url || node.sources?.[0]?.url,
        sources: node.sources || [],
        entities: node.entities || [],
        sentiment: node.sentiment,
        category: node.category,
        why_it_matters: node.why_it_matters,
        pulse_score: node.pulse,
        exposure_score: node.exposure,
        signal_tier: node.signal_tier || node.tier || null,
      },
    },
  });

  const profileTopics = preferences?.data?.preferred_categories || orbit.center?.topics || [];

  return (
    <div className="world-pulse-page orbit-page">
      {/* LiveCursor is now global in App.jsx */}
      <Sidebar
        preferences={{
          hasPreferences: Boolean(profileTopics.length || orbit.center?.regions?.length),
          topics: profileTopics,
          regions: preferences?.data?.preferred_regions || orbit.center?.regions || [],
          entities: [],
        }}
        activeItem="orbit"
        onHome={() => navigate('/dashboard')}
        onOrbit={() => load()}
        onStories={() => navigate('/stories')}
        onMap={() => navigate('/map')}
        onSimulator={() => navigate('/simulator')}
        onLocked={setLockedToast}
        onWatchlist={() => navigate('/watchlist')}
        onAlerts={() => navigate('/alerts')}
        onSetFocus={() => navigate('/onboarding')}
        onSettings={() => navigate('/settings')}
        onPipeline={() => navigate('/pipeline')}
      />
      <main className="world-pulse-main orbit-main">
        <header className="orbit-header ni-screen-header">
          <div>
            <h1>Signal Orbit</h1>
            <p>Closer = higher urgency. Larger = stronger pulse. Hover a node to isolate its links.</p>
          </div>
          <div className="ni-header-tools">
            <button className="wp-icon-btn" onClick={() => setLockedToast('Orbit relationships come from backend graph edges.')}><Circle size={14} /> Data Source</button>
            <button className="wp-icon-btn" onClick={load} disabled={loading}><RefreshCw size={18} /> Refresh</button>
          </div>
        </header>

        <section className="orbit-controls wp-card">
          <label><Tags size={15} /> Topic<select value={topic} onChange={(event) => setTopic(event.target.value)}>{topics.map((item) => <option key={item} value={item}>{compactLabel(item)}</option>)}</select></label>
          <label><GitBranch size={15} /> Relationship<select value={relationship} onChange={(event) => setRelationship(event.target.value)}>{relationships.map((item) => <option key={item} value={item}>{compactLabel(item)}</option>)}</select></label>
          <label><ArrowDownWideNarrow size={15} /> Sort<select value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="relevance">Relevance</option><option value="pulse">Pulse</option><option value="newest">Newest</option></select></label>
          <button className={showLabels ? 'toggle active' : 'toggle'} onClick={() => setShowLabels((value) => !value)}>Labels</button>
        </section>

        {loading ? <div className="wp-loading"><span /></div> : (
          <>
            {error && <div className="wp-error"><b>Orbit unavailable</b><span>{error}</span><button onClick={load}>Retry</button></div>}
            {!visibleNodes.length ? (
              <section className="wp-card orbit-empty">
                <h2>Orbit is building from recent events.</h2>
                <p>{profileTopics.length ? 'Validated relationships will appear after the next ingestion pass.' : 'Track topics to personalize your orbit.'}</p>
                {!profileTopics.length && <button onClick={() => navigate('/onboarding')}>Track Topics</button>}
              </section>
            ) : (
              <section className="orbit-layout">
                <OrbitGraph nodes={visibleNodes} edges={visibleEdges} showLabels={showLabels} selectedId={activeNode?.id} onSelect={setSelected} />
                <div className="orbit-list wp-card orbit-focus-panel">
                  <div className="wp-section-head"><span>{activeNode?.label || 'Visible Signals'}</span></div>
                  {activeNode && (
                    <>
                      <div className="drawer-grid">
                        <div><small>Pulse</small><b>{activeNode.pulse ?? '-'}</b></div>
                        <div><small>Exposure</small><b>{activeNode.exposure ?? '-'}</b></div>
                        <div><small>Distance</small><b>{Math.round((activeNode.distance ?? 0) * 100)}</b></div>
                        <div><small>Status</small><b>{activeNode.status ? compactLabel(activeNode.status) : '-'}</b></div>
                      </div>
                      {activeNode.why_it_matters && <p className="orbit-focus-copy">{activeNode.why_it_matters}</p>}
                      <button className="orbit-story-button" onClick={() => openStory(activeNode)}>Explore Signal</button>
                    </>
                  )}
                  <div className="orbit-mini-list">
                    {visibleNodes.slice(0, 6).map((node) => (
                      <button key={node.id} onClick={() => setSelected(node)}>
                        <b>{node.label}</b>
                        <span>{compactLabel(node.category)} / pulse {node.pulse}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </main>
      <OrbitDrawer node={selected} edges={visibleEdges} nodesById={nodesById} onClose={() => setSelected(null)} onStory={openStory} />
      <LockedNavToast message={lockedToast} />
    </div>
  );
}
