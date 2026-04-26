"""Create the production event-store tables directly, skipping any that exist."""
import asyncio
from app.core.config import get_settings
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.models.base import Base
from app.models import news  # noqa: F401 — registers all models


async def create_tables():
    s = get_settings()
    engine = create_async_engine(s.async_database_url, connect_args={"ssl": "require"})
    
    # First, drop the legacy alerts table if it exists AND is the old schema
    # (the old alerts table has different columns than the new one)
    async with engine.begin() as conn:
        # Check if the legacy alerts table has the old schema (varchar user_id, no event_id FK)
        result = await conn.execute(text(
            "SELECT column_name, data_type FROM information_schema.columns "
            "WHERE table_name = 'alerts' AND table_schema = 'public' ORDER BY ordinal_position"
        ))
        columns = {row[0]: row[1] for row in result.fetchall()}
        print(f"Existing alerts columns: {columns}")
        
        if columns and "user_id" in columns:
            # Check if user_id is varchar (legacy) or uuid (new)
            result = await conn.execute(text(
                "SELECT data_type, character_maximum_length FROM information_schema.columns "
                "WHERE table_name = 'alerts' AND column_name = 'user_id' AND table_schema = 'public'"
            ))
            row = result.fetchone()
            if row:
                dtype = row[0]
                max_len = row[1]
                print(f"alerts.user_id type: {dtype}, max_len: {max_len}")
                if dtype == "character varying":
                    print("Legacy alerts table detected (varchar user_id). Renaming to alerts_legacy...")
                    await conn.execute(text("ALTER TABLE alerts RENAME TO alerts_legacy"))
                    print("Legacy alerts table renamed successfully.")
                else:
                    print("New-style alerts table already exists. Skipping.")
        
        # Now create all tables — checkfirst=True means IF NOT EXISTS
        await conn.run_sync(Base.metadata.create_all, checkfirst=True)
        print("All event-store tables created successfully!")
    
    # Verify
    async with engine.connect() as conn:
        result = await conn.execute(text(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'public' ORDER BY table_name"
        ))
        tables = [row[0] for row in result.fetchall()]
        print(f"\nAll tables now: {tables}")
    
    # Stamp alembic version so future migrations work
    async with engine.begin() as conn:
        await conn.execute(text(
            "CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) NOT NULL)"
        ))
        await conn.execute(text("DELETE FROM alembic_version"))
        await conn.execute(text(
            "INSERT INTO alembic_version (version_num) VALUES ('20260425_0001')"
        ))
        print("Alembic version stamped: 20260425_0001")
    
    await engine.dispose()
    print("\nDone! All tables are ready.")


asyncio.run(create_tables())
