import React, { useEffect, useMemo, useState } from 'react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';

export default function WorldMap({ regions = [], onRegionSelect }) {
  const [geoData, setGeoData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [hovered, setHovered] = useState(null);

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

  const points = useMemo(() => (
    regions
      .filter((r) => Number.isFinite(Number(r.lng)) && Number.isFinite(Number(r.lat)))
      .map((r) => {
        const [x, y] = projection([Number(r.lng), Number(r.lat)]) || [0, 0];
        return { ...r, x, y };
      })
  ), [regions, projection]);

  return (
    <svg className="world-map-svg" viewBox="0 0 1000 560" role="img" aria-label="World map of live signal intensity">
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
      {geoData && geoData.features.map((feat) => (
        <path key={feat.id} d={pathGenerator(feat)} className="world-map-geo" />
      ))}

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

      {/* Vignette */}
      <rect x="0" y="0" width="1000" height="560" fill="url(#map-vignette)" rx="14" pointerEvents="none" />
    </svg>
  );
}
