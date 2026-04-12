import { useState, useEffect, useRef, useCallback } from 'react';
import { feature } from 'topojson-client';
import { geoNaturalEarth1, geoPath, geoMercator } from 'd3-geo';
import { Swords, Activity, CloudLightning, ArrowLeft } from 'lucide-react';
import { fetchTrending } from '../api';

const TOPO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

const HIGHCHARTS_CDN = "https://code.highcharts.com/mapdata";
const COUNTRY_TOPO_URLS = {
  'United States': `${HIGHCHARTS_CDN}/countries/us/us-all.topo.json`,
  'India': `${HIGHCHARTS_CDN}/countries/in/in-all.topo.json`,
  'Japan': `${HIGHCHARTS_CDN}/countries/jp/jp-all.topo.json`,
  'France': `${HIGHCHARTS_CDN}/countries/fr/fr-all.topo.json`,
  'United Kingdom': `${HIGHCHARTS_CDN}/countries/gb/gb-all.topo.json`,
  'Russia': `${HIGHCHARTS_CDN}/countries/ru/ru-all.topo.json`,
  'Australia': `${HIGHCHARTS_CDN}/countries/au/au-all.topo.json`,
  'Canada': `${HIGHCHARTS_CDN}/countries/ca/ca-all.topo.json`,
  'China': `${HIGHCHARTS_CDN}/countries/cn/cn-all.topo.json`,
  'Brazil': `${HIGHCHARTS_CDN}/countries/br/br-all.topo.json`
};

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
  'United States of America': { name: 'United States', capital: 'Washington D.C.', flag: '🇺🇸' },
  'United Kingdom': { name: 'United Kingdom', capital: 'London', flag: '🇬🇧' }
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
      { from: [-55, -10], to: [-95, 38], color: '#a855f7', label: 'VECTOR' },
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
    critical: { fill: 'rgba(239,68,68,0.3)', stroke: '#ef4444', glow: 'rgba(239,68,68,0.5)' },
    high:     { fill: 'rgba(249,115,22,0.25)', stroke: '#f97316', glow: 'rgba(249,115,22,0.5)' },
    medium:   { fill: 'rgba(250,204,21,0.2)',  stroke: '#facc15', glow: 'rgba(250,204,21,0.4)' },
  },
  disease: {
    critical: { fill: 'rgba(168,85,247,0.3)', stroke: '#a855f7', glow: 'rgba(168,85,247,0.5)' },
    high:     { fill: 'rgba(217,70,239,0.25)', stroke: '#d946ef', glow: 'rgba(217,70,239,0.5)' },
    medium:   { fill: 'rgba(232,121,249,0.2)',  stroke: '#e879f9', glow: 'rgba(232,121,249,0.4)' },
  },
  weather: {
    critical: { fill: 'rgba(56,189,248,0.3)', stroke: '#38bdf8', glow: 'rgba(56,189,248,0.5)' },
    high:     { fill: 'rgba(14,165,233,0.25)', stroke: '#0ea5e9', glow: 'rgba(14,165,233,0.5)' },
    medium:   { fill: 'rgba(2,132,199,0.2)',  stroke: '#0284c7', glow: 'rgba(2,132,199,0.4)' },
  }
};

export default function WorldMap() {
  const [countries, setCountries] = useState([]);
  const [hoveredInfo, setHoveredInfo] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(true);
  
  // Drill-down states
  const [zoomedCountryInfo, setZoomedCountryInfo] = useState(null);
  const [zoomStateFeatures, setZoomStateFeatures] = useState([]);
  const [zoomParentFeature, setZoomParentFeature] = useState(null);
  const [stateNews, setStateNews] = useState([]);
  const [loadingStateLevel, setLoadingStateLevel] = useState(false);
  
  // Animation states
  const [pulsePhase, setPulsePhase] = useState(0);
  const [currentTimeMs, setCurrentTimeMs] = useState(Date.now());
  const [dataFlowOffset, setDataFlowOffset] = useState(0);
  const [liveBlips, setLiveBlips] = useState([]);
  
  const [activeLayer, setActiveLayer] = useState('conflict');
  const containerRef = useRef(null);

  const width = 900;
  const height = 460;

  // Initial Load: World TopoJSON
  useEffect(() => {
    let cancelled = false;
    fetch(TOPO_URL)
      .then(r => r.json())
      .then(topo => {
        if (cancelled) return;
        const feats = feature(topo, topo.objects.countries).features;
        const enhancedFeats = feats.map(f => ({ ...f, info: resolveCountryInfo(f) }));
        setCountries(enhancedFeats);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Frame tick for smooth pulsing & alive dots
  useEffect(() => {
    const interval = setInterval(() => {
      setPulsePhase(p => (p + 1) % 60);
      setDataFlowOffset(d => (d + 2) % 100);
      setCurrentTimeMs(Date.now());
    }, 80);
    return () => clearInterval(interval);
  }, []);

  // Spawn random 'Alive' blips randomly on map purely for engaging UI
  useEffect(() => {
    if (zoomedCountryInfo || countries.length === 0) return;
    const interval = setInterval(() => {
      const lon = -160 + Math.random() * 320;
      const lat = -60 + Math.random() * 120;
      const id = Date.now();
      setLiveBlips(prev => [...prev.slice(-4), { id, coords: [lon, lat] }]);
    }, 2500);
    return () => clearInterval(interval);
  }, [countries, zoomedCountryInfo]);

  const loadLocalNews = () => {
    fetchTrending().then(d => {
      const allNews = d.headlines || [];
      // Quick fake shuffle so new country looks different
      setStateNews([...allNews].sort(() => 0.5 - Math.random()));
    });
  };

  const handleCountryClick = useCallback(async (featureItem) => {
    const info = featureItem.info;
    if (!info || info.name === 'Antarctica') return;

    setZoomedCountryInfo(info);
    setZoomParentFeature(featureItem);
    setZoomStateFeatures([]);
    setStateNews([]);
    setHoveredInfo(null);
    loadLocalNews();

    const topoUrl = COUNTRY_TOPO_URLS[info.name];
    if (topoUrl) {
      setLoadingStateLevel(true);
      try {
        const r = await fetch(topoUrl);
        const topo = await r.json();
        const collectionKey = topo.objects.default ? 'default' : Object.keys(topo.objects)[0];
        const feats = feature(topo, topo.objects[collectionKey]).features;
        feats.forEach(f => {
          f.parentCountry = info;
          f.info = { name: f.properties.name, isState: true };
        });
        setZoomStateFeatures(feats);
      } catch (err) {
        console.warn("Failed to load map data", err);
      } finally {
        setLoadingStateLevel(false);
      }
    }
  }, []);

  const handleStateClick = useCallback((feat) => {
     setHoveredInfo(feat.info);
     loadLocalNews();
  }, []);

  if (loading) {
    return (
      <div className="world-map-section" style={{ minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#05070f' }}>
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

  // Map Projection Engine
  let projection;
  if (zoomedCountryInfo) {
    // Zoom in. We use Mercator for better local proportions for states
    projection = geoMercator();
    if (zoomStateFeatures.length > 0) {
      projection.fitSize([width * 0.65, height * 0.9], { type: "FeatureCollection", features: zoomStateFeatures });
    } else if (zoomParentFeature) {
      projection.fitSize([width * 0.65, height * 0.9], zoomParentFeature);
    }
  } else {
    projection = geoNaturalEarth1().scale(155).translate([width / 2, height / 2 + 10]);
  }
  
  const pathGenerator = geoPath().projection(projection);
  const featuresToRender = zoomedCountryInfo && zoomStateFeatures.length > 0 ? zoomStateFeatures : countries;

  return (
    <div ref={containerRef} className="world-map-section" style={{ width: '100%', position: 'relative', overflow: 'hidden', background: '#0a0b14', borderRadius: '16px', border: '1px solid rgba(139,92,246,0.15)' }}>
      
      {/* ── Layer Toggles (Hide when zoomed) ── */}
      {!zoomedCountryInfo && (
        <div style={{ position: 'absolute', top: 15, left: 15, zIndex: 50, display: 'flex', gap: '8px' }}>
          {Object.entries(LAYERS).map(([key, data]) => {
            const Icon = data.icon;
            const isActive = activeLayer === key;
            return (
              <button
                key={key}
                onClick={() => setActiveLayer(key)}
                style={{
                  background: isActive ? `${data.color}25` : 'rgba(10,5,20,0.8)',
                  border: `1px solid ${isActive ? data.color : 'rgba(255,255,255,0.06)'}`,
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
      )}

      {/* ── Back Button ── */}
      {zoomedCountryInfo && (
        <button 
          onClick={() => { setZoomedCountryInfo(null); setZoomParentFeature(null); setZoomStateFeatures([]); }} 
          style={{ position: 'absolute', top: 15, left: 15, zIndex: 100, background: 'rgba(139,92,246,0.2)', border: '1px solid #8b5cf6', color: '#fff', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 'bold', backdropFilter: 'blur(10px)', transition: 'all 0.2s', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
        >
          <ArrowLeft size={14} /> Global Feed
        </button>
      )}

      {/* Tooltip Overlay */}
      {hoveredInfo && (
        <div 
          className="map-tooltip" 
          style={{ left: tooltipPos.x + 15, top: tooltipPos.y + 15, position: 'absolute', zIndex: 200, background: 'rgba(10,5,20,0.95)', backdropFilter: 'blur(12px)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: '12px', padding: '12px 16px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', pointerEvents: 'none' }}
        >
          {hoveredInfo.flag && <span style={{ fontSize: '20px' }}>{hoveredInfo.flag}</span>}
          <div style={{ marginLeft: hoveredInfo.flag ? '8px' : 0, display: 'inline-block' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#fff', display: 'block' }}>{hoveredInfo.name}</span>
            {hoveredInfo.capital && <span style={{ fontSize: '10px', color: '#94a3b8' }}>{hoveredInfo.capital}</span>}
            {hoveredInfo.isState && <span style={{ fontSize: '10px', color: '#10b981', fontWeight: '600' }}>Local Region</span>}
          </div>
        </div>
      )}

      {/* ── Drilldown Regional Panel ── */}
      {zoomedCountryInfo && (
        <div style={{ position: 'absolute', top: 0, right: 0, width: '32%', height: '100%', background: 'rgba(5,7,12,0.95)', backdropFilter: 'blur(20px)', borderLeft: '1px solid rgba(139,92,246,0.2)', zIndex: 50, display: 'flex', flexDirection: 'column', animation: 'slideIn 0.3s ease-out' }}>
          <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>{zoomedCountryInfo.flag}</div>
            <h2 style={{ fontSize: '20px', margin: 0, color: '#fff', fontWeight: '800' }}>{zoomedCountryInfo.name} Command</h2>
            <p style={{ fontSize: '11px', color: '#10b981', margin: '6px 0 0', fontWeight: '600', letterSpacing: '1px' }}>● LIVE INTELLIGENCE ENABLED</p>
          </div>
          <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
             {loadingStateLevel && <div style={{ color: '#8b5cf6', fontSize: '11px', textAlign: 'center', background: 'rgba(139,92,246,0.1)', padding: '10px', borderRadius: '8px' }}>Initializing strict local boundaries...</div>}
             <div style={{ fontSize: '10px', color: '#8b5cf6', fontWeight: '700', letterSpacing: '1px', marginBottom: '8px' }}>REGION FEEDS</div>
             {stateNews.map((news, idx) => (
                <div key={idx} style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', transition: 'all 0.2s', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,92,246,0.1)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}>
                   <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#e2e8f0', marginBottom: '8px', lineHeight: '1.4' }}>{news.title}</div>
                   <div style={{ fontSize: '10px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#38bdf8', fontWeight: '600' }}>{news.source}</span>
                      <span>{news.time_ago}</span>
                   </div>
                </div>
             ))}
             {stateNews.length === 0 && <div style={{color: '#64748b', fontSize: '12px', textAlign: 'center', padding: '20px 0'}}>Scanning for local events...</div>}
          </div>
        </div>
      )}

      {/* ── Main SVG Map ── */}
      <div style={{ width: '100%', padding: zoomedCountryInfo ? '30px 32% 30px 20px' : '15px 0' }}>
        <svg 
          viewBox={`0 0 ${width} ${height}`} 
          className="world-map-svg"
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', height: 'auto', overflow: 'visible' }}
        >
        <defs>
          <filter id="glow-hot" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glow-medium" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="3d-pop" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="rgba(0,0,0,0.8)" />
          </filter>

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
            </g>
          ))}

          <linearGradient id="gridGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(56,189,248,0.03)" />
            <stop offset="100%" stopColor="rgba(56,189,248,0.01)" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width={width} height={height} fill="url(#gridGrad)" />

        <g className="countries-group">
          {featuresToRender.map((feat, i) => {
            const info = feat.info;
            const isStateMap = !!(zoomedCountryInfo && zoomStateFeatures.length > 0);
            
            // Check hotness (only applied in global view for now to keep states clean)
            const isHot = !zoomedCountryInfo && info && hotZoneNames.includes(info.name);
            const zone = isHot ? currentLayer.zones.find(z => z.name === info.name) : null;
            const sev = zone ? layerColors[zone.severity] : null;

            const isHovered = hoveredInfo?.key === info?.key || hoveredInfo?.name === info?.name;

            // Neon dark space aesthetic
            const baseFill = isStateMap ? 'rgba(20,25,50,0.8)' : 'rgba(8,12,24,0.95)';
            const baseStroke = isStateMap ? 'rgba(56,189,248,0.3)' : 'rgba(56,189,248,0.15)';
            const hoverFill = 'rgba(139,92,246,0.25)';
            const hoverStroke = '#a78bfa';

            return (
              <path
                key={`path-${i}`}
                d={pathGenerator(feat)}
                fill={isHot ? sev.fill : (isHovered ? hoverFill : baseFill)}
                stroke={isHot ? sev.stroke : (isHovered ? hoverStroke : baseStroke)}
                strokeWidth={isHot ? 1.2 : (isHovered ? 1.5 : 0.5)}
                filter={isHot ? 'url(#glow-hot)' : (isHovered ? 'url(#glow-medium)' : (zoomedCountryInfo ? 'none' : 'url(#3d-pop)'))}
                onMouseEnter={(e) => {
                  if (info) setHoveredInfo(info);
                  if (containerRef.current) {
                    const rect = containerRef.current.getBoundingClientRect();
                    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                  }
                }}
                onMouseMove={(e) => {
                  if (containerRef.current && hoveredInfo) {
                    const rect = containerRef.current.getBoundingClientRect();
                    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                  }
                }}
                onMouseLeave={() => setHoveredInfo(null)}
                onClick={() => {
                   if (!isStateMap) handleCountryClick(feat);
                   else handleStateClick(feat);
                }}
                style={{ cursor: 'pointer', transition: 'fill 0.4s ease, stroke 0.4s ease' }}
              />
            );
          })}
        </g>

        {/* ── Global Animated Nodes (Only on World Map) ── */}
        {!zoomedCountryInfo && currentLayer.connections.map((conn, i) => {
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
              />
              <text x={midX} y={midY - 6} fill={conn.color} fontSize="7" fontWeight="700" textAnchor="middle" letterSpacing="1.5px">
                {conn.label}
              </text>
            </g>
          );
        })}

        {!zoomedCountryInfo && currentLayer.zones.map((zone, i) => {
          const pt = projection(zone.coords);
          if (!pt) return null;
          const sev = layerColors[zone.severity];
          return (
            <g key={`zone-${activeLayer}-${i}`}>
              <circle cx={pt[0]} cy={pt[1]} r="30" fill={`url(#heatGrad-${activeLayer}-${zone.severity})`} opacity="0.8" />
              <circle cx={pt[0]} cy={pt[1]} r={pulseR3} fill="none" stroke={sev.glow} strokeWidth="0.5" opacity={0.2 + Math.sin(pulsePhase * 0.1) * 0.15} />
              <circle cx={pt[0]} cy={pt[1]} r={pulseR2} fill="none" stroke={sev.glow} strokeWidth="0.8" opacity={0.3 + Math.sin(pulsePhase * 0.15) * 0.2} />
              <circle cx={pt[0]} cy={pt[1]} r={pulseR1} fill="none" stroke={sev.stroke} strokeWidth="1" opacity="0.6" />
              <circle cx={pt[0]} cy={pt[1]} r="3" fill={sev.stroke} filter="url(#glow-hot)" />
              <g transform={`translate(${pt[0]}, ${pt[1] - 18})`}>
                <rect x={-zone.label.length * 3.5 - 4} y="-10" width={zone.label.length * 7 + 8} height="14" rx="3" fill="rgba(0,0,0,0.8)" stroke={sev.stroke} strokeWidth="0.5" />
                <text x="0" y="0" fill={sev.stroke} fontSize="7" fontWeight="bold" textAnchor="middle" letterSpacing="1px">{zone.label}</text>
              </g>
            </g>
          );
        })}

        {/* ── Random 'Alive' Blips to make Map look busy ── */}
        {!zoomedCountryInfo && liveBlips.map(blip => {
           const pt = projection(blip.coords);
           if(!pt) return null;
           const ageMs = currentTimeMs - blip.id;
           if (ageMs > 2500) return null; // faded out
           const progress = ageMs / 2500;
           return (
             <g key={blip.id}>
               <circle cx={pt[0]} cy={pt[1]} r="1.5" fill="#38bdf8" filter="url(#glow-hot)" opacity={1 - progress} />
               <circle cx={pt[0]} cy={pt[1]} r={2 + progress * 20} fill="none" stroke="#38bdf8" strokeWidth="1" opacity={0.6 - (progress * 0.6)} />
             </g>
           )
        })}

        {!zoomedCountryInfo && (
          <g transform={`translate(${width - 100}, 15)`}>
            <circle r="4" fill={currentLayer.color} opacity={0.4 + Math.sin(pulsePhase * 0.3) * 0.6} />
            <circle r="2" fill={currentLayer.color} />
            <text x="10" y="4" fill={currentLayer.color} fontSize="8" fontWeight="700" letterSpacing="1px">{activeLayer.toUpperCase()} SYS</text>
          </g>
        )}
        
        <text x="15" y={height - 10} fill="rgba(255,255,255,0.2)" fontSize="7" fontFamily="monospace">
          UTC {new Date().toLocaleTimeString()} | SATCOM RELAY
        </text>
        </svg>
      </div>
    </div>
  );
}
