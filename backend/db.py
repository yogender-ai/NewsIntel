import os
import json
import logging
from datetime import datetime, timezone
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
import databases
import sqlalchemy
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./newsintel.db")


def _sanitize_url_for_asyncpg(url: str) -> str:
    """Strip psycopg-style SSL params that asyncpg does NOT support in the DSN.

    asyncpg does NOT accept ``sslmode``, ``ssl``, or ``channel_binding`` as
    query-string parameters.  SSL must be configured via ``connect_args``.
    """
    if not url.startswith(("postgresql://", "postgres://")):
        return url  # sqlite or other — leave as-is
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query.pop("sslmode", None)
    query.pop("ssl", None)
    query.pop("channel_binding", None)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def _sanitize_url_for_sync(url: str) -> str:
    """Strip parameters that psycopg2/libpq don't recognise (e.g. channel_binding)."""
    if not url.startswith(("postgresql://", "postgres://")):
        return url
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query.pop("channel_binding", None)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


_async_url = _sanitize_url_for_asyncpg(DATABASE_URL)
_sync_url = _sanitize_url_for_sync(DATABASE_URL)

_is_postgres = DATABASE_URL.startswith(("postgresql://", "postgres://"))

# databases.Database passes **options through to asyncpg.connect().
# asyncpg needs ssl passed as a keyword arg, NOT in the query string.
database = databases.Database(_async_url, ssl="require") if _is_postgres else databases.Database(_async_url)
metadata = sqlalchemy.MetaData()

# ---------------------------------------------------------------------------
# Tables
# ---------------------------------------------------------------------------

# Table to track search history and topic popularity
searches = sqlalchemy.Table(
    "searches",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("topic", sqlalchemy.String(255), nullable=False),
    sqlalchemy.Column("region", sqlalchemy.String(50), nullable=False),
    sqlalchemy.Column("article_count", sqlalchemy.Integer, default=0),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=lambda: datetime.now(timezone.utc)),
)

# Table to track sentiment trends over time for topics
sentiment_trends = sqlalchemy.Table(
    "sentiment_trends",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("topic", sqlalchemy.String(255), nullable=False),
    sqlalchemy.Column("positive_count", sqlalchemy.Integer, default=0),
    sqlalchemy.Column("negative_count", sqlalchemy.Integer, default=0),
    sqlalchemy.Column("neutral_count", sqlalchemy.Integer, default=0),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=lambda: datetime.now(timezone.utc)),
)

# Table to track entity mentions
entities = sqlalchemy.Table(
    "entities",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("entity_name", sqlalchemy.String(255), nullable=False),
    sqlalchemy.Column("entity_type", sqlalchemy.String(50), nullable=False),
    sqlalchemy.Column("mention_count", sqlalchemy.Integer, default=1),
    sqlalchemy.Column("last_seen", sqlalchemy.DateTime, default=lambda: datetime.now(timezone.utc)),
)

# Feedback table (persistent version)
feedback = sqlalchemy.Table(
    "feedback",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("author", sqlalchemy.String(100), nullable=False),
    sqlalchemy.Column("message", sqlalchemy.Text, nullable=False),
    sqlalchemy.Column("emotion", sqlalchemy.String(50), nullable=False),
    sqlalchemy.Column("rating", sqlalchemy.Integer, default=5),
    sqlalchemy.Column("github_issue_url", sqlalchemy.String(255), nullable=True),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=lambda: datetime.now(timezone.utc)),
)

# Pulse snapshots — stores topic-level pulse scores for Daily Delta
pulse_snapshots = sqlalchemy.Table(
    "pulse_snapshots",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("topic", sqlalchemy.String(255), nullable=False),
    sqlalchemy.Column("pulse_score", sqlalchemy.Float, default=50.0),
    sqlalchemy.Column("source_count", sqlalchemy.Integer, default=0),
    sqlalchemy.Column("neg_ratio", sqlalchemy.Float, default=0.0),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=lambda: datetime.now(timezone.utc)),
)

# User preferences table — stores onboarding choices per user
saved_threads = sqlalchemy.Table(
    "saved_threads",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("user_id", sqlalchemy.String(128), nullable=False, index=True),
    sqlalchemy.Column("thread_id", sqlalchemy.String(255), nullable=False, index=True),
    sqlalchemy.Column("saved_at", sqlalchemy.DateTime, default=lambda: datetime.now(timezone.utc)),
    sqlalchemy.UniqueConstraint("user_id", "thread_id", name="uq_saved_threads_user_thread"),
)

watched_signals = sqlalchemy.Table(
    "watched_signals",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("user_id", sqlalchemy.String(128), nullable=False, index=True),
    sqlalchemy.Column("signal_id", sqlalchemy.String(255), nullable=False, index=True),
    sqlalchemy.Column("watch_priority", sqlalchemy.Integer, default=1),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=lambda: datetime.now(timezone.utc)),
    sqlalchemy.UniqueConstraint("user_id", "signal_id", name="uq_watched_signals_user_signal"),
)

tracked_entities = sqlalchemy.Table(
    "tracked_entities",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("user_id", sqlalchemy.String(128), nullable=False, index=True),
    sqlalchemy.Column("entity_name", sqlalchemy.String(255), nullable=False, index=True),
    sqlalchemy.Column("entity_type", sqlalchemy.String(50), default="ENTITY"),
    sqlalchemy.Column("follow_weight", sqlalchemy.Float, default=1.0),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=lambda: datetime.now(timezone.utc)),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=lambda: datetime.now(timezone.utc)),
    sqlalchemy.UniqueConstraint("user_id", "entity_name", name="uq_tracked_entities_user_name"),
)

dismissed_signals = sqlalchemy.Table(
    "dismissed_signals",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("user_id", sqlalchemy.String(128), nullable=False, index=True),
    sqlalchemy.Column("signal_id", sqlalchemy.String(255), nullable=False, index=True),
    sqlalchemy.Column("dismiss_reason", sqlalchemy.String(255), default="not_relevant"),
    sqlalchemy.Column("dismissed_at", sqlalchemy.DateTime, default=lambda: datetime.now(timezone.utc)),
    sqlalchemy.UniqueConstraint("user_id", "signal_id", name="uq_dismissed_signals_user_signal"),
)

user_interactions = sqlalchemy.Table(
    "user_interactions",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("user_id", sqlalchemy.String(128), nullable=False, index=True),
    sqlalchemy.Column("signal_id", sqlalchemy.String(255), nullable=False, index=True),
    sqlalchemy.Column("interaction_type", sqlalchemy.String(50), nullable=False, index=True),
    sqlalchemy.Column("dwell_time_seconds", sqlalchemy.Integer, default=0),
    sqlalchemy.Column("metadata_json", sqlalchemy.Text, default="{}"),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=lambda: datetime.now(timezone.utc)),
)

alerts = sqlalchemy.Table(
    "alerts",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("user_id", sqlalchemy.String(128), nullable=False, index=True),
    sqlalchemy.Column("signal_id", sqlalchemy.String(255), nullable=True, index=True),
    sqlalchemy.Column("message", sqlalchemy.String(500), nullable=False),
    sqlalchemy.Column("severity", sqlalchemy.String(30), default="info"),
    sqlalchemy.Column("alert_type", sqlalchemy.String(50), default="signal"),
    sqlalchemy.Column("unread", sqlalchemy.Boolean, default=True),
    sqlalchemy.Column("resolved", sqlalchemy.Boolean, default=False),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=lambda: datetime.now(timezone.utc)),
)

user_preferences = sqlalchemy.Table(
    "user_preferences",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("firebase_uid", sqlalchemy.String(128), unique=True, nullable=False),
    sqlalchemy.Column("display_name", sqlalchemy.String(100)),
    sqlalchemy.Column("email", sqlalchemy.String(255)),
    sqlalchemy.Column("photo_url", sqlalchemy.String(500)),
    sqlalchemy.Column("preferred_categories", sqlalchemy.Text, default="[]"),  # JSON array
    sqlalchemy.Column("preferred_regions", sqlalchemy.Text, default="[]"),      # JSON array
    sqlalchemy.Column("youtube_channels", sqlalchemy.Text, default="[]"),       # JSON array
    sqlalchemy.Column("onboarded", sqlalchemy.Boolean, default=False),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=lambda: datetime.now(timezone.utc)),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=lambda: datetime.now(timezone.utc)),
)

engine = sqlalchemy.create_engine(_sync_url)

logger = logging.getLogger("news-intel-db")

async def init_db():
    """Initialize database schema if it doesn't exist."""
    try:
        # Note: metadata.create_all is blocking, so we run it in a thread if needed,
        # but for simple init on startup, this usually suffices in sync-init wrappers.
        metadata.create_all(engine)
        logger.info("Database schema initialized successfully.")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        raise

async def log_search(topic: str, region: str, article_count: int):
    """Log a search query to the database."""
    query = searches.insert().values(
        topic=topic.lower().strip(),
        region=region,
        article_count=article_count,
        created_at=datetime.now(timezone.utc)
    )
    await database.execute(query)

async def update_sentiment_trends(topic: str, sentiment_data: list):
    """Log sentiment distribution for a topic search."""
    pos = sum(1 for s in sentiment_data if s["name"] == "Positive")
    neg = sum(1 for s in sentiment_data if s["name"] == "Negative")
    neu = sum(1 for s in sentiment_data if s["name"] == "Neutral")
    
    query = sentiment_trends.insert().values(
        topic=topic.lower().strip(),
        positive_count=pos,
        negative_count=neg,
        neutral_count=neu,
        created_at=datetime.now(timezone.utc)
    )
    await database.execute(query)

async def track_entities(entity_list: list):
    """Update mention counts for entities."""
    for ent in entity_list:
        name = ent["name"]
        etype = ent["type"]
        
        # Try to update existing, or insert new
        # This is a simplified version, ideally use UPSERT for production
        find_query = entities.select().where(entities.c.entity_name == name)
        existing = await database.fetch_one(find_query)
        
        if existing:
            update_query = entities.update().where(entities.c.entity_name == name).values(
                mention_count=existing["mention_count"] + 1,
                last_seen=datetime.now(timezone.utc)
            )
            await database.execute(update_query)
        else:
            insert_query = entities.insert().values(
                entity_name=name,
                entity_type=etype,
                mention_count=1,
                last_seen=datetime.now(timezone.utc)
            )
            await database.execute(insert_query)


# ---------------------------------------------------------------------------
# User Preferences CRUD
# ---------------------------------------------------------------------------

async def get_user_prefs(firebase_uid: str):
    """Fetch user preferences by Firebase UID."""
    query = user_preferences.select().where(
        user_preferences.c.firebase_uid == firebase_uid
    )
    return await database.fetch_one(query)

async def get_user_prefs_by_email(email: str):
    """Fetch user preferences by email as a recovery path across auth/device changes."""
    cleaned = (email or "").strip().lower()
    if not cleaned:
        return None
    query = user_preferences.select().where(
        sqlalchemy.func.lower(user_preferences.c.email) == cleaned
    )
    return await database.fetch_one(query)

async def upsert_user_prefs(firebase_uid: str, data: dict):
    """Create or update user preferences."""
    existing = await get_user_prefs(firebase_uid)
    if existing:
        update_query = user_preferences.update().where(
            user_preferences.c.firebase_uid == firebase_uid
        ).values(
            display_name=data.get("display_name", existing["display_name"]),
            email=data.get("email", existing["email"]),
            photo_url=data.get("photo_url", existing["photo_url"]),
            preferred_categories=json.dumps(data.get("preferred_categories", json.loads(existing["preferred_categories"] or "[]"))),
            preferred_regions=json.dumps(data.get("preferred_regions", json.loads(existing["preferred_regions"] or "[]"))),
            youtube_channels=json.dumps(data.get("youtube_channels", json.loads(existing["youtube_channels"] or "[]"))),
            onboarded=data.get("onboarded", existing["onboarded"]),
            updated_at=datetime.now(timezone.utc),
        )
        await database.execute(update_query)
    else:
        insert_query = user_preferences.insert().values(
            firebase_uid=firebase_uid,
            display_name=data.get("display_name", ""),
            email=data.get("email", ""),
            photo_url=data.get("photo_url", ""),
            preferred_categories=json.dumps(data.get("preferred_categories", [])),
            preferred_regions=json.dumps(data.get("preferred_regions", [])),
            youtube_channels=json.dumps(data.get("youtube_channels", [])),
            onboarded=data.get("onboarded", False),
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        await database.execute(insert_query)

async def delete_user_prefs(firebase_uid: str):
    """Delete user preferences — used for account reset/delete."""
    query = user_preferences.delete().where(
        user_preferences.c.firebase_uid == firebase_uid
    )
    await database.execute(query)


# ---------------------------------------------------------------------------
# Phase 5 Personal Intelligence CRUD
# ---------------------------------------------------------------------------

def _row_dict(row):
    return dict(row) if row else None

async def save_thread(user_id: str, thread_id: str):
    existing = await database.fetch_one(
        saved_threads.select().where(saved_threads.c.user_id == user_id).where(saved_threads.c.thread_id == thread_id)
    )
    if not existing:
        await database.execute(saved_threads.insert().values(user_id=user_id, thread_id=thread_id))
    await record_interaction(user_id, thread_id, "save")

async def list_saved_threads(user_id: str):
    rows = await database.fetch_all(saved_threads.select().where(saved_threads.c.user_id == user_id).order_by(saved_threads.c.saved_at.desc()))
    return [dict(r) for r in rows]

async def watch_signal(user_id: str, signal_id: str, watch_priority: int = 1):
    existing = await database.fetch_one(
        watched_signals.select().where(watched_signals.c.user_id == user_id).where(watched_signals.c.signal_id == signal_id)
    )
    if existing:
        await database.execute(
            watched_signals.update()
            .where(watched_signals.c.user_id == user_id)
            .where(watched_signals.c.signal_id == signal_id)
            .values(watch_priority=watch_priority)
        )
    else:
        await database.execute(watched_signals.insert().values(user_id=user_id, signal_id=signal_id, watch_priority=watch_priority))
    await record_interaction(user_id, signal_id, "watch")

async def list_watched_signals(user_id: str):
    rows = await database.fetch_all(watched_signals.select().where(watched_signals.c.user_id == user_id).order_by(watched_signals.c.created_at.desc()))
    return [dict(r) for r in rows]

async def track_user_entity(user_id: str, entity_name: str, entity_type: str = "ENTITY", follow_weight: float = 1.0):
    cleaned = (entity_name or "").strip()
    if not cleaned:
        return
    existing = await database.fetch_one(
        tracked_entities.select().where(tracked_entities.c.user_id == user_id).where(tracked_entities.c.entity_name == cleaned)
    )
    if existing:
        await database.execute(
            tracked_entities.update()
            .where(tracked_entities.c.user_id == user_id)
            .where(tracked_entities.c.entity_name == cleaned)
            .values(
                entity_type=entity_type or existing["entity_type"],
                follow_weight=max(float(follow_weight), float(existing["follow_weight"] or 1.0)),
                updated_at=datetime.now(timezone.utc),
            )
        )
    else:
        await database.execute(
            tracked_entities.insert().values(
                user_id=user_id,
                entity_name=cleaned,
                entity_type=entity_type or "ENTITY",
                follow_weight=follow_weight,
            )
        )

async def list_tracked_entities(user_id: str):
    rows = await database.fetch_all(tracked_entities.select().where(tracked_entities.c.user_id == user_id).order_by(tracked_entities.c.follow_weight.desc()))
    return [dict(r) for r in rows]

async def dismiss_signal(user_id: str, signal_id: str, dismiss_reason: str = "not_relevant"):
    existing = await database.fetch_one(
        dismissed_signals.select().where(dismissed_signals.c.user_id == user_id).where(dismissed_signals.c.signal_id == signal_id)
    )
    if not existing:
        await database.execute(dismissed_signals.insert().values(user_id=user_id, signal_id=signal_id, dismiss_reason=dismiss_reason))
    await record_interaction(user_id, signal_id, "dismiss", metadata={"reason": dismiss_reason})

async def list_dismissed_signals(user_id: str):
    rows = await database.fetch_all(dismissed_signals.select().where(dismissed_signals.c.user_id == user_id))
    return [dict(r) for r in rows]

async def record_interaction(user_id: str, signal_id: str, interaction_type: str, dwell_time_seconds: int = 0, metadata: dict = None):
    await database.execute(
        user_interactions.insert().values(
            user_id=user_id,
            signal_id=signal_id,
            interaction_type=interaction_type,
            dwell_time_seconds=dwell_time_seconds or 0,
            metadata_json=json.dumps(metadata or {}),
        )
    )

async def list_user_interactions(user_id: str, limit: int = 500):
    rows = await database.fetch_all(
        user_interactions.select()
        .where(user_interactions.c.user_id == user_id)
        .order_by(user_interactions.c.created_at.desc())
        .limit(limit)
    )
    return [dict(r) for r in rows]

async def create_alert(user_id: str, message: str, severity: str = "info", alert_type: str = "signal", signal_id: str = None):
    recent = await database.fetch_one(
        alerts.select()
        .where(alerts.c.user_id == user_id)
        .where(alerts.c.message == message)
        .where(alerts.c.resolved == False)
        .order_by(alerts.c.created_at.desc())
    )
    if recent:
        return dict(recent)
    alert_id = await database.execute(
        alerts.insert().values(
            user_id=user_id,
            signal_id=signal_id,
            message=message,
            severity=severity,
            alert_type=alert_type,
        )
    )
    row = await database.fetch_one(alerts.select().where(alerts.c.id == alert_id))
    return _row_dict(row)

async def list_alerts(user_id: str, unresolved_only: bool = False):
    query = alerts.select().where(alerts.c.user_id == user_id)
    if unresolved_only:
        query = query.where(alerts.c.resolved == False)
    rows = await database.fetch_all(query.order_by(alerts.c.created_at.desc()).limit(100))
    return [dict(r) for r in rows]

async def get_pulse_history(topics: list, days: int = 30):
    from datetime import timedelta
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    history = {}
    for topic in topics:
        rows = await database.fetch_all(
            pulse_snapshots.select()
            .where(pulse_snapshots.c.topic == topic.lower().strip())
            .where(pulse_snapshots.c.created_at >= cutoff)
            .order_by(pulse_snapshots.c.created_at.asc())
        )
        history[topic] = [
            {
                "pulse_score": row["pulse_score"],
                "source_count": row["source_count"],
                "neg_ratio": row["neg_ratio"],
                "created_at": row["created_at"].isoformat() if hasattr(row["created_at"], "isoformat") else str(row["created_at"]),
            }
            for row in rows
        ]
    return history


# ---------------------------------------------------------------------------
# Pulse Snapshots (for Daily Delta)
# ---------------------------------------------------------------------------

async def save_pulse_snapshot(topic: str, pulse: float, source_count: int = 0, neg_ratio: float = 0.0):
    """Save a pulse score snapshot for a topic."""
    query = pulse_snapshots.insert().values(
        topic=topic.lower().strip(),
        pulse_score=pulse,
        source_count=source_count,
        neg_ratio=neg_ratio,
        created_at=datetime.now(timezone.utc),
    )
    await database.execute(query)


async def get_pulse_snapshot_24h(topic: str):
    """Get the most recent pulse snapshot for a topic that is at least 20h old (allows some flex)."""
    from datetime import timedelta
    cutoff = datetime.now(timezone.utc) - timedelta(hours=20)
    query = (
        pulse_snapshots.select()
        .where(pulse_snapshots.c.topic == topic.lower().strip())
        .where(pulse_snapshots.c.created_at <= cutoff)
        .order_by(pulse_snapshots.c.created_at.desc())
        .limit(1)
    )
    return await database.fetch_one(query)


async def get_latest_pulse_snapshot(topic: str):
    """Get the most recent pulse snapshot for a topic (any age)."""
    query = (
        pulse_snapshots.select()
        .where(pulse_snapshots.c.topic == topic.lower().strip())
        .order_by(pulse_snapshots.c.created_at.desc())
        .limit(1)
    )
    return await database.fetch_one(query)
