import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Activity, RefreshCcw, Search, LineChart, Loader } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchStocks, fetchStockHistory } from '../api';

export default function MarketsPage() {
  const [marketData, setMarketData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStock, setSelectedStock] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadMarkets();
  }, []);

  const loadMarkets = async () => {
    setLoading(true);
    const data = await fetchStocks();
    if (data?.stocks) setMarketData(data.stocks);
    setLoading(false);
  };

  const handleStockClick = async (stock) => {
    if (selectedStock?.symbol === stock.symbol) {
      setSelectedStock(null);
      return;
    }
    setSelectedStock(stock);
    setHistoryLoading(true);
    const result = await fetchStockHistory(stock.symbol, '1mo');
    if (result.history) setHistoryData(result.history);
    setHistoryLoading(false);
  };

  const filteredData = marketData.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (s.symbol && s.symbol.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div style={{ padding: '24px 40px 40px', minHeight: '100vh', background: 'transparent' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', margin: 0, fontWeight: 700, color: '#fff', letterSpacing: '1px' }}>Market Intelligence</h1>
          <p style={{ margin: '8px 0 0', color: '#94a3b8', fontSize: '13px' }}>Real-time aggregated analytics & historical trajectory</p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '12px', color: '#64748b' }} />
            <input 
              type="text" 
              placeholder="Search markets..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '10px 10px 10px 36px', color: '#fff', fontSize: '12px', width: '220px', outline: 'none' }}
            />
          </div>
          <button onClick={loadMarkets} style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.4)', color: '#38bdf8', padding: '0 16px', borderRadius: '12px', display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer', outline: 'none' }}>
             <RefreshCcw size={14} /> Sync
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', height: '300px', alignItems: 'center', justifyContent: 'center', color: '#38bdf8', flexDirection: 'column', gap: '16px' }}>
          <div className="spin"><Activity size={32} /></div>
          <div style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '2px' }}>SYNCING GLOBAL EXCHANGES</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* INTERACTIVE CHART SECTION */}
          {selectedStock && (
            <div style={{ background: 'rgba(10,10,15,0.8)', backdropFilter: 'blur(10px)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '24px', padding: '32px', animation: 'tooltipFadeIn 0.3s ease' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                   <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
                     <span style={{ fontSize: '24px' }}>{selectedStock.flag}</span>
                     <h2 style={{ margin: 0, fontSize: '24px', color: '#fff' }}>{selectedStock.name} <span style={{ fontSize: '12px', color: '#94a3b8', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>{selectedStock.symbol}</span></h2>
                   </div>
                   <div style={{ display: 'flex', gap: '12px', alignItems: 'baseline' }}>
                     <span style={{ fontSize: '32px', fontWeight: 700, color: '#fff', fontFamily: 'var(--font-mono)' }}>
                       {selectedStock.price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                     </span>
                     <span style={{ fontSize: '16px', fontWeight: 600, display: 'flex', gap: '4px', alignItems: 'center', color: selectedStock.direction === 'up' ? '#10b981' : '#ef4444' }}>
                        {selectedStock.direction === 'up' ? <TrendingUp size={16}/> : <TrendingDown size={16}/>}
                        {selectedStock.change_pct}% (Today)
                     </span>
                   </div>
                </div>
                <div style={{ background: 'rgba(139,92,246,0.1)', color: '#a855f7', padding: '8px 16px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <LineChart size={14} /> 1 MONTH HISTORY
                </div>
              </div>

              {historyLoading ? (
                 <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6' }}>
                   <Loader className="spin" size={24} />
                 </div>
              ) : historyData.length > 0 ? (
                 <div style={{ height: '300px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={historyData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={selectedStock.direction === 'up' ? '#10b981' : '#ef4444'} stopOpacity={0.4}/>
                          <stop offset="95%" stopColor={selectedStock.direction === 'up' ? '#10b981' : '#ef4444'} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" tick={{fill: '#64748b', fontSize: 10}} tickLine={false} axisLine={false} minTickGap={30} />
                      <YAxis domain={['auto', 'auto']} tick={{fill: '#64748b', fontSize: 10}} tickLine={false} axisLine={false} tickFormatter={(val) => val.toLocaleString()} />
                      <Tooltip 
                        contentStyle={{ background: 'rgba(10,5,25,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                        itemStyle={{ color: selectedStock.direction === 'up' ? '#10b981' : '#ef4444', fontWeight: 700 }}
                        formatter={(value) => [value.toLocaleString(undefined, {minimumFractionDigits:2}), "Price"]}
                      />
                      <Area type="monotone" dataKey="price" stroke={selectedStock.direction === 'up' ? '#10b981' : '#ef4444'} strokeWidth={3} fillOpacity={1} fill="url(#colorPrice)" />
                    </AreaChart>
                  </ResponsiveContainer>
                 </div>
              ) : (
                 <div style={{ height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '13px' }}>
                   Historical data unavailable for this ticker
                 </div>
              )}
            </div>
          )}

          {/* GRID */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
            {filteredData.map((stock, i) => (
              <div 
                key={i} 
                onClick={() => handleStockClick(stock)}
                style={{ 
                  padding: '20px', 
                  background: selectedStock?.symbol === stock.symbol ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.02)', 
                  border: `1px solid ${selectedStock?.symbol === stock.symbol ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.05)'}`,
                  borderRadius: '16px', 
                  cursor: 'pointer',
                  borderLeft: `3px solid ${stock.direction === 'up' ? '#10b981' : '#ef4444'}`,
                  transition: 'all 0.2s ease',
                  transform: selectedStock?.symbol === stock.symbol ? 'translateY(-2px)' : 'none'
                }}
                onMouseOver={(e) => { if(selectedStock?.symbol !== stock.symbol) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                onMouseOut={(e) => { if(selectedStock?.symbol !== stock.symbol) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                     <span style={{ fontSize: '16px' }}>{stock.flag}</span>
                     <span style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: 600 }}>{stock.name}</span>
                   </div>
                   {stock.direction === 'up' ? <TrendingUp size={16} color="#10b981" /> : <TrendingDown size={16} color="#ef4444" />}
                </div>
                <div style={{ fontSize: '26px', fontWeight: 700, color: '#fff', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>
                  {stock.price ? stock.price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '—'}
                </div>
                <div style={{ color: stock.direction === 'up' ? '#10b981' : '#ef4444', fontSize: '13px', fontWeight: 600 }}>
                  {stock.change_pct > 0 ? '+' : ''}{stock.change_pct}%
                </div>
              </div>
            ))}
            {filteredData.length === 0 && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#64748b' }}>No markets found for "{searchQuery}"</div>
            )}
          </div>
          
        </div>
      )}
    </div>
  );
}
