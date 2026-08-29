# Deploying NewsIntel

Three pieces: **Neon** (Postgres + pgvector), **Render** (FastAPI), **Cloudflare
Pages** (React). All AI inference runs on **Cloudflare Workers AI**.

> **Why the backend is not on Cloudflare.** Workers runs JavaScript, or Python via
> Pyodide. Neither can load `asyncpg`, `psycopg2` or SQLAlchemy, which are native C
> extensions. Moving the API to Workers means rewriting it in TypeScript. The API
> therefore stays on Render and calls Workers AI over REST.

---

## 1. Neon — database

The new tables need the `vector` extension. Run once against the production branch:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Then apply migrations. Render's Dockerfile already runs `alembic upgrade head` on
boot, so a deploy applies `20260830_0013_accounts_and_rag` automatically. To run it
by hand:

```bash
cd backend
DATABASE_URL='postgresql://…neon…/newsintel' alembic upgrade head
```

This creates `accounts`, `account_profiles`, `refresh_sessions`, `signal_feedback`
and `signal_chunks` (with an HNSW vector index and a generated tsvector column).
It does not touch existing tables.

## 2. Cloudflare — API token

Workers AI needs a token with **Workers AI: Read** on your account. The account id
is on the right-hand side of any Cloudflare dashboard page.

Verify a token before using it:

```bash
curl "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT/ai/run/@cf/openai/gpt-oss-120b" \
  -H "Authorization: Bearer $CF_TOKEN" -H 'Content-Type: application/json' \
  -d '{"input":"Reply with exactly: OK"}'
```

A token scoped only to Workers AI cannot list accounts (`/accounts` returns an empty
array) and cannot reach Vectorize. That is expected — vectors live in Neon.

## 3. Render — API

The live service is **`newsintel-3igw`** in the `yogender.aiml@gmail.com` workspace.
`newsintel-xvhe` (the other workspace) is **suspended** and must not be used — it was
what the old `vercel.json` proxied to, which is why the frontend saw 503s.


Set these environment variables on `newsintel-api`:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Neon connection string |
| `REDIS_URL` | Redis instance (pipeline locking) |
| `CLOUDFLARE_ACCOUNT_ID` | your Cloudflare account id |
| `CLOUDFLARE_API_TOKEN` | the Workers AI token |
| `JWT_SECRET` | long random string — **rotating it signs everyone out** |
| `CORS_ALLOWED_ORIGINS` | your Pages URL, if it is not a `*.pages.dev` domain |
| `ENV` | `production` |

`*.pages.dev` is already allowed by the CORS regex, so a default Pages deployment
needs no extra configuration.

The worker (`newsintel-worker`) needs the same variables except `JWT_SECRET`.

## 4. Cloudflare Pages — frontend

```bash
cd frontend
npm ci
npm run build
npx wrangler pages deploy dist --project-name=newsintel
```

Or connect the GitHub repo in the Cloudflare dashboard:

- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Root directory:** `frontend`
- **Environment variable:** `VITE_API_URL=https://newsintel-3igw.onrender.com`

`VITE_API_URL` is read at **build time**, not runtime — changing it requires a
rebuild, not just a restart.

`public/_redirects` rewrites all paths to `index.html` so deep links such as
`/ask` survive a hard refresh.

## 5. First run

The Ask page is empty until the pipeline has indexed something. Trigger a run:

```bash
curl -X POST https://newsintel-3igw.onrender.com/api/admin/ingest-now \
  -H "X-Ingest-Secret: $INGEST_SECRET"
```

Then check `/pipeline` in the app. The `rag_index` stage reports how many passages
were embedded; `/api/ask/corpus` reports the total the answer engine can see.

## Costs

Billed in Cloudflare "neurons". Measured on this deployment:

| Operation | Neurons |
| --- | --- |
| One Ask (embed + rerank + answer) | ~33 |
| Embedding 10 passages | ~0.74 |
| One rerank over 10 candidates | ~0.03 |

The free allowance is 10,000 neurons/day, so roughly 300 questions a day before
paid usage. Generation dominates; retrieval is nearly free.
