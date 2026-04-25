import { CircleDot } from 'lucide-react';

export default function FreshnessBadge({ cache }) {
  const stale = cache?.isStale;
  const label = stale ? 'Stale' : cache?.cachedAt ? 'Fresh' : 'Unknown';
  return (
    <div className={`freshness-badge ${stale ? 'stale' : 'fresh'}`}>
      <CircleDot size={9} />
      <span>{label}</span>
      {cache?.cacheAgeSeconds !== null && cache?.cacheAgeSeconds !== undefined && (
        <em>{Math.round(cache.cacheAgeSeconds / 60)}m cache</em>
      )}
    </div>
  );
}

