import { useState, useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';
import { fetchStocks } from '../api';

export default function StockTicker({ mode = 'all' }) {
  const [stocks, setStocks] = useState([]);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    (async () => {
      const data = await fetchStocks();
      if (data?.stocks) setStocks(data.stocks);
    })();

    const interval = setInterval(async () => {
      const data = await fetchStocks();
      if (data?.stocks) setStocks(data.stocks);
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  if (!stocks.length) return null;

  const filteredStocks = stocks.filter(s => {
    if (mode === 'up') return s.direction === 'up' || (s.change_pct != null && s.change_pct > 0);
    if (mode === 'down') return s.direction === 'down' || (s.change_pct != null && s.change_pct < 0);
    return true;
  });

  // If filtering produces nothing, show all (API may not separate well)
  const displayStocks = filteredStocks.length > 0 ? filteredStocks : stocks;

  // Triple for truly seamless infinite scroll
  const tripled = [...displayStocks, ...displayStocks, ...displayStocks];

  const tickerLabel = mode === 'up' ? '📈 GAINERS' : mode === 'down' ? '📉 LOSERS' : '📊 MARKETS';

  return (
    <div
      className="stock-ticker"
      id="stock-ticker"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="stock-ticker-label">
        <BarChart3 size={10} />
        {tickerLabel}
      </div>
      <div className="stock-ticker-track">
        <div className={`stock-ticker-scroll ${paused ? 'paused' : ''}`}>
          {tripled.map((stock, i) => (
            <div key={i} className={`stock-item ${stock.direction}`}>
              <span className="stock-flag">{stock.flag}</span>
              <span className="stock-name">{stock.name}</span>
              {stock.price ? (
                <>
                  <span className="stock-price">
                    {stock.price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                  <span className={`stock-change ${stock.direction}`}>
                    {stock.direction === 'up' ? (
                      <TrendingUp size={10} />
                    ) : stock.direction === 'down' ? (
                      <TrendingDown size={10} />
                    ) : (
                      <Minus size={10} />
                    )}
                    {stock.change_pct != null ? `${Math.abs(stock.change_pct).toFixed(2)}%` : '—'}
                  </span>
                </>
              ) : (
                <span className="stock-price stock-unavailable">—</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
