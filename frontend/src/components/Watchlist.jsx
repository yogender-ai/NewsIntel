import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const MOCK_WATCHLIST = [
  { symbol: 'BEMARTNUSD', name: 'BEMARK CEN', price: '5,301ML', change: '+2.31', direction: 'up' },
  { symbol: 'COUP', name: 'COUP', price: '53,516', change: '-1.8', direction: 'down' },
  { symbol: 'PLAT', name: 'PLAT', price: '+DS', change: '+16%', direction: 'up' },
  { symbol: 'SUE', name: 'SUE', price: '96.65', change: '-2.11%', direction: 'down' },
];

export default function Watchlist({ stocks = null }) {
  const displayStocks = stocks || MOCK_WATCHLIST;

  return (
    <div className="watchlist-panel">
      <div className="watchlist-header">
        <span>WATCHLIST</span>
      </div>

      <div className="watchlist-list">
        {displayStocks.map((stock, idx) => (
          <div key={idx} className="watchlist-item">
            <div className="watchlist-item-info">
              <span className="watchlist-symbol">{stock.symbol}</span>
              <span className="watchlist-name">{stock.name}</span>
            </div>
            <div className="watchlist-item-price">
              <span className="watchlist-price">{stock.price}</span>
              <span className={`watchlist-change ${stock.direction}`}>
                {stock.direction === 'up' ? <TrendingUp size={10} /> : stock.direction === 'down' ? <TrendingDown size={10} /> : <Minus size={10} />}
                {stock.change}
              </span>
            </div>
            {/* Mini sparkline */}
            <div className="watchlist-sparkline">
              <svg viewBox="0 0 60 20" className="watchlist-spark-svg">
                <polyline
                  fill="none"
                  stroke={stock.direction === 'up' ? '#34d399' : '#f43f5e'}
                  strokeWidth="1.5"
                  points={Array.from({ length: 12 }, (_, i) => {
                    const x = (i / 11) * 58 + 1;
                    const y = stock.direction === 'up'
                      ? 18 - (i / 11) * 14 + Math.random() * 4
                      : 4 + (i / 11) * 14 + Math.random() * 4;
                    return `${x},${Math.max(1, Math.min(19, y))}`;
                  }).join(' ')}
                />
              </svg>
            </div>
          </div>
        ))}
      </div>

      <div className="watchlist-total">
        <span>5,007§</span>
      </div>
    </div>
  );
}
