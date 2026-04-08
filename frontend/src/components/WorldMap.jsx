import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { feature } from 'topojson-client';
import { Globe, Zap } from 'lucide-react';
import { COUNTRY_DATA, CITY_DOTS } from './countryData';

const MAP_WIDTH = 960;
const MAP_HEIGHT = 480;
const TOPO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

/* ── Simple equirectangular projection ── */
function project(lon, lat) {
  const clampedLat = Math.max(-58, Math.min(83, lat));
  const x = (lon + 180) / 360 * MAP_WIDTH;
  const y = (83 - clampedLat) / (83 + 58) * MAP_HEIGHT;
  return [x, y];
}

/* ── Convert GeoJSON geometry → SVG path string ── */
function geoToSvgPath(geometry) {
  const segments = [];

  const processRing = (ring) => {
    let d = '';
    for (let i = 0; i < ring.length; i++) {
      const [x, y] = project(ring[i][0], ring[i][1]);
      d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }
    return d + 'Z';
  };

  if (geometry.type === 'Polygon') {
    geometry.coordinates.forEach(ring => segments.push(processRing(ring)));
  } else if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach(poly =>
      poly.forEach(ring => segments.push(processRing(ring)))
    );
  }

  return segments.join('');
}

/* ── Generate graticule (grid lines) ── */
function generateGraticule() {
  const lines = [];
  // Longitude lines every 30°
  for (let lon = -180; lon <= 180; lon += 30) {
    let d = '';
    for (let lat = -58; lat <= 83; lat += 2) {
      const [x, y] = project(lon, lat);
      d += `${lat === -58 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }
    lines.push(d);
  }
  // Latitude lines every 30°
  for (let lat = -60; lat <= 90; lat += 30) {
    let d = '';
    for (let lon = -180; lon <= 180; lon += 2) {
      const [x, y] = project(lon, Math.max(-58, Math.min(83, lat)));
      d += `${lon === -180 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }
    lines.push(d);
  }
  return lines;
}

const GRATICULE_PATHS = generateGraticule();

export default function WorldMap() {
  const [countries, setCountries] = useState([]);
  const [hoveredId, setHoveredId] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const containerRef = useRef(null);
  const navigate = useNavigate();

  /* ── Load TopoJSON ── */
  useEffect(() => {
    let cancelled = false;
    fetch(TOPO_URL)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(topo => {
        if (cancelled) return;
        const feats = feature(topo, topo.objects.countries).features;
        setCountries(feats);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) { setError(true); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, []);

  /* ── Memoize computed paths ── */
  const paths = useMemo(() => {
    return countries.map(f => {
      const id = String(f.id);
      return {
        id,
        d: geoToSvgPath(f.geometry),
        info: COUNTRY_DATA[id] || null,
      };
    });
  }, [countries]);

  /* ── Memoize city dot positions ── */
  const dots = useMemo(() => {
    return CITY_DOTS.map(dot => {
      const [x, y] = project(dot.lon, dot.lat);
      return { ...dot, x, y };
    });
  }, []);

  /* ── Mouse handlers ── */
  const handleMouseMove = useCallback((e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTooltipPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, []);

  const handleCountryClick = useCallback((info) => {
    if (info && info.name && info.name !== 'Antarctica') {
      navigate(`/search/${encodeURIComponent(info.name + ' news')}`);
    }
  }, [navigate]);

  /* ── Get hovered country info ── */
  const hoveredInfo = useMemo(() => {
    if (!hoveredId) return null;
    return COUNTRY_DATA[hoveredId] || { name: 'Unknown Region', capital: '', flag: '🏳️' };
  }, [hoveredId]);

  /* ── Loading / Error states ── */
  if (error) return null; // Silently fail

  return (
    <div className="world-map-section scroll-reveal" ref={containerRef} onMouseMove={handleMouseMove}>
      <div className="world-map-header">
        <div className="map-indicator">
          <Globe size={14} className="map-globe-icon" />
          <span className="map-live-dot" />
          <span>GLOBAL NEWS MAP</span>
        </div>
        <span className="map-subtitle">
          <Zap size={10} />
          Click any country for live news
        </span>
      </div>

      <div className="world-map-wrapper">
        {loading ? (
          <div className="world-map-loading">
            <div className="map-loader-ring" />
            <span>Loading Global Map...</span>
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
            className="world-map-svg"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              {/* Glow filter for hovered country */}
              <filter id="country-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feFlood floodColor="#facc15" floodOpacity="0.4" result="color" />
                <feComposite in="color" in2="blur" operator="in" result="glow" />
                <feMerge>
                  <feMergeNode in="glow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              {/* Dot glow */}
              <radialGradient id="dot-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#facc15" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#facc15" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Graticule grid */}
            {GRATICULE_PATHS.map((d, i) => (
              <path
                key={`g-${i}`}
                d={d}
                fill="none"
                stroke="rgba(255,255,255,0.04)"
                strokeWidth="0.5"
              />
            ))}

            {/* Country paths */}
            {paths.map(({ id, d, info }) => (
              <path
                key={id}
                d={d}
                className={`country-path ${hoveredId === id ? 'country-hovered' : ''}`}
                onMouseEnter={() => setHoveredId(id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => handleCountryClick(info)}
              />
            ))}

            {/* City pulse dots */}
            {dots.map((dot, i) => (
              <g key={`dot-${i}`}>
                <circle
                  cx={dot.x}
                  cy={dot.y}
                  r="6"
                  fill="url(#dot-glow)"
                  className="map-dot-glow"
                  style={{ animationDelay: `${i * 0.4}s` }}
                />
                <circle
                  cx={dot.x}
                  cy={dot.y}
                  r="1.5"
                  className="map-city-dot"
                  style={{ animationDelay: `${i * 0.3}s` }}
                />
              </g>
            ))}
          </svg>
        )}

        {/* Tooltip */}
        {hoveredId && hoveredInfo && (
          <div
            className="map-tooltip"
            style={{
              left: Math.min(tooltipPos.x + 16, (containerRef.current?.offsetWidth || 600) - 200),
              top: tooltipPos.y - 10,
            }}
          >
            <span className="map-tooltip-flag">{hoveredInfo.flag}</span>
            <div className="map-tooltip-info">
              <div className="map-tooltip-name">{hoveredInfo.name}</div>
              {hoveredInfo.capital && (
                <div className="map-tooltip-capital">📍 {hoveredInfo.capital}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
