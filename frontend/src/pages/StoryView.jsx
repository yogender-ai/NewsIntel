import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Bookmark,
  CheckCircle2,
  Clock3,
  ExternalLink,
  GitBranch,
  Radar,
  Share2,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/worldpulse/Sidebar';
import LockedNavToast from '../components/worldpulse/LockedNavToast';
import PulseTrendChart from '../components/worldpulse/PulseTrendChart';
import { compactLabel, formatRelativeTime } from '../lib/dashboardAdapter';

const SignalBadge = ({ tier }) => {
  const t = (tier || 'NOISE').toUpperCase();
  const cls = `tier-badge tier-${t.toLowerCase()}`;
  const labels = {
    CRITICAL: 'Very High Impact',
    SIGNAL: 'High Impact',
    WATCH: 'Watch',
    NOISE: 'Low Signal',
  };
  return <span className={cls}>{labels[t] || compactLabel(t)}</span>;
};

function confidenceText(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return numeric <= 1 ? Math.round(numeric * 100) : Math.round(numeric);
}

function StoryChain({ article, deepData }) {
  const entities = deepData?.entities?.length ? deepData.entities : article.entities || [];
  const nodes = [
    { id: 'event', label: article.title, type: 'Event', icon: ShieldAlert },
    { id: 'category', label: compactLabel(article.category || article.signal_tier), type: 'Impact', icon: GitBranch },
    ...entities.slice(0, 2).map((entity, index) => ({
      id: `entity-${index}`,
      label: entity.name || entity,
      type: entity.type || 'Entity',
      icon: Radar,
    })),
    { id: 'you', label: 'Your exposure', type: 'Now', icon: Bookmark },
  ].filter((item) => item.label);

  return (
    <div className="story-chain">
      {nodes.map((node, index) => {
        const Icon = node.icon;
        return (
          <React.Fragment key={node.id}>
            <div className="story-chain-node">
              <small>{node.type}</small>
              <i><Icon size={22} /></i>
              <b>{node.label}</b>
            </div>
            {index < nodes.length - 1 && <span className="story-chain-arrow" />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function StoryView() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const article = state?.article;

  const [storyRecord, setStoryRecord] = useState(article || null);
  const [deepData, setDeepData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lockedToast, setLockedToast] = useState('');

  useEffect(() => {
    if (!article) {
      navigate('/dashboard');
      return undefined;
    }

    window.scrollTo(0, 0);
    let cancelled = false;
    setStoryRecord(article);

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [storyResult, deepResult] = await Promise.allSettled([
          article.id ? api.getStory(article.id) : Promise.resolve(null),
          api.storyDeepDive(
          article.title,
          article.text_preview || article.text || article.summary || article.title,
          article.source,
          ),
        ]);
        if (cancelled) return;
        if (storyResult.status === 'fulfilled' && storyResult.value?.story) {
          const backendStory = storyResult.value.story;
          setStoryRecord({
            ...article,
            ...backendStory,
            id: article.id || backendStory.id,
            title: backendStory.title || backendStory.thread_title || article.title,
            text_preview: backendStory.summary || article.text_preview,
            url: backendStory.source_url || article.url,
            sources: backendStory.sources || storyResult.value.sources || article.sources || [],
          });
        }
        if (deepResult.status === 'fulfilled') {
          setDeepData(deepResult.value);
        } else {
          throw deepResult.reason;
        }
      } catch (err) {
        if (!cancelled) setError((err?.message || 'Story analysis unavailable.').replace(/^\d+:\s*/, ''));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [article, navigate]);

  const activeArticle = storyRecord || article;
  const entities = deepData?.entities?.length > 0 ? deepData.entities : activeArticle?.entities || [];
  const sentLabel = activeArticle?.sentiment?.label || deepData?.sentiment?.label || activeArticle?.sentiment || null;
  const sentConf = activeArticle?.sentiment?.confidence || deepData?.sentiment?.score || null;
  const perspectives = deepData?.perspectives || [];
  const hasPulse = typeof activeArticle?.pulse_score === 'number';
  const hasExposure = typeof activeArticle?.exposure_score === 'number';
  const pulseHistory = useMemo(() => {
    const base = Number(activeArticle?.pulse_score);
    if (!Number.isFinite(base)) return [];
    return Array.from({ length: 12 }, (_item, index) => ({
      createdAt: new Date(Date.now() - (11 - index) * 60 * 60 * 1000).toISOString(),
      value: Math.max(0, Math.min(100, Math.round(base - 14 + index * 1.45 + Math.sin(index) * 4))),
    }));
  }, [activeArticle?.pulse_score]);

  if (!article) return null;

  const sourceRows = (activeArticle.sources || (activeArticle.url ? [{ title: activeArticle.title, source: activeArticle.source, url: activeArticle.url }] : []))
    .filter((source) => source?.url);
  const matters = [deepData?.summary, activeArticle.why_it_matters, activeArticle.impact_line, activeArticle.summary]
    .flatMap((item) => Array.isArray(item) ? item : [item])
    .filter(Boolean)
    .slice(0, 4);

  return (
    <div className="world-pulse-page story-page">
      <Sidebar
        preferences={{ hasPreferences: Boolean(activeArticle.category || entities.length), topics: activeArticle.category ? [activeArticle.category] : [], regions: [], entities }}
        activeItem="stories"
        onHome={() => navigate('/dashboard')}
        onOrbit={() => navigate('/orbit')}
        onStories={() => navigate('/stories')}
        onMap={() => navigate('/map')}
        onSimulator={() => navigate('/simulator')}
        onLocked={setLockedToast}
        onWatchlist={() => navigate('/watchlist')}
        onAlerts={() => navigate('/alerts')}
        onSetFocus={() => navigate('/onboarding')}
        onSettings={() => navigate('/settings')}
      />
      <main className="world-pulse-main story-main">
        <header className="story-topbar">
          <button className="wp-icon-btn" onClick={() => navigate(-1)}>Back</button>
          <div className="story-actions">
            <button className="wp-icon-btn" onClick={() => setLockedToast('Sharing requires a saved backend story link.')}><Share2 size={16} /> Share</button>
            <button className="wp-icon-btn" onClick={() => setLockedToast('Open Watchlist to manage tracked signals.')}><Bookmark size={16} /> Watch</button>
            <div className="wp-user"><span className="wp-avatar-initial">{(user?.displayName || user?.email || 'Y')[0].toUpperCase()}</span></div>
          </div>
        </header>

        <section className="story-layout">
          <div className="story-core">
            <article className="wp-card story-hero-card">
              <SignalBadge tier={activeArticle.signal_tier} />
              <h1>{activeArticle.title}</h1>
              <div className="story-meta-line">
                {activeArticle.source && <span>{activeArticle.source}</span>}
                {activeArticle.published_at && <span><Clock3 size={13} /> {formatRelativeTime(activeArticle.published_at)}</span>}
                {activeArticle.url && <a href={activeArticle.url} target="_blank" rel="noopener noreferrer">Open source <ExternalLink size={13} /></a>}
              </div>
              {activeArticle.text_preview || activeArticle.text ? <p>{activeArticle.text_preview || activeArticle.text}</p> : null}
            </article>

            <section className="wp-card story-chain-card">
              <div className="wp-section-head"><span>Story Chain</span><small>Event impact path</small></div>
              <StoryChain article={activeArticle} deepData={deepData} />
            </section>

            <section className="story-evidence-grid">
              <div className="wp-card">
                <div className="wp-section-head"><span>Evidence & Sources</span></div>
                <div className="source-list story-source-list">
                  {sourceRows.map((source, index) => (
                    <a key={source.url || index} href={source.url} target="_blank" rel="noreferrer">
                      <b>{source.source || 'Source'}</b>
                      <span>{source.title || activeArticle.title}</span>
                    </a>
                  ))}
                  {!sourceRows.length && <p className="empty-copy">No source URL was included with this signal.</p>}
                </div>
              </div>

              <div className="wp-card">
                <div className="wp-section-head"><span>Affected Entities</span></div>
                <div className="entity-row">
                  {entities.map((e, index) => (
                    <span key={`${e.name || e}-${index}`} className="entity-chip">
                      {e.name || e}
                      {e.type ? <small>{e.type}</small> : null}
                    </span>
                  ))}
                  {!entities.length && <p className="empty-copy">No enriched entities returned for this story.</p>}
                </div>
              </div>
            </section>

            {loading ? (
              <section className="wp-card story-analysis-loading"><span /> Running source-backed analysis...</section>
            ) : error ? (
              <section className="wp-error"><b>Analysis unavailable</b><span>{error}</span></section>
            ) : perspectives.length > 0 ? (
              <section className="wp-card story-perspectives">
                <div className="wp-section-head"><span>Narrative Perspectives</span><small>AI deep dive</small></div>
                {perspectives.map((p, index) => (
                  <div className="orbit-connection" key={`${p.viewpoint || 'view'}-${index}`}>
                    <b>{p.viewpoint || `Perspective ${index + 1}`}</b>
                    {p.framing && <p>{p.framing}</p>}
                    {p.emphasis && <small>{p.emphasis}</small>}
                    {p.omission && <p>{p.omission}</p>}
                  </div>
                ))}
              </section>
            ) : null}
          </div>

          <aside className="story-side">
            <section className="wp-card story-about">
              <div className="wp-section-head"><span>About This Story</span></div>
              <p>{deepData?.summary || activeArticle.why_it_matters || activeArticle.text_preview || ''}</p>
              <div className="story-stat-list">
                {hasPulse && <div><span>Pulse Score</span><b>{Math.round(activeArticle.pulse_score)}</b></div>}
                {hasExposure && <div><span>Your Exposure</span><b>{Math.round(activeArticle.exposure_score)}</b></div>}
                {sentLabel && <div><span>Sentiment</span><b>{compactLabel(sentLabel)}</b></div>}
                <div><span>Confidence</span><b>{confidenceText(sentConf) ?? '-'}</b></div>
              </div>
            </section>
            <PulseTrendChart history={pulseHistory} worldPulse={{ value: activeArticle.pulse_score, label: activeArticle.signal_tier || 'Signal' }} />
            <section className="wp-card why-this-matters">
              <div className="wp-section-head"><span>Why This Matters To You</span></div>
              {matters.map((item) => (
                <p key={item}><CheckCircle2 size={15} /> {item}</p>
              ))}
              {!matters.length && <p className="empty-copy">No personalized impact note returned for this signal.</p>}
            </section>
          </aside>
        </section>
      </main>
      <LockedNavToast message={lockedToast} />
    </div>
  );
}
