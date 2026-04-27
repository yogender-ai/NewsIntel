import React, { useEffect, useMemo, useState } from 'react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';

export default function WorldMap({ regions = [], onRegionSelect }) {
  const [geoData, setGeoData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const urls = [
      'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json',
      'https://unpkg.com/world-atlas@2.0.2/countries-110m.json',
      'https://unpkg.com/world-atlas@2.0.2/world/110m.json',
    ];

    async function loadMap() {
      for (const url of urls) {
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const topology = await res.json();
          const countries = topology.objects.countries || topology.objects.land;
          if (!countries) continue;
          if (!cancelled) {
            setGeoData(feature(topology, countries));
            setFailed(false);
          }
          return;
        } catch {
          // Try the next CDN.
        }
      }
      if (!cancelled) setFailed(true);
    }

    loadMap();
    return () => {
      cancelled = true;
    };
  }, []);

  const projection = useMemo(() => {
    const next = geoNaturalEarth1();
    if (geoData) next.fitSize([1000, 560], geoData);
    return next;
  }, [geoData]);

  const pathGenerator = useMemo(() => geoPath().projection(projection), [projection]);

  const points = useMemo(() => (
    regions
      .filter((region) => Number.isFinite(Number(region.lng)) && Number.isFinite(Number(region.lat)))
      .map((region) => {
        const [x, y] = projection([Number(region.lng), Number(region.lat)]) || [0, 0];
        return { ...region, x, y };
      })
  ), [regions, projection]);

  return (
    <svg className="world-map-svg" viewBox="0 0 1000 560" role="img" aria-label="World map of live signal intensity">
      <defs>
        {/* Ocean ambient glow */}
        <radialGradient id="map-ocean-glow" cx="50%" cy="44%" r="70%">
          <stop offset="0%" stopColor="rgba(94, 234, 212, 0.12)" />
          <stop offset="35%" stopColor="rgba(139, 92, 246, 0.06)" />
          <stop offset="65%" stopColor="rgba(91, 124, 250, 0.04)" />
          <stop offset="100%" stopColor="rgba(3, 7, 18, 0)" />
        </radialGradient>

        {/* Enhanced point glow */}
        <filter id="map-point-glow" x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur stdDeviation="10" result="blur1" />
          <feGaussianBlur stdDeviation="4" result="blur2" in="SourceGraphic" />
          <feMerge>
            <feMergeNode in="blur1" />
            <feMergeNode in="blur2" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Soft outer halo for land */}
        <filter id="land-glow" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="3" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Animated scan line gradient */}
        <linearGradient id="scan-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(94, 234, 212, 0)" />
          <stop offset="45%" stopColor="rgba(94, 234, 212, 0)" />
          <stop offset="50%" stopColor="rgba(94, 234, 212, 0.08)" />
          <stop offset="55%" stopColor="rgba(94, 234, 212, 0)" />
          <stop offset="100%" stopColor="rgba(94, 234, 212, 0)" />
        </linearGradient>

        {/* Vignette for depth */}
        <radialGradient id="map-vignette" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.4)" />
        </radialGradient>
      </defs>

      {/* Background */}
      <rect className="world-map-ocean" x="0" y="0" width="1000" height="560" rx="12" />

      {/* Atmosphere glow */}
      <ellipse className="world-map-atmosphere" cx="500" cy="278" rx="460" ry="235" fill="url(#map-ocean-glow)" />

      {/* Subtle grid lines for depth */}
      <g className="map-grid-lines" opacity="0.06" stroke="rgba(94,234,212,0.4)" strokeWidth="0.3">
        {[...Array(9)].map((_, i) => (
          <line key={`h${i}`} x1="50" y1={60 + i * 55} x2="950" y2={60 + i * 55} />
        ))}
        {[...Array(13)].map((_, i) => (
          <line key={`v${i}`} x1={80 + i * 70} y1="30" x2={80 + i * 70} y2="530" />
        ))}
      </g>

      {/* Countries */}
      {geoData && geoData.features.map((feat) => (
        <path key={feat.id} d={pathGenerator(feat)} className="world-map-geo" />
      ))}

      {/* Loading placeholder */}
      {!geoData && !failed && (
        <g className="world-map-loading">
          <path d="M110 260C210 170 338 132 486 146c137 13 244 56 386 151" />
          <path d="M166 336c124 52 236 75 358 66 123-9 216-43 306-101" />
        </g>
      )}

      {/* Fallback silhouette */}
      {failed && (
        <g className="world-map-fallback">
          <path d="M126 218c53-57 132-91 224-89 87 1 128 37 213 39 103 3 160-43 249-5 57 24 86 67 92 112-84 77-204 126-343 132-177 8-327-56-435-189z" />
          <path d="M306 420c52 18 102 29 161 33-6 35-27 61-60 78-47-16-80-53-101-111z" />
        </g>
      )}

      {/* Animated radar scan */}
      <rect
        x="0" y="0" width="1000" height="560"
        fill="url(#scan-gradient)"
        opacity="0.6"
        style={{ animation: 'mapScan 4s ease-in-out infinite' }}
      />

      {/* Connection lines between nearby points */}
      {points.length > 1 && points.slice(0, -1).map((pt, i) => {
        const next = points[i + 1];
        if (!next) return null;
        const dist = Math.sqrt((pt.x - next.x) ** 2 + (pt.y - next.y) ** 2);
        if (dist > 300) return null;
        return (
          <line
            key={`conn-${pt.id}-${next.id}`}
            x1={pt.x} y1={pt.y} x2={next.x} y2={next.y}
            stroke="rgba(94,234,212,0.08)"
            strokeWidth="0.8"
            strokeDasharray="4 6"
            className="map-connection-line"
          />
        );
      })}

      {/* Signal points */}
      {points.map((pt) => {
        const intensity = Number(pt.intensity || 0);
        const auraR = Math.max(16, 22 + intensity * 0.2);
        const coreR = Math.max(4.5, 6 + intensity * 0.06);
        return (
          <g
            key={pt.id}
            className="world-map-point-group"
            role="button"
            tabIndex="0"
            onClick={() => onRegionSelect && onRegionSelect(pt)}
            onKeyDown={(event) => {
              if ((event.key === 'Enter' || event.key === ' ') && onRegionSelect) onRegionSelect(pt);
            }}
            style={{ '--point-color': pt.color || '#5b7cfa' }}
          >
            <title>{pt.name}</title>
            {/* Outer ripple */}
            <circle cx={pt.x} cy={pt.y} r={auraR * 1.6} className="world-map-heat-aura" style={{ animationDelay: `${(pt.x % 3) * 0.5}s` }} />
            {/* Inner aura */}
            <circle cx={pt.x} cy={pt.y} r={auraR} className="world-map-heat-aura" style={{ animationDelay: `${(pt.y % 3) * 0.3}s`, opacity: 0.25 }} />
            {/* Core dot */}
            <circle cx={pt.x} cy={pt.y} r={coreR} className="world-map-heat-core" />
            {/* Labels */}
            <text x={pt.x + 16} y={pt.y - 12} className="world-map-label">{pt.name}</text>
            <text x={pt.x + 16} y={pt.y + 6} className="world-map-sub-label">{pt.label}</text>
          </g>
        );
      })}

      {/* Vignette overlay for depth */}
      <rect x="0" y="0" width="1000" height="560" fill="url(#map-vignette)" rx="12" pointerEvents="none" />
    </svg>
  );
}
