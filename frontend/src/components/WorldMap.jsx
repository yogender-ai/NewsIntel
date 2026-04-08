import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { feature } from 'topojson-client';
import { Globe, Zap } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const MAP_WIDTH = 960;
const MAP_HEIGHT = 460;
const TOPO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

/* ── Country metadata by ISO 3166-1 numeric & name lookup ── */
const COUNTRY_META = {
  '004': { name: 'Afghanistan', capital: 'Kabul', flag: '🇦🇫' },
  '008': { name: 'Albania', capital: 'Tirana', flag: '🇦🇱' },
  '010': { name: 'Antarctica', capital: 'Research Stations', flag: '🇦🇶' },
  '012': { name: 'Algeria', capital: 'Algiers', flag: '🇩🇿' },
  '024': { name: 'Angola', capital: 'Luanda', flag: '🇦🇴' },
  '031': { name: 'Azerbaijan', capital: 'Baku', flag: '🇦🇿' },
  '032': { name: 'Argentina', capital: 'Buenos Aires', flag: '🇦🇷' },
  '036': { name: 'Australia', capital: 'Canberra', flag: '🇦🇺' },
  '040': { name: 'Austria', capital: 'Vienna', flag: '🇦🇹' },
  '044': { name: 'Bahamas', capital: 'Nassau', flag: '🇧🇸' },
  '050': { name: 'Bangladesh', capital: 'Dhaka', flag: '🇧🇩' },
  '051': { name: 'Armenia', capital: 'Yerevan', flag: '🇦🇲' },
  '056': { name: 'Belgium', capital: 'Brussels', flag: '🇧🇪' },
  '064': { name: 'Bhutan', capital: 'Thimphu', flag: '🇧🇹' },
  '068': { name: 'Bolivia', capital: 'Sucre', flag: '🇧🇴' },
  '070': { name: 'Bosnia and Herzegovina', capital: 'Sarajevo', flag: '🇧🇦' },
  '072': { name: 'Botswana', capital: 'Gaborone', flag: '🇧🇼' },
  '076': { name: 'Brazil', capital: 'Brasília', flag: '🇧🇷' },
  '084': { name: 'Belize', capital: 'Belmopan', flag: '🇧🇿' },
  '090': { name: 'Solomon Islands', capital: 'Honiara', flag: '🇸🇧' },
  '096': { name: 'Brunei', capital: 'Bandar Seri Begawan', flag: '🇧🇳' },
  '100': { name: 'Bulgaria', capital: 'Sofia', flag: '🇧🇬' },
  '104': { name: 'Myanmar', capital: 'Naypyidaw', flag: '🇲🇲' },
  '108': { name: 'Burundi', capital: 'Gitega', flag: '🇧🇮' },
  '112': { name: 'Belarus', capital: 'Minsk', flag: '🇧🇾' },
  '116': { name: 'Cambodia', capital: 'Phnom Penh', flag: '🇰🇭' },
  '120': { name: 'Cameroon', capital: 'Yaoundé', flag: '🇨🇲' },
  '124': { name: 'Canada', capital: 'Ottawa', flag: '🇨🇦' },
  '140': { name: 'Central African Republic', capital: 'Bangui', flag: '🇨🇫' },
  '144': { name: 'Sri Lanka', capital: 'Colombo', flag: '🇱🇰' },
  '148': { name: 'Chad', capital: "N'Djamena", flag: '🇹🇩' },
  '152': { name: 'Chile', capital: 'Santiago', flag: '🇨🇱' },
  '156': { name: 'China', capital: 'Beijing', flag: '🇨🇳' },
  '158': { name: 'Taiwan', capital: 'Taipei', flag: '🇹🇼' },
  '170': { name: 'Colombia', capital: 'Bogotá', flag: '🇨🇴' },
  '178': { name: 'Congo', capital: 'Brazzaville', flag: '🇨🇬' },
  '180': { name: 'DR Congo', capital: 'Kinshasa', flag: '🇨🇩' },
  '188': { name: 'Costa Rica', capital: 'San José', flag: '🇨🇷' },
  '191': { name: 'Croatia', capital: 'Zagreb', flag: '🇭🇷' },
  '192': { name: 'Cuba', capital: 'Havana', flag: '🇨🇺' },
  '196': { name: 'Cyprus', capital: 'Nicosia', flag: '🇨🇾' },
  '203': { name: 'Czechia', capital: 'Prague', flag: '🇨🇿' },
  '204': { name: 'Benin', capital: 'Porto-Novo', flag: '🇧🇯' },
  '208': { name: 'Denmark', capital: 'Copenhagen', flag: '🇩🇰' },
  '214': { name: 'Dominican Republic', capital: 'Santo Domingo', flag: '🇩🇴' },
  '218': { name: 'Ecuador', capital: 'Quito', flag: '🇪🇨' },
  '222': { name: 'El Salvador', capital: 'San Salvador', flag: '🇸🇻' },
  '226': { name: 'Equatorial Guinea', capital: 'Malabo', flag: '🇬🇶' },
  '231': { name: 'Ethiopia', capital: 'Addis Ababa', flag: '🇪🇹' },
  '232': { name: 'Eritrea', capital: 'Asmara', flag: '🇪🇷' },
  '233': { name: 'Estonia', capital: 'Tallinn', flag: '🇪🇪' },
  '238': { name: 'Falkland Islands', capital: 'Stanley', flag: '🇫🇰' },
  '242': { name: 'Fiji', capital: 'Suva', flag: '🇫🇯' },
  '246': { name: 'Finland', capital: 'Helsinki', flag: '🇫🇮' },
  '250': { name: 'France', capital: 'Paris', flag: '🇫🇷' },
  '260': { name: 'French Southern Territories', capital: 'Port-aux-Français', flag: '🇹🇫' },
  '262': { name: 'Djibouti', capital: 'Djibouti', flag: '🇩🇯' },
  '266': { name: 'Gabon', capital: 'Libreville', flag: '🇬🇦' },
  '268': { name: 'Georgia', capital: 'Tbilisi', flag: '🇬🇪' },
  '270': { name: 'Gambia', capital: 'Banjul', flag: '🇬🇲' },
  '275': { name: 'Palestine', capital: 'Ramallah', flag: '🇵🇸' },
  '276': { name: 'Germany', capital: 'Berlin', flag: '🇩🇪' },
  '288': { name: 'Ghana', capital: 'Accra', flag: '🇬🇭' },
  '300': { name: 'Greece', capital: 'Athens', flag: '🇬🇷' },
  '304': { name: 'Greenland', capital: 'Nuuk', flag: '🇬🇱' },
  '320': { name: 'Guatemala', capital: 'Guatemala City', flag: '🇬🇹' },
  '324': { name: 'Guinea', capital: 'Conakry', flag: '🇬🇳' },
  '328': { name: 'Guyana', capital: 'Georgetown', flag: '🇬🇾' },
  '332': { name: 'Haiti', capital: 'Port-au-Prince', flag: '🇭🇹' },
  '340': { name: 'Honduras', capital: 'Tegucigalpa', flag: '🇭🇳' },
  '348': { name: 'Hungary', capital: 'Budapest', flag: '🇭🇺' },
  '352': { name: 'Iceland', capital: 'Reykjavik', flag: '🇮🇸' },
  '356': { name: 'India', capital: 'New Delhi', flag: '🇮🇳' },
  '360': { name: 'Indonesia', capital: 'Jakarta', flag: '🇮🇩' },
  '364': { name: 'Iran', capital: 'Tehran', flag: '🇮🇷' },
  '368': { name: 'Iraq', capital: 'Baghdad', flag: '🇮🇶' },
  '372': { name: 'Ireland', capital: 'Dublin', flag: '🇮🇪' },
  '376': { name: 'Israel', capital: 'Jerusalem', flag: '🇮🇱' },
  '380': { name: 'Italy', capital: 'Rome', flag: '🇮🇹' },
  '384': { name: "Côte d'Ivoire", capital: 'Yamoussoukro', flag: '🇨🇮' },
  '388': { name: 'Jamaica', capital: 'Kingston', flag: '🇯🇲' },
  '392': { name: 'Japan', capital: 'Tokyo', flag: '🇯🇵' },
  '398': { name: 'Kazakhstan', capital: 'Astana', flag: '🇰🇿' },
  '400': { name: 'Jordan', capital: 'Amman', flag: '🇯🇴' },
  '404': { name: 'Kenya', capital: 'Nairobi', flag: '🇰🇪' },
  '408': { name: 'North Korea', capital: 'Pyongyang', flag: '🇰🇵' },
  '410': { name: 'South Korea', capital: 'Seoul', flag: '🇰🇷' },
  '414': { name: 'Kuwait', capital: 'Kuwait City', flag: '🇰🇼' },
  '417': { name: 'Kyrgyzstan', capital: 'Bishkek', flag: '🇰🇬' },
  '418': { name: 'Laos', capital: 'Vientiane', flag: '🇱🇦' },
  '422': { name: 'Lebanon', capital: 'Beirut', flag: '🇱🇧' },
  '426': { name: 'Lesotho', capital: 'Maseru', flag: '🇱🇸' },
  '428': { name: 'Latvia', capital: 'Riga', flag: '🇱🇻' },
  '430': { name: 'Liberia', capital: 'Monrovia', flag: '🇱🇷' },
  '434': { name: 'Libya', capital: 'Tripoli', flag: '🇱🇾' },
  '440': { name: 'Lithuania', capital: 'Vilnius', flag: '🇱🇹' },
  '442': { name: 'Luxembourg', capital: 'Luxembourg', flag: '🇱🇺' },
  '450': { name: 'Madagascar', capital: 'Antananarivo', flag: '🇲🇬' },
  '454': { name: 'Malawi', capital: 'Lilongwe', flag: '🇲🇼' },
  '458': { name: 'Malaysia', capital: 'Kuala Lumpur', flag: '🇲🇾' },
  '466': { name: 'Mali', capital: 'Bamako', flag: '🇲🇱' },
  '478': { name: 'Mauritania', capital: 'Nouakchott', flag: '🇲🇷' },
  '484': { name: 'Mexico', capital: 'Mexico City', flag: '🇲🇽' },
  '496': { name: 'Mongolia', capital: 'Ulaanbaatar', flag: '🇲🇳' },
  '498': { name: 'Moldova', capital: 'Chișinău', flag: '🇲🇩' },
  '499': { name: 'Montenegro', capital: 'Podgorica', flag: '🇲🇪' },
  '504': { name: 'Morocco', capital: 'Rabat', flag: '🇲🇦' },
  '508': { name: 'Mozambique', capital: 'Maputo', flag: '🇲🇿' },
  '512': { name: 'Oman', capital: 'Muscat', flag: '🇴🇲' },
  '516': { name: 'Namibia', capital: 'Windhoek', flag: '🇳🇦' },
  '524': { name: 'Nepal', capital: 'Kathmandu', flag: '🇳🇵' },
  '528': { name: 'Netherlands', capital: 'Amsterdam', flag: '🇳🇱' },
  '540': { name: 'New Caledonia', capital: 'Nouméa', flag: '🇳🇨' },
  '548': { name: 'Vanuatu', capital: 'Port Vila', flag: '🇻🇺' },
  '554': { name: 'New Zealand', capital: 'Wellington', flag: '🇳🇿' },
  '558': { name: 'Nicaragua', capital: 'Managua', flag: '🇳🇮' },
  '562': { name: 'Niger', capital: 'Niamey', flag: '🇳🇪' },
  '566': { name: 'Nigeria', capital: 'Abuja', flag: '🇳🇬' },
  '578': { name: 'Norway', capital: 'Oslo', flag: '🇳🇴' },
  '586': { name: 'Pakistan', capital: 'Islamabad', flag: '🇵🇰' },
  '591': { name: 'Panama', capital: 'Panama City', flag: '🇵🇦' },
  '598': { name: 'Papua New Guinea', capital: 'Port Moresby', flag: '🇵🇬' },
  '600': { name: 'Paraguay', capital: 'Asunción', flag: '🇵🇾' },
  '604': { name: 'Peru', capital: 'Lima', flag: '🇵🇪' },
  '608': { name: 'Philippines', capital: 'Manila', flag: '🇵🇭' },
  '616': { name: 'Poland', capital: 'Warsaw', flag: '🇵🇱' },
  '620': { name: 'Portugal', capital: 'Lisbon', flag: '🇵🇹' },
  '624': { name: 'Guinea-Bissau', capital: 'Bissau', flag: '🇬🇼' },
  '626': { name: 'Timor-Leste', capital: 'Dili', flag: '🇹🇱' },
  '630': { name: 'Puerto Rico', capital: 'San Juan', flag: '🇵🇷' },
  '634': { name: 'Qatar', capital: 'Doha', flag: '🇶🇦' },
  '642': { name: 'Romania', capital: 'Bucharest', flag: '🇷🇴' },
  '643': { name: 'Russia', capital: 'Moscow', flag: '🇷🇺' },
  '646': { name: 'Rwanda', capital: 'Kigali', flag: '🇷🇼' },
  '682': { name: 'Saudi Arabia', capital: 'Riyadh', flag: '🇸🇦' },
  '686': { name: 'Senegal', capital: 'Dakar', flag: '🇸🇳' },
  '688': { name: 'Serbia', capital: 'Belgrade', flag: '🇷🇸' },
  '694': { name: 'Sierra Leone', capital: 'Freetown', flag: '🇸🇱' },
  '704': { name: 'Vietnam', capital: 'Hanoi', flag: '🇻🇳' },
  '705': { name: 'Slovenia', capital: 'Ljubljana', flag: '🇸🇮' },
  '706': { name: 'Somalia', capital: 'Mogadishu', flag: '🇸🇴' },
  '710': { name: 'South Africa', capital: 'Pretoria', flag: '🇿🇦' },
  '716': { name: 'Zimbabwe', capital: 'Harare', flag: '🇿🇼' },
  '724': { name: 'Spain', capital: 'Madrid', flag: '🇪🇸' },
  '728': { name: 'South Sudan', capital: 'Juba', flag: '🇸🇸' },
  '729': { name: 'Sudan', capital: 'Khartoum', flag: '🇸🇩' },
  '732': { name: 'Western Sahara', capital: 'Laayoune', flag: '🇪🇭' },
  '740': { name: 'Suriname', capital: 'Paramaribo', flag: '🇸🇷' },
  '748': { name: 'Eswatini', capital: 'Mbabane', flag: '🇸🇿' },
  '752': { name: 'Sweden', capital: 'Stockholm', flag: '🇸🇪' },
  '756': { name: 'Switzerland', capital: 'Bern', flag: '🇨🇭' },
  '760': { name: 'Syria', capital: 'Damascus', flag: '🇸🇾' },
  '762': { name: 'Tajikistan', capital: 'Dushanbe', flag: '🇹🇯' },
  '764': { name: 'Thailand', capital: 'Bangkok', flag: '🇹🇭' },
  '768': { name: 'Togo', capital: 'Lomé', flag: '🇹🇬' },
  '780': { name: 'Trinidad and Tobago', capital: 'Port of Spain', flag: '🇹🇹' },
  '784': { name: 'United Arab Emirates', capital: 'Abu Dhabi', flag: '🇦🇪' },
  '788': { name: 'Tunisia', capital: 'Tunis', flag: '🇹🇳' },
  '792': { name: 'Turkey', capital: 'Ankara', flag: '🇹🇷' },
  '795': { name: 'Turkmenistan', capital: 'Ashgabat', flag: '🇹🇲' },
  '800': { name: 'Uganda', capital: 'Kampala', flag: '🇺🇬' },
  '804': { name: 'Ukraine', capital: 'Kyiv', flag: '🇺🇦' },
  '807': { name: 'North Macedonia', capital: 'Skopje', flag: '🇲🇰' },
  '818': { name: 'Egypt', capital: 'Cairo', flag: '🇪🇬' },
  '826': { name: 'United Kingdom', capital: 'London', flag: '🇬🇧' },
  '834': { name: 'Tanzania', capital: 'Dodoma', flag: '🇹🇿' },
  '840': { name: 'United States', capital: 'Washington D.C.', flag: '🇺🇸' },
  '854': { name: 'Burkina Faso', capital: 'Ouagadougou', flag: '🇧🇫' },
  '858': { name: 'Uruguay', capital: 'Montevideo', flag: '🇺🇾' },
  '860': { name: 'Uzbekistan', capital: 'Tashkent', flag: '🇺🇿' },
  '862': { name: 'Venezuela', capital: 'Caracas', flag: '🇻🇪' },
  '887': { name: 'Yemen', capital: "Sana'a", flag: '🇾🇪' },
  '894': { name: 'Zambia', capital: 'Lusaka', flag: '🇿🇲' },
};

/* Fallback for features with no numeric ID but have properties.name */
const NAME_FALLBACK = {
  'N. Cyprus':   { name: 'Northern Cyprus', capital: 'North Nicosia', flag: '🇨🇾' },
  'Kosovo':      { name: 'Kosovo', capital: 'Pristina', flag: '🇽🇰' },
  'Somaliland':  { name: 'Somaliland', capital: 'Hargeisa', flag: '🏴' },
};

/* ── City dots for visual effect ── */
const CITY_DOTS = [
  { lon: -74.0, lat: 40.7 }, { lon: -0.1, lat: 51.5 }, { lon: 77.2, lat: 28.6 },
  { lon: 139.7, lat: 35.7 }, { lon: 116.4, lat: 39.9 }, { lon: 2.35, lat: 48.8 },
  { lon: 37.6, lat: 55.8 }, { lon: -43.2, lat: -22.9 }, { lon: 151.2, lat: -33.9 },
  { lon: -99.1, lat: 19.4 }, { lon: 31.2, lat: 30.0 }, { lon: 28.9, lat: 41.0 },
  { lon: 55.3, lat: 25.3 }, { lon: 126.9, lat: 37.6 }, { lon: 100.5, lat: 13.7 },
  { lon: 106.8, lat: -6.2 }, { lon: 36.8, lat: -1.3 }, { lon: -46.6, lat: -23.5 },
  { lon: 18.4, lat: -34.0 }, { lon: 103.8, lat: 1.35 }, { lon: -122.4, lat: 37.8 },
  { lon: 13.4, lat: 52.5 }, { lon: 46.7, lat: 24.7 }, { lon: 67.0, lat: 24.9 },
  { lon: 72.8, lat: 19.1 },
];

/* ── Equirectangular projection (clipped to avoid Antarctica) ── */
function project(lon, lat) {
  const cLat = Math.max(-58, Math.min(83, lat));
  const x = (lon + 180) / 360 * MAP_WIDTH;
  const y = (83 - cLat) / (83 + 58) * MAP_HEIGHT;
  return [x, y];
}

/* ── Convert GeoJSON → SVG path, handling antimeridian crossings ── */
function geoToSvgPath(geometry) {
  const segments = [];

  const processRing = (ring) => {
    let d = '';
    for (let i = 0; i < ring.length; i++) {
      const [x, y] = project(ring[i][0], ring[i][1]);
      if (i === 0) {
        d += `M${x.toFixed(1)},${y.toFixed(1)}`;
      } else {
        // Detect antimeridian crossing (lon jump > 170°)
        const lonDiff = Math.abs(ring[i][0] - ring[i - 1][0]);
        if (lonDiff > 170) {
          // Break path — start a new subpath instead of drawing a line across
          d += `M${x.toFixed(1)},${y.toFixed(1)}`;
        } else {
          d += `L${x.toFixed(1)},${y.toFixed(1)}`;
        }
      }
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

/* ── Resolve country info from a feature ── */
function resolveCountryInfo(f) {
  // Try by ID first (padded to 3 digits)
  if (f.id != null) {
    const padded = String(f.id).padStart(3, '0');
    if (COUNTRY_META[padded]) return { key: padded, ...COUNTRY_META[padded] };
    // Try raw string
    const raw = String(f.id);
    if (COUNTRY_META[raw]) return { key: raw, ...COUNTRY_META[raw] };
  }
  // Fallback by properties.name
  if (f.properties?.name) {
    const n = f.properties.name;
    if (NAME_FALLBACK[n]) return { key: n, ...NAME_FALLBACK[n] };
    // Build from name
    return { key: n, name: n, capital: '', flag: '🏳️' };
  }
  return null;
}

/* ── Graticule grid ── */
function generateGraticule() {
  const lines = [];
  for (let lon = -180; lon <= 180; lon += 40) {
    let d = '';
    for (let lat = -58; lat <= 83; lat += 3) {
      const [x, y] = project(lon, lat);
      d += `${lat === -58 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }
    lines.push(d);
  }
  for (let lat = -40; lat <= 80; lat += 40) {
    let d = '';
    for (let lon = -180; lon <= 180; lon += 3) {
      const [x, y] = project(lon, Math.max(-58, Math.min(83, lat)));
      d += `${lon === -180 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }
    lines.push(d);
  }
  return lines;
}

const GRATICULE = generateGraticule();

export default function WorldMap() {
  const [countries, setCountries] = useState([]);
  const [hoveredKey, setHoveredKey] = useState(null);
  const [hoveredInfo, setHoveredInfo] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(true);
  const containerRef = useRef(null);
  const navigate = useNavigate();
  const { t } = useLanguage();

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
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  /* ── Memoize paths + info ── */
  const paths = useMemo(() => {
    return countries.map((f, i) => {
      const info = resolveCountryInfo(f);
      return {
        key: info?.key || `unknown-${i}`,
        d: geoToSvgPath(f.geometry),
        info,
      };
    });
  }, [countries]);

  /* ── City dots ── */
  const dots = useMemo(() => CITY_DOTS.map(d => {
    const [x, y] = project(d.lon, d.lat);
    return { x, y };
  }), []);

  /* ── Mouse handlers ── */
  const handleMouseMove = useCallback((e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  const handleCountryClick = useCallback((info) => {
    if (info && info.name !== 'Antarctica') {
      navigate(`/search/${encodeURIComponent(info.name + ' news')}`);
    }
  }, [navigate]);

  if (loading) {
    return (
      <div className="world-map-section scroll-reveal">
        <div className="world-map-loading">
          <div className="map-loader-ring" />
          <span>{t('loadingMap')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="world-map-section scroll-reveal" ref={containerRef} onMouseMove={handleMouseMove}>
      <div className="world-map-header">
        <div className="map-indicator">
          <Globe size={13} className="map-globe-icon" />
          <span className="map-live-dot" />
          <span>{t('globalNewsMap')}</span>
        </div>
        <span className="map-subtitle">
          <Zap size={9} />
          {t('clickCountry')}
        </span>
      </div>

      <div className="world-map-3d-wrapper">
        <div className="world-map-wrapper">
          <svg
            viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
            className="world-map-svg"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <filter id="country-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feFlood floodColor="#facc15" floodOpacity="0.35" result="color" />
                <feComposite in="color" in2="blur" operator="in" result="glow" />
                <feMerge>
                  <feMergeNode in="glow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <radialGradient id="dot-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#facc15" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#facc15" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Graticule */}
            {GRATICULE.map((d, i) => (
              <path key={`g${i}`} d={d} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
            ))}

            {/* Countries */}
            {paths.map(({ key, d, info }) => (
              <path
                key={key}
                d={d}
                className={`country-path ${hoveredKey === key ? 'country-hovered' : ''}`}
                onMouseEnter={() => { setHoveredKey(key); setHoveredInfo(info); }}
                onMouseLeave={() => { setHoveredKey(null); setHoveredInfo(null); }}
                onClick={() => handleCountryClick(info)}
              />
            ))}

            {/* City dots */}
            {dots.map((dot, i) => (
              <g key={`d${i}`}>
                <circle cx={dot.x} cy={dot.y} r="5" fill="url(#dot-glow)" className="map-dot-glow" style={{ animationDelay: `${i * 0.4}s` }} />
                <circle cx={dot.x} cy={dot.y} r="1.3" className="map-city-dot" style={{ animationDelay: `${i * 0.3}s` }} />
              </g>
            ))}
          </svg>

          {/* Bottom fade for 3D depth */}
          <div className="map-depth-fade" />
        </div>
      </div>

      {/* Tooltip */}
      {hoveredKey && hoveredInfo && (
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
  );
}
