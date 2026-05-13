import React, { useEffect, useMemo, useState, useRef } from 'react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';

const COUNTRY_META = {
  '004': { code: 'AF', name: 'Afghanistan', capital: 'Kabul' },
  '008': { code: 'AL', name: 'Albania', capital: 'Tirana' },
  '012': { code: 'DZ', name: 'Algeria', capital: 'Algiers' },
  '032': { code: 'AR', name: 'Argentina', capital: 'Buenos Aires' },
  '036': { code: 'AU', name: 'Australia', capital: 'Canberra' },
  '040': { code: 'AT', name: 'Austria', capital: 'Vienna' },
  '050': { code: 'BD', name: 'Bangladesh', capital: 'Dhaka' },
  '056': { code: 'BE', name: 'Belgium', capital: 'Brussels' },
  '076': { code: 'BR', name: 'Brazil', capital: 'Brasilia' },
  '124': { code: 'CA', name: 'Canada', capital: 'Ottawa' },
  '152': { code: 'CL', name: 'Chile', capital: 'Santiago' },
  '156': { code: 'CN', name: 'China', capital: 'Beijing' },
  '170': { code: 'CO', name: 'Colombia', capital: 'Bogota' },
  '203': { code: 'CZ', name: 'Czechia', capital: 'Prague' },
  '208': { code: 'DK', name: 'Denmark', capital: 'Copenhagen' },
  '231': { code: 'ET', name: 'Ethiopia', capital: 'Addis Ababa' },
  '246': { code: 'FI', name: 'Finland', capital: 'Helsinki' },
  '250': { code: 'FR', name: 'France', capital: 'Paris' },
  '276': { code: 'DE', name: 'Germany', capital: 'Berlin' },
  '288': { code: 'GH', name: 'Ghana', capital: 'Accra' },
  '300': { code: 'GR', name: 'Greece', capital: 'Athens' },
  '348': { code: 'HU', name: 'Hungary', capital: 'Budapest' },
  '356': { code: 'IN', name: 'India', capital: 'New Delhi' },
  '360': { code: 'ID', name: 'Indonesia', capital: 'Jakarta' },
  '364': { code: 'IR', name: 'Iran', capital: 'Tehran' },
  '368': { code: 'IQ', name: 'Iraq', capital: 'Baghdad' },
  '372': { code: 'IE', name: 'Ireland', capital: 'Dublin' },
  '376': { code: 'IL', name: 'Israel', capital: 'Jerusalem' },
  '380': { code: 'IT', name: 'Italy', capital: 'Rome' },
  '392': { code: 'JP', name: 'Japan', capital: 'Tokyo' },
  '400': { code: 'JO', name: 'Jordan', capital: 'Amman' },
  '404': { code: 'KE', name: 'Kenya', capital: 'Nairobi' },
  '410': { code: 'KR', name: 'South Korea', capital: 'Seoul' },
  '414': { code: 'KW', name: 'Kuwait', capital: 'Kuwait City' },
  '458': { code: 'MY', name: 'Malaysia', capital: 'Kuala Lumpur' },
  '484': { code: 'MX', name: 'Mexico', capital: 'Mexico City' },
  '504': { code: 'MA', name: 'Morocco', capital: 'Rabat' },
  '524': { code: 'NP', name: 'Nepal', capital: 'Kathmandu' },
  '528': { code: 'NL', name: 'Netherlands', capital: 'Amsterdam' },
  '554': { code: 'NZ', name: 'New Zealand', capital: 'Wellington' },
  '566': { code: 'NG', name: 'Nigeria', capital: 'Abuja' },
  '578': { code: 'NO', name: 'Norway', capital: 'Oslo' },
  '586': { code: 'PK', name: 'Pakistan', capital: 'Islamabad' },
  '604': { code: 'PE', name: 'Peru', capital: 'Lima' },
  '608': { code: 'PH', name: 'Philippines', capital: 'Manila' },
  '616': { code: 'PL', name: 'Poland', capital: 'Warsaw' },
  '620': { code: 'PT', name: 'Portugal', capital: 'Lisbon' },
  '634': { code: 'QA', name: 'Qatar', capital: 'Doha' },
  '642': { code: 'RO', name: 'Romania', capital: 'Bucharest' },
  '643': { code: 'RU', name: 'Russia', capital: 'Moscow' },
  '682': { code: 'SA', name: 'Saudi Arabia', capital: 'Riyadh' },
  '702': { code: 'SG', name: 'Singapore', capital: 'Singapore' },
  '704': { code: 'VN', name: 'Vietnam', capital: 'Hanoi' },
  '710': { code: 'ZA', name: 'South Africa', capital: 'Pretoria' },
  '724': { code: 'ES', name: 'Spain', capital: 'Madrid' },
  '752': { code: 'SE', name: 'Sweden', capital: 'Stockholm' },
  '756': { code: 'CH', name: 'Switzerland', capital: 'Bern' },
  '764': { code: 'TH', name: 'Thailand', capital: 'Bangkok' },
  '784': { code: 'AE', name: 'United Arab Emirates', capital: 'Abu Dhabi' },
  '792': { code: 'TR', name: 'Turkey', capital: 'Ankara' },
  '804': { code: 'UA', name: 'Ukraine', capital: 'Kyiv' },
  '818': { code: 'EG', name: 'Egypt', capital: 'Cairo' },
  '826': { code: 'GB', name: 'United Kingdom', capital: 'London' },
  '840': { code: 'US', name: 'United States', capital: 'Washington, D.C.' },
};

function metaForFeature(feat) {
  const id = String(feat.id || '').padStart(3, '0');
  return COUNTRY_META[id] || {
    code: id,
    name: feat.properties?.name || feat.properties?.NAME || `Country ${id}`,
    capital: 'Capital unavailable',
  };
}

export default function WorldMap({ regions = [], onRegionSelect, onCountrySelect, selectedCountry }) {
  const svgRef = useRef(null);
  const [geoData, setGeoData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [hovered, setHovered] = useState(null);
  const [hoveredCountry, setHoveredCountry] = useState(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [isAnimating, setIsAnimating] = useState(false);
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    let cancelled = false;
    const mapUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

    async function loadMap() {
      try {
        const res = await fetch(mapUrl);
        if (!res.ok) throw new Error(`Map request failed: ${res.status}`);
        const topology = await res.json();
        const countries = topology.objects.countries || topology.objects.land;
        if (!countries) throw new Error('Map topology missing countries.');
        if (!cancelled) {
          setGeoData(feature(topology, countries));
          setFailed(false);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    loadMap();
    return () => { cancelled = true; };
  }, []);

  const projection = useMemo(() => {
    const next = geoNaturalEarth1();
    if (geoData) next.fitSize([1000, 560], geoData);
    return next;
  }, [geoData]);

  const pathGenerator = useMemo(() => geoPath().projection(projection), [projection]);

  const regionsByCode = useMemo(() => {
    const index = new Map();
    regions.forEach((region) => {
      if (region.id) index.set(String(region.id).toUpperCase(), region);
    });
    return index;
  }, [regions]);

  const points = useMemo(() => (
    regions
      .filter((r) => Number.isFinite(Number(r.lng)) && Number.isFinite(Number(r.lat)))
      .map((r) => {
        const [x, y] = projection([Number(r.lng), Number(r.lat)]) || [0, 0];
        return { ...r, x, y };
      })
  ), [regions, projection]);

  /* Native wheel handler — must be {passive: false} to allow preventDefault */
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;

    const onWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const scaleAdj = e.deltaY * -0.0015;
      setTransform((prev) => {
        const newK = Math.min(Math.max(1, prev.k + scaleAdj * prev.k), 8);
        return { ...prev, k: newK };
      });
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const handleDoubleClick = () => {
    setIsAnimating(true);
    setTransform({ x: 0, y: 0, k: 1 });
    setTimeout(() => setIsAnimating(false), 400);
  };

  const handleMouseDown = (e) => {
    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    setTransform((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => { isDragging.current = false; };

  return (
    <svg 
      ref={svgRef}
      className="world-map-svg" viewBox="0 0 1000 560" role="img" aria-label="World map of live signal intensity"
      onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      style={{ cursor: isDragging.current ? 'grabbing' : 'grab' }}
    >
      <defs>
        {/* Ocean gradient */}
        <radialGradient id="map-ocean-glow" cx="50%" cy="44%" r="70%">
          <stop offset="0%" stopColor="rgba(139,92,246,0.08)" />
          <stop offset="40%" stopColor="rgba(94,234,212,0.04)" />
          <stop offset="100%" stopColor="rgba(3,7,18,0)" />
        </radialGradient>

        {/* Enhanced point glow */}
        <filter id="map-point-glow" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="12" result="blur1" />
          <feGaussianBlur stdDeviation="5" result="blur2" in="SourceGraphic" />
          <feMerge>
            <feMergeNode in="blur1" />
            <feMergeNode in="blur2" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Scan sweep */}
        <linearGradient id="map-scan" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(139,92,246,0)" />
          <stop offset="42%" stopColor="rgba(139,92,246,0)" />
          <stop offset="50%" stopColor="rgba(139,92,246,0.05)" />
          <stop offset="58%" stopColor="rgba(139,92,246,0)" />
          <stop offset="100%" stopColor="rgba(139,92,246,0)" />
        </linearGradient>

        {/* Vignette */}
        <radialGradient id="map-vignette" cx="50%" cy="50%" r="58%">
          <stop offset="0%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.45)" />
        </radialGradient>

        {/* Callout card bg */}
        <filter id="callout-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="rgba(0,0,0,0.5)" />
        </filter>
      </defs>

      {/* Background */}
      <rect className="world-map-ocean" x="0" y="0" width="1000" height="560" rx="14" />
      <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}
         style={{ transition: isAnimating ? 'transform 0.4s cubic-bezier(0.22,1,0.36,1)' : (isDragging.current ? 'none' : 'transform 0.08s ease-out') }}
      >
        <ellipse className="world-map-atmosphere" cx="500" cy="278" rx="460" ry="235" fill="url(#map-ocean-glow)" />

      {/* Subtle latitude/longitude grid */}
      <g opacity="0.04" stroke="rgba(94,234,212,0.5)" strokeWidth="0.3">
        {[...Array(9)].map((_, i) => (
          <line key={`h${i}`} x1="40" y1={50 + i * 58} x2="960" y2={50 + i * 58} />
        ))}
        {[...Array(11)].map((_, i) => (
          <line key={`v${i}`} x1={90 + i * 82} y1="25" x2={90 + i * 82} y2="535" />
        ))}
      </g>

      {/* Countries */}
      {geoData && geoData.features.map((feat) => {
        const meta = metaForFeature(feat);
        const centroid = pathGenerator.centroid(feat);
        const active = regionsByCode.has(meta.code);
        const selected = selectedCountry?.code === meta.code;
        return (
          <path
            key={feat.id}
            d={pathGenerator(feat)}
            className={`world-map-geo ${active ? 'has-signal' : ''} ${selected ? 'selected-country' : ''}`}
            role="button"
            tabIndex="0"
            onMouseEnter={() => setHoveredCountry({ ...meta, x: centroid[0], y: centroid[1], active })}
            onMouseLeave={() => setHoveredCountry(null)}
            onClick={() => onCountrySelect && onCountrySelect({ ...meta, activeRegion: regionsByCode.get(meta.code) || null })}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && onCountrySelect) onCountrySelect({ ...meta, activeRegion: regionsByCode.get(meta.code) || null });
            }}
          >
            <title>{`${meta.name} / Capital: ${meta.capital}`}</title>
          </path>
        );
      })}

      {/* Loading state */}
      {!geoData && !failed && (
        <g className="world-map-loading">
          <path d="M110 260C210 170 338 132 486 146c137 13 244 56 386 151" />
          <path d="M166 336c124 52 236 75 358 66 123-9 216-43 306-101" />
        </g>
      )}

      {failed && (
        <g className="world-map-unavailable">
          <text x="500" y="280" textAnchor="middle">Map geography unavailable</text>
        </g>
      )}

      {/* Radar scan */}
      <rect x="0" y="0" width="1000" height="560" fill="url(#map-scan)" opacity="0.7" rx="14"
        style={{ animation: 'mapScan 5s ease-in-out infinite' }} />

      {/* Connection lines */}
      {points.length > 1 && points.slice(0, -1).map((pt, i) => {
        const next = points[i + 1];
        if (!next) return null;
        const dist = Math.sqrt((pt.x - next.x) ** 2 + (pt.y - next.y) ** 2);
        if (dist > 350) return null;
        const midX = (pt.x + next.x) / 2;
        const midY = Math.min(pt.y, next.y) - 20;
        return (
          <path
            key={`conn-${pt.id}-${next.id}`}
            d={`M${pt.x},${pt.y} Q${midX},${midY} ${next.x},${next.y}`}
            stroke="rgba(139,92,246,0.08)"
            strokeWidth="0.8"
            fill="none"
            strokeDasharray="4 6"
            className="map-connection-line"
          />
        );
      })}

      {/* Signal points */}
      {points.map((pt) => {
        const intensity = Number(pt.intensity || 0);
        const auraR = Math.max(18, 26 + intensity * 0.22);
        const coreR = Math.max(5, 7 + intensity * 0.07);
        const isHov = hovered === pt.id;
        return (
          <g
            key={pt.id}
            className="world-map-point-group"
            role="button"
            tabIndex="0"
            onClick={() => onRegionSelect && onRegionSelect(pt)}
            onMouseEnter={() => setHovered(pt.id)}
            onMouseLeave={() => setHovered(null)}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && onRegionSelect) onRegionSelect(pt);
            }}
            style={{ '--point-color': pt.color || '#818cf8' }}
          >
            <title>{pt.name} — intensity {intensity}</title>

            {/* Outer ripple */}
            <circle cx={pt.x} cy={pt.y} r={auraR * 1.8} className="world-map-heat-aura"
              style={{ animationDelay: `${(pt.x % 5) * 0.3}s` }} />
            {/* Inner aura */}
            <circle cx={pt.x} cy={pt.y} r={auraR} className="world-map-heat-aura"
              style={{ animationDelay: `${(pt.y % 4) * 0.4}s`, opacity: 0.22 }} />
            {/* Core */}
            <circle cx={pt.x} cy={pt.y} r={coreR} className="world-map-heat-core" />

            {/* Labels */}
            <text x={pt.x + 16} y={pt.y - 14} className="world-map-label">{pt.name}</text>
            <text x={pt.x + 16} y={pt.y + 4} className="world-map-sub-label">{pt.label}</text>

            {/* Hover callout card */}
            {isHov && (
              <g filter="url(#callout-shadow)">
                <rect
                  x={pt.x + 20} y={pt.y - 50}
                  width="160" height="48" rx="8"
                  fill="rgba(10,15,30,0.88)"
                  stroke="rgba(139,92,246,0.2)"
                  strokeWidth="1"
                />
                <text x={pt.x + 30} y={pt.y - 30} fill="#f0f4ff" fontSize="11" fontWeight="700">{pt.name}</text>
                <text x={pt.x + 30} y={pt.y - 14} fill="#94a3b8" fontSize="9">
                  {pt.label || `Intensity: ${intensity}`}
                </text>
              </g>
            )}
          </g>
        );
      })}
      {hoveredCountry && (
        <g filter="url(#callout-shadow)" pointerEvents="none">
          <rect
            x={Math.min(hoveredCountry.x + 16, 810)}
            y={Math.max(hoveredCountry.y - 42, 16)}
            width="176"
            height="58"
            rx="8"
            className="country-hover-card"
          />
          <text x={Math.min(hoveredCountry.x + 28, 822)} y={Math.max(hoveredCountry.y - 19, 39)} className="country-hover-title">
            {hoveredCountry.name}
          </text>
          <text x={Math.min(hoveredCountry.x + 28, 822)} y={Math.max(hoveredCountry.y - 1, 57)} className="country-hover-sub">
            Capital: {hoveredCountry.capital}
          </text>
        </g>
      )}
      </g>

      {/* Vignette */}
      <rect x="0" y="0" width="1000" height="560" fill="url(#map-vignette)" rx="14" pointerEvents="none" />
    </svg>
  );
}
