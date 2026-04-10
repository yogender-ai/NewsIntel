import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { feature } from 'topojson-client';
import { geoEquirectangular, geoPath } from 'd3-geo';
import { useLanguage } from '../context/LanguageContext';

const TOPO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

/* ── Country metadata by ISO 3166-1 numeric & name lookup ── */
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
  // Truncated list for brevity but functional
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

export default function WorldMap() {
  const [countries, setCountries] = useState([]);
  const [hoveredInfo, setHoveredInfo] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { t } = useLanguage();

  const width = 800;
  const height = 400;

  const projection = geoEquirectangular()
    .scale(130)
    .translate([width / 2, height / 2]);

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

  const hotZones = ['United States', 'Iran'];
  
  // USA and Iran coordinate approximations
  const usCoords = projection([-95, 38]);
  const iranCoords = projection([53, 32]);

  return (
    <div className="world-map-section" style={{ width: '100%', position: 'relative', marginTop: '20px' }}>
      
      {/* Tooltip */}
      {hoveredInfo && (
        <div 
          className="map-tooltip" 
          style={{ left: tooltipPos.x + 15, top: tooltipPos.y + 15, position: 'fixed', zIndex: 100 }}
        >
          <span className="map-tooltip-flag">{hoveredInfo.flag}</span>
          <div className="map-tooltip-info">
            <span className="map-tooltip-name">{hoveredInfo.name}</span>
            <span className="map-tooltip-capital">{hoveredInfo.capital}</span>
          </div>
        </div>
      )}

      {/* SVG Map */}
      <svg 
        viewBox={`0 0 ${width} ${height}`} 
        className="world-map-svg"
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: 'auto', maxHeight: '400px', filter: 'drop-shadow(0 0 30px rgba(250, 204, 21, 0.05))', overflow: 'visible' }}
      >
        <defs>
          <filter id="glow-hot" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <g className="countries-group">
          {countries.map((feature, i) => {
            const isHot = feature.info && hotZones.includes(feature.info.name);
            const isHovered = hoveredInfo?.key === feature.info?.key;

            return (
              <path
                key={`path-${i}`}
                d={pathGenerator(feature)}
                fill={isHot ? 'rgba(239, 68, 68, 0.3)' : (isHovered ? 'rgba(139, 92, 246, 0.4)' : 'transparent')}
                stroke={isHot ? 'rgba(239, 68, 68, 0.7)' : (isHovered ? 'rgba(139, 92, 246, 0.6)' : 'rgba(255, 255, 255, 0.1)')}
                strokeWidth={isHot || isHovered ? 1.5 : 0.5}
                filter={isHot ? 'url(#glow-hot)' : ''}
                onMouseEnter={(e) => {
                  if (feature.info) setHoveredInfo(feature.info);
                  setTooltipPos({ x: e.clientX, y: e.clientY });
                }}
                onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setHoveredInfo(null)}
                onClick={() => handleCountryClick(feature.info)}
                style={{ cursor: 'pointer', transition: 'all 0.2s ease', outline: 'none' }}
              />
            );
          })}
        </g>
        
        {/* Draw pulsing connection arch between US and Iran */}
        {usCoords && iranCoords && (
          <>
            <path 
               d={`M ${usCoords[0]},${usCoords[1]} Q ${(usCoords[0]+iranCoords[0])/2},${usCoords[1]-80} ${iranCoords[0]},${iranCoords[1]}`} 
               fill="none" 
               stroke="rgba(239, 68, 68, 0.6)" 
               strokeWidth="2"
               strokeDasharray="4,4" 
            />
            
            <circle cx={usCoords[0]} cy={usCoords[1]} r="4" fill="#ef4444" filter="url(#glow-hot)" />
            <circle cx={iranCoords[0]} cy={iranCoords[1]} r="4" fill="#ef4444" filter="url(#glow-hot)" />
            
            {/* Labels */}
            <g transform={`translate(${usCoords[0]}, ${usCoords[1] - 12})`}>
              <rect x="-15" y="-12" width="30" height="16" rx="4" fill="rgba(0,0,0,0.6)" stroke="rgba(255,255,255,0.2)" />
              <text x="0" y="0" fill="#fff" fontSize="8" fontWeight="bold" textAnchor="middle" letterSpacing="1px">USA</text>
            </g>

            <g transform={`translate(${iranCoords[0]}, ${iranCoords[1] - 12})`}>
              <rect x="-15" y="-12" width="30" height="16" rx="4" fill="rgba(0,0,0,0.6)" stroke="rgba(255,255,255,0.2)" />
              <text x="0" y="0" fill="#fff" fontSize="8" fontWeight="bold" textAnchor="middle" letterSpacing="1px">IRAN</text>
            </g>
          </>
        )}
      </svg>
    </div>
  );
}
