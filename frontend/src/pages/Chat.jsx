import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, Plus, Square } from 'lucide-react';
import { api } from '../lib/api';
import { ErrorState } from '../components/States';

const STORE_KEY = 'ni_chat_history';
const MODEL_KEY = 'ni_chat_model';

const SHORT_NAME = (id) =>
  id.replace(/^@cf\//, '').replace(/-instruct.*$/, '').replace(/-fp8-fast$/, '');

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch { return []; }
}
function saveHistory(msgs) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(msgs.slice(-40))); } catch { /* ignore */ }
}

const SUGGESTIONS = [
  'Explain how vector search actually works',
  'Write a Python script to rename files by date',
  'What should I ask a landlord before signing a lease?',
];

export default function Chat() {
  const [messages, setMessages] = useState(loadHistory);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [models, setModels] = useState([]);
  const [model, setModel] = useState(() => {
    try { return localStorage.getItem(MODEL_KEY) || ''; } catch { return ''; }
  });
  const abortRef = useRef(null);
  const bottomRef = useRef(null);
  const taRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    api.chatModels().then(
      (d) => {
        if (cancelled) return;
        setModels(d.models || []);
        setModel((m) => m || d.default);
      },
      () => {},
    );
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { saveHistory(messages); }, [messages]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streaming]);
  useEffect(() => { if (model) { try { localStorage.setItem(MODEL_KEY, model); } catch { /* ignore */ } } }, [model]);

  const send = useCallback(async (text) => {
    const content = (text ?? input).trim();
    if (!content || streaming) return;

    const next = [...messages, { role: 'user', content }];
    setMessages([...next, { role: 'assistant', content: '' }]);
    setInput('');
    setError(null);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await api.chatStream(next, {
        model,
        signal: controller.signal,
        onDelta: (_d, full) => {
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = { role: 'assistant', content: full };
            return copy;
          });
        },
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        // Keep whatever streamed before the stop button was pressed.
      } else {
        setError(err);
        setMessages((prev) => prev.slice(0, -1));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [input, messages, model, streaming]);

  const stop = () => abortRef.current?.abort();
  const reset = () => { setMessages([]); setError(null); saveHistory([]); };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const grow = (e) => {
    setInput(e.target.value);
    const ta = taRef.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`; }
  };

  return (
    <div className="chat-page">
      <header className="chat-head">
        <div>
          <h1>Assistant</h1>
          <p className="page-sub">
            Open-ended chat on Cloudflare Workers AI. Unlike Ask, this is not restricted
            to indexed news — it answers anything, but cannot cite sources.
          </p>
        </div>
        <div className="row gap-2">
          {models.length > 0 && (
            <>
              <label className="sr-only" htmlFor="model">Model</label>
              <select id="model" className="select chat-model" value={model} onChange={(e) => setModel(e.target.value)}>
                {models.map((m) => <option key={m} value={m}>{SHORT_NAME(m)}</option>)}
              </select>
            </>
          )}
          {messages.length > 0 && (
            <button className="btn btn-sm" onClick={reset} title="New conversation">
              <Plus size={14} aria-hidden="true" /> New
            </button>
          )}
        </div>
      </header>

      <div className="chat-log" role="log" aria-live="polite" aria-busy={streaming}>
        {messages.length === 0 && (
          <div className="chat-empty">
            <h2>What do you want to know?</h2>
            <div className="chat-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip" onClick={() => send(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <article key={i} className={`bubble bubble-${m.role}`}>
            <span className="bubble-who">{m.role === 'user' ? 'You' : SHORT_NAME(model || '')}</span>
            <div className="bubble-body">
              {m.content || (streaming && i === messages.length - 1 ? <span className="caret" /> : null)}
              {streaming && i === messages.length - 1 && m.content && <span className="caret" />}
            </div>
          </article>
        ))}
        <div ref={bottomRef} />
      </div>

      {error && <ErrorState error={error} title="The model didn’t respond" />}

      <div className="chat-composer">
        <label className="sr-only" htmlFor="msg">Message</label>
        <textarea
          id="msg" ref={taRef} className="chat-input" rows={1} value={input}
          placeholder="Ask anything…  (Enter to send, Shift+Enter for a new line)"
          onChange={grow} onKeyDown={onKeyDown} disabled={streaming}
        />
        {streaming ? (
          <button className="btn chat-send" onClick={stop} title="Stop generating">
            <Square size={15} aria-hidden="true" />
          </button>
        ) : (
          <button className="btn btn-primary chat-send" onClick={() => send()} disabled={!input.trim()} title="Send">
            <ArrowUp size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
