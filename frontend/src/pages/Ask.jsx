import { useEffect, useState } from 'react';
import { ChevronDown, ExternalLink, Search, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/auth-context';
import Explain from '../components/Explain';
import { ErrorState } from '../components/States';

const EXAMPLES = [
  'Why might shipping costs into Europe rise this year?',
  'What is changing in AI chip supply?',
  'Which regulations are about to affect importers?',
];

const STEP_COPY = {
  embed_query: 'Turned your question into a vector so we can search by meaning, not just words.',
  vector_search: 'Found passages whose meaning is closest to your question.',
  lexical_search: 'Separately searched for your actual keywords, to catch names and numbers that meaning-search blurs.',
  fuse_rrf: 'Merged both result lists into one ranking.',
  rerank: 'Re-read each candidate alongside your question and scored how well it actually answers it.',
  filter: 'Dropped weak matches and kept one passage per story.',
  generate: 'Wrote the answer using only the passages that survived.',
  halt: 'Stopped early — nothing relevant enough was found.',
};

/* Renders [S1] markers as links to the matching source. */
function AnswerText({ text, onJump }) {
  const parts = String(text || '').split(/(\[S\d+\])/g);
  return (
    <p className="answer-text">
      {parts.map((part, i) => {
        const m = part.match(/^\[S(\d+)\]$/);
        if (!m) return <span key={i}>{part}</span>;
        return (
          <button key={i} className="cite" onClick={() => onJump(Number(m[1]))} title={`Jump to source ${m[1]}`}>
            {m[1]}
          </button>
        );
      })}
    </p>
  );
}

function Trace({ trace }) {
  const [open, setOpen] = useState(false);
  if (!trace?.steps?.length) return null;

  return (
    <section className="trace card">
      <button className="trace-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>
          <strong>How this answer was found</strong>
          <span className="hint">
            {' '}{trace.steps.length} steps · {trace.total_ms}ms ·{' '}
            {trace.total_neurons} <Explain topic="neurons">neurons</Explain>
          </span>
        </span>
        <ChevronDown size={16} className={open ? 'rot' : ''} aria-hidden="true" />
      </button>

      {open && (
        <ol className="trace-list">
          {trace.steps.map((s) => (
            <li key={s.step}>
              <div className="trace-row">
                <span className="trace-n mono">{s.step}</span>
                <div className="grow">
                  <div className="row spread gap-2">
                    <strong className="mono">{s.name}</strong>
                    <span className="hint mono">{s.elapsed_ms}ms</span>
                  </div>
                  <p className="hint trace-copy">{STEP_COPY[s.name] || ''}</p>
                  <div className="trace-facts">
                    {Object.entries(s)
                      .filter(([k]) => !['step', 'name', 'elapsed_ms', 'top'].includes(k))
                      .map(([k, v]) => (
                        <span key={k} className="fact mono">
                          {k}: <b>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</b>
                        </span>
                      ))}
                  </div>
                  {Array.isArray(s.top) && s.top.length > 0 && (
                    <ul className="trace-top">
                      {s.top.map((t, i) => (
                        <li key={i}>
                          <span className="mono">{t.score}</span> {t.title}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default function Ask() {
  const { profile } = useAuth();
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [corpus, setCorpus] = useState(null);

  useEffect(() => { api.askCorpus().then(setCorpus).catch(() => {}); }, []);

  const submit = async (e) => {
    e?.preventDefault();
    const q = question.trim();
    if (q.length < 3) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await api.ask(q));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const jump = (n) => {
    document.getElementById(`src-${n}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const empty = corpus && corpus.chunks === 0;

  return (
    <div className="page page-narrow">
      <header className="page-head">
        <div>
          <h1>Ask the news</h1>
          <p className="page-sub">
            Answers come only from stories NewsIntel has actually indexed, with a citation
            on every claim. If the archive can’t answer, it says so instead of guessing.
          </p>
        </div>
      </header>

      <form onSubmit={submit} className="ask-form card">
        <label className="sr-only" htmlFor="q">Your question</label>
        <div className="ask-input-row">
          <Search size={17} className="ask-icon" aria-hidden="true" />
          <input
            id="q" className="ask-input" value={question} placeholder="Ask anything about the news…"
            onChange={(e) => setQuestion(e.target.value)}
          />
          <button className="btn btn-primary" type="submit" disabled={busy || question.trim().length < 3}>
            {busy ? 'Searching…' : 'Ask'}
          </button>
        </div>
        <div className="ask-examples">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className="chip chip-sm" onClick={() => setQuestion(ex)}>
              {ex}
            </button>
          ))}
        </div>
      </form>

      {corpus && (
        <p className="hint corpus-line">
          Searching {corpus.chunks.toLocaleString()} passages from{' '}
          {corpus.signals_indexed.toLocaleString()} stories · embeddings by{' '}
          <span className="mono">{corpus.embed_model}</span>
        </p>
      )}

      {empty && (
        <div className="notice card" role="status">
          <strong>The archive is empty.</strong>
          <p className="hint" style={{ margin: 0 }}>
            No stories have been indexed yet, so there is nothing to search. Run the
            pipeline and the <span className="mono">rag_index</span> stage will fill this.
          </p>
        </div>
      )}

      {busy && (
        <div className="card ask-thinking" role="status" aria-live="polite">
          <Sparkles size={16} className="pulse-icon" aria-hidden="true" />
          Searching the archive, then reading the best passages…
        </div>
      )}

      {error && <ErrorState error={error} onRetry={submit} title="Couldn’t answer that" />}

      {result && (
        <>
          {result.status === 'no_results' ? (
            <div className="notice card" role="status">
              <strong>No relevant coverage found.</strong>
              <p className="hint" style={{ margin: 0 }}>{result.answer}</p>
            </div>
          ) : (
            <section className="answer card">
              <AnswerText text={result.answer} onJump={jump} />

              {result.personal_impact && (
                <div className="for-you">
                  <span className="for-you-label">What this means for you</span>
                  <p>{result.personal_impact}</p>
                </div>
              )}

              {!result.personal_impact && !profile?.occupation && (
                <p className="hint for-you-hint">
                  Add your job in Settings and answers will also explain what each story
                  means for your work specifically.
                </p>
              )}
            </section>
          )}

          {result.sources?.length > 0 && (
            <section className="sources">
              <h2 className="sources-head">
                Sources <span className="hint">({result.sources.length})</span>
              </h2>
              {result.sources.map((s) => (
                <article className="source card" key={s.n} id={`src-${s.n}`}>
                  <div className="row spread gap-2">
                    <span className="source-n mono">S{s.n}</span>
                    <span className="hint mono">
                      <Explain topic="rerank">match</Explain>{' '}
                      {s.scores.rerank != null ? s.scores.rerank.toFixed(4) : '—'}
                    </span>
                  </div>
                  <h3 className="source-title">{s.title}</h3>
                  <p className="source-passage">“{s.passage}”</p>
                  <div className="row spread gap-2 wrap">
                    <span className="hint">
                      {s.source}{s.published ? ` · ${new Date(s.published).toLocaleDateString()}` : ''}
                    </span>
                    {s.url && (
                      <a className="btn btn-sm" href={s.url} target="_blank" rel="noopener noreferrer">
                        Open <ExternalLink size={12} aria-hidden="true" />
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </section>
          )}

          <Trace trace={result.trace} />
        </>
      )}
    </div>
  );
}
