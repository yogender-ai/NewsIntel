"""Check column types for legacy tables in Neon."""
import asyncio
from app.core.config import get_settings
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def check():
    s = get_settings()
    engine = create_async_engine(s.async_database_url, connect_args={"ssl": "require"})
    async with engine.connect() as conn:
        result = await conn.execute(text(
            "SELECT table_name, column_name, data_type, is_nullable "
            "FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = 'pulse_snapshots' "
            "ORDER BY ordinal_position"
        ))
        print("pulse_snapshots columns:")
        for row in result.fetchall():
            print(f"  {row[1]}: {row[2]} (nullable={row[3]})")

        # Also check the articles table for the new event-store schema
        result = await conn.execute(text(
            "SELECT table_name, column_name, data_type "
            "FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = 'articles' "
            "ORDER BY ordinal_position"
        ))
        print("\narticles columns:")
        for row in result.fetchall():
            print(f"  {row[1]}: {row[2]}")

        # Count existing data
        for table in ["articles", "events", "event_articles", "raw_articles", "pulse_snapshots"]:
            try:
                result = await conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
                count = result.scalar()
                print(f"\n{table}: {count} rows")
            except Exception as e:
                print(f"\n{table}: ERROR - {e}")

    await engine.dispose()

asyncio.run(check())
