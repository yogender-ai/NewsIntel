# NewsIntel

NewsIntel is a live news-intelligence system. It does not simply show headlines. It fetches fresh articles, removes duplicates, ranks what matters, enriches the strongest stories with AI, scores their urgency, stores a compact dashboard snapshot, and serves the frontend from that snapshot so the dashboard stays fast.

The product is built around one question: "What changed today, and why should I care?" The pipeline turns noisy Google News RSS results into a small set of signals with pulse scores, dimensions, daily deltas, source links, entities, risk/opportunity labels, and an explainable system status.

## What The System Does

The backend runs a controlled news pipeline across the current MVP categories: tech, education, entertainment, and politics. Each cycle fetches real Google News RSS items for those categories, normalizes the URLs and article text, deduplicates near-identical stories, asks an AI model to rank the strongest articles, queues selected items for enrichment, converts enriched articles into dashboard signals, computes pulse metrics, and stores a home snapshot.

The frontend reads that snapshot through the API and renders the World Pulse dashboard:

```text
Google News RSS
  -> normalized article candidates
  -> URL/title/content deduplication
  -> AI ranking
  -> enrichment queue
  -> story summaries, entities, risk, opportunity, graph, pulse
  -> event metrics and daily deltas
  -> home snapshot cache
  -> React dashboard
```

The important performance idea is that the dashboard usually reads cached snapshot data instead of doing the full AI pipeline inside the user's page load. Manual refresh can trigger a fresh run, but normal reads stay quick.

## Pipeline Internals

### 1. Source Collection

NewsIntel uses Google News RSS because it is free, fresh, broad, and easy to query without a paid news API. Each category maps to a richer search query such as global technology, AI, startups, cybersecurity, semiconductors, or global politics and diplomacy. The fetcher adds recency terms like latest, today, and breaking, then requests RSS results with a 24-hour bias.

The RSS stage returns article-like items containing title, summary text, source, published time, category, RSS query, and a Google News URL. When possible, Google News redirect URLs are decoded back to publisher URLs. That matters because deduplication and source display work better with canonical publisher links than with wrapper URLs.

### 2. Normalization

Raw RSS data is messy. Titles may contain source suffixes, summaries may include HTML, URLs may include tracking parameters, and multiple articles may refer to the same story. NewsIntel cleans article text, truncates oversized fields, normalizes URLs, stores canonical URLs, and creates hashes for URL, title, and content.

The pipeline keeps only usable candidates: a candidate needs a title and URL. It also records category and source metadata so later scoring can explain where a signal came from.

### 3. Filtering And Deduplication

The filtering layer exists to prevent repeated headlines from dominating the dashboard. It uses several checks:

- Exact or canonical URL duplicates are rejected.
- Already-seen URLs inside the same run are skipped.
- Recent stored articles are checked before inserting a new one.
- Normalized titles are compared with `SequenceMatcher`; titles above the configured similarity threshold are treated as the same story.
- Content hashes catch cases where the URL changes but the article text is essentially the same.

This means "Company launches AI tool" and "Company launches new AI tool" will collapse into one signal, while unrelated stories in the same category can still pass through.

### 4. AI Ranking

After deduplication, the backend sends a compact JSON list of candidate articles to the model chain. The prompt asks the model to rank articles by importance, freshness, public impact, credibility, category balance, newsworthiness, and long-term relevance. The model must return strict JSON with article indexes, ranks, scores, reasons, and importance levels.

The ranker is deliberately index-based. The model is not allowed to invent stories; it must choose from the supplied article list. The backend validates the returned indexes, removes duplicates, clamps scores, and keeps only the top configured number of stories. These ranked stories are stored and selected for enrichment.

OpenRouter free models are tried first. If one provider/model fails, the client can try the next configured OpenRouter model. Gemini is used as a fallback for synthesis paths. The code also detects quota, token-budget, empty-success, and temporary provider throttling states so the pipeline can defer work instead of repeatedly failing.

### 5. Enrichment Queue

Ranking and enrichment are separated. Ranking chooses what deserves deeper analysis; enrichment turns those selected articles into intelligence cards. The queue gives the system control over cost, provider failures, and retries.

Each queued article is marked pending, running, done, failed, or skipped. If the AI circuit breaker is open, the queue pauses rather than hammering the model provider. Failed enrichment can retry once with a later `next_attempt_at`. After each batch, the home snapshot is rebuilt so the frontend sees the newest stable state.

### 6. Enrichment Output

For each selected story, the AI enrichment prompt asks for compact structured analysis:

- display title
- summary
- why it matters
- entities
- sentiment
- risk level
- opportunity level
- story graph
- confidence explanation
- uncertainty
- pulse-related fields

The backend stores the enriched story and exposes it as a dashboard card. If enrichment is pending or unavailable, the frontend can still show rule-based/cached fields rather than going blank.

### 7. Pulse Score

Pulse is the dashboard's urgency/intensity score. It combines AI importance, freshness, source strength, confidence, and user relevance. In the MVP snapshot, story cards carry `pulse_score`, `exposure_score`, `signal_tier`, and a `pulse_breakdown` so the UI can explain why something is ranked highly.

The signal tier is derived from pulse:

```text
75+  -> CRITICAL
55+  -> SIGNAL
35+  -> WATCH
0-34 -> NOISE
```

The World Pulse value is the weighted average of the strongest current cards. Daily delta compares recent category metric points so the UI can show what changed today and whether each dimension is rising, cooling, or stable.

### 8. SignalRank Local Model

NewsIntel also includes a small local neural model called SignalRank. It is a deterministic multi-layer perceptron used to score story strength without making another remote AI call.

The model turns a story into numeric features:

- source count
- confidence
- freshness inside 6 hours and 24 hours
- velocity
- high or medium risk flags
- high or medium opportunity flags
- negative or mixed sentiment
- entity density
- urgency words such as attack, outage, crisis, recall, strike, probe, surge
- category one-hot features for tech, politics, education, and entertainment

The internal model has one hidden layer with ReLU activations and a sigmoid output. ReLU keeps positive evidence active and zeros out weak evidence. Sigmoid converts the final logit into a 0-1 probability, which becomes a 0-100 signal score. The model can be trained from rows of feature vectors and targets, but it also has seeded weights so predictions work even before a trained JSON model exists.

This local model is useful because it gives NewsIntel a fast, explainable fallback score. The remote LLM supplies semantic judgment and narrative structure; SignalRank supplies cheap repeatable ranking pressure.

## NLP And Model Behavior

The project has two AI layers: the production dashboard pipeline and the Hugging Face NLP space.

### OpenRouter / Gemini

These are used for reasoning-heavy structured outputs. They read compact article metadata and produce rankings or enriched intelligence JSON. They are best suited for tasks that need synthesis: deciding importance, explaining why a story matters, extracting risk/opportunity framing, and building a story graph.

The backend treats model output as untrusted until parsed and validated. JSON fences are stripped, required arrays are checked, scores are clamped, and invalid article references are discarded.

### BERT NER

The Hugging Face space loads `dslim/bert-base-NER` for named entity recognition. BERT reads text through bidirectional self-attention, meaning each token is interpreted using words before and after it. For NER, the model predicts token labels such as person, organization, location, or miscellaneous entity. The pipeline uses aggregation so split wordpieces are merged into cleaner entity spans.

Entities matter because they make a story trackable. "OpenAI", "India", "Nvidia", or "Hanoi" are not just words; they become handles for watchlists, maps, relevance, and story graphs.

### RoBERTa Sentiment

The Hugging Face space loads `cardiffnlp/twitter-roberta-base-sentiment-latest`. RoBERTa is a BERT-family encoder trained with improved masking and larger pretraining. It classifies text into negative, neutral, and positive sentiment. NewsIntel uses this to estimate tone pressure. Negative or mixed sentiment can increase risk features, while positive/mixed framing can support opportunity labels.

### DistilBART Summarization

The Hugging Face space loads `sshleifer/distilbart-cnn-12-6`. BART is an encoder-decoder transformer: the encoder reads the article text, and the decoder generates a shorter summary. The DistilBART version is smaller and cheaper to run on CPU, which makes it practical for a free Hugging Face Space.

Summarization is useful when raw article text is too long for the dashboard. The system truncates long input to avoid CPU/memory pressure and asks the model for a compact news summary.

### Sentence Embeddings

The Hugging Face space also exposes `sentence-transformers/all-MiniLM-L6-v2`. It turns text into a normalized vector. Similar vectors represent semantically similar stories. Embeddings are useful for clustering, personalization, and finding related stories even when they do not share exact words.

## Dashboard Data Flow

The dashboard receives a home snapshot containing clusters, articles, source counts, daily delta, pulse history, world pulse, quick-glance stats, pipeline status, categories, regions, and alerts. The frontend normalizes that payload into UI-friendly structures:

- `worldPulse` drives the large pulse ring.
- `changesToday` powers "What Changed Today".
- `dimensions` powers "Pulse By Dimension".
- `topShifts` powers the top story cards.
- `quickGlance` powers the right-side summary metrics.
- `pipelineStatus` powers the system status panel.

This normalization step lets the UI tolerate missing or partially enriched backend data. If dimensions are not provided directly, they can be derived from daily delta. If pulse history is sparse, the chart still uses available metric points.

## Libraries And Why They Are Used

FastAPI is used because the backend is an async API service. It handles dashboard reads, refresh triggers, story lookup, ask endpoints, watchlist actions, alerts, and health checks cleanly.

SQLAlchemy async is used for database access because the pipeline needs structured persistence for articles, ranked stories, enrichment queue rows, snapshots, metrics, and locks.

Alembic is used for schema migrations so production tables can evolve without manual database surgery.

httpx is used for async HTTP calls to Google News RSS, the AI gateway, OpenRouter, Gemini, and Hugging Face routes.

feedparser is used because Google News is exposed as RSS and feedparser handles RSS/Atom parsing reliably.

googlenewsdecoder is used to turn Google News redirect links into publisher URLs where possible.

cachetools and Redis support caching so expensive reads and AI outputs are not recomputed unnecessarily.

APScheduler is available for scheduled jobs, while the current production path can also use external scheduling.

React is used for the frontend because the dashboard is stateful and component-driven.

Vite is used because it gives fast development builds and simple production bundles.

lucide-react is used for consistent interface icons.

Three.js, React Three Fiber, and Drei are used for the animated background/visual layer.

d3-geo and topojson-client are used for map/geographic views.

Firebase Auth identifies users and lets the frontend attach user identity headers to API requests.

Transformers, Sentence Transformers, and Gradio power the Hugging Face NLP space. Transformers loads the BERT/RoBERTa/BART models; Sentence Transformers creates embeddings; Gradio exposes simple callable model endpoints.

## Reliability Controls

The pipeline has locks for ingestion and enrichment so two cycles do not write over each other. It has an AI circuit breaker so quota or provider failures pause expensive work for a cooldown window. It keeps active home snapshots so the frontend can still load the last known good dashboard. It has cleanup logic for old rows and retention windows. It separates cached reads from manual refresh so the user experience does not depend on a model call finishing in real time.

## Running Locally

Backend:

```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Useful environment values:

```text
DATABASE_URL=postgresql+asyncpg://...
GATEWAY_SECRET=...
GATEWAY_BASE_URL=https://cloud-command.onrender.com/api/gateway
HF_SPACE_URL=YAsh213kadian/News_intel_HF_space_1
NEWSINTEL_CATEGORIES=tech,education,entertainment,politics
NEWSINTEL_ARTICLES_PER_CATEGORY=5
NEWSINTEL_RANK_TOP_N=15
NEWSINTEL_ENRICH_BATCH_SIZE=3
NEWSINTEL_INGEST_INTERVAL_MINUTES=10
```

## Testing

The backend tests cover the controlled MVP pipeline contract, deduplication behavior, AI ranking selection, circuit breaker behavior, SignalRank scoring, snapshot shape, map extraction, and provider fallback handling.

```bash
cd backend
python -m pytest
```

The frontend production bundle can be checked with:

```bash
cd frontend
npm run build
```

## Product Philosophy

NewsIntel is designed to reduce news overload. It filters first, enriches only what survives, explains why a signal appears, and makes the pipeline state visible. The dashboard should feel like an intelligence readout, not a game layer: no XP, levels, missions, or badges are needed for the product to be useful.
