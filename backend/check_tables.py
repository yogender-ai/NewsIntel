import asyncio
from app.core.config import get_settings
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def check():
    s = get_settings()
    engine = create_async_engine(s.async_database_url, connect_args={"ssl": "require"})
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"))
        tables = [row[0] for row in result.fetchall()]
        print("Tables in Neon database:")
        for t in tables:
            print(f"  - {t}")
        
        # Check alembic version
        try:
            result = await conn.execute(text("SELECT version_num FROM alembic_version"))
            versions = [row[0] for row in result.fetchall()]
            print(f"\nAlembic version: {versions}")
        except Exception as e:
            print(f"\nAlembic version table: {e}")
    
    await engine.dispose()

asyncio.run(check())
