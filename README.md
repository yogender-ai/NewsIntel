# NewsIntel

NewsIntel is a news intelligence system. In simple words, it takes raw news headlines, removes repeated stories, ranks the important items, asks AI to explain the selected stories, saves the result, and shows a fast dashboard.

It is not only a headline website. A normal news website mostly says:

```text
Here are 50 headlines.
```

NewsIntel tries to say:

```text
Here are the few stories that matter most.
Here is why they matter.
Here is the risk or opportunity.
Here is how strong the signal is.
Here are the sources behind it.
```

The current public dashboard mainly uses the controlled MVP pipeline in:

```text
backend/app/services/mvp_pipeline.py
```

The repo also contains a bigger event-store architecture for future or advanced features like event clustering, alerts, digests, maps, orbit graphs, personalization, and scenario simulation.

## One-Line Summary

NewsIntel turns live RSS news into clean, ranked, AI-enriched, source-traceable intelligence cards and serves them through a fast React dashboard.

## Simple Example First

Imagine Google News returns these headlines:

```text
1. OpenAI launches new education tools - TechCrunch
2. OpenAI launches new education tool - The Verge
3. Election policy talks resume - Reuters
4. Streaming platform releases new movie - Variety
```

NewsIntel does this:

```text
Step 1: Fetch the RSS items.
Step 2: Clean titles, summaries, dates, and URLs.
Step 3: Detect that item 1 and item 2 are almost the same.
Step 4: Keep one clean version.
Step 5: Ask AI to rank the remaining stories.
Step 6: Enrich the top stories with summary, risk, sentiment, entities, pulse, and exposure.
Step 7: Save the final cards in PostgreSQL.
Step 8: Build one cached dashboard snapshot.
Step 9: React frontend reads the snapshot and renders the dashboard.
```

So instead of showing duplicate headlines, the dashboard shows fewer but stronger signals.

## What Problem This Project Solves

Raw news has four common problems:

1. It is repetitive.
2. It is unorganized.
3. It does not explain importance.
4. It is slow and costly if every page load calls AI.

NewsIntel solves this by using a backend pipeline:

```text
Google News RSS
  -> clean article candidates
  -> remove duplicates
  -> store articles
  -> rank with AI
  -> enrich selected stories with AI
  -> store story cards
  -> build cached dashboard snapshot
  -> React frontend displays the snapshot
```

The important idea is this:

```text
The browser does not fetch RSS.
The browser does not call AI directly.
The browser asks the backend for already prepared data.
```

That keeps secrets safe and makes the dashboard faster.

## Current MVP Pipeline

The MVP pipeline is the main active path for the dashboard.

Main file:

```text
backend/app/services/mvp_pipeline.py
```

Main fetcher:

```text
backend/news_fetcher.py
```

Main database models:

```text
backend/app/models/news.py
```

Main API entry:

```text
backend/main.py
```

Main frontend app:

```text
frontend/src/App.jsx
frontend/src/pages/HomePage.jsx
frontend/src/api.js
```

## Big Architecture

```text
User Browser
  |
  | calls API
  v
React Frontend
  |
  | GET /api/home-snapshot
  v
FastAPI Backend
  |
  | reads cached payload
  v
PostgreSQL home_snapshots table
  ^
  |
MVP News Pipeline
  |
  | fetches
  v
Google News RSS
```

The longer internal flow is:

```text
Google News RSS
  -> query generation
  -> RSS parsing
  -> Google News URL decoding
  -> URL normalization
  -> title normalization
  -> duplicate filtering
  -> articles table
  -> AI ranking
  -> ranked_stories table
  -> enrichment_queue table
  -> AI enrichment
  -> stories table
  -> event_metrics table
  -> home_snapshots table
  -> React dashboard
```

## MVP Categories

The controlled MVP categories are:

```text
tech
education
entertainment
politics
```

Default setting:

```text
NEWSINTEL_CATEGORIES=tech,education,entertainment,politics
```

Only these four categories are allowed in the MVP settings. If someone puts an unsupported category in the environment, the settings code filters it out.

Example:

```text
Input env:
NEWSINTEL_CATEGORIES=tech,sports,politics

Allowed MVP result:
tech,politics
```

## Query Generation

The system does not search only for the word `tech` or `politics`. It expands each category into a better Google News query.

Current MVP query mapping:

```text
tech:
global technology AI startups cybersecurity semiconductors

education:
global education universities students exams online learning

entertainment:
global entertainment movies music celebrities streaming

politics:
global politics elections government diplomacy policy
```

Each category also gets query variants:

```text
base query
base query latest
base query today
base query breaking
```

Then `_fetch_rss()` adds:

```text
when:1d
```

That means Google News is biased toward fresh results from the last day.

Example final query:

```text
global technology AI startups cybersecurity semiconductors latest when:1d
```

## Fetch Count Calculation

Default setting:

```text
NEWSINTEL_ARTICLES_PER_CATEGORY=5
```

Default categories:

```text
4 categories = tech, education, entertainment, politics
```

So the target article count per ingestion run is:

```text
target_fetched_articles = category_count * articles_per_category
target_fetched_articles = 4 * 5
target_fetched_articles = 20
```

So the MVP tries to fetch around 20 article candidates per run before deduplication.

Important: after duplicate filtering, the stored count can be lower.

Example:

```text
Fetched candidates = 20
Duplicates removed = 6
Clean stored articles = 14
```

Deduped article calculation:

```text
deduped_count = fetched_count - skipped_duplicate_count
deduped_count = 20 - 6
deduped_count = 14
```

Duplicate rate:

```text
duplicate_rate = skipped_duplicate_count / fetched_count
duplicate_rate = 6 / 20
duplicate_rate = 0.30
duplicate_rate_percent = 30%
```

## RSS Fetching

RSS fetching happens in:

```text
backend/news_fetcher.py
```

The fetcher uses:

```text
httpx
feedparser
googlenewsdecoder
```

Simple explanation:

```text
httpx downloads the RSS XML.
feedparser converts RSS XML into Python entries.
googlenewsdecoder tries to convert Google redirect links into real publisher links.
```

Google News RSS often returns a Google wrapper link. NewsIntel wants the real publisher URL because it is better for:

```text
deduplication
source trust
displaying source links
avoiding repeated Google wrapper URLs
```

Example:

```text
Google wrapper:
https://news.google.com/rss/articles/CBMi...

Decoded publisher URL:
https://www.example.com/news/openai-education-tools
```

## Candidate Article Shape

After RSS parsing, each raw item becomes a `CandidateArticle`.

Important fields:

```text
title
description
url
canonical_url
source
published_at
category
rss_query
content_hash
```

Example candidate:

```json
{
  "title": "OpenAI launches new education tools",
  "description": "The company announced tools for teachers and students.",
  "url": "https://www.example.com/story?utm_source=google",
  "canonical_url": "https://example.com/story",
  "source": "Example News",
  "published_at": "2026-05-13T10:00:00Z",
  "category": "education",
  "rss_query": "global education universities students exams online learning",
  "content_hash": "sha256..."
}
```

## Normalization

Normalization means converting messy input into stable clean values.

The system normalizes:

```text
titles
URLs
summaries
dates
categories
hashes
```

Why normalization is needed:

```text
"OpenAI launches tool - The Verge"
"OpenAI launches tool"
"openai launches tool"
```

These should be treated as very similar, not totally different stories.

## Title Normalization

Title normalization happens in:

```text
backend/app/services/text_fingerprint.py
```

It does these steps:

```text
1. Lowercase the title.
2. Remove a source suffix like " - BBC" when present.
3. Replace punctuation with spaces.
4. Remove common stopwords.
5. Join the remaining words.
```

Stopwords include:

```text
a, an, and, are, as, at, for, from, in, is, of, on, the, to, with
```

Example:

```text
Original:
The OpenAI Education Tool Launches in Schools - The Verge

Lowercase:
the openai education tool launches in schools - the verge

Remove source suffix:
the openai education tool launches in schools

Remove punctuation and stopwords:
openai education tool launches schools
```

So:

```text
normalized_title = "openai education tool launches schools"
```

## URL Normalization

URL normalization happens in:

```text
backend/app/services/url_normalizer.py
```

It does these steps:

```text
1. Trim spaces.
2. Decode URL encoding.
3. Lowercase scheme and host.
4. Remove "www." from host.
5. Remove default ports like 443 for HTTPS.
6. Remove fragments after "#".
7. Remove tracking query parameters.
8. Sort remaining query parameters.
```

Tracking parameters removed include:

```text
utm_source
utm_medium
utm_campaign
utm_term
utm_content
gclid
fbclid
ref
source
```

Example:

```text
Original:
HTTPS://WWW.Example.com/news/story/?utm_source=google&b=2&a=1#comments

Normalized:
https://example.com/news/story?a=1&b=2
```

Why this matters:

```text
https://example.com/story?utm_source=google
https://example.com/story?utm_source=twitter
https://example.com/story
```

All three should usually count as the same article.

## Hashing

The system uses SHA-256 hashes for stable lookup.

URL hash:

```text
url_hash = sha256(canonical_url)
```

Title hash:

```text
title_hash = sha256(normalized_title)
```

Content hash:

```text
cleaned_content = lowercase_and_collapse_spaces(title + description)
content_hash = sha256(first_5000_characters(cleaned_content))
```

Why hash?

```text
Long URLs are awkward to compare and index.
Short hashes are easy to compare.
The database can find duplicates faster.
```

Simple example:

```text
canonical_url = https://example.com/story
url_hash = sha256("https://example.com/story")
```

The actual hash is a long 64-character string.

## Deduplication

Deduplication means removing repeated news.

NewsIntel checks duplicates in multiple ways:

```text
1. Same canonical URL in the same run.
2. Very similar title in the same run.
3. Same URL hash already in the database.
4. Same canonical URL in recent database rows.
5. Very similar title in recent database rows.
```

The recent database window is controlled by:

```text
NEWSINTEL_RETENTION_DAYS=7
```

That means the MVP pipeline compares new candidates against recent articles from the last 7 days.

Retention cutoff formula:

```text
cutoff_time = current_time - retention_days
```

Example:

```text
current_time = 2026-05-13 12:00 UTC
retention_days = 7
cutoff_time = 2026-05-06 12:00 UTC
```

Only recent rows newer than the cutoff are checked for recent-title duplicates.

## Title Similarity Calculation

The MVP duplicate check uses Python `SequenceMatcher` after title normalization.

Formula idea:

```text
title_similarity = SequenceMatcher(normalized_title_a, normalized_title_b).ratio()
```

The default threshold is:

```text
TITLE_SIMILARITY_THRESHOLD=0.86
```

Rule:

```text
if title_similarity >= 0.86:
    treat as duplicate
else:
    treat as different enough
```

Example:

```text
Title A:
OpenAI launches new education tools

Title B:
OpenAI launches new education tool

Similarity:
about 0.86 or higher

Result:
duplicate
```

Different example:

```text
Title A:
Election policy talks resume

Title B:
Streaming platform releases movie

Similarity:
less than 0.86

Result:
not duplicate
```

There is also a helper in `text_fingerprint.py` that combines two signals:

```text
combined_title_similarity = SequenceMatcher_ratio * 0.55 + Jaccard_token_score * 0.45
```

Jaccard token score means:

```text
jaccard = shared_words / total_unique_words
```

Example:

```text
Title A words:
openai, launches, education, tools

Title B words:
openai, launches, education, tool

shared_words = openai, launches, education = 3
total_unique_words = openai, launches, education, tools, tool = 5

jaccard = 3 / 5
jaccard = 0.60
```

## Deduplication Example With Numbers

Suppose one run fetches 8 candidates:

```text
1. OpenAI launches education tools
2. OpenAI launches education tool
3. New AI chip announced
4. New AI chip announced
5. Election talks resume
6. Streaming platform releases film
7. Streaming platform releases movie
8. University exam policy updated
```

Possible dedupe result:

```text
Item 1 kept.
Item 2 skipped because title is too similar to item 1.
Item 3 kept.
Item 4 skipped because same title.
Item 5 kept.
Item 6 kept.
Item 7 maybe kept or skipped depending similarity.
Item 8 kept.
```

If 5 are kept:

```text
fetched_count = 8
deduped_count = 5
skipped_count = 3
duplicate_rate = 3 / 8 = 0.375 = 37.5%
```

## Database Tables In The MVP Path

The main MVP tables are in:

```text
backend/app/models/news.py
```

### articles

Stores clean deduplicated article rows.

Important fields:

```text
id
url
canonical_url
url_hash
title
normalized_title
title_hash
source
published_at
first_seen_at
last_seen_at
content_hash
category
rss_query
text_preview
embedding_json
```

Simple meaning:

```text
One row = one clean article URL/story candidate.
```

### news_cycles

Stores one ingestion run.

Important fields:

```text
started_at
finished_at
status
fetched_count
deduped_count
ranked_count
enriched_count
error_message
```

Simple meaning:

```text
One row = one backend pipeline run.
```

Example:

```json
{
  "status": "RANKED",
  "fetched_count": 20,
  "deduped_count": 14,
  "ranked_count": 15,
  "enriched_count": 3
}
```

### ranked_stories

Stores AI ranking result for a cycle.

Important fields:

```text
cycle_id
article_id
rank_position
ai_score
ai_reason
importance_level
selected_for_enrichment
```

Simple meaning:

```text
This table says which articles AI thought were most important.
```

### enrichment_queue

Stores articles waiting for AI enrichment.

Statuses:

```text
PENDING
RUNNING
DONE
FAILED
SKIPPED
```

Simple meaning:

```text
The ranking step puts selected articles here.
The enrichment step processes them in batches.
```

### stories

Stores final user-facing intelligence cards.

Important fields:

```text
display_title
summary
why_it_matters
entities_json
sentiment
pulse_score
exposure_score
importance_level
risk_level
source_url
source_name
published_at
enriched_at
```

Simple meaning:

```text
One row = one dashboard story card.
```

### event_metrics

Stores score history.

Important fields:

```text
story_id
cycle_id
pulse_score
exposure_score
category
created_at
```

Simple meaning:

```text
This table lets the dashboard show trends and daily changes.
```

### home_snapshots

Stores the final cached dashboard payload.

Important fields:

```text
cycle_id
payload_json
active
created_at
expires_at
```

Simple meaning:

```text
The frontend reads this instead of recomputing everything.
```

### ingestion_locks

Stores locks and AI circuit breaker state.

Important fields:

```text
lock_name
locked_until
locked_by
```

Simple meaning:

```text
This prevents two ingestion jobs from doing the same work at the same time.
```

## Ranking

After deduplication, the backend asks AI to rank articles.

Ranking function:

```text
MVPNewsPipeline.rank_articles()
```

The AI receives compact article metadata:

```text
i = article index
t = title
d = description
s = source
c = category
p = published date
```

Example ranking input:

```json
[
  {
    "i": 0,
    "t": "OpenAI launches new education tools",
    "d": "The company announced tools for teachers.",
    "s": "Example News",
    "c": "education",
    "p": "2026-05-13"
  }
]
```

The AI must return strict JSON:

```json
{
  "ranked": [
    {
      "article_index": 0,
      "rank": 1,
      "score": 92,
      "reason": "major education impact",
      "importance": "HIGH"
    }
  ]
}
```

## Ranking Calculation And Limits

Default setting:

```text
NEWSINTEL_RANK_TOP_N=15
```

The pipeline asks for:

```text
ranked_items_to_return = min(rank_top_n, number_of_articles)
```

Example 1:

```text
rank_top_n = 15
number_of_articles = 20
ranked_items_to_return = min(15, 20) = 15
```

Example 2:

```text
rank_top_n = 15
number_of_articles = 9
ranked_items_to_return = min(15, 9) = 9
```

The backend validates the AI output:

```text
article_index must exist
article_index cannot be repeated
score is clamped to 0-100
importance is normalized
rank is stored as rank_position
```

Score clamp formula:

```text
safe_score = max(0, min(100, ai_score))
```

Example:

```text
AI score = 130
safe_score = max(0, min(100, 130)) = 100

AI score = -5
safe_score = max(0, min(100, -5)) = 0
```

## Why Ranking And Enrichment Are Separate

Ranking is cheaper than full enrichment.

The system first ranks many candidate articles, then enriches only selected ones.

Simple reason:

```text
Do not spend expensive AI work on every headline.
First find the best headlines.
Then enrich the best ones.
```

Example:

```text
Fetched = 20
Deduped = 14
Ranked = 14
Selected top = 15, but only 14 exist
Queued for enrichment = 14
Enrichment batch size = 3
Stories enriched in one batch = 3
Remaining pending = 11
```

## Enrichment

Enrichment turns an article into a story card.

Function:

```text
MVPNewsPipeline.enrich_one()
```

The AI receives:

```text
title
description
source
category
published_at
url
```

The AI must return strict JSON:

```json
{
  "display_title": "OpenAI Adds Classroom Tools",
  "summary": "OpenAI announced tools for teachers and students.",
  "why_it_matters": "Schools may change how they use AI.",
  "entities": ["OpenAI", "teachers", "students"],
  "sentiment": "mixed",
  "pulse_score": 78,
  "exposure_score": 70,
  "importance_level": "HIGH",
  "risk_level": "MEDIUM"
}
```

The backend validates and saves it.

## Enrichment Batch Calculation

Default setting:

```text
NEWSINTEL_ENRICH_BATCH_SIZE=3
```

Formula:

```text
items_processed_this_batch = min(pending_queue_count, enrich_batch_size)
```

Example:

```text
pending_queue_count = 11
enrich_batch_size = 3
items_processed_this_batch = min(11, 3) = 3
remaining_pending = 11 - 3 = 8
```

If the queue has only 2 pending items:

```text
pending_queue_count = 2
enrich_batch_size = 3
items_processed_this_batch = min(2, 3) = 2
remaining_pending = 0
```

## Pulse Score

Pulse score is the story intensity number.

Range:

```text
0 to 100
```

Simple meaning:

```text
0 = weak signal
50 = normal signal
100 = very strong signal
```

In the MVP path, AI proposes the pulse score during enrichment. The backend then clamps it:

```text
pulse_score = max(0, min(100, ai_pulse_score))
```

Example:

```text
AI says pulse_score = 78
stored pulse_score = 78
```

Bad AI output example:

```text
AI says pulse_score = 140
stored pulse_score = 100
```

Another bad AI output example:

```text
AI says pulse_score = -10
stored pulse_score = 0
```

## Exposure Score

Exposure score means how relevant or visible the story is for the dashboard/user context.

Range:

```text
0 to 100
```

In the MVP enrichment path:

```text
exposure_score = max(0, min(100, ai_exposure_score))
```

In some personalized/snapshot paths, exposure can be boosted by profile choices.

Snapshot exposure formula:

```text
score = card.exposure_score or card.relevance_score or 50

if user selected the card category:
    score = score + 10

if user selected global region:
    score = score + 5

final_score = clamp(round(score), 1, 100)
```

Example:

```text
base exposure = 70
user topic includes "tech" = +10
user region includes "global" = +5

final exposure = 70 + 10 + 5 = 85
```

## Personalized Exposure Formula

There is also a profile-based exposure function in `backend/main.py`.

If the user has no topics and no regions:

```text
exposure = 50
```

If the user selected `global` region:

```text
ratio = topic_keyword_hits / total_topic_keywords
exposure = min(100, max(70, int(70 + sqrt(ratio) * 30)))
```

Example:

```text
topic_keyword_hits = 4
total_topic_keywords = 16
ratio = 4 / 16 = 0.25
sqrt(ratio) = 0.5
exposure = 70 + 0.5 * 30
exposure = 85
```

Without global region:

```text
ratio = keyword_hits / total_keywords
exposure = min(100, int(sqrt(ratio) * 100))
```

Small-match rule:

```text
if hits > 0 and exposure < 15:
    exposure = 15
```

That rule prevents a matched story from getting a near-zero score.

## Signal Tier

Signal tier converts pulse into a label.

MVP tier formula:

```text
if pulse_score >= 75:
    tier = CRITICAL
elif pulse_score >= 55:
    tier = SIGNAL
elif pulse_score >= 35:
    tier = WATCH
else:
    tier = NOISE
```

Example:

```text
pulse_score = 82 -> CRITICAL
pulse_score = 64 -> SIGNAL
pulse_score = 42 -> WATCH
pulse_score = 21 -> NOISE
```

## Legacy Composite Signal Tier

Some older/full-dashboard code uses a composite tier calculation:

```text
composite =
    pulse_score * 0.35
  + min(source_count * 12, 100) * 0.15
  + source_diversity * 100 * 0.10
  + sentiment_intensity * 100 * 0.15
  + exposure_score * 0.25
```

Then:

```text
if composite >= 72:
    tier = CRITICAL
elif composite >= 50:
    tier = SIGNAL
elif composite >= 28:
    tier = WATCH
else:
    tier = NOISE
```

Example:

```text
pulse_score = 80
source_count = 3
source_diversity = 0.67
sentiment_intensity = 0.50
exposure_score = 70

composite =
    80 * 0.35
  + min(3 * 12, 100) * 0.15
  + 0.67 * 100 * 0.10
  + 0.50 * 100 * 0.15
  + 70 * 0.25

composite =
    28
  + 36 * 0.15
  + 6.7
  + 7.5
  + 17.5

composite = 28 + 5.4 + 6.7 + 7.5 + 17.5
composite = 65.1

tier = SIGNAL
```

## World Pulse

World Pulse is the dashboard's global pressure number.

In the current MVP snapshot, it is calculated from the top 5 story cards.

Formula:

```text
world_pulse = average(pulse_score of top 5 cards)
```

In code:

```text
world_pulse = sum(top_5_pulse_scores) / number_of_top_cards
```

Example:

```text
Top 5 pulse scores:
82, 77, 70, 64, 57

world_pulse = (82 + 77 + 70 + 64 + 57) / 5
world_pulse = 350 / 5
world_pulse = 70
```

World Pulse label:

```text
if world_pulse >= 76:
    label = High Pressure
elif world_pulse >= 56:
    label = Elevated
elif world_pulse >= 31:
    label = Normal
else:
    label = Calm
```

Example:

```text
world_pulse = 70
label = Elevated
```

## Category Intensity

Each category gets an intensity value.

Formula:

```text
category_intensity = average(pulse_score of cards in that category)
```

Example:

```text
Tech cards:
90, 70, 50

tech_intensity = (90 + 70 + 50) / 3
tech_intensity = 210 / 3
tech_intensity = 70
```

If a category has no cards:

```text
category_intensity = 0
```

## Daily Delta

Daily delta explains what changed compared with the previous metric point.

Function:

```text
MVPNewsPipeline.category_deltas()
```

For each category:

```text
current = latest pulse score for category
previous = pulse score before latest
delta = current - previous
```

Direction:

```text
if delta > 1:
    direction = Rising
elif delta < -1:
    direction = Cooling
else:
    direction = Stable
```

Severity:

```text
if abs(delta) >= 8:
    severity = High
elif abs(delta) >= 2:
    severity = Medium
else:
    severity = Stable
```

Example:

```text
previous = 62
current = 73
delta = 73 - 62
delta = 11

direction = Rising
severity = High
```

Cooling example:

```text
previous = 70
current = 65
delta = -5

direction = Cooling
severity = Medium
```

Stable example:

```text
previous = 70
current = 70.5
delta = 0.5

direction = Stable
severity = Stable
```

## Dashboard Exposure Average

The snapshot also stores an overall exposure score.

Formula:

```text
dashboard_exposure = average(exposure_score of top 5 cards)
```

Example:

```text
Top 5 exposure scores:
90, 80, 70, 65, 55

dashboard_exposure = (90 + 80 + 70 + 65 + 55) / 5
dashboard_exposure = 360 / 5
dashboard_exposure = 72
```

If there are no cards:

```text
dashboard_exposure = 50
```

## Quick Glance Counts

The dashboard snapshot includes quick glance items.

In the MVP snapshot:

```text
Countries in Focus = active region count
Signals = number of cards
Alerts = number of CRITICAL cards
Sources = number of unique source names
```

Example:

```text
cards = 10
critical cards = 2
unique sources = 7
active regions = 1

Quick glance:
Countries in Focus = 1
Signals = 10
Alerts = 2
Sources = 7
```

## Home Snapshot

The frontend reads a cached home snapshot.

Snapshot builder:

```text
MVPNewsPipeline.rebuild_home_snapshot()
```

Snapshot table:

```text
home_snapshots
```

Main endpoint:

```text
GET /api/home-snapshot
```

The snapshot contains:

```text
topStories
feed
categories
pulse
exposure
graph
map
simulatorContext
clusters
articles
topics_used
regions_used
sources_count
pipeline_status
daily_delta
pulse_history
world_pulse
global_pulse
world_pulse_label
quick_glance
exposure_score
next_refresh_at
```

Simple meaning:

```text
The backend prepares one big JSON object.
The frontend renders it quickly.
```

## Snapshot Expiry Calculation

Default ingest interval:

```text
NEWSINTEL_INGEST_INTERVAL_MINUTES=10
```

Snapshot expiry formula:

```text
expires_at = snapshot_created_at + ingest_interval_minutes
```

Example:

```text
snapshot_created_at = 12:00
ingest_interval_minutes = 10
expires_at = 12:10
```

The dashboard can still show the latest good snapshot if fresh AI work is delayed.

## Cache Strategy

NewsIntel uses cache because AI and RSS work can be slow.

Cache types:

```text
RSS cache
AI response cache
dashboard snapshot cache
frontend/session cache
optional Redis cache
```

RSS cache TTL:

```text
90 seconds
```

Dashboard cache TTL setting:

```text
DASHBOARD_CACHE_TTL_SECONDS=600
```

600 seconds calculation:

```text
600 seconds / 60 = 10 minutes
```

Simple reason:

```text
Without cache:
Every user page load could cause RSS fetching and AI calls.

With cache:
Many users can read the same prepared snapshot.
```

## Retention

Retention means how long the system keeps recent pipeline data before cleanup and how far back it looks for recent duplicate checks.

Default:

```text
NEWSINTEL_RETENTION_DAYS=7
```

Retention cutoff:

```text
cutoff = now - 7 days
```

Used for:

```text
recent article duplicate comparison
event metric history
cleanup of old MVP data
snapshot history cleanup
queue cleanup
```

Cleanup includes tables like:

```text
raw_articles
event_metrics
stories
ranked_stories
enrichment_queue
home_snapshots
news_cycles
```

Simple example:

```text
Now = May 13
Retention = 7 days
Cutoff = May 6

Rows older than May 6 can be removed by cleanup.
Rows after May 6 are kept.
```

Why retention matters:

```text
It keeps the database from growing forever.
It keeps dedupe focused on recent news.
It keeps dashboard history useful but not too heavy.
```

## AI Provider Strategy

NewsIntel does not train a huge language model from scratch.

Instead, it uses:

```text
OpenRouter through Cloud Command Gateway
Gemini through the same gateway as fallback
Hugging Face Space for NLP tools in the larger path
local deterministic fallback for embeddings
small local signal-rank model for extra scoring
```

Why this is practical:

```text
Training large models is expensive.
Hosted models are easier for an MVP.
The project can focus on the news pipeline and product behavior.
```

## AI Circuit Breaker

AI providers can fail because of:

```text
quota limits
rate limits
billing errors
temporary provider downtime
token budget problems
empty responses
bad JSON
```

The MVP pipeline has an AI circuit breaker.

Lock name:

```text
ai_circuit_breaker
```

If account quota or serious provider errors happen, the circuit opens for a cooldown period.

Default cooldown:

```text
AI_CIRCUIT_BREAKER_COOLDOWN_MINUTES=10
```

Cooldown formula:

```text
locked_until = current_time + cooldown_minutes
```

Example:

```text
current_time = 12:00
cooldown_minutes = 10
locked_until = 12:10
```

While the circuit is open:

```text
ranking can be deferred
enrichment can be deferred
latest good snapshot remains available
backend avoids repeated failing AI calls
```

This is important because the system should not invent stories when AI fails.

## Local Signal-Rank ML Model

NewsIntel includes a small local neural model.

File:

```text
backend/app/services/custom_signal_rank.py
```

Model version:

```text
newsintel-signalrank-mlp-v1
```

It is a small MLP:

```text
MLP = multilayer perceptron
```

Simple meaning:

```text
It takes numeric features.
It combines them with weights.
It outputs a score from 0 to 100.
```

It does not replace the LLM. It is a fast local helper.

## Signal-Rank Features

The model uses these features:

```text
source_count
confidence
freshness_6h
freshness_24h
velocity
high_risk
medium_risk
high_opportunity
medium_opportunity
negative_or_mixed
entity_density
urgency_terms
technology_topic
politics_topic
education_topic
entertainment_topic
```

Most features are normalized between 0 and 1.

Example:

```text
source_count = 3
source_count_feature = clamp(3 / 5) = 0.60
```

Freshness examples:

```text
age_hours = 2
freshness_6h = clamp(1 - age_hours / 6)
freshness_6h = clamp(1 - 2 / 6)
freshness_6h = 0.667

freshness_24h = clamp(1 - age_hours / 24)
freshness_24h = clamp(1 - 2 / 24)
freshness_24h = 0.917
```

Entity density example:

```text
entities = ["OpenAI", "Microsoft", "Students"]
entity_count = 3
entity_density = clamp(entity_count / 8)
entity_density = 3 / 8
entity_density = 0.375
```

Urgency terms:

```text
urgent_terms_found = count of urgent words in title/summary
urgency_terms = clamp(urgent_terms_found / 3)
```

Example:

```text
Text includes: cyberattack, outage, warning
urgent_terms_found = 3
urgency_terms = clamp(3 / 3) = 1.0
```

## Signal-Rank Math

The model uses one hidden layer.

Step 1:

```text
hidden_raw = input_features * first_layer_weights + first_layer_bias
```

Step 2:

```text
hidden = ReLU(hidden_raw)
```

ReLU means:

```text
ReLU(x) = max(0, x)
```

Example:

```text
ReLU(2.4) = 2.4
ReLU(-0.8) = 0
```

Step 3:

```text
logit = hidden * output_weights + output_bias
```

Step 4:

```text
probability = sigmoid(logit)
```

Sigmoid means:

```text
sigmoid(x) = 1 / (1 + e^(-x))
```

Step 5:

```text
ml_signal_score = round(probability * 100)
```

Example:

```text
probability = 0.73
ml_signal_score = round(0.73 * 100)
ml_signal_score = 73
```

## Signal-Rank Tier

The local ML tier uses these thresholds:

```text
if score >= 78:
    tier = CRITICAL
elif score >= 58:
    tier = SIGNAL
elif score >= 35:
    tier = WATCH
else:
    tier = NOISE
```

Example:

```text
ml_signal_score = 73
ml_signal_tier = SIGNAL
```

## Signal-Rank Confidence

The model also returns a confidence number.

Formula:

```text
confidence = 0.58 + min(trained_examples, 1000) / 1000 * 0.27
```

If no training examples have been used:

```text
trained_examples = 0
confidence = 0.58 + 0 / 1000 * 0.27
confidence = 0.58
```

If 500 training examples have been used:

```text
trained_examples = 500
confidence = 0.58 + 500 / 1000 * 0.27
confidence = 0.58 + 0.135
confidence = 0.715
```

If 1000 or more examples have been used:

```text
trained_examples = 1000
confidence = 0.58 + 1 * 0.27
confidence = 0.85
```

## Signal-Rank Training Target

Training target formula:

```text
objective = clamp(pulse_score / 100)
source_bonus = clamp(source_count / 5) * 0.18
target = clamp(objective * 0.82 + source_bonus + engagement_bonus)
```

Example:

```text
pulse_score = 80
source_count = 3
engagement_bonus = 0.03

objective = 80 / 100 = 0.80
source_bonus = (3 / 5) * 0.18 = 0.108

target = 0.80 * 0.82 + 0.108 + 0.03
target = 0.656 + 0.108 + 0.03
target = 0.794
```

So the training target is about:

```text
0.794
```

That means the model should learn to output around:

```text
79.4 out of 100
```

## Local ML Example

Example story:

```text
Title:
University restores systems after cyberattack outage

Summary:
Canvas outage disrupted student access before services were restored.

Risk:
HIGH

Sentiment:
negative

Category:
education

Entities:
Canvas, Students, University
```

Why the local model gives it a meaningful score:

```text
high_risk = 1
negative_or_mixed = 1
education_topic = 1
entity_density = 3 / 8 = 0.375
urgency_terms includes cyberattack and outage
freshness is high if enriched recently
```

So even without an LLM call, the local model can say:

```text
This is at least a WATCH-level signal.
```

## Map View Calculations

Map data is built from snapshot cards.

File:

```text
backend/app/services/snapshot_read_models.py
```

For each country/region bucket:

```text
avg_pulse = sum(pulse_scores) / event_count
intensity = min(100, round(avg_pulse * 0.72 + min(event_count * 8, 28)))
```

Example:

```text
India has 3 related cards.
pulse scores = 82, 64, 74

avg_pulse = (82 + 64 + 74) / 3
avg_pulse = 220 / 3
avg_pulse = 73.3

event_count_bonus = min(3 * 8, 28)
event_count_bonus = min(24, 28)
event_count_bonus = 24

intensity = min(100, round(73.3 * 0.72 + 24))
intensity = min(100, round(52.8 + 24))
intensity = 77
```

So the map intensity for India is:

```text
77
```

Other map counts:

```text
event_count = number of cards in that region
high_impact_count = number of cards with pulse >= 75
risk_count = number of top cards with medium/high risk
opportunity_count = number of top cards with medium/high opportunity
```

## Orbit View Calculations

Orbit view turns story cards into nodes and relationships.

Node distance formula:

```text
distance = 1 - exposure / 100
```

Example:

```text
exposure = 80
distance = 1 - 80 / 100
distance = 0.20
```

Simple meaning:

```text
Higher exposure means the node appears closer.
Lower exposure means the node appears farther.
```

Node size formula:

```text
size = clamp(round(42 + pulse * 0.28), 24, 76)
```

Example:

```text
pulse = 75
size = round(42 + 75 * 0.28)
size = round(42 + 21)
size = 63
```

## Orbit Edge Confidence

Orbit edges connect related story nodes.

The system adds confidence points:

```text
shared entities:
    + min(0.28 + shared_entity_count * 0.08, 0.58)

same category:
    + 0.24

title token overlap with at least 2 shared tokens:
    + min(0.12 + shared_token_count * 0.03, 0.24)

shared source:
    + 0.08
```

Rule:

```text
if confidence < 0.35:
    do not create edge
else:
    create edge
```

Final cap:

```text
edge_confidence = min(confidence, 0.92)
```

Example:

```text
Story A:
Google to Build AI Data Center in Vizag

Story B:
Google AI Hub in Vizag

Shared entities:
Google, AI, Vizag = 3

Same category:
tech

Shared title tokens:
Google, AI, Vizag = 3

Confidence:
shared_entities = min(0.28 + 3 * 0.08, 0.58) = 0.52
same_category = 0.24
title_overlap = min(0.12 + 3 * 0.03, 0.24) = 0.21

total = 0.52 + 0.24 + 0.21
total = 0.97

edge_confidence = min(0.97, 0.92)
edge_confidence = 0.92
```

So the orbit graph shows a strong relationship.

## Ask NewsIntel

Ask NewsIntel lets a user ask a question.

Endpoint:

```text
POST /api/ask
```

Simple flow:

```text
1. Take the user's question.
2. Search stored stories/articles for matching words.
3. Optionally fetch fresh Google News sources for the question.
4. Deduplicate sources.
5. Send the compact source context to AI.
6. Return an answer with sources.
```

Example question:

```text
What is happening in AI regulation today?
```

The important rule:

```text
Ask mode should answer from supplied news context.
It should not act like a random chatbot with no sources.
```

## Hugging Face NLP Layer

The repo has a Hugging Face Space path:

```text
hf_space/app.py
```

It supports NLP tasks used by the larger architecture.

NLP means:

```text
Natural Language Processing
```

Simple meaning:

```text
Using algorithms or models to understand text.
```

## Summarization Model

Model:

```text
sshleifer/distilbart-cnn-12-6
```

Task:

```text
summarization
```

Simple explanation:

```text
Long article in.
Short summary out.
```

Internal working in simple words:

```text
1. Tokenizer splits text into smaller word pieces.
2. Encoder reads the whole article.
3. Attention helps the model decide which words relate to which other words.
4. Decoder writes a shorter version one token at a time.
5. The output becomes the summary.
```

Example:

```text
Input:
A 900-word article about a university cyberattack.

Output:
University systems were disrupted by a cyberattack, affecting student access before services were restored.
```

## Sentiment Model

Model:

```text
cardiffnlp/twitter-roberta-base-sentiment-latest
```

Task:

```text
sentiment analysis
```

Simple explanation:

```text
It guesses whether text sounds positive, neutral, negative, or mixed.
```

Example:

```text
Text:
Company shares fell after a profit warning.

Likely sentiment:
negative
```

Why not use only keyword counting?

```text
Because news language depends on context.
"Profit rises despite warning" and "profit warning hits shares" are different.
```

## Named Entity Recognition

Model:

```text
dslim/bert-base-NER
```

Task:

```text
named entity recognition
```

Simple explanation:

```text
It finds names of people, organizations, places, and other important things.
```

Example:

```text
Text:
Nvidia and OpenAI announced a partnership in the United States.

Entities:
Nvidia = organization
OpenAI = organization
United States = location
```

Why entities matter:

```text
They help build maps.
They help build orbit relationships.
They help search stored stories.
They help users track companies, people, and places.
```

## Embeddings

Model:

```text
sentence-transformers/all-MiniLM-L6-v2
```

Task:

```text
semantic embeddings
```

Simple explanation:

```text
An embedding turns text into a list of numbers.
Texts with similar meaning should have similar number lists.
```

Example:

```text
"OpenAI launches classroom tools"
"New AI tools released for teachers"
```

These do not have exactly the same words, but the meaning is similar. Embeddings help detect that.

## Cosine Similarity

Embeddings are often compared using cosine similarity.

Simple formula:

```text
cosine_similarity = dot_product(vector_a, vector_b) / (length(vector_a) * length(vector_b))
```

Simple meaning:

```text
1.0 = very similar direction
0.0 = unrelated direction
-1.0 = opposite direction
```

Example:

```text
vector_a = [1, 1]
vector_b = [2, 2]

dot_product = 1*2 + 1*2 = 4
length_a = sqrt(1^2 + 1^2) = sqrt(2)
length_b = sqrt(2^2 + 2^2) = sqrt(8)

cosine_similarity = 4 / (sqrt(2) * sqrt(8))
cosine_similarity = 4 / 4
cosine_similarity = 1.0
```

The direction is the same, so similarity is 1.0.

## Semantic Clustering

The larger event-store path can group articles into real-world events.

Main files:

```text
backend/app/services/semantic_embeddings.py
backend/app/services/semantic_clustering.py
backend/app/services/event_clustering.py
```

Goal:

```text
Decide whether two articles describe the same event.
```

Thresholds from the report:

```text
MERGE_THRESHOLD = 0.86
AMBIGUOUS_THRESHOLD = 0.72
```

Simple rule:

```text
if similarity >= 0.86:
    merge automatically
elif similarity >= 0.72:
    ask AI or use extra validation
else:
    keep separate
```

Example:

```text
Article A:
Google announces AI data center in India.

Article B:
Google plans new AI hub in Vizag.

Similarity:
high

Result:
probably same event or closely related event.
```

## MVP Path vs Event-Store Path

The repo has two architecture levels.

### MVP path

Simple and controlled:

```text
RSS article
  -> Article
  -> RankedStory
  -> EnrichmentQueue
  -> Story
  -> EventMetric
  -> HomeSnapshot
```

Best for:

```text
fast dashboard
clear demo
controlled categories
simple deployment
```

### Event-store path

More advanced:

```text
RawArticle
  -> Article
  -> Event
  -> EventArticle
  -> EventRelationship
  -> Dashboard read model
```

Best for:

```text
grouping many articles into one real event
tracking event relationships
personalized alerts
daily digests
scenario simulation
map/orbit intelligence
```

## Why The Frontend Is Fast

The frontend does not wait for this on page load:

```text
RSS fetch
dedupe
AI ranking
AI enrichment
database writes
snapshot generation
```

Instead, it does this:

```text
GET /api/home-snapshot
render returned JSON
```

That is why the UI can load quickly.

## Frontend Structure

Important frontend files:

```text
frontend/src/App.jsx
frontend/src/api.js
frontend/src/firebase.js
frontend/src/context/AuthContext.jsx
frontend/src/context/PersonalizationContext.jsx
frontend/src/pages/HomePage.jsx
frontend/src/pages/OrbitPage.jsx
frontend/src/pages/MapPage.jsx
frontend/src/pages/SimulatorPage.jsx
frontend/src/pages/StoryView.jsx
frontend/src/pages/AlertsPage.jsx
frontend/src/pages/Settings.jsx
frontend/src/components/worldpulse/*
```

Simple explanation:

```text
React builds the user interface.
React Router changes pages without a full page reload.
Firebase handles Google login.
frontend/src/api.js talks to the backend.
```

When logged in, the frontend can send:

```text
X-User-Id
X-User-Email
```

Those headers help backend personalization features.

## Backend Structure

Important backend files:

```text
backend/main.py
backend/news_fetcher.py
backend/hf_client.py
backend/app/core/config.py
backend/app/core/database.py
backend/app/core/cache.py
backend/app/models/news.py
backend/app/services/mvp_pipeline.py
backend/app/services/custom_signal_rank.py
backend/app/services/snapshot_read_models.py
backend/app/services/dashboard_read_model.py
backend/app/services/semantic_embeddings.py
backend/app/services/semantic_clustering.py
backend/app/services/scenario_simulator.py
backend/app/services/alert_engine.py
backend/app/services/digest_engine.py
```

Simple explanation:

```text
main.py exposes API endpoints.
news_fetcher.py gets RSS news.
hf_client.py talks to AI providers.
config.py reads environment variables.
database.py connects to PostgreSQL.
models/news.py defines tables.
mvp_pipeline.py runs the current dashboard pipeline.
custom_signal_rank.py gives local ML scores.
snapshot_read_models.py builds map/orbit payloads from snapshots.
```

## Main API Endpoints

Common endpoints:

```text
GET  /api/home-snapshot
GET  /api/feed
GET  /api/story/{story_id}
POST /api/ask
GET  /api/orbit
GET  /api/map-signals
POST /api/simulate
POST /api/admin/ingest-now
POST /api/admin/enrich-batch
```

Simple meaning:

```text
/api/home-snapshot gives dashboard data.
/api/feed gives paginated feed cards.
/api/story/{story_id} gives one story.
/api/ask answers questions from news context.
/api/orbit builds graph data.
/api/map-signals builds map data.
/api/simulate runs a what-if scenario.
Admin endpoints trigger ingestion and enrichment.
```

## Configuration

Important environment values:

```text
DATABASE_URL=postgresql+asyncpg://...
REDIS_URL=...
GATEWAY_SECRET=...
GATEWAY_BASE_URL=https://cloud-command.onrender.com/api/gateway
INGEST_SECRET=...
ADMIN_SECRET=...
CORS_ALLOWED_ORIGINS=...

NEWSINTEL_CATEGORIES=tech,education,entertainment,politics
NEWSINTEL_ARTICLES_PER_CATEGORY=5
NEWSINTEL_INGEST_INTERVAL_MINUTES=10
NEWSINTEL_RANK_TOP_N=15
NEWSINTEL_ENRICH_BATCH_SIZE=3
NEWSINTEL_RETENTION_DAYS=7
NEWSINTEL_AI_RANK_MAX_TOKENS=520
NEWSINTEL_AI_ENRICH_MAX_TOKENS=500
DASHBOARD_CACHE_TTL_SECONDS=600
AI_CIRCUIT_BREAKER_COOLDOWN_MINUTES=10

ENABLE_PERSONALIZATION=false
ENABLE_WATCHLIST=false
ENABLE_ALERTS=false
ENABLE_DIGESTS=false
ENABLE_COUNTRY_FILTERS=false
```

Frontend API base:

```text
VITE_API_URL=http://127.0.0.1:8000
```

## Default Number Summary

Useful default values:

```text
categories = 4
articles_per_category = 5
target fetch count = 4 * 5 = 20
rank top N = 15
enrich batch size = 3
retention days = 7
ingest interval = 10 minutes
dashboard cache TTL = 600 seconds = 10 minutes
RSS cache TTL = 90 seconds
title duplicate threshold = 0.86
```

## Main Libraries And Why They Are Used

### Backend

FastAPI:

```text
Builds the backend API.
```

Uvicorn:

```text
Runs the FastAPI app.
```

httpx:

```text
Downloads RSS feeds and calls external services using async HTTP.
```

feedparser:

```text
Parses RSS XML safely.
```

googlenewsdecoder:

```text
Decodes Google News wrapper URLs into publisher URLs when possible.
```

SQLAlchemy:

```text
Defines and queries database models.
```

Alembic:

```text
Runs database migrations.
```

PostgreSQL:

```text
Stores articles, stories, metrics, snapshots, users, alerts, and digests.
```

Redis:

```text
Optional shared cache and lock store.
```

APScheduler:

```text
Can run recurring background jobs.
```

Pydantic:

```text
Validates settings and request/response data.
```

pytest:

```text
Runs tests for pipeline behavior.
```

### NLP And AI

transformers:

```text
Loads Hugging Face NLP models.
```

torch:

```text
Runs neural models.
```

sentence-transformers:

```text
Creates semantic embeddings.
```

gradio:

```text
Hosts the Hugging Face Space interface/API.
```

### Frontend

React:

```text
Builds UI components.
```

Vite:

```text
Runs fast local development and builds production files.
```

React Router:

```text
Handles frontend pages/routes.
```

Firebase:

```text
Handles Google login identity.
```

Lucide React:

```text
Provides icons.
```

Three.js and React Three Fiber:

```text
Support 3D/visual scenes where needed.
```

d3-geo and topojson-client:

```text
Support map/geography calculations.
```

## Tests

Main test file:

```text
backend/tests/test_mvp_pipeline.py
```

Tests cover:

```text
20-candidate fetch contract
title similarity dedupe
local signal-rank score
AI ranking top 15
AI circuit breaker behavior
enrichment batch size
snapshot payload shape
orbit payload from snapshot cards
map extraction from story cards
country event lookup
retention setting
quota detection
provider throttle detection
AI JSON cleanup
OpenRouter token-budget handling
fallback model chain
```

Why tests matter:

```text
The riskiest parts are AI output, provider failures, deduplication, and snapshot shape.
Tests protect those parts.
```

## Reliability Rules

NewsIntel follows these rules:

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

## Security Notes

Secrets must stay in the backend:

```text
DATABASE_URL
REDIS_URL
GATEWAY_SECRET
ADMIN_SECRET
INGEST_SECRET
SMTP_PASSWORD
```

The frontend should not contain private AI provider keys.

Admin endpoints should require:

```text
ADMIN_SECRET
```

Ingestion endpoints should require:

```text
INGEST_SECRET
```

## Current Strengths

The project already has:

```text
real Google News RSS ingestion
multi-layer deduplication
database-backed story storage
AI ranking and enrichment
strict AI JSON validation
AI circuit breaker
cached dashboard snapshots
map/orbit read models
local ML signal ranker
personalization-ready schema
alerts/digests-ready schema
tests for important pipeline behavior
```

## Current Limitations

Important limitations:

```text
Google News RSS is not an enterprise-grade paid news feed.
RSS summaries can be short.
AI providers can hit quota or rate limits.
The MVP pipeline treats one article as one story card.
The event-store path is better for grouping many articles into one event.
The local hash embedding fallback is weaker than neural embeddings.
Some advanced features depend on feature flags.
```

## Why This Is Good For An MVP

This architecture is good for an MVP because it is practical.

It does not try to solve everything by training a giant model.

Instead, it focuses on:

```text
fetching real news
cleaning data
removing duplicates
preserving sources
ranking important stories
enriching selected stories
caching dashboard data
keeping frontend fast
```

That is the right tradeoff for a working product/demo.

## Future Improvements

Good future improvements:

```text
Add stronger source quality scoring.
Use pgvector for embedding search.
Improve full article extraction.
Track cache hit rate and AI provider latency.
Train signal-rank from real user behavior.
Add stronger source citation checks.
Add dead-letter queue for failed enrichments.
Strengthen admin authentication.
Clearly separate MVP, legacy, and event-store APIs.
```

## Quick Start

Backend:

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Run backend tests:

```bash
cd backend
pytest
```

## Full Pipeline In One Example

Input settings:

```text
categories = 4
articles_per_category = 5
rank_top_n = 15
enrich_batch_size = 3
retention_days = 7
```

Fetch:

```text
target candidates = 4 * 5 = 20
```

Suppose:

```text
fetched_count = 20
duplicate_count = 5
deduped_count = 15
```

Ranking:

```text
ranked_items = min(rank_top_n, deduped_count)
ranked_items = min(15, 15)
ranked_items = 15
```

Enrichment:

```text
pending_queue = 15
batch_size = 3
processed_now = min(15, 3)
processed_now = 3
remaining_pending = 12
```

Snapshot:

```text
topStories = top 3 story cards
feed = top 10 story cards
clusters = all story cards
world_pulse = average pulse of top 5
dashboard_exposure = average exposure of top 5
daily_delta = current category pulse - previous category pulse
```

World Pulse example:

```text
top_5_pulses = 88, 80, 72, 66, 59
world_pulse = (88 + 80 + 72 + 66 + 59) / 5
world_pulse = 365 / 5
world_pulse = 73
world_pulse_label = Elevated
```

Final frontend result:

```text
React displays top stories, feed cards, pulse history, map, orbit, quick glance, and pipeline status from one cached snapshot.
```

## Presentation-Ready Simple Explanation

NewsIntel is an AI news intelligence platform. It collects current news from Google News RSS, cleans it, removes duplicate stories, ranks important articles with AI, enriches the best ones into readable cards, stores everything in PostgreSQL, and shows a fast dashboard in React.

The main technical idea is that expensive work happens in the backend, not in the browser. The backend prepares a cached snapshot, and the frontend simply renders it.

The system uses pretrained models and APIs because training large models from scratch would need huge datasets, GPUs, time, and money. For this project, it is smarter to use proven models and focus on the pipeline, scoring, storage, and user experience.
