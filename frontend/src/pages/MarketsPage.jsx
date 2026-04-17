import { useState, useEffect, useRef, useCallback } from 'react';
import { TrendingUp, TrendingDown, Activity, RefreshCcw, Search, LineChart, Loader, X, Globe, Zap, Sparkles } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { fetchStocks, fetchStockHistory, fetchStockSearch, fetchStockSuggest } from '../api';

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

// Popular recommendations shown when search bar is focused but empty
const QUICK_PICKS = [
  { label: 'Indian Oil', query: 'Indian Oil', flag: '🇮🇳', type: 'Indian Stock' },
  { label: 'Reliance', query: 'Reliance', flag: '🇮🇳', type: 'Indian Stock' },
  { label: 'TCS', query: 'TCS', flag: '🇮🇳', type: 'Indian IT' },
  { label: 'HDFC Bank', query: 'HDFC Bank', flag: '🇮🇳', type: 'Indian Bank' },
  { label: 'Apple', query: 'Apple', flag: '🇺🇸', type: 'US Tech' },
  { label: 'Nvidia', query: 'Nvidia', flag: '🇺🇸', type: 'US Tech' },
  { label: 'Gold', query: 'Gold', flag: '🥇', type: 'Commodity' },
  { label: 'Bitcoin', query: 'Bitcoin', flag: '₿', type: 'Crypto' },
  { label: 'Nifty 50', query: 'Nifty 50', flag: '🇮🇳', type: 'Index' },
  { label: 'S&P 500', query: 'S&P 500', flag: '🇺🇸', type: 'Index' },
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

  // Smart search state
  const [customSearch, setCustomSearch] = useState('');
  const [customSearching, setCustomSearching] = useState(false);
  const [customResult, setCustomResult] = useState(null);
  const [customError, setCustomError] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);

  const searchInputRef = useRef(null);
  const dropdownRef = useRef(null);
  const suggestTimerRef = useRef(null);

  useEffect(() => { loadMarkets(); }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
    setTimeout(() => document.getElementById('stock-chart-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleRangeChange = (range) => {
    setActiveRange(range);
    if (selectedStock) loadHistory(selectedStock, range);
  };

  // Debounced suggestion fetch
  const fetchSuggestions = useCallback(async (q) => {
    if (!q || q.trim().length < 1) {
      setSuggestions([]);
      setSuggestLoading(false);
      return;
    }
    setSuggestLoading(true);
    const result = await fetchStockSuggest(q.trim());
    setSuggestions(result?.suggestions || []);
    setSuggestLoading(false);
  }, []);

  const handleSearchInput = (e) => {
    const val = e.target.value;
    setCustomSearch(val);
    setCustomError('');
    setCustomResult(null);
    setActiveSuggestion(-1);
    setShowDropdown(true);

    // Debounce
    clearTimeout(suggestTimerRef.current);
    if (val.trim().length >= 1) {
      suggestTimerRef.current = setTimeout(() => fetchSuggestions(val), 280);
    } else {
      setSuggestions([]);
    }
  };

  const handleSearchFocus = () => {
    setShowDropdown(true);
    if (customSearch.trim().length >= 1) {
      fetchSuggestions(customSearch);
    }
  };

  const handleSuggestionClick = (s) => {
    setCustomSearch(s.name);
    setShowDropdown(false);
    setSuggestions([]);
    // Trigger search
    runSearch(s.name);
  };

  const handleQuickPick = (pick) => {
    setCustomSearch(pick.query);
    setShowDropdown(false);
    runSearch(pick.query);
  };

  const runSearch = async (query) => {
    if (!query?.trim()) return;
    setCustomSearching(true);
    setCustomError('');
    setCustomResult(null);
    const result = await fetchStockSearch(query.trim());
    if (result?.found) {
      setCustomResult(result);
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
      setCustomError(result?.message || 'Stock not found. Try a company name like "Reliance", "Apple", or ticker like "IOC.NS".');
    }
    setCustomSearching(false);
  };

  const handleCustomSearch = async (e) => {
    e.preventDefault();
    setShowDropdown(false);
    await runSearch(customSearch);
  };

  // Keyboard nav in dropdown
  const handleKeyDown = (e) => {
    const items = suggestions.length > 0 ? suggestions : (customSearch.trim().length < 1 ? QUICK_PICKS : []);
    if (!showDropdown || items.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestion(prev => Math.min(prev + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestion(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter' && activeSuggestion >= 0) {
      e.preventDefault();
      const item = items[activeSuggestion];
      if (suggestions.length > 0) {
        handleSuggestionClick(item);
      } else {
        handleQuickPick(item);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const filteredData = marketData.filter(s => {
    const matchesCategory = CATEGORY_FILTER[category]?.(s) ?? true;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || (s.name || '').toLowerCase().includes(q) || (s.symbol || '').toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  const color = selectedStock ? (selectedStock.direction === 'up' ? '#10b981' : '#ef4444') : '#8b5cf6';
  const gainers = marketData.filter(s => s.direction === 'up').length;
  const losers = marketData.filter(s => s.direction === 'down').length;

  // Show quick picks OR live suggestions in dropdown
  const showQuickPicks = showDropdown && customSearch.trim().length < 1;
  const showSuggestions = showDropdown && customSearch.trim().length >= 1;

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
          <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>Real-time prices · Search by name or ticker · Click any card for chart</p>
        </div>
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

      {/* ── SMART SEARCH ── */}
      <div style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '18px', padding: '20px 24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <Zap size={14} color="#a855f7" />
          <span style={{ color: '#a855f7', fontSize: '12px', fontWeight: 700, letterSpacing: '1px' }}>SEARCH ANY STOCK</span>
          <span style={{ color: '#475569', fontSize: '11px', marginLeft: '4px' }}>— type a company name or ticker symbol</span>
        </div>

        <form onSubmit={handleCustomSearch} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', position: 'relative' }}>
          {/* Search input + dropdown wrapper */}
          <div ref={dropdownRef} style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search size={14} style={{ position: 'absolute', left: '14px', top: '13px', color: '#64748b', zIndex: 2 }} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="e.g. Indian Oil, Apple, Bitcoin, RELIANCE, IOC..."
              value={customSearch}
              onChange={handleSearchInput}
              onFocus={handleSearchFocus}
              onKeyDown={handleKeyDown}
              autoComplete="off"
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', padding: '11px 14px 11px 38px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
              onMouseEnter={e => e.target.style.borderColor = 'rgba(139,92,246,0.5)'}
              onMouseLeave={e => e.target.style.borderColor = showDropdown ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.12)'}
            />

            {/* ── DROPDOWN ── */}
            {showDropdown && (showQuickPicks || showSuggestions) && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
                background: 'rgba(10,8,30,0.98)', backdropFilter: 'blur(20px)',
                border: '1px solid rgba(139,92,246,0.25)', borderRadius: '14px',
                zIndex: 100, overflow: 'hidden', boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
              }}>
                {/* Quick picks header */}
                {showQuickPicks && (
                  <>
                    <div style={{ padding: '10px 14px 6px', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <Sparkles size={11} color="#a855f7" />
                      <span style={{ color: '#64748b', fontSize: '10px', fontWeight: 700, letterSpacing: '1px' }}>POPULAR STOCKS</span>
                    </div>
                    {QUICK_PICKS.map((pick, i) => (
                      <div
                        key={pick.query}
                        onClick={() => handleQuickPick(pick)}
                        style={{
                          padding: '9px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px',
                          background: activeSuggestion === i ? 'rgba(139,92,246,0.15)' : 'transparent',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => { setActiveSuggestion(i); e.currentTarget.style.background = 'rgba(139,92,246,0.12)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = activeSuggestion === i ? 'rgba(139,92,246,0.15)' : 'transparent'; }}
                      >
                        <span style={{ fontSize: '16px', width: '20px', textAlign: 'center' }}>{pick.flag}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 500 }}>{pick.label}</div>
                        </div>
                        <span style={{ color: '#475569', fontSize: '10px', background: 'rgba(255,255,255,0.05)', padding: '2px 7px', borderRadius: '5px' }}>{pick.type}</span>
                      </div>
                    ))}
                  </>
                )}

                {/* Live suggestions */}
                {showSuggestions && (
                  <>
                    {suggestLoading && (
                      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '12px' }}>
                        <Loader size={12} className="spin" /> Searching...
                      </div>
                    )}
                    {!suggestLoading && suggestions.length === 0 && (
                      <div style={{ padding: '12px 14px', color: '#475569', fontSize: '12px' }}>
                        No suggestions — press Search to look up "{customSearch}"
                      </div>
                    )}
                    {!suggestLoading && suggestions.length > 0 && (
                      <>
                        <div style={{ padding: '10px 14px 6px', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          <Search size={10} color="#64748b" />
                          <span style={{ color: '#64748b', fontSize: '10px', fontWeight: 700, letterSpacing: '1px' }}>MATCHES</span>
                        </div>
                        {suggestions.map((s, i) => (
                          <div
                            key={s.symbol}
                            onClick={() => handleSuggestionClick(s)}
                            style={{
                              padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px',
                              background: activeSuggestion === i ? 'rgba(139,92,246,0.15)' : 'transparent',
                              transition: 'background 0.15s',
                            }}
                            onMouseEnter={e => { setActiveSuggestion(i); e.currentTarget.style.background = 'rgba(139,92,246,0.12)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = activeSuggestion === i ? 'rgba(139,92,246,0.15)' : 'transparent'; }}
                          >
                            <span style={{ fontSize: '18px', width: '22px', textAlign: 'center' }}>{s.flag}</span>
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                              <div style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                              <div style={{ color: '#64748b', fontSize: '10px' }}>{s.exchange}</div>
                            </div>
                            <span style={{ color: '#8b5cf6', fontFamily: 'monospace', fontSize: '11px', background: 'rgba(139,92,246,0.12)', padding: '2px 7px', borderRadius: '5px', whiteSpace: 'nowrap' }}>{s.symbol}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={customSearching || !customSearch.trim()}
            style={{ background: customSearching ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.8)', border: 'none', color: '#fff', padding: '11px 22px', borderRadius: '12px', cursor: customSearching ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}
          >
            {customSearching ? <><Loader size={13} className="spin" /> Searching...</> : <><Search size={13} /> Search</>}
          </button>
        </form>

        {/* Error */}
        {customError && (
          <div style={{ marginTop: '12px', padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px' }}>
            <div style={{ color: '#f87171', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>⚠️ {customError}</div>
            <div style={{ color: '#64748b', fontSize: '11px' }}>
              Try clicking a suggestion below, or use exact Yahoo Finance symbols like{' '}
              {['IOC.NS', 'RELIANCE.NS', 'HDFCBANK.NS', 'AAPL', 'BTC-USD'].map(s => (
                <span
                  key={s}
                  onClick={() => { setCustomSearch(s); runSearch(s); }}
                  style={{ color: '#a855f7', cursor: 'pointer', marginLeft: '4px', textDecoration: 'underline', fontFamily: 'monospace' }}
                >{s}</span>
              ))}
            </div>
          </div>
        )}

        {/* Success result */}
        {customResult && !customError && (
          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '10px' }}>
            <span style={{ fontSize: '20px' }}>{customResult.flag}</span>
            <div>
              <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '14px' }}>{customResult.name}</span>
              <span style={{ color: '#64748b', fontSize: '11px', marginLeft: '8px', fontFamily: 'monospace' }}>{customResult.yahoo_symbol}</span>
            </div>
            <span style={{ marginLeft: 'auto', color: '#fff', fontWeight: 700, fontFamily: 'monospace', fontSize: '16px' }}>
              {customResult.price?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span style={{ color: customResult.direction === 'up' ? '#10b981' : '#ef4444', fontWeight: 600, fontSize: '13px' }}>
              {customResult.change_pct > 0 ? '+' : ''}{customResult.change_pct}%
            </span>
          </div>
        )}

        {/* Quick tip chips */}
        <div style={{ marginTop: '12px', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: '#334155', fontSize: '10px', marginRight: '4px' }}>Quick picks:</span>
          {QUICK_PICKS.slice(0, 6).map(pick => (
            <span
              key={pick.query}
              onClick={() => handleQuickPick(pick)}
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '3px 9px', fontSize: '11px', color: '#94a3b8', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '4px' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)'; e.currentTarget.style.color = '#c4b5fd'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#94a3b8'; }}
            >
              {pick.flag} {pick.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── CHART PANEL ── */}
      {selectedStock && (
        <div id="stock-chart-panel" style={{ background: 'rgba(8,5,25,0.85)', backdropFilter: 'blur(16px)', border: `1px solid ${color}33`, borderRadius: '24px', padding: '28px 32px', marginBottom: '28px', animation: 'tooltipFadeIn 0.3s ease', position: 'relative' }}>
          <button onClick={() => setSelectedStock(null)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#64748b', cursor: 'pointer', padding: '4px 8px', display: 'flex', alignItems: 'center' }}>
            <X size={14} />
          </button>

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

            <div style={{ display: 'flex', gap: '6px', background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '10px' }}>
              {RANGES.map(r => (
                <button key={r.key} onClick={() => handleRangeChange(r.key)} style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, background: activeRange === r.key ? color : 'transparent', color: activeRange === r.key ? '#fff' : '#64748b', transition: 'all 0.2s' }}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

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
            <div style={{ height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '10px' }}>
              <div style={{ color: '#64748b', fontSize: '13px' }}>Chart data unavailable for this symbol</div>
              <div style={{ color: '#334155', fontSize: '11px' }}>Try a different time range or check back later</div>
            </div>
          )}
        </div>
      )}

      {/* ── FILTER BAR ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '6px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
          {CATEGORIES.map(c => (
            <button key={c.key} onClick={() => setCategory(c.key)} style={{ padding: '7px 14px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, background: category === c.key ? 'rgba(139,92,246,0.7)' : 'transparent', color: category === c.key ? '#fff' : '#64748b', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span>{c.icon}</span> {c.label}
            </button>
          ))}
        </div>

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

                <div style={{ fontSize: '22px', fontWeight: 800, color: '#fff', marginBottom: '4px', fontFamily: 'monospace', letterSpacing: '-0.5px' }}>
                  {stock.price != null ? stock.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                </div>

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
              <div style={{ fontSize: '12px', marginTop: '8px', color: '#334155' }}>Try the smart search above for any stock</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
