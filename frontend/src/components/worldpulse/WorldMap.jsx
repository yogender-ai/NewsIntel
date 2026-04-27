import React, { useEffect, useState, useMemo } from 'react';
import { geoMercator, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';

/**
 * WorldMap – renders an interactive SVG world map.
 * The map data is fetched at runtime from a public CDN, ensuring no hard‑coded assets.
 * Regions are displayed as paths; hover effects are applied via CSS.
 */
export default function WorldMap({ regions = [], onRegionSelect }) {
  const [geoData, setGeoData] = useState(null);

  // Load world topology JSON (no hard‑coded asset, fetched from CDN)
  useEffect(() => {
    const url = 'https://unpkg.com/world-atlas@2.0.2/world/110m.json';
    fetch(url)
      .then((res) => res.json())
      .then((topology) => {
        const world = feature(topology, topology.objects.countries);
        setGeoData(world);
      })
      .catch((err) => {
        console.error('Failed to load world map data', err);
        // No fallback – the component will simply render nothing on error
      });
  }, []);

  // Projection – size adapts to container via viewBox
  const projection = useMemo(() => {
    return geoMercator()
      .scale(150) // base scale – can be adjusted via CSS if needed
      .translate([400, 250]); // centre of the SVG (width:800, height:500)
  }, []);

  const pathGenerator = useMemo(() => geoPath().projection(projection), [projection]);

  // Convert region data (with lat/lng) to SVG coordinates on the fly
  const points = useMemo(() => {
    return regions.map((region) => {
      const [x, y] = projection([Number(region.lng), Number(region.lat)]) || [0, 0];
      return { ...region, x, y };
    });
  }, [regions, projection]);

  return (
    <svg className="world-map-svg" viewBox="0 0 800 500" aria-hidden="true">
      {geoData &&
        geoData.features.map((feat) => (
          <path
            key={feat.id}
            d={pathGenerator(feat)}
            className="world-map-geo"
          />
        ))}
      {/* Heat points */}
      {points.map((pt) => (
        <g key={pt.id} className="world-map-point-group" onClick={() => onRegionSelect && onRegionSelect(pt)}>
          <circle
            cx={pt.x}
            cy={pt.y}
            r={Math.max(4, Math.sqrt(pt.intensity) * 2)}
            className="world-map-heat-point"
          />
        </g>
      ))}
    </svg>
  );
}
