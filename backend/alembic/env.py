import asyncio
from logging.config import fileConfig
from urllib.parse import urlsplit

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import get_settings
from app.models.base import Base
from app.models import account  # noqa: F401
from app.models import news  # noqa: F401
from app.models import rag  # noqa: F401
from app.models import pipeline_run  # noqa: F401
from app.models import signal  # noqa: F401
from app.models import snapshot  # noqa: F401


def _is_local(url: str) -> bool:
    host = (urlsplit(url).hostname or "").lower()
    return host in {"localhost", "127.0.0.1", "::1", "db", "postgres"}


config = context.config
settings = get_settings()
config.set_main_option("sqlalchemy.url", settings.async_database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# asyncpg requires SSL via connect_args, not query-string params. Local
# databases (docker/dev) do not speak SSL, so only demand it for remote hosts.
_connect_args: dict = {}
if "asyncpg" in settings.async_database_url and not _is_local(settings.async_database_url):
    _connect_args["ssl"] = "require"


def run_migrations_offline() -> None:
    context.configure(
        url=settings.async_database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = create_async_engine(
        settings.async_database_url,
        poolclass=pool.NullPool,
        connect_args=_connect_args,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
