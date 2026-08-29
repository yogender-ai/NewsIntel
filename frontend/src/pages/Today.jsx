import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/auth-context';
import { topicLabel } from '../lib/taxonomy';
import Explain from '../components/Explain';
import Tier from '../components/Tier';
import { Empty, ErrorState, Loading } from '../components/States';

function pulseBand(value) {
  if (value == null) return { label: 'Unknown', cls: 'tag-neutral' };
  if (value >= 76) return { label: 'High pressure', cls: 'tag-critical' };
  if (value >= 56) return { label: 'Elevated', cls: 'tag-signal' };
  if (value >= 31) return { label: 'Normal', cls: 'tag-watch' };
  return { label: 'Calm', cls: 'tag-calm' };
}

function timeAgo(iso) {
  if (!iso) return null;
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (Number.isNaN(diff)) return null;
  if (diff < 90) return 'just now';
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

function StoryCard({ card }) {
  const why = card.why_it_matters || card.impact_line;
  return (
    <article className="story card">
      {card.image_url && (
        <img className="story-img" src={card.image_url} alt="" loading="lazy" />
      )}
      <div className="story-body">
        <div className="row gap-2 wrap story-meta">
          <Tier tier={card.signal_tier} />
          <span className="tag tag-neutral">{topicLabel(card.category)}</span>
          <span className="hint">{card.source_name}</span>
          {timeAgo(card.published_at) && <span className="hint">· {timeAgo(card.published_at)}</span>}
        </div>

        <h3 className="story-title">{card.title}</h3>
        <p className="story-summary">{card.summary}</p>

        {why && (
          <p className="story-why">
            <span className="story-why-label">Why it matters</span>
            {why}
          </p>
        )}

        <div className="row spread gap-3 story-foot">
          <span className="mono hint">
            <Explain topic="pulse">Pulse</Explain> {Math.round(card.pulse_score ?? 0)}
            {' · '}
            <Explain topic="exposure">Exposure</Explain> {Math.round(card.exposure_score ?? 0)}
          </span>
          {card.source_url && (
            <a className="btn btn-sm" href={card.source_url} target="_blank" rel="noopener noreferrer">
              Read source <ExternalLink size={13} aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

export default function Today() {
  const { account, profile } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(true);
  const [topic, setTopic] = useState('all');

  /* `quiet` skips the synchronous busy flip used by the mount effect; the
     initial state is already busy, so flipping it again just causes an extra render. */
  const load = useCallback(async (quiet = false) => {
    if (!quiet) {
      setBusy(true);
      setError(null);
    }
    try {
      const next = await api.snapshot();
      setData(next);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.snapshot().then(
      (next) => { if (!cancelled) { setData(next); setBusy(false); } },
      (err) => { if (!cancelled) { setError(err); setBusy(false); } },
    );
    return () => { cancelled = true; };
  }, []);

  const cards = useMemo(() => data?.feed ?? [], [data]);

  /* Reader's own topics first — the whole point of asking them. */
  const ranked = useMemo(() => {
    const picked = new Set(profile?.topics ?? []);
    if (!picked.size) return cards;
    return [...cards].sort((a, b) => {
      const av = picked.has(a.category) ? 0 : 1;
      const bv = picked.has(b.category) ? 0 : 1;
      return av - bv || (b.pulse_score ?? 0) - (a.pulse_score ?? 0);
    });
  }, [cards, profile]);

  const visible = topic === 'all' ? ranked : ranked.filter((c) => c.category === topic);
  const categories = useMemo(
    () => [...new Set(cards.map((c) => c.category).filter(Boolean))],
    [cards],
  );

  const pulse = data?.world_pulse?.value ?? data?.world_pulse ?? null;
  const band = pulseBand(typeof pulse === 'number' ? pulse : null);
  const firstName = (account?.display_name || '').split(' ')[0];

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>{firstName ? `Good to see you, ${firstName}` : 'Today'}</h1>
          <p className="page-sub">
            {profile?.topics?.length
              ? <>Sorted for your interests: {profile.topics.slice(0, 4).map(topicLabel).join(', ')}
                  {profile.topics.length > 4 ? ` +${profile.topics.length - 4}` : ''}.</>
              : 'Ranked by how much each story is moving right now.'}
          </p>
        </div>
        <button className="btn btn-sm" onClick={load} disabled={busy}>
          <RefreshCw size={14} className={busy ? 'spin' : ''} aria-hidden="true" /> Refresh
        </button>
      </header>

      {typeof pulse === 'number' && (
        <section className="pulse-bar card">
          <div className="pulse-num mono">{Math.round(pulse)}</div>
          <div className="stack">
            <div className="row gap-2">
              <strong><Explain topic="pulse">World Pulse</Explain></strong>
              <span className={`tag ${band.cls}`}>{band.label}</span>
            </div>
            <p className="hint" style={{ margin: 0 }}>
              How loud the news is right now, from the importance of today’s top stories.
              Higher means more is happening at once — not that the news is bad.
            </p>
          </div>
        </section>
      )}

      {categories.length > 1 && (
        <div className="chip-row filter-row" role="group" aria-label="Filter by topic">
          <button className="chip" aria-pressed={topic === 'all'} onClick={() => setTopic('all')}>
            All ({ranked.length})
          </button>
          {categories.map((c) => (
            <button key={c} className="chip" aria-pressed={topic === c} onClick={() => setTopic(c)}>
              {topicLabel(c)}
            </button>
          ))}
        </div>
      )}

      {busy && !data && <Loading label="Loading your briefing" rows={4} />}
      {error && <ErrorState error={error} onRetry={load} title="Couldn’t load your briefing" />}

      {!busy && !error && visible.length === 0 && (
        <Empty
          title="No stories yet"
          hint="The pipeline hasn’t produced a snapshot for these topics yet. Check the Pipeline page to see where it is."
        />
      )}

      <div className="story-grid">
        {visible.map((card) => <StoryCard key={card.id} card={card} />)}
      </div>
    </div>
  );
}
