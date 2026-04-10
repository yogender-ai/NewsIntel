import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { feature } from 'topojson-client';
import Globe from 'react-globe.gl';
import { Globe as GlobeIcon, Zap } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

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

/* ── Resolve country info from a feature ── */
function resolveCountryInfo(f) {
  if (f.id != null) {
    const padded = String(f.id).padStart(3, '0');
    if (COUNTRY_META[padded]) return { key: padded, ...COUNTRY_META[padded] };
    const raw = String(f.id);
    if (COUNTRY_META[raw]) return { key: raw, ...COUNTRY_META[raw] };
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
  const [dimensions, setDimensions] = useState({ width: 600, height: 600 });
  const containerRef = useRef(null);
  const globeReff = useRef(null);
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
        // Attach info to each polygon
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

  /* ── Resize Observer for Responsive Globe ── */
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      if (!entries[0]) return;
      let { width, height } = entries[0].contentRect;
      // Keep it a square or just use width
      setDimensions({ width, height: height || width });
    });
    observer.observe(containerRef.current);
    
    // Auto Rotation
    if (globeReff.current) {
      try {
        const controls = globeReff.current.controls();
        if (controls) {
          controls.autoRotate = true;
          controls.autoRotateSpeed = 0.5;
          controls.enableZoom = true;
        }
      } catch (e) {
        console.warn("Globe controls not ready yet");
      }
    }

    return () => observer.disconnect();
  }, [loading]);

  const handleCountryClick = useCallback((polygon) => {
    const info = polygon.info;
    if (info && info.name !== 'Antarctica') {
      navigate(`/search/${encodeURIComponent(info.name + ' news')}`);
    }
  }, [navigate]);

  if (loading) {
    return (
      <div className="world-map-section scroll-reveal" style={{minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div className="world-map-loading">
          <div className="map-loader-ring" />
          <span>{t('loadingMap')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="world-map-section scroll-reveal" ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>


      <div 
        className="globe-container"
        style={{ width: '100%', height: '100%', padding: '20px 0' }}
        onMouseMove={(e) => {
            if (hoveredInfo) {
              setTooltipPos({ x: e.clientX, y: e.clientY });
            }
        }}
      >
        <Globe
          ref={globeReff}
          width={dimensions.width}
          height={dimensions.height}
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
          showGlobe={true}
          showAtmosphere={true}
          atmosphereColor="#5b21b6"
          atmosphereAltitude={0.2}
          polygonsData={countries}
          polygonAltitude={d => d.info === hoveredInfo ? 0.08 : 0.015}
          polygonCapColor={d => d.info === hoveredInfo ? 'rgba(59, 130, 246, 0.4)' : 'rgba(59, 130, 246, 0.05)'}
          polygonSideColor={() => 'rgba(59, 130, 246, 0.2)'}
          polygonStrokeColor={() => 'rgba(96, 165, 250, 0.9)'}
          onPolygonHover={polygon => setHoveredInfo(polygon ? polygon.info : null)}
          onPolygonClick={handleCountryClick}
          backgroundColor="rgba(0,0,0,0)"
        />
      </div>

      {/* Custom Tooltip matching old style */}
      {hoveredInfo && (
        <div
          className="map-tooltip"
          style={{
            position: 'fixed',
            left: tooltipPos.x + 15,
            top: tooltipPos.y - 10,
            zIndex: 100,
            pointerEvents: 'none',
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
