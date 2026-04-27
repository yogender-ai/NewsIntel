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
        <radialGradient id="map-ocean-glow" cx="50%" cy="44%" r="70%">
          <stop offset="0%" stopColor="rgba(94, 234, 212, 0.14)" />
          <stop offset="55%" stopColor="rgba(91, 124, 250, 0.08)" />
          <stop offset="100%" stopColor="rgba(3, 7, 18, 0)" />
        </radialGradient>
        <filter id="map-point-glow" x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect className="world-map-ocean" x="0" y="0" width="1000" height="560" rx="8" />
      <ellipse className="world-map-atmosphere" cx="500" cy="278" rx="455" ry="228" fill="url(#map-ocean-glow)" />
      {geoData && geoData.features.map((feat) => (
        <path key={feat.id} d={pathGenerator(feat)} className="world-map-geo" />
      ))}
      {!geoData && !failed && (
        <g className="world-map-loading">
          <path d="M110 260C210 170 338 132 486 146c137 13 244 56 386 151" />
          <path d="M166 336c124 52 236 75 358 66 123-9 216-43 306-101" />
        </g>
      )}
      {failed && (
        <g className="world-map-fallback">
          <path d="M126 218c53-57 132-91 224-89 87 1 128 37 213 39 103 3 160-43 249-5 57 24 86 67 92 112-84 77-204 126-343 132-177 8-327-56-435-189z" />
          <path d="M306 420c52 18 102 29 161 33-6 35-27 61-60 78-47-16-80-53-101-111z" />
        </g>
      )}
      {points.map((pt) => (
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
          <circle cx={pt.x} cy={pt.y} r={Math.max(12, 16 + Number(pt.intensity || 0) * 0.16)} className="world-map-heat-aura" />
          <circle cx={pt.x} cy={pt.y} r={Math.max(4, 5 + Number(pt.intensity || 0) * 0.05)} className="world-map-heat-core" />
          <text x={pt.x + 14} y={pt.y - 10} className="world-map-label">{pt.name}</text>
          <text x={pt.x + 14} y={pt.y + 8} className="world-map-sub-label">{pt.label}</text>
        </g>
      ))}
    </svg>
  );
}
