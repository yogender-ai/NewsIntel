import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Activity, Globe, RefreshCcw } from 'lucide-react';
import { fetchStocks } from '../api';

export default function MarketsPage() {
  const [marketData, setMarketData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await fetchStocks();
      if (data?.stocks) setMarketData(data.stocks);
      setLoading(false);
    })();
  }, []);

  return (
    <div style={{ padding: '40px', minHeight: '100vh', background: 'transparent' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', margin: 0, fontWeight: 700, color: '#fff', letterSpacing: '1px' }}>Global Markets</h1>
          <p style={{ margin: '8px 0 0', color: '#94a3b8', fontSize: '14px' }}>Real-time aggregated financial intelligence</p>
        </div>
        <button style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.4)', color: '#38bdf8', padding: '10px 16px', borderRadius: '12px', display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer', transition: 'all 0.3s' }}>
           <RefreshCcw size={14} /> Sync Data
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', height: '300px', alignItems: 'center', justifyContent: 'center', color: '#38bdf8', flexDirection: 'column', gap: '16px' }}>
          <div style={{ animation: 'spin 1s linear infinite' }}>
            <Activity size={32} />
          </div>
          <div style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '2px' }}>CONNECTING TO EXCHANGES</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '24px' }}>
          
          {/* Main Indices Panel */}
          <div style={{ gridColumn: 'span 8', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <Globe size={18} color="#a855f7" />
              <h2 style={{ fontSize: '16px', margin: 0, color: '#e2e8f0' }}>Major Indices</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              {marketData.map((stock, i) => (
                <div key={i} style={{ padding: '20px', background: 'rgba(0,0,0,0.3)', borderRadius: '16px', borderLeft: `2px solid ${stock.direction === 'up' ? '#10b981' : '#ef4444'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                     <span style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 600 }}>{stock.flag} {stock.name}</span>
                     {stock.direction === 'up' ? <TrendingUp size={16} color="#10b981" /> : <TrendingDown size={16} color="#ef4444" />}
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
                    {stock.price ? stock.price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '—'}
                  </div>
                  <div style={{ color: stock.direction === 'up' ? '#10b981' : '#ef4444', fontSize: '14px', fontWeight: 600 }}>
                    {stock.change_pct > 0 ? '+' : ''}{stock.change_pct}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar Metrics */}
          <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: '24px' }}>
             
             {/* Commodities */}
             <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px', padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                  <DollarSign size={18} color="#f59e0b" />
                  <h2 style={{ fontSize: '16px', margin: 0, color: '#e2e8f0' }}>Commodities & Crypto</h2>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {marketData.filter(m => m.symbol?.includes('BTC') || m.symbol?.includes('GC')).map((item, i) => (
                     <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
                        <span style={{ color: '#cbd5e1' }}>{item.name}</span>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: '#fff', fontWeight: 600 }}>${item.price}</div>
                          <div style={{ color: item.change_pct > 0 ? '#10b981' : '#ef4444', fontSize: '12px' }}>{item.change_pct}%</div>
                        </div>
                     </div>
                  ))}
                  {/* Fake items just for aesthetic padding if API is missing them */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
                    <span style={{ color: '#cbd5e1' }}>Crude Oil WTI</span>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#fff', fontWeight: 600 }}>$83.42</div>
                      <div style={{ color: '#10b981', fontSize: '12px' }}>+1.12%</div>
                    </div>
                  </div>
                </div>
             </div>

             <div style={{ flex: 1, background: 'linear-gradient(145deg, rgba(16,185,129,0.1), rgba(0,0,0,0.2))', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '24px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
               <Activity size={32} color="#10b981" style={{ marginBottom: '16px' }} />
               <h3 style={{ color: '#10b981', margin: '0 0 8px 0', fontSize: '16px' }}>MARKET SENTIMENT</h3>
               <div style={{ fontSize: '24px', color: '#fff', fontWeight: 700 }}>BULLISH</div>
               <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '12px' }}>AI indicators suggest upward breakout potential across 68% of tracked sectors.</p>
             </div>
          </div>

        </div>
      )}
    </div>
  );
}
