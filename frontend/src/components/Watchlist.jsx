import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { fetchStocks } from '../api';

// Sparkline mini-chart using real data array
function Sparkline({ prices = [], direction = 'up' }) {
  if (!prices || prices.length < 2) {
    // No data — show flat line (no fake random sparkline)
    const pts = Array.from({ length: 10 }, (_, i) => ({ x: i, y: 10 }));
    return <SparklineSVG pts={pts} direction={direction} />;
  }
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const pts = prices.map((p, i) => ({ x: i, y: 20 - ((p - min) / range) * 18 }));
  return <SparklineSVG pts={pts} direction={direction} />;
}

function SparklineSVG({ pts, direction }) {
  const w = 60;
  const points = pts.map((p, i) => {
    const x = (i / (pts.length - 1)) * (w - 2) + 1;
    return `${x},${Math.max(1, Math.min(19, p.y))}`;
  }).join(' ');
  return (
    <svg viewBox="0 0 60 20" className="watchlist-spark-svg" style={{ width: 60, height: 20 }}>
      <polyline fill="none" stroke={direction === 'up' ? '#34d399' : '#f43f5e'} strokeWidth="1.5" points={points} />
    </svg>
  );
}

// Which stocks the watchlist defaults to (by symbol)
const DEFAULT_WATCHLIST_SYMBOLS = ['SENSEX', 'NIFTY_50', 'INFY', 'IOC', 'BTC-USD'];

export default function Watchlist({ stocks: propStocks = null }) {
  const [watchStocks, setWatchStocks] = useState([]);

  useEffect(() => {
    if (propStocks) {
      setWatchStocks(propStocks);
      return;
    }
    // Fetch live data and filter to default symbols
    (async () => {
      const data = await fetchStocks();
      if (data?.stocks) {
        const filtered = DEFAULT_WATCHLIST_SYMBOLS
          .map(sym => data.stocks.find(s => s.symbol === sym))
          .filter(Boolean);
        setWatchStocks(filtered.length > 0 ? filtered : data.stocks.slice(0, 5));
      }
    })();
  }, [propStocks]);

  const displayStocks = watchStocks;

  return (
    <div className="watchlist-panel">
      <div className="watchlist-header">
        <span>WATCHLIST</span>
      </div>

      <div className="watchlist-list">
        {displayStocks.map((stock, idx) => (
          <div key={idx} className="watchlist-item">
            <div className="watchlist-item-info">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px' }}>{stock.flag}</span>
                <span className="watchlist-symbol">{stock.symbol}</span>
              </div>
              <span className="watchlist-name">{stock.name}</span>
            </div>
            <div className="watchlist-item-price">
              <span className="watchlist-price">
                {stock.price != null ? stock.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
              </span>
              <span className={`watchlist-change ${stock.direction}`}>
                {stock.direction === 'up' ? <TrendingUp size={10} /> : stock.direction === 'down' ? <TrendingDown size={10} /> : <Minus size={10} />}
                {stock.change_pct != null ? `${stock.change_pct > 0 ? '+' : ''}${stock.change_pct}%` : '—'}
              </span>
            </div>
            {/* Mini sparkline */}
            <div className="watchlist-sparkline">
              <Sparkline direction={stock.direction} />
            </div>
          </div>
        ))}
        {displayStocks.length === 0 && (
          <div style={{ padding: '20px', textAlign: 'center', color: '#475569', fontSize: '12px' }}>
            Loading watchlist...
          </div>
        )}
      </div>
    </div>
  );
}
