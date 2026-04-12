import { useState, useEffect, useRef, useCallback } from 'react';
import { feature } from 'topojson-client';
import { geoNaturalEarth1, geoPath, geoMercator, geoIdentity, geoCentroid } from 'd3-geo';
import { select, zoom, zoomIdentity } from 'd3';
import { Activity, CloudLightning, ArrowLeft, Maximize } from 'lucide-react';
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

const SEVERITY_COLORS = {
  critical: { fill: 'rgba(239,68,68,0.3)', stroke: '#ef4444', glow: 'rgba(239,68,68,0.5)' },
  high:     { fill: 'rgba(249,115,22,0.25)', stroke: '#f97316', glow: 'rgba(249,115,22,0.5)' },
  medium:   { fill: 'rgba(250,204,21,0.2)',  stroke: '#facc15', glow: 'rgba(250,204,21,0.4)' },
};

function classifyHeadline(title) {
  const t = title.toLowerCase();
  if (t.includes('war') || t.includes('strike') || t.includes('missile') || t.includes('flee') || t.includes('crash') || t.includes('crisis') || t.includes('tornado') || t.includes('disease')) return 'critical';
  if (t.includes('conflict') || t.includes('tensions') || t.includes('surge') || t.includes('outbreak') || t.includes('flood') || t.includes('down')) return 'high';
  return 'medium';
}

function getEventLabel(title) {
  const words = title.split(' ');
  const eventKeywords = ['war', 'conflict', 'strike', 'missile', 'famine', 'outbreak', 'virus', 'ceasefire', 'rally', 'surge', 'threat', 'disease', 'weather', 'flood', 'tornado', 'crisis', 'crash', 'economic'];
  for (const w of words) {
    const wt = w.toLowerCase().replace(/[^a-z]/g, '');
    if (eventKeywords.includes(wt)) {
      return w.toUpperCase().replace(/[^A-Z]/g, '');
    }
  }
  return 'UPDATE';
}

export default function WorldMap() {
  const [countries, setCountries] = useState([]);
  const [hoveredInfo, setHoveredInfo] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(true);
  
  // Drill-down states
  const [zoomedCountryInfo, setZoomedCountryInfo] = useState(null);
  const [zoomStateFeatures, setZoomStateFeatures] = useState([]);
  const [zoomParentFeature, setZoomParentFeature] = useState(null);
  const [selectedState, setSelectedState] = useState(null);
  const [stateNews, setStateNews] = useState([]);
  const [loadingStateLevel, setLoadingStateLevel] = useState(false);
  
  // Dynamic Live Feed State
  const [dynamicZones, setDynamicZones] = useState([]);
  const [dynamicConns, setDynamicConns] = useState([]);
  
  const [pulsePhase, setPulsePhase] = useState(0);
  const [currentTimeMs, setCurrentTimeMs] = useState(Date.now());
  const [dataFlowOffset, setDataFlowOffset] = useState(0);
  const [liveBlips, setLiveBlips] = useState([]);
  
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const mapGroupRef = useRef(null); // Ref for D3 Zoom scaling limits
  const idleTimeoutRef = useRef(null); // Ref for map auto-center

  const width = 1000;
  const height = 550;

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

  // Live Intelligence Parsing System
  useEffect(() => {
    if (countries.length === 0) return;

    fetchTrending().then(d => {
       const headlines = d.headlines || [];
       const newZones = [];
       const newConns = [];

       headlines.forEach((hl) => {
          const entities = hl.entities || [];
          if (entities.length > 0) {
              const countryEntities = entities.filter(e => countries.some(c => c.info?.name === e.word || c.info?.key === e.word));
              if(countryEntities.length === 0) return;

              const severity = classifyHeadline(hl.title);
              const label = getEventLabel(hl.title);
              
              countryEntities.forEach(c => {
                 const feat = countries.find(ct => ct.info?.name === c.word || ct.info?.key === c.word);
                 if (feat) {
                    const coords = geoCentroid(feat);
                    if (!newZones.find(z => z.name === c.word)) {
                       newZones.push({ name: c.word, coords, severity, label, headline: hl.title });
                    }
                 }
              });

              if (countryEntities.length >= 2) {
                 const f1 = countries.find(ct => ct.info?.name === countryEntities[0].word || ct.info?.key === countryEntities[0].word);
                 const f2 = countries.find(ct => ct.info?.name === countryEntities[1].word || ct.info?.key === countryEntities[1].word);
                 if (f1 && f2) {
                    newConns.push({ from: geoCentroid(f1), to: geoCentroid(f2), color: SEVERITY_COLORS[severity].stroke, label });
                 }
              }
          }
       });

       setDynamicZones(newZones);
       setDynamicConns(newConns);
    });
  }, [countries]);

  // Reliable Zooming via D3 Transforming a <g> object so path clicks aren't destroyed!
  useEffect(() => {
    if (!svgRef.current || !mapGroupRef.current) return;
    const svg = select(svgRef.current);
    const g = select(mapGroupRef.current);
    
    // Create zoom behavior
    const dZoom = zoom()
      .scaleExtent([0.8, 6])
      .on('zoom', (e) => {
        g.attr('transform', e.transform);
        
        // Auto-center functionality
        if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
        idleTimeoutRef.current = setTimeout(() => {
           setZoomedCountryInfo((currState) => {
               // Only reset if we are on the global map (not zoomed into a specific country)
               if (!currState) {
                  svg.transition().duration(1500).call(dZoom.transform, zoomIdentity);
               }
               return currState;
           });
        }, 3000); // Reset map after 3 seconds of inactivity
      });
      
    // Remove old zoom behavior if any, to prevent memory leaks
    svg.on('.zoom', null);

    // Apply only if we are not locked into state drilldown 
    // (Drilldown performs its own perfect viewport fit)
    if (!zoomedCountryInfo) {
      svg.call(dZoom);
    } else {
      g.attr('transform', ''); // Reset transform if zooming natively via drilldown
    }
  }, [zoomedCountryInfo, countries.length]);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulsePhase(p => (p + 1) % 60);
      setDataFlowOffset(d => (d + 2) % 100);
      setCurrentTimeMs(Date.now());
    }, 80);
    return () => clearInterval(interval);
  }, []);

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
      setStateNews([...allNews].sort(() => 0.5 - Math.random()));
    });
  };

  const handleCountryClick = useCallback(async (featureItem) => {
    const info = featureItem.info;
    if (!info || info.name === 'Antarctica') return;

    setZoomedCountryInfo(info);
    setZoomParentFeature(featureItem);
    setZoomStateFeatures([]);
    setSelectedState(null);
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
     setSelectedState(feat);
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

  const pulseR1 = 6 + Math.sin(pulsePhase * 0.2) * 3;
  const pulseR2 = 12 + Math.sin(pulsePhase * 0.15) * 5;
  const pulseR3 = 20 + Math.sin(pulsePhase * 0.1) * 8;

  // Next-Gen Map Projection Engine
  let projection;
  if (zoomedCountryInfo) {
    if (zoomStateFeatures.length > 0) {
      projection = geoIdentity().reflectY(true).fitSize([width * 0.65, height * 0.9], { type: "FeatureCollection", features: zoomStateFeatures });
    } else {
      projection = geoMercator().fitSize([width * 0.65, height * 0.9], zoomParentFeature);
    }
  } else {
    // Elegant Flat Projection
    projection = geoNaturalEarth1()
      .scale(210)
      .translate([width / 2, height / 2 + 20]);
  }
  
  const pathGenerator = geoPath().projection(projection);
  const featuresToRender = zoomedCountryInfo && zoomStateFeatures.length > 0 ? zoomStateFeatures : countries;

  return (
    <div 
      ref={containerRef} 
      className="world-map-section" 
      style={{ 
        width: '100%', 
        position: 'relative', 
        overflow: 'hidden', 
        margin: '20px 0',
        borderRadius: '24px',
        background: 'radial-gradient(circle at center, rgba(139,92,246,0.05) 0%, transparent 80%)'
      }}
    >
      {/* ── Global Header Overlay ── */}
      {!zoomedCountryInfo && (
        <div style={{ position: 'absolute', top: 15, left: 15, zIndex: 50, display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ background: 'rgba(10,5,20,0.8)', border: '1px solid #10b981', color: '#10b981', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', backdropFilter: 'blur(10px)' }}>
             <Activity size={14} className="animate-pulse" /> LIVE TACTICAL FEED
          </div>
          <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '600' }}>Scroll to Zoom • Drag to Pan</span>
        </div>
      )}

      {/* ── Back Button ── */}
      {zoomedCountryInfo && (
        <button 
          onClick={() => { setZoomedCountryInfo(null); setZoomParentFeature(null); setZoomStateFeatures([]); setSelectedState(null); }} 
          style={{ position: 'absolute', top: 15, left: 15, zIndex: 100, background: 'rgba(139,92,246,0.2)', border: '1px solid #8b5cf6', color: '#fff', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 'bold', backdropFilter: 'blur(10px)', transition: 'all 0.2s', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
        >
          <ArrowLeft size={14} /> Back to Global View
        </button>
      )}

      {/* Map Tooltip Overlay */}
      {hoveredInfo && (
        <div 
          className="map-tooltip" 
          style={{ left: tooltipPos.x + 15, top: tooltipPos.y + 15, position: 'absolute', zIndex: 200, background: 'rgba(10,5,20,0.95)', backdropFilter: 'blur(12px)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: '12px', padding: '12px 16px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', pointerEvents: 'none', maxWidth: '200px' }}
        >
          {hoveredInfo.flag && <span style={{ fontSize: '20px' }}>{hoveredInfo.flag}</span>}
          <div style={{ marginLeft: hoveredInfo.flag ? '8px' : 0, display: 'inline-block' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#fff', display: 'block' }}>{hoveredInfo.name}</span>
            {hoveredInfo.capital && <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>{hoveredInfo.capital}</span>}
            {hoveredInfo.isState && <span style={{ fontSize: '10px', color: '#10b981', fontWeight: '600', display: 'block' }}>Local Region</span>}
            {hoveredInfo.headline && <span style={{ fontSize: '10px', color: '#f87171', fontWeight: '500', display: 'block', marginTop: '4px', lineHeight: 1.2 }}>"{hoveredInfo.headline}"</span>}
          </div>
        </div>
      )}

      {/* ── Drilldown Regional Panel ── */}
      {zoomedCountryInfo && (
        <div style={{ position: 'absolute', top: 0, right: 0, width: '32%', height: '100%', background: 'rgba(5,7,12,0.95)', backdropFilter: 'blur(20px)', borderLeft: '1px solid rgba(139,92,246,0.2)', zIndex: 50, display: 'flex', flexDirection: 'column', animation: 'slideIn 0.3s ease-out' }}>
          <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>{zoomedCountryInfo.flag}</div>
            
            <h2 style={{ fontSize: '20px', margin: 0, color: '#fff', fontWeight: '800' }}>
              {selectedState ? `${selectedState.info.name} Region` : `${zoomedCountryInfo.name} Command`}
            </h2>
            <p style={{ fontSize: '11px', color: '#10b981', margin: '6px 0 0', fontWeight: '600', letterSpacing: '1px' }}>● STRICT LOCAL FILTER ACTIVE</p>
            
            {selectedState && (
              <button 
                onClick={() => { setSelectedState(null); loadLocalNews(); }}
                style={{ marginTop: '12px', padding: '6px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', transition: 'all 0.2s' }}
              >
                ⟵ ALL NATIONAL ALERTS
              </button>
            )}
          </div>
          <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
             {loadingStateLevel && <div style={{ color: '#8b5cf6', fontSize: '11px', textAlign: 'center', background: 'rgba(139,92,246,0.1)', padding: '10px', borderRadius: '8px' }}>Initializing localized boundaries...</div>}
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

      {/* ── Main SVG Projection ── */}
      <div style={{ width: '100%', padding: zoomedCountryInfo ? '30px 32% 30px 20px' : '0' }}>
        <svg 
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`} 
          className="world-map-svg"
          preserveAspectRatio="xMidYMid meet"
          style={{ 
            width: '100%', height: '100%', minHeight: '550px', overflow: 'hidden', cursor: zoomedCountryInfo ? 'default' : 'grab'
          }}
        >
        <defs>
          <radialGradient id="globe-glow" cx="50%" cy="50%" r="50%">
            <stop offset="85%" stopColor="rgba(8,12,30,0.8)" />
            <stop offset="100%" stopColor="rgba(56,189,248,0.2)" />
          </radialGradient>
          
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

          {Object.keys(SEVERITY_COLORS).map(sKey => (
            <radialGradient key={`heatGrad-${sKey}`} id={`heatGrad-${sKey}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={SEVERITY_COLORS[sKey].glow} />
              <stop offset="100%" stopColor="rgba(0,0,0,0)" />
            </radialGradient>
          ))}
        </defs>

        {/* Group everything inside mapGroupRef for flawless zooming without breaking physics */}
        <g ref={mapGroupRef}>
          <g className="countries-group">
            {featuresToRender.map((feat, i) => {
              const info = feat.info;
              const isStateMap = !!(zoomedCountryInfo && zoomStateFeatures.length > 0);
              
              const renderedPath = pathGenerator(feat);
              if (!renderedPath) return null;

              const dynamicZone = dynamicZones.find(z => z.name === info?.name);
              const isHot = !zoomedCountryInfo && dynamicZone;
              const sev = isHot ? SEVERITY_COLORS[dynamicZone.severity] : null;

              const isHovered = hoveredInfo?.key === info?.key || hoveredInfo?.name === info?.name;
              const isSelectedState = selectedState && selectedState.info.name === info?.name;

              const baseFill = isSelectedState ? 'rgba(139,92,246,0.35)' : (isStateMap ? 'rgba(20,25,50,0.8)' : 'rgba(12,16,36,0.95)');
              const baseStroke = isSelectedState ? '#c084fc' : (isStateMap ? 'rgba(56,189,248,0.3)' : 'rgba(56,189,248,0.15)');
              const hoverFill = 'rgba(139,92,246,0.25)';
              const hoverStroke = '#a78bfa';

              return (
                <path
                  key={`path-${i}`}
                  d={renderedPath}
                  fill={isHot ? sev.fill : (isHovered ? hoverFill : baseFill)}
                  stroke={isHot ? sev.stroke : (isHovered ? hoverStroke : baseStroke)}
                  strokeWidth={isHot ? 1.2 : (isHovered || isSelectedState ? 1.5 : 0.5)}
                  filter={isHot ? 'url(#glow-hot)' : (isHovered || isSelectedState ? 'url(#glow-medium)' : 'none')}
                  onMouseEnter={(e) => {
                    if (!info) return;
                    if (dynamicZone) {
                       setHoveredInfo({...info, headline: dynamicZone.headline});
                    } else {
                       setHoveredInfo(info);
                    }
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

          {/* ── NLP Dynamic Connections ── */}
          {!zoomedCountryInfo && dynamicConns.map((conn, i) => {
            const from = projection(conn.from);
            const to = projection(conn.to);
            if (!from || !to) return null;
            
            const midX = (from[0] + to[0]) / 2;
            const midY = Math.min(from[1], to[1]) - 60;
            return (
              <g key={`conn-dyn-${i}`} style={{ pointerEvents: 'none' }}>
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

          {/* ── NLP Dynamic Intelligence Nodes ── */}
          {!zoomedCountryInfo && dynamicZones.map((zone, i) => {
            const pt = projection(zone.coords);
            if (!pt) return null;

            const sev = SEVERITY_COLORS[zone.severity];
            return (
              <g key={`zone-dyn-${i}`} style={{ pointerEvents: 'none' }}>
                <circle cx={pt[0]} cy={pt[1]} r={30} fill={`url(#heatGrad-${zone.severity})`} opacity="0.8" />
                <circle cx={pt[0]} cy={pt[1]} r={pulseR3} fill="none" stroke={sev.glow} strokeWidth="0.5" opacity={0.2 + Math.sin(pulsePhase * 0.1) * 0.15} />
                <circle cx={pt[0]} cy={pt[1]} r={pulseR2} fill="none" stroke={sev.glow} strokeWidth="0.8" opacity={0.3 + Math.sin(pulsePhase * 0.15) * 0.2} />
                <circle cx={pt[0]} cy={pt[1]} r={pulseR1} fill="none" stroke={sev.stroke} strokeWidth="1" opacity="0.6" />
                <circle cx={pt[0]} cy={pt[1]} r={3} fill={sev.stroke} filter="url(#glow-hot)" />
                <g transform={`translate(${pt[0]}, ${pt[1] - 18 - 10})`}>
                  <rect x={-zone.label.length * 3.5 - 4} y="-10" width={zone.label.length * 7 + 8} height="14" rx="3" fill="rgba(0,0,0,0.8)" stroke={sev.stroke} strokeWidth="0.5" />
                  <text x="0" y="0" fill={sev.stroke} fontSize="7" fontWeight="bold" textAnchor="middle" letterSpacing="1px">{zone.label}</text>
                </g>
              </g>
            );
          })}

          {/* ── Deep Space Blips ── */}
          {!zoomedCountryInfo && liveBlips.map(blip => {
             const pt = projection(blip.coords);
             if (!pt) return null;
             
             const ageMs = currentTimeMs - blip.id;
             if (ageMs > 2500) return null;
             const progress = ageMs / 2500;
             return (
               <g key={blip.id} style={{ pointerEvents: 'none' }}>
                 <circle cx={pt[0]} cy={pt[1]} r="1.5" fill="#38bdf8" filter="url(#glow-hot)" opacity={1 - progress} />
                 <circle cx={pt[0]} cy={pt[1]} r={2 + progress * 20} fill="none" stroke="#38bdf8" strokeWidth="1" opacity={0.6 - (progress * 0.6)} />
               </g>
             )
          })}
        </g>

        {/* ── Status Indication UI (Outside Pan/Zoom group so it remains fixed) ── */}
        {!zoomedCountryInfo && (
          <g transform={`translate(${width - 120}, ${height - 20})`} style={{ pointerEvents: 'none' }}>
            <circle r="4" fill="#a855f7" opacity={0.4 + Math.sin(pulsePhase * 0.3) * 0.6} />
            <circle r="2" fill="#a855f7" />
            <text x="10" y="4" fill="#a855f7" fontSize="8" fontWeight="700" letterSpacing="1px">AI LIVE SCRAPING</text>
          </g>
        )}
        
        <text x="15" y={height - 10} fill="rgba(255,255,255,0.2)" fontSize="7" fontFamily="monospace">
          UTC {new Date().toLocaleTimeString()} | SATCOM ZOOM UPLINK SECURED
        </text>
        </svg>
      </div>
    </div>
  );
}
