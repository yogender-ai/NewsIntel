import asyncio
import logging
from pathlib import Path

from alembic import command
from alembic.config import Config


logger = logging.getLogger("news-intel-schema-migrations")


def _alembic_config() -> Config:
    backend_dir = Path(__file__).resolve().parents[2]
    config = Config(str(backend_dir / "alembic.ini"))
    config.set_main_option("script_location", str(backend_dir / "alembic"))
    return config


async def run_startup_migrations() -> None:
    """Apply database migrations before the API starts serving requests."""
    logger.info("Applying database migrations...")
    await asyncio.to_thread(command.upgrade, _alembic_config(), "head")
    logger.info("Database migrations are up to date.")
