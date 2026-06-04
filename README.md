# <p align="center">🛰️ NewsIntel</p>

<p align="center">
  <img src="https://readme-typing-svg.demolab.com?font=Orbitron&weight=800&size=34&duration=2300&pause=700&color=00E5A0&center=true&vCenter=true&width=920&lines=AI+News+Intelligence+Command+Center;Live+RSS+%E2%86%92+Dedupe+%E2%86%92+Rank+%E2%86%92+Enrich+%E2%86%92+Dashboard;World+Pulse+%E2%9C%A6+Orbit+Graph+%E2%9C%A6+Signal+Map;Turn+headlines+into+decision+signals" alt="NewsIntel animated title" />
</p>

<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&height=185&color=0:050811,32:00e5a0,62:8b5cf6,100:38bdf8&text=SIGNAL%20INTELLIGENCE%20COMMAND&fontColor=ffffff&fontAlignY=36&fontSize=36&desc=Ranked%20stories%20%7C%20AI%20briefings%20%7C%20Map%20signals%20%7C%20Orbit%20relationships%20%7C%20What-if%20simulation&descAlignY=60&animation=fadeIn" alt="NewsIntel animated banner" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Active-22c55e?style=for-the-badge" alt="Status Active" />
  <img src="https://img.shields.io/badge/Frontend-React%2019-61DAFB?style=for-the-badge&logo=react&logoColor=06121f" alt="React 19" />
  <img src="https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Database-PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Auth-Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=111827" alt="Firebase" />
  <img src="https://img.shields.io/badge/NLP-Hugging%20Face-FFD21E?style=for-the-badge&logo=huggingface&logoColor=111827" alt="Hugging Face" />
</p>

<p align="center">
  <b>NewsIntel</b> turns noisy live news into ranked, deduplicated, AI-enriched intelligence cards with source traceability, world-pulse scoring, map signals, orbit relationships, watchlists, alerts, and scenario simulation.
</p>

<p align="center">
  <img src="frontend/src/assets/hero.png" alt="NewsIntel dashboard hero" width="880" />
</p>

---

## ✨ The Idea

Most news apps say:

```text
Here are 50 headlines.
```

NewsIntel tries to say:

```text
Here are the stories that matter.
Here is why they matter.
Here is the signal strength.
Here are the sources behind them.
Here is how they connect.
```

The browser does not call RSS feeds or AI directly. The backend prepares intelligence, stores it, caches a dashboard snapshot, and the React app renders it fast.

---

## 🚀 Product Highlights

<table>
  <tr>
    <td width="50%">
      <h3>⚡ World Pulse Dashboard</h3>
      <p>Top signals, pulse scores, exposure scores, daily deltas, briefings, story cards, and transparent pipeline status.</p>
    </td>
    <td width="50%">
      <h3>🧠 AI Ranking + Enrichment</h3>
      <p>Fetches RSS news, removes repeated stories, ranks importance, enriches selected stories, and validates AI JSON before storing.</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>🗺️ Signal Map</h3>
      <p>Turns story cards into regional intensity, high-impact counts, risk counts, and country-level news lookups.</p>
    </td>
    <td width="50%">
      <h3>🪐 Orbit View</h3>
      <p>Visualizes relationships between stories using shared entities, categories, title overlap, sources, pulse, and exposure.</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>🔎 Ask NewsIntel</h3>
      <p>Ask questions against supplied news context and get source-grounded answers instead of generic chatbot guesses.</p>
    </td>
    <td width="50%">
      <h3>🧭 Personal Intelligence</h3>
      <p>Firebase login, onboarding, watchlist, tracked entities, saved threads, alerts, movers, and preference-aware reads.</p>
    </td>
  </tr>
</table>

---

## 🧬 Intelligence Pipeline

```text
Google News RSS
  -> query expansion
  -> RSS parsing
  -> Google URL decoding
  -> URL + title normalization
  -> duplicate filtering
  -> article storage
  -> AI ranking
  -> enrichment queue
  -> AI story enrichment
  -> event metrics
  -> cached home snapshot
  -> React dashboard
```

Core principle:

```text
Do expensive intelligence work in the backend.
Serve fast cached read models to the frontend.
Keep sources attached to every story.
Never invent substitute stories when providers fail.
```

---

## 🧠 Feature Matrix

| Area | What NewsIntel Does |
| --- | --- |
| 📰 Ingestion | Google News RSS fetching, query variants, fresh `when:1d` style searches |
| 🧹 Cleanup | URL normalization, title normalization, content hashes, source cleanup |
| 🧬 Deduplication | URL hash checks, title similarity, recent-window duplicate detection |
| 🏆 Ranking | AI-assisted importance ranking with score clamps and strict JSON validation |
| ✍️ Enrichment | Summary, why-it-matters, entities, sentiment, pulse, exposure, risk |
| ⚡ Snapshotting | Cached `home_snapshots` payload so the frontend loads quickly |
| 🗺️ Map Signals | Regional intensity, country lookups, high-impact and risk counts |
| 🪐 Orbit Graph | Relationship graph based on entities, category, source, and title overlap |
| 🔔 Alerts | Alert rules and unread alert workflow behind feature flags |
| 📬 Digests | Daily digest generation behind feature flags |
| 🧪 Simulation | What-if scenario endpoint for future impact analysis |
| 🧑 Personalization | Firebase user identity, preferences, watchlists, interactions, tracked entities |

---

## 🏗️ Architecture

```text
News-Intel
├── backend
│   ├── main.py                         # FastAPI app and API routes
│   ├── news_fetcher.py                 # RSS fetching and Google News URL decoding
│   ├── hf_client.py                    # AI/provider client helpers
│   ├── app
│   │   ├── core                        # Config, database, cache, CORS
│   │   ├── models/news.py              # Articles, stories, events, alerts, snapshots
│   │   ├── services
│   │   │   ├── mvp_pipeline.py         # Active controlled MVP pipeline
│   │   │   ├── snapshot_read_models.py # Map/orbit read models
│   │   │   ├── custom_signal_rank.py   # Local signal scoring fallback
│   │   │   ├── semantic_clustering.py  # Advanced event clustering
│   │   │   ├── scenario_simulator.py   # What-if simulation
│   │   │   ├── alert_engine.py         # Alerts
│   │   │   └── digest_engine.py        # Digests
│   │   └── workers/ingestion_worker.py # External ingestion worker path
│   └── tests/test_mvp_pipeline.py
│
├── frontend
│   ├── src
│   │   ├── App.jsx                     # Auth, routes, shell, global cursor
│   │   ├── api.js                      # API client
│   │   ├── pages                       # Dashboard, map, orbit, simulator, stories
│   │   ├── components/worldpulse       # Premium dashboard components
│   │   └── context                     # Auth and personalization contexts
│   └── vercel.json
│
├── hf_space                            # Hugging Face NLP Space
└── NEWS_INTEL_FULL_PIPELINE_REPORT.md  # Deep technical report
```

---

## 🛠️ Tech Stack

| Layer | Tools |
| --- | --- |
| Frontend | React 19, Vite 8, React Router 7, Three.js, React Three Fiber, d3-geo, topojson-client, Lucide React |
| Auth | Firebase Google login |
| Backend | FastAPI, Uvicorn, Pydantic Settings, SQLAlchemy, databases, Alembic |
| Data | PostgreSQL, asyncpg, Redis cache optional |
| News | Google News RSS, feedparser, newspaper3k, googlenewsdecoder, HTTPX |
| AI/NLP | OpenRouter model chain, Hugging Face Space, transformers-ready NLP layer |
| Ops | Docker, Vercel frontend, Python backend deployment |
| Tests | pytest pipeline tests |

---

## 🚀 Quick Start

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

For macOS/Linux activation:

```bash
source .venv/bin/activate
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

---

## 🔐 Environment Variables

### Backend: `backend/.env`

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string, asyncpg supported |
| `REDIS_URL` | Optional shared cache/lock store |
| `GATEWAY_SECRET` | Secret for protected gateway calls |
| `GATEWAY_BASE_URL` | Cloud Command gateway base URL when used |
| `INGEST_SECRET` | Protects ingestion endpoints/workflows |
| `ADMIN_SECRET` | Protects admin-only operations |
| `CORS_ALLOWED_ORIGINS` | Allowed frontend origins |
| `NEWSINTEL_CATEGORIES` | MVP categories, default `tech,education,entertainment,politics` |
| `NEWSINTEL_ARTICLES_PER_CATEGORY` | Article target per category |
| `NEWSINTEL_INGEST_INTERVAL_MINUTES` | Ingestion cadence |
| `NEWSINTEL_RANK_TOP_N` | Number of ranked articles kept |
| `NEWSINTEL_ENRICH_BATCH_SIZE` | Number of queued stories enriched per batch |
| `NEWSINTEL_RETENTION_DAYS` | Recent duplicate comparison window |
| `DASHBOARD_CACHE_TTL_SECONDS` | Read-model cache TTL |
| `AI_CIRCUIT_BREAKER_COOLDOWN_MINUTES` | AI failure cooldown window |
| `ENABLE_PERSONALIZATION` | Enables personalization features |
| `ENABLE_WATCHLIST` | Enables watchlist behavior |
| `ENABLE_ALERTS` | Enables alert engine |
| `ENABLE_DIGESTS` | Enables digest generation |
| `ENABLE_COUNTRY_FILTERS` | Enables country-filter features |

### Frontend: `frontend/.env.local`

```text
VITE_API_URL=http://127.0.0.1:8000
```

Firebase values are configured in `frontend/src/firebase.js` or your deployment environment, depending on how you host it.

---

## 🧪 Tests

```bash
cd backend
pytest
```

The main pipeline tests cover:

| Test Area | Why It Matters |
| --- | --- |
| Fetch contract | The MVP pipeline should fetch predictable candidate counts |
| Deduplication | Repeated headlines should not become repeated intelligence cards |
| AI ranking | Ranking output must stay bounded and valid |
| AI circuit breaker | Provider quota/rate-limit failures should degrade safely |
| Enrichment batches | Expensive AI work should be controlled |
| Snapshot shape | Frontend read models must stay stable |
| Map/orbit payloads | Visual intelligence views must have valid data |

---

## 📡 Main API Surface

| Endpoint | Purpose |
| --- | --- |
| `GET /api/home-snapshot` | Fast cached dashboard payload |
| `POST /api/dashboard` | Force dashboard refresh |
| `GET /api/feed` | Paginated story feed |
| `GET /api/story/{story_id}` | Full story detail |
| `POST /api/ask` | Source-grounded question answering |
| `GET /api/orbit` | Relationship graph payload |
| `GET /api/map-signals` | Map intelligence payload |
| `GET /api/map-country-news` | Country-specific signal lookup |
| `POST /api/simulate` | What-if scenario simulation |
| `POST /api/admin/ingest-now` | Admin ingestion trigger |
| `POST /api/admin/enrich-batch` | Admin enrichment trigger |

---

## 🧭 Reliability Rules

```text
Do not invent stories when AI fails.
Keep the latest good snapshot available.
Validate AI JSON before storing it.
Clamp scores into safe ranges.
Keep source URLs attached to story cards.
Deduplicate before enrichment.
Separate ranking from enrichment.
Keep expensive work in the backend.
Expose queue and AI circuit state.
```

---

## 📚 Deep Dive

For the full engineering explanation, including formulas, database tables, dedupe math, map calculations, orbit confidence scoring, and MVP-vs-event-store architecture, read:

[NEWS_INTEL_FULL_PIPELINE_REPORT.md](NEWS_INTEL_FULL_PIPELINE_REPORT.md)

---

## 🌌 Final Signal

<p align="center">
  <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=700&size=22&duration=2200&pause=900&color=FACC15&center=true&vCenter=true&width=900&lines=Raw+headlines+are+noise.;Deduped+stories+are+signals.;Ranked+signals+become+intelligence.;Cached+intelligence+becomes+a+fast+product." alt="NewsIntel final signal animation" />
</p>

```text
Fetch the world.
Remove the noise.
Rank the signal.
Explain the impact.
```

<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&height=130&section=footer&color=0:050811,35:00e5a0,70:8b5cf6,100:38bdf8&animation=twinkling" alt="NewsIntel animated footer" />
</p>
