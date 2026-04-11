import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { feature } from 'topojson-client';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { Swords, Activity, CloudLightning } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const TOPO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

const COUNTRY_META = {
  '004': { name: 'Afghanistan', capital: 'Kabul', flag: '🇦🇫' },
  '032': { name: 'Argentina', capital: 'Buenos Aires', flag: '🇦🇷' },
  '036': { name: 'Australia', capital: 'Canberra', flag: '🇦🇺' },
  '076': { name: 'Brazil', capital: 'Brasília', flag: '🇧🇷' },
  '124': { name: 'Canada', capital: 'Ottawa', flag: '🇨🇦' },
  '156': { name: 'China', capital: 'Beijing', flag: '🇨🇳' },
  '250': { name: 'France', capital: 'Paris', flag: '🇫🇷' },
  '276': { name: 'Germany', capital: 'Berlin', flag: '🇩🇪' },
  '356': { name: 'India', capital: 'New Delhi', flag: '🇮🇳' },
  '364': { name: 'Iran', capital: 'Tehran', flag: '🇮🇷' },
  '376': { name: 'Israel', capital: 'Jerusalem', flag: '🇮🇱' },
  '380': { name: 'Italy', capital: 'Rome', flag: '🇮🇹' },
  '392': { name: 'Japan', capital: 'Tokyo', flag: '🇯🇵' },
  '484': { name: 'Mexico', capital: 'Mexico City', flag: '🇲🇽' },
  '643': { name: 'Russia', capital: 'Moscow', flag: '🇷🇺' },
  '682': { name: 'Saudi Arabia', capital: 'Riyadh', flag: '🇸🇦' },
  '710': { name: 'South Africa', capital: 'Pretoria', flag: '🇿🇦' },
  '804': { name: 'Ukraine', capital: 'Kyiv', flag: '🇺🇦' },
  '826': { name: 'United Kingdom', capital: 'London', flag: '🇬🇧' },
  '840': { name: 'United States', capital: 'Washington D.C.', flag: '🇺🇸' },
  '818': { name: 'Egypt', capital: 'Cairo', flag: '🇪🇬' },
  '566': { name: 'Nigeria', capital: 'Abuja', flag: '🇳🇬' },
  '410': { name: 'South Korea', capital: 'Seoul', flag: '🇰🇷' },
  '792': { name: 'Turkey', capital: 'Ankara', flag: '🇹🇷' },
  '764': { name: 'Thailand', capital: 'Bangkok', flag: '🇹🇭' },
  '586': { name: 'Pakistan', capital: 'Islamabad', flag: '🇵🇰' },
  '729': { name: 'Sudan', capital: 'Khartoum', flag: '🇸🇩' },
};

const NAME_FALLBACK = {
  'N. Cyprus':   { name: 'Northern Cyprus', capital: 'North Nicosia', flag: '🇨🇾' },
  'Kosovo':      { name: 'Kosovo', capital: 'Pristina', flag: '🇽🇰' },
  'Somaliland':  { name: 'Somaliland', capital: 'Hargeisa', flag: '🏴' },
  'United States of America': { name: 'United States', capital: 'Washington D.C.', flag: '🇺🇸' }
};

function resolveCountryInfo(f) {
  if (f.id != null) {
    const padded = String(f.id).padStart(3, '0');
    if (COUNTRY_META[padded]) return { key: padded, ...COUNTRY_META[padded] };
  }
  if (f.properties?.name) {
    const n = f.properties.name;
    if (NAME_FALLBACK[n]) return { key: n, ...NAME_FALLBACK[n] };
    return { key: n, name: n, capital: '', flag: '🏳️' };
  }
  return null;
}

const LAYERS = {
  conflict: {
    label: 'Geopolitics & Conflict',
    icon: Swords,
    color: '#ef4444',
    zones: [
      { name: 'United States', coords: [-95, 38], severity: 'high', label: 'USA' },
      { name: 'Iran', coords: [53, 32], severity: 'critical', label: 'IRAN' },
      { name: 'Ukraine', coords: [32, 49], severity: 'critical', label: 'UKR' },
      { name: 'Sudan', coords: [30, 15], severity: 'high', label: 'SDN' },
      { name: 'Israel', coords: [35, 31], severity: 'medium', label: 'ISR' },
      { name: 'China', coords: [105, 35], severity: 'medium', label: 'CHN' },
      { name: 'Russia', coords: [60, 60], severity: 'high', label: 'RUS' },
    ],
    connections: [
      { from: [-95, 38], to: [53, 32], color: '#ef4444', label: 'CEASEFIRE' },
      { from: [32, 49], to: [60, 60], color: '#f59e0b', label: 'CONFLICT' },
      { from: [35, 31], to: [53, 32], color: '#f97316', label: 'TENSIONS' },
    ]
  },
  disease: {
    label: 'Disease Outbreaks',
    icon: Activity,
    color: '#a855f7',
    zones: [
      { name: 'Brazil', coords: [-55, -10], severity: 'high', label: 'DENGUE' },
      { name: 'India', coords: [78, 22], severity: 'medium', label: 'NIPAH WATCH' },
      { name: 'Nigeria', coords: [8, 10], severity: 'critical', label: 'LASSA' },
      { name: 'United States', coords: [-95, 38], severity: 'medium', label: 'FLU SPIKE' },
    ],
    connections: [
      { from: [-55, -10], to: [-95, 38], color: '#a855f7', label: 'TRANSMISSION VECTOR' },
    ]
  },
  weather: {
    label: 'Extreme Weather',
    icon: CloudLightning,
    color: '#38bdf8',
    zones: [
      { name: 'Philippines', coords: [121, 12], severity: 'critical', label: 'TYPHOON' },
      { name: 'Australia', coords: [133, -25], severity: 'high', label: 'WILDFIRES' },
      { name: 'Canada', coords: [-106, 56], severity: 'medium', label: 'FREEZE' },
      { name: 'India', coords: [78, 22], severity: 'critical', label: 'HEATWAVE' },
    ],
    connections: [
      { from: [121, 12], to: [133, -25], color: '#38bdf8', label: 'STORM CELL' },
    ]
  }
};

const SEVERITY_COLORS = {
  conflict: {
    critical: { fill: 'rgba(239,68,68,0.35)', stroke: '#ef4444', glow: 'rgba(239,68,68,0.6)' },
    high:     { fill: 'rgba(249,115,22,0.25)', stroke: '#f97316', glow: 'rgba(249,115,22,0.5)' },
    medium:   { fill: 'rgba(250,204,21,0.2)',  stroke: '#facc15', glow: 'rgba(250,204,21,0.4)' },
  },
  disease: {
    critical: { fill: 'rgba(168,85,247,0.35)', stroke: '#a855f7', glow: 'rgba(168,85,247,0.6)' },
    high:     { fill: 'rgba(217,70,239,0.25)', stroke: '#d946ef', glow: 'rgba(217,70,239,0.5)' },
    medium:   { fill: 'rgba(232,121,249,0.2)',  stroke: '#e879f9', glow: 'rgba(232,121,249,0.4)' },
  },
  weather: {
    critical: { fill: 'rgba(56,189,248,0.35)', stroke: '#38bdf8', glow: 'rgba(56,189,248,0.6)' },
    high:     { fill: 'rgba(14,165,233,0.25)', stroke: '#0ea5e9', glow: 'rgba(14,165,233,0.5)' },
    medium:   { fill: 'rgba(2,132,199,0.2)',  stroke: '#0284c7', glow: 'rgba(2,132,199,0.4)' },
  }
};

export default function WorldMap() {
  const [countries, setCountries] = useState([]);
  const [hoveredInfo, setHoveredInfo] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(true);
  const [pulsePhase, setPulsePhase] = useState(0);
  const [dataFlowOffset, setDataFlowOffset] = useState(0);
  const [activeLayer, setActiveLayer] = useState('conflict');
  const navigate = useNavigate();
  const { t } = useLanguage();
  const containerRef = useRef(null);

  const width = 900;
  const height = 460;

  const projection = geoNaturalEarth1()
    .scale(155)
    .translate([width / 2, height / 2 + 10]);

  const pathGenerator = geoPath().projection(projection);

  useEffect(() => {
    let cancelled = false;
    fetch(TOPO_URL)
      .then(r => r.json())
      .then(topo => {
        if (cancelled) return;
        const feats = feature(topo, topo.objects.countries).features;
        const enhancedFeats = feats.map(f => ({
          ...f,
          info: resolveCountryInfo(f)
        }));
        setCountries(enhancedFeats);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Animate pulse rings and data flow
  useEffect(() => {
    const interval = setInterval(() => {
      setPulsePhase(p => (p + 1) % 60);
      setDataFlowOffset(d => (d + 2) % 100);
    }, 80);
    return () => clearInterval(interval);
  }, []);

  const handleCountryClick = useCallback((info) => {
    if (info && info.name !== 'Antarctica') {
      navigate(`/search/${encodeURIComponent(info.name + ' news')}`);
    }
  }, [navigate]);

  if (loading) {
    return (
      <div className="world-map-section" style={{ minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="map-loader-ring" />
      </div>
    );
  }

  const currentLayer = LAYERS[activeLayer];
  const hotZoneNames = currentLayer.zones.map(z => z.name);
  const pulseR1 = 6 + Math.sin(pulsePhase * 0.2) * 3;
  const pulseR2 = 12 + Math.sin(pulsePhase * 0.15) * 5;
  const pulseR3 = 20 + Math.sin(pulsePhase * 0.1) * 8;
  const layerColors = SEVERITY_COLORS[activeLayer];

  return (
    <div ref={containerRef} className="world-map-section" style={{ width: '100%', position: 'relative' }}>
      
      {/* Layer Toggle Controls */}
      <div style={{ position: 'absolute', top: 10, left: 15, zIndex: 50, display: 'flex', gap: '8px' }}>
        {Object.entries(LAYERS).map(([key, data]) => {
          const Icon = data.icon;
          const isActive = activeLayer === key;
          return (
            <button
              key={key}
              onClick={() => setActiveLayer(key)}
              style={{
                background: isActive ? `${data.color}20` : 'rgba(10,5,20,0.6)',
                border: `1px solid ${isActive ? data.color : 'rgba(255,255,255,0.1)'}`,
                color: isActive ? data.color : '#94a3b8',
                padding: '8px 12px', borderRadius: '8px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px',
                fontWeight: 600, backdropFilter: 'blur(10px)', transition: 'all 0.3s'
              }}
            >
              <Icon size={14} /> {data.label}
            </button>
          );
        })}
      </div>

      {/* Tooltip */}
      {hoveredInfo && (
        <div 
          className="map-tooltip" 
          style={{ left: tooltipPos.x + 15, top: tooltipPos.y + 15, position: 'absolute', zIndex: 100, background: 'rgba(10,5,20,0.95)', backdropFilter: 'blur(12px)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: '12px', padding: '12px 16px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', pointerEvents: 'none' }}
        >
          <span style={{ fontSize: '20px' }}>{hoveredInfo.flag}</span>
          <div style={{ marginLeft: '8px', display: 'inline-block' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#fff', display: 'block' }}>{hoveredInfo.name}</span>
            <span style={{ fontSize: '10px', color: '#94a3b8' }}>{hoveredInfo.capital}</span>
          </div>
        </div>
      )}

      {/* SVG Map */}
      <div style={{ width: '100%', padding: '10px 0' }}>
        <svg 
          viewBox={`0 0 ${width} ${height}`} 
          className="world-map-svg"
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', height: 'auto', overflow: 'visible' }}
        >
        <defs>
          <filter id="glow-hot" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glow-medium" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="3d-pop" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="3" dy="5" stdDeviation="3" floodColor="rgba(0,0,0,0.6)" />
          </filter>

          {/* Dynamic Layer Gradients */}
          {Object.entries(SEVERITY_COLORS).map(([layerName, severities]) => (
            <g key={`grads-${layerName}`}>
              <radialGradient id={`heatGrad-${layerName}-critical`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={severities.critical.glow} />
                <stop offset="100%" stopColor="rgba(0,0,0,0)" />
              </radialGradient>
              <radialGradient id={`heatGrad-${layerName}-high`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={severities.high.glow} />
                <stop offset="100%" stopColor="rgba(0,0,0,0)" />
              </radialGradient>
              <radialGradient id={`heatGrad-${layerName}-medium`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={severities.medium.glow} />
                <stop offset="100%" stopColor="rgba(0,0,0,0)" />
              </radialGradient>
            </g>
          ))}

          <linearGradient id="gridGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(139,92,246,0.03)" />
            <stop offset="100%" stopColor="rgba(139,92,246,0.01)" />
          </linearGradient>
          <pattern id="dotGrid" width="30" height="30" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.5" fill="rgba(139,92,246,0.15)" />
            <line x1="2" y1="2" x2="30" y2="2" stroke="rgba(139,92,246,0.05)" strokeWidth="0.5" />
            <line x1="2" y1="2" x2="2" y2="30" stroke="rgba(139,92,246,0.05)" strokeWidth="0.5" />
          </pattern>
        </defs>

        {/* 3D background grid effect */}
        <rect x="0" y="0" width={width} height={height} fill="url(#dotGrid)" />
        <rect x="0" y="0" width={width} height={height} fill="url(#gridGrad)" />

        {/* Countries */}
        <g className="countries-group">
          {countries.map((feat, i) => {
            const isHot = feat.info && hotZoneNames.includes(feat.info.name);
            const isHovered = hoveredInfo?.key === feat.info?.key;
            const zone = isHot ? currentLayer.zones.find(z => z.name === feat.info.name) : null;
            const sev = zone ? layerColors[zone.severity] : null;

            return (
              <path
                key={`path-${i}`}
                d={pathGenerator(feat)}
                fill={isHot ? sev.fill : (isHovered ? `${currentLayer.color}40` : 'rgba(20,15,40,0.8)')}
                stroke={isHot ? sev.stroke : (isHovered ? currentLayer.color : 'rgba(139,92,246,0.1)')}
                strokeWidth={isHot ? 1.2 : (isHovered ? 1.5 : 0.6)}
                filter={isHot ? 'url(#glow-hot)' : (isHovered ? 'url(#glow-medium)' : 'url(#3d-pop)')}
                onMouseEnter={(e) => {
                  if (feat.info) setHoveredInfo(feat.info);
                  if (containerRef.current) {
                    const rect = containerRef.current.getBoundingClientRect();
                    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                  }
                }}
                onMouseMove={(e) => {
                  if (containerRef.current) {
                    const rect = containerRef.current.getBoundingClientRect();
                    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                  }
                }}
                onMouseLeave={() => setHoveredInfo(null)}
                onClick={() => handleCountryClick(feat.info)}
                style={{ cursor: 'pointer', transition: 'fill 0.5s ease, stroke 0.5s ease' }}
              />
            );
          })}
        </g>

        {/* Connection arcs with animated data flow */}
        {currentLayer.connections.map((conn, i) => {
          const from = projection(conn.from);
          const to = projection(conn.to);
          if (!from || !to) return null;
          const midX = (from[0] + to[0]) / 2;
          const midY = Math.min(from[1], to[1]) - 60;
          return (
            <g key={`conn-${activeLayer}-${i}`}>
              <path 
                d={`M ${from[0]},${from[1]} Q ${midX},${midY} ${to[0]},${to[1]}`} 
                fill="none" 
                stroke={conn.color} 
                strokeWidth="1.5"
                strokeDasharray="6,4"
                strokeDashoffset={dataFlowOffset}
                opacity="0.8"
                style={{ transition: 'stroke 0.5s ease' }}
              />
              <text x={midX} y={midY - 6} fill={conn.color} fontSize="7" fontWeight="700" textAnchor="middle" letterSpacing="1.5px" opacity="0.9">
                {conn.label}
              </text>
            </g>
          );
        })}

        {/* Hot zone markers with animated pulse rings */}
        {currentLayer.zones.map((zone, i) => {
          const pt = projection(zone.coords);
          if (!pt) return null;
          const sev = layerColors[zone.severity];
          return (
            <g key={`zone-${activeLayer}-${i}`} style={{ animation: 'fadeIn 0.5s ease-out' }}>
              {/* Heat gradient circle */}
              <circle cx={pt[0]} cy={pt[1]} r="30" fill={`url(#heatGrad-${activeLayer}-${zone.severity})`} opacity="0.8" />
              
              {/* Animated pulse rings */}
              <circle cx={pt[0]} cy={pt[1]} r={pulseR3} fill="none" stroke={sev.glow} strokeWidth="0.5" opacity={0.2 + Math.sin(pulsePhase * 0.1) * 0.15} />
              <circle cx={pt[0]} cy={pt[1]} r={pulseR2} fill="none" stroke={sev.glow} strokeWidth="0.8" opacity={0.3 + Math.sin(pulsePhase * 0.15) * 0.2} />
              <circle cx={pt[0]} cy={pt[1]} r={pulseR1} fill="none" stroke={sev.stroke} strokeWidth="1" opacity="0.6" />

              {/* Center dot */}
              <circle cx={pt[0]} cy={pt[1]} r="3" fill={sev.stroke} filter="url(#glow-hot)" />

              {/* Label */}
              <g transform={`translate(${pt[0]}, ${pt[1] - 18})`}>
                <rect x={-zone.label.length * 3.5 - 4} y="-10" width={zone.label.length * 7 + 8} height="14" rx="3" fill="rgba(0,0,0,0.75)" stroke={sev.stroke} strokeWidth="0.5" />
                <text x="0" y="0" fill={sev.stroke} fontSize="7" fontWeight="bold" textAnchor="middle" letterSpacing="1px">{zone.label}</text>
              </g>
            </g>
          );
        })}

        {/* Live data indicator */}
        <g transform={`translate(${width - 100}, 15)`}>
          <circle r="4" fill={currentLayer.color} opacity={0.4 + Math.sin(pulsePhase * 0.3) * 0.6} style={{ transition: 'fill 0.5s ease' }} />
          <circle r="2" fill={currentLayer.color} style={{ transition: 'fill 0.5s ease' }} />
          <text x="10" y="4" fill={currentLayer.color} fontSize="8" fontWeight="700" letterSpacing="1px" style={{ transition: 'fill 0.5s ease' }}>{activeLayer.toUpperCase()} SYS</text>
        </g>
        
        {/* Timestamp */}
        <text x="15" y={height - 10} fill="rgba(255,255,255,0.3)" fontSize="7" fontFamily="monospace">
          UTC {new Date().toLocaleTimeString()}
        </text>
        </svg>
      </div>
    </div>
  );
}
