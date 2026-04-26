"""Create the production event-store tables directly, handling legacy collisions."""
import asyncio
from app.core.config import get_settings
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text


async def create_tables():
    s = get_settings()
    engine = create_async_engine(s.async_database_url, connect_args={"ssl": "require"})

    async with engine.begin() as conn:
        # 1. Drop any leftover indexes from the legacy alerts table
        await conn.execute(text("DROP INDEX IF EXISTS ix_alerts_user_id"))
        await conn.execute(text("DROP INDEX IF EXISTS ix_alerts_user_unread"))
        await conn.execute(text("DROP INDEX IF EXISTS ix_alerts_event_type"))
        print("Dropped legacy alert indexes")

    # 2. Use create_all with checkfirst=True
    async with engine.begin() as conn:
        from app.models.base import Base
        from app.models import news  # noqa: F401
        await conn.run_sync(Base.metadata.create_all, checkfirst=True)
        print("All event-store tables created successfully!")

    # 3. Stamp alembic version
    async with engine.begin() as conn:
        await conn.execute(text(
            "CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) NOT NULL)"
        ))
        await conn.execute(text("DELETE FROM alembic_version"))
        await conn.execute(text(
            "INSERT INTO alembic_version (version_num) VALUES ('20260426_0004')"
        ))
        print("Alembic version stamped: 20260426_0004")

    # 4. Verify
    async with engine.connect() as conn:
        result = await conn.execute(text(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'public' ORDER BY table_name"
        ))
        tables = [row[0] for row in result.fetchall()]
        print(f"\nAll tables now:")
        for t in tables:
            print(f"  - {t}")

        # Check the key tables exist
        required = {
            "articles",
            "events",
            "event_articles",
            "event_relationships",
            "event_relationship_checks",
            "raw_articles",
            "scenario_runs",
            "users",
        }
        found = set(tables)
        missing = required - found
        if missing:
            print(f"\nERROR: Missing tables: {missing}")
        else:
            print(f"\nSUCCESS: All required tables exist!")

    await engine.dispose()


asyncio.run(create_tables())
