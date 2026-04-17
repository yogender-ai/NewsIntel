import { useState, useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown, Activity, RefreshCcw, Search, LineChart, Loader, X, Globe, ChevronRight, Star, Zap } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { fetchStocks, fetchStockHistory, fetchStockSearch } from '../api';

const CATEGORIES = [
  { key: 'all', label: 'All Markets', icon: '🌐' },
  { key: 'india', label: 'India', icon: '🇮🇳' },
  { key: 'us', label: 'USA', icon: '🇺🇸' },
  { key: 'global', label: 'Global', icon: '🌍' },
  { key: 'crypto', label: 'Crypto', icon: '₿' },
];

const CATEGORY_FILTER = {
  all: () => true,
  india: (s) => s.flag === '🇮🇳',
  us: (s) => s.flag === '🇺🇸',
  global: (s) => ['🇬🇧', '🇨🇳', '🇯🇵', '🥇', '🛢️', '🌐'].includes(s.flag),
  crypto: (s) => ['₿', 'Ξ'].includes(s.flag),
};

const RANGES = [
  { key: '5d', label: '5D' },
  { key: '1mo', label: '1M' },
  { key: '3mo', label: '3M' },
  { key: '6mo', label: '6M' },
  { key: '1y', label: '1Y' },
];

const CustomTooltip = ({ active, payload, label, color }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: 'rgba(5,5,20,0.95)', border: `1px solid ${color}44`, borderRadius: '10px', padding: '10px 14px', fontSize: '12px' }}>
        <div style={{ color: '#94a3b8', marginBottom: '4px' }}>{label}</div>
        <div style={{ color, fontWeight: 700, fontSize: '15px', fontFamily: 'monospace' }}>
          {Number(payload[0].value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>
    );
  }
  return null;
};

export default function MarketsPage() {
  const [marketData, setMarketData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStock, setSelectedStock] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [activeRange, setActiveRange] = useState('1mo');
  // Custom search state
  const [customSearch, setCustomSearch] = useState('');
  const [customSearching, setCustomSearching] = useState(false);
  const [customResult, setCustomResult] = useState(null);
  const [customError, setCustomError] = useState('');
  const searchInputRef = useRef(null);

  useEffect(() => { loadMarkets(); }, []);

  const loadMarkets = async () => {
    setLoading(true);
    const data = await fetchStocks();
    if (data?.stocks) setMarketData(data.stocks);
    setLoading(false);
  };

  const loadHistory = async (stock, range = '1mo') => {
    setHistoryLoading(true);
    setHistoryData([]);
    const result = await fetchStockHistory(stock.symbol, range);
    if (result?.history) setHistoryData(result.history);
    setHistoryLoading(false);
  };

  const handleStockClick = async (stock) => {
    if (selectedStock?.symbol === stock.symbol) {
      setSelectedStock(null);
      return;
    }
    setSelectedStock(stock);
    setActiveRange('1mo');
    loadHistory(stock, '1mo');
    // Scroll chart into view
    setTimeout(() => document.getElementById('stock-chart-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleRangeChange = (range) => {
    setActiveRange(range);
    if (selectedStock) loadHistory(selectedStock, range);
  };

  const handleCustomSearch = async (e) => {
    e.preventDefault();
    if (!customSearch.trim()) return;
    setCustomSearching(true);
    setCustomError('');
    setCustomResult(null);
    const result = await fetchStockSearch(customSearch.trim());
    if (result?.found) {
      setCustomResult(result);
      // Simulate click to show chart
      const pseudo = {
        symbol: result.yahoo_symbol || result.symbol,
        name: result.name,
        price: result.price,
        change_pct: result.change_pct,
        direction: result.direction,
        flag: result.flag || '🌐',
        change: result.change,
      };
      setSelectedStock(pseudo);
      setActiveRange('1mo');
      loadHistory(pseudo, '1mo');
      setTimeout(() => document.getElementById('stock-chart-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } else {
      setCustomError(result?.message || 'Ticker not found. Try e.g. IOC.NS, AAPL, BTC-USD');
    }
    setCustomSearching(false);
  };

  // Filter logic
  const filteredData = marketData.filter(s => {
    const matchesCategory = CATEGORY_FILTER[category]?.(s) ?? true;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || (s.name || '').toLowerCase().includes(q) || (s.symbol || '').toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  const color = selectedStock ? (selectedStock.direction === 'up' ? '#10b981' : '#ef4444') : '#8b5cf6';

  // Quick stats
  const gainers = marketData.filter(s => s.direction === 'up').length;
  const losers = marketData.filter(s => s.direction === 'down').length;

  return (
    <div style={{ padding: '24px 40px 60px', minHeight: '100vh', background: 'transparent' }}>

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '28px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'linear-gradient(135deg,#8b5cf6,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={18} color="#fff" />
            </div>
            <h1 style={{ fontSize: '26px', margin: 0, fontWeight: 700, color: '#fff', letterSpacing: '0.5px' }}>Market Intelligence</h1>
          </div>
          <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>Real-time prices · Click any card for interactive chart</p>
        </div>

        {/* Refresh */}
        <button onClick={loadMarkets} style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.25)', color: '#38bdf8', padding: '8px 18px', borderRadius: '12px', display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer', fontSize: '13px' }}>
          <RefreshCcw size={13} /> Sync
        </button>
      </div>

      {/* ── QUICK STATS BAR ── */}
      {!loading && marketData.length > 0 && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {[
            { label: 'Tracked', val: marketData.length, color: '#94a3b8', icon: '📊' },
            { label: 'Gainers', val: gainers, color: '#10b981', icon: '📈' },
            { label: 'Losers', val: losers, color: '#ef4444', icon: '📉' },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>{s.icon}</span>
              <span style={{ color: s.color, fontWeight: 700, fontSize: '18px' }}>{s.val}</span>
              <span style={{ color: '#475569', fontSize: '12px' }}>{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── CUSTOM TICKER SEARCH ── */}
      <div style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '18px', padding: '20px 24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <Zap size={14} color="#a855f7" />
          <span style={{ color: '#a855f7', fontSize: '12px', fontWeight: 700, letterSpacing: '1px' }}>SEARCH ANY TICKER</span>
        </div>
        <form onSubmit={handleCustomSearch} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search size={14} style={{ position: 'absolute', left: '14px', top: '13px', color: '#64748b' }} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="e.g. IOC, IOCL, RELIANCE, AAPL, BTC-USD ..."
              value={customSearch}
              onChange={e => { setCustomSearch(e.target.value); setCustomError(''); }}
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '11px 14px 11px 38px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <button type="submit" disabled={customSearching || !customSearch.trim()} style={{ background: customSearching ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.8)', border: 'none', color: '#fff', padding: '11px 22px', borderRadius: '12px', cursor: customSearching ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {customSearching ? <><Loader size={13} className="spin" /> Searching...</> : <><Search size={13} /> Search</>}
          </button>
        </form>
        {customError && (
          <div style={{ marginTop: '10px', color: '#f87171', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            ⚠️ {customError}
          </div>
        )}
        {customResult && (
          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '10px' }}>
            <span style={{ fontSize: '20px' }}>{customResult.flag}</span>
            <div>
              <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '14px' }}>{customResult.name}</span>
              <span style={{ color: '#64748b', fontSize: '11px', marginLeft: '8px' }}>{customResult.yahoo_symbol}</span>
            </div>
            <span style={{ marginLeft: 'auto', color: '#fff', fontWeight: 700, fontFamily: 'monospace', fontSize: '16px' }}>
              {customResult.price?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span style={{ color: customResult.direction === 'up' ? '#10b981' : '#ef4444', fontWeight: 600, fontSize: '13px' }}>
              {customResult.change_pct > 0 ? '+' : ''}{customResult.change_pct}%
            </span>
          </div>
        )}
        <p style={{ margin: '10px 0 0', color: '#475569', fontSize: '11px' }}>
          Try Indian stocks: <code style={{ color: '#94a3b8' }}>IOC</code>, <code style={{ color: '#94a3b8' }}>SBIN</code>, <code style={{ color: '#94a3b8' }}>WIPRO</code>, <code style={{ color: '#94a3b8' }}>ADANIENT</code> · US: <code style={{ color: '#94a3b8' }}>AAPL</code>, <code style={{ color: '#94a3b8' }}>META</code> · Crypto: <code style={{ color: '#94a3b8' }}>BTC-USD</code>
        </p>
      </div>

      {/* ── CHART PANEL ── */}
      {selectedStock && (
        <div id="stock-chart-panel" style={{ background: 'rgba(8,5,25,0.85)', backdropFilter: 'blur(16px)', border: `1px solid ${color}33`, borderRadius: '24px', padding: '28px 32px', marginBottom: '28px', animation: 'tooltipFadeIn 0.3s ease', position: 'relative' }}>
          {/* Close button */}
          <button onClick={() => setSelectedStock(null)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#64748b', cursor: 'pointer', padding: '4px 8px', display: 'flex', alignItems: 'center' }}>
            <X size={14} />
          </button>

          {/* Stock header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{ fontSize: '28px' }}>{selectedStock.flag}</span>
                <div>
                  <h2 style={{ margin: 0, fontSize: '22px', color: '#fff', fontWeight: 700 }}>{selectedStock.name}</h2>
                  <span style={{ fontSize: '11px', color: '#64748b', background: 'rgba(255,255,255,0.07)', padding: '2px 8px', borderRadius: '6px', fontFamily: 'monospace' }}>{selectedStock.symbol}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px' }}>
                <span style={{ fontSize: '34px', fontWeight: 800, color: '#fff', fontFamily: 'monospace', letterSpacing: '-1px' }}>
                  {selectedStock.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span style={{ fontSize: '16px', fontWeight: 700, color, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {selectedStock.direction === 'up' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  {selectedStock.change_pct > 0 ? '+' : ''}{selectedStock.change_pct}%
                </span>
                {selectedStock.change != null && (
                  <span style={{ color: '#475569', fontSize: '13px' }}>
                    ({selectedStock.change > 0 ? '+' : ''}{selectedStock.change?.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                  </span>
                )}
              </div>
            </div>

            {/* Range selector */}
            <div style={{ display: 'flex', gap: '6px', background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '10px' }}>
              {RANGES.map(r => (
                <button key={r.key} onClick={() => handleRangeChange(r.key)} style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, background: activeRange === r.key ? color : 'transparent', color: activeRange === r.key ? '#fff' : '#64748b', transition: 'all 0.2s' }}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Chart */}
          {historyLoading ? (
            <div style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexDirection: 'column', gap: '12px' }}>
              <Loader className="spin" size={28} />
              <span style={{ fontSize: '12px', color: '#64748b' }}>Fetching historical data...</span>
            </div>
          ) : historyData.length > 0 ? (
            <div style={{ height: '280px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historyData} margin={{ top: 5, right: 0, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={40} />
                  <YAxis domain={['auto', 'auto']} tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v.toFixed(0)} />
                  <Tooltip content={<CustomTooltip color={color} />} />
                  <Area type="monotone" dataKey="price" stroke={color} strokeWidth={2.5} fill="url(#priceGrad)" dot={false} activeDot={{ r: 5, fill: color, stroke: '#fff', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '13px' }}>
              Historical data unavailable
            </div>
          )}
        </div>
      )}

      {/* ── FILTER BAR ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        {/* Category tabs */}
        <div style={{ display: 'flex', gap: '6px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
          {CATEGORIES.map(c => (
            <button key={c.key} onClick={() => setCategory(c.key)} style={{ padding: '7px 14px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, background: category === c.key ? 'rgba(139,92,246,0.7)' : 'transparent', color: category === c.key ? '#fff' : '#64748b', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span>{c.icon}</span> {c.label}
            </button>
          ))}
        </div>

        {/* Name/symbol filter */}
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: '12px', top: '11px', color: '#64748b' }} />
          <input
            type="text"
            placeholder="Filter list..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '9px 10px 9px 32px', color: '#fff', fontSize: '12px', width: '180px', outline: 'none' }}
          />
        </div>
      </div>

      {/* ── STOCK GRID ── */}
      {loading ? (
        <div style={{ display: 'flex', height: '260px', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6', flexDirection: 'column', gap: '14px' }}>
          <div className="spin"><Activity size={30} /></div>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2px', color: '#475569' }}>SYNCING GLOBAL EXCHANGES</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '14px' }}>
          {filteredData.map((stock, i) => {
            const isSelected = selectedStock?.symbol === stock.symbol;
            const up = stock.direction === 'up';
            const cardColor = up ? '#10b981' : '#ef4444';
            return (
              <div
                key={i}
                id={`stock-card-${stock.symbol}`}
                onClick={() => handleStockClick(stock)}
                style={{
                  padding: '18px 20px',
                  background: isSelected ? `rgba(139,92,246,0.1)` : 'rgba(255,255,255,0.025)',
                  border: `1px solid ${isSelected ? 'rgba(139,92,246,0.45)' : 'rgba(255,255,255,0.06)'}`,
                  borderLeft: `3px solid ${cardColor}`,
                  borderRadius: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  transform: isSelected ? 'translateY(-2px)' : 'none',
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.055)'; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; }}
              >
                {/* Top row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>{stock.flag}</span>
                    <div>
                      <div style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 600, lineHeight: 1.2 }}>{stock.name}</div>
                      {stock.exchange && <div style={{ color: '#475569', fontSize: '10px' }}>{stock.exchange}</div>}
                    </div>
                  </div>
                  {up ? <TrendingUp size={14} color="#10b981" /> : <TrendingDown size={14} color="#ef4444" />}
                </div>

                {/* Price */}
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#fff', marginBottom: '4px', fontFamily: 'monospace', letterSpacing: '-0.5px' }}>
                  {stock.price != null ? stock.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                </div>

                {/* Change */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: cardColor, fontSize: '12px', fontWeight: 700 }}>
                    {stock.change_pct > 0 ? '+' : ''}{stock.change_pct}%
                  </span>
                  <span style={{ color: '#334155', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <LineChart size={10} /> View chart
                  </span>
                </div>
              </div>
            );
          })}

          {filteredData.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px', color: '#475569' }}>
              <Globe size={32} style={{ marginBottom: '12px', opacity: 0.4 }} />
              <div>No markets found for "{searchQuery}"</div>
              <div style={{ fontSize: '12px', marginTop: '8px', color: '#334155' }}>Try the ticker search above for any stock</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
