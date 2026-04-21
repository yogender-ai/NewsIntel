import os
import json
import logging
from datetime import datetime, timezone
import databases
import sqlalchemy
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./newsintel.db")
database = databases.Database(DATABASE_URL)
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

# User preferences table — stores onboarding choices per user
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

engine = sqlalchemy.create_engine(DATABASE_URL)

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
