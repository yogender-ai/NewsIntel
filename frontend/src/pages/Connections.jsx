import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { topicLabel } from '../lib/taxonomy';
import Explain from '../components/Explain';
import Tier from '../components/Tier';
import { Empty, ErrorState, Loading } from '../components/States';

/* The previous Orbit page rendered a 3D scene that conveyed no information.
   Stories are grouped into clusters instead: a cluster is a set of stories linked
   by shared entities, which is the thing the graph was trying to show. */
function buildClusters(nodes, edges) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const parent = new Map(nodes.map((n) => [n.id, n.id]));

  const find = (x) => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)));
      x = parent.get(x);
    }
    return x;
  };
  const union = (a, b) => {
    const ra = find(a); const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  edges.forEach((e) => {
    if (byId.has(e.from) && byId.has(e.to)) union(e.from, e.to);
  });

  const groups = new Map();
  nodes.forEach((n) => {
    const root = find(n.id);
    if (!groups.has(root)) groups.set(root, { nodes: [], edges: [] });
    groups.get(root).nodes.push(n);
  });
  edges.forEach((e) => {
    const root = byId.has(e.from) ? find(e.from) : null;
    if (root && groups.has(root)) groups.get(root).edges.push(e);
  });

  return [...groups.values()]
    .map((g) => ({
      ...g,
      nodes: g.nodes.sort((a, b) => (b.pulse ?? 0) - (a.pulse ?? 0)),
      peak: Math.max(...g.nodes.map((n) => n.pulse ?? 0)),
    }))
    .sort((a, b) => b.nodes.length - a.nodes.length || b.peak - a.peak);
}

export default function Connections() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setData(await api.orbit());
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.orbit().then(
      (next) => { if (!cancelled) { setData(next); setBusy(false); } },
      (err) => { if (!cancelled) { setError(err); setBusy(false); } },
    );
    return () => { cancelled = true; };
  }, []);

  const clusters = useMemo(() => {
    if (!data?.nodes) return [];
    return buildClusters(data.nodes, data.edges || []);
  }, [data]);

  const linked = clusters.filter((c) => c.nodes.length > 1);
  const solo = clusters.filter((c) => c.nodes.length === 1);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Connections</h1>
          <p className="page-sub">
            Stories that share companies, people or places are usually one situation
            reported several times. Grouping them shows the situation instead of the noise.
            {' '}<Explain topic="orbit" />
          </p>
        </div>
        <button className="btn btn-sm" onClick={load} disabled={busy}>
          <RefreshCw size={14} className={busy ? 'spin' : ''} aria-hidden="true" /> Refresh
        </button>
      </header>

      {busy && !data && <Loading label="Loading connections" />}
      {error && <ErrorState error={error} onRetry={load} title="Couldn’t load connections" />}

      {!busy && !error && clusters.length === 0 && (
        <Empty title="Nothing to connect yet" hint="Once the pipeline publishes stories, their links appear here." />
      )}

      {linked.length > 0 && (
        <section>
          <h2 className="sources-head">
            Developing situations <span className="hint">({linked.length})</span>
          </h2>
          <div className="cluster-grid">
            {linked.map((c, i) => (
              <article className="cluster card" key={i}>
                <div className="row spread gap-2">
                  <span className="tag tag-neutral">{c.nodes.length} linked stories</span>
                  <span className="mono hint">peak pulse {Math.round(c.peak)}</span>
                </div>
                <ul className="cluster-list">
                  {c.nodes.map((n) => (
                    <li key={n.id}>
                      <Tier tier={n.tier} />
                      <span className="cluster-title">{n.title}</span>
                      <span className="hint">{topicLabel(n.category)}</span>
                    </li>
                  ))}
                </ul>
                {c.edges.length > 0 && c.edges[0].label && (
                  <p className="hint cluster-why">Linked because: {c.edges[0].label}</p>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {solo.length > 0 && (
        <section>
          <h2 className="sources-head">
            Standalone stories <span className="hint">({solo.length})</span>
          </h2>
          <p className="hint" style={{ marginTop: -4 }}>
            No links to anything else we’re tracking right now.
          </p>
          <ul className="solo-list">
            {solo.map((c) => (
              <li key={c.nodes[0].id} className="card solo-item">
                <Tier tier={c.nodes[0].tier} />
                <span className="grow">{c.nodes[0].title}</span>
                <span className="hint mono">{Math.round(c.nodes[0].pulse ?? 0)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
