from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import psycopg2
from psycopg2 import sql
from psycopg2.extras import RealDictCursor


DATE_COLUMNS = {
    "articles": ["created_at", "published_at", "first_seen_at", "last_seen_at", "updated_at"],
    "ranked_stories": ["created_at"],
    "news_cycles": ["started_at", "finished_at"],
    "enrichment_queue": ["created_at", "updated_at", "next_attempt_at", "locked_at"],
    "stories": ["created_at", "published_at", "enriched_at"],
    "event_metrics": ["created_at"],
    "home_snapshots": ["created_at", "expires_at"],
    "ingestion_locks": ["created_at", "updated_at", "locked_until"],
    "scenario_runs": ["created_at"],
    "raw_articles": ["created_at", "updated_at", "published_at", "fetched_at"],
    "events": ["created_at", "updated_at", "first_seen_at", "last_seen_at"],
}


RETENTION_DATE_COLUMN = {
    "articles": "created_at",
    "ranked_stories": "created_at",
    "news_cycles": "started_at",
    "enrichment_queue": "created_at",
    "stories": "created_at",
    "event_metrics": "created_at",
    "home_snapshots": "created_at",
    "scenario_runs": "created_at",
    "raw_articles": "created_at",
    "events": "created_at",
}


def load_dotenv() -> None:
    env_path = Path(__file__).resolve().parent / ".env"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def format_bytes(value: int | float | None) -> str:
    size = float(value or 0)
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if size < 1024 or unit == "TB":
            return f"{size:.2f} {unit}"
        size /= 1024
    return f"{size:.2f} TB"


def scalar(cur, query, params=None):
    cur.execute(query, params or ())
    row = cur.fetchone()
    if row is None:
        return None
    if isinstance(row, dict):
        return next(iter(row.values()))
    return row[0]


def table_columns(cur, table: str) -> set[str]:
    cur.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = %s
        """,
        (table,),
    )
    return {row["column_name"] for row in cur.fetchall()}


def count_rows(cur, table: str) -> int:
    cur.execute(sql.SQL("SELECT COUNT(*) AS count FROM {}").format(sql.Identifier(table)))
    return int(cur.fetchone()["count"] or 0)


def count_older_than(cur, table: str, column: str, cutoff: datetime) -> int:
    cur.execute(
        sql.SQL("SELECT COUNT(*) AS count FROM {} WHERE {} < %s").format(
            sql.Identifier(table),
            sql.Identifier(column),
        ),
        (cutoff,),
    )
    return int(cur.fetchone()["count"] or 0)


def min_max_for_column(cur, table: str, column: str) -> tuple[object, object]:
    cur.execute(
        sql.SQL("SELECT MIN({col}) AS first_date, MAX({col}) AS last_date FROM {table}").format(
            col=sql.Identifier(column),
            table=sql.Identifier(table),
        )
    )
    row = cur.fetchone()
    return row["first_date"], row["last_date"]


def print_table_overview(cur, table: str, cutoff: datetime) -> None:
    columns = table_columns(cur, table)
    row_count = count_rows(cur, table)
    total_size = scalar(cur, "SELECT pg_total_relation_size(%s)", (table,))
    table_size = scalar(cur, "SELECT pg_relation_size(%s)", (table,))
    attached_size = max(0, int(total_size or 0) - int(table_size or 0))

    print(f"\nTable: {table}")
    print(f"  rows: {row_count}")
    print(
        f"  size: total={format_bytes(total_size)} "
        f"main_table={format_bytes(table_size)} toast_and_indexes={format_bytes(attached_size)}"
    )

    for column in DATE_COLUMNS.get(table, []):
        if column in columns and row_count:
            first_date, last_date = min_max_for_column(cur, table, column)
            print(f"  {column}: first={first_date} last={last_date}")

    retention_column = RETENTION_DATE_COLUMN.get(table)
    if retention_column in columns:
        old_rows = count_older_than(cur, table, retention_column, cutoff)
        print(f"  older_than_retention_by_{retention_column}: {old_rows}")


def print_group_counts(cur, table: str, column: str) -> None:
    columns = table_columns(cur, table)
    if column not in columns:
        return
    cur.execute(
        sql.SQL(
            """
            SELECT {column} AS value, COUNT(*) AS count
            FROM {table}
            GROUP BY {column}
            ORDER BY count DESC, value ASC
            """
        ).format(column=sql.Identifier(column), table=sql.Identifier(table))
    )
    rows = cur.fetchall()
    print(f"\n{table}.{column} counts:")
    for row in rows:
        print(f"  {row['value']}: {row['count']}")


def print_top_sizes(cur) -> None:
    cur.execute(
        """
        SELECT
            relname AS table_name,
            pg_total_relation_size(relid) AS total_size,
            pg_relation_size(relid) AS table_size,
            pg_indexes_size(relid) AS index_size
        FROM pg_catalog.pg_statio_user_tables
        ORDER BY pg_total_relation_size(relid) DESC
        LIMIT 15
        """
    )
    print("\nTop tables by storage:")
    for row in cur.fetchall():
        print(
            "  {table}: total={total} table={table_size} indexes={indexes}".format(
                table=row["table_name"],
                total=format_bytes(row["total_size"]),
                table_size=format_bytes(row["table_size"]),
                indexes=format_bytes(row["index_size"]),
            )
        )


def print_database_summary(cur, retention_days: int, cutoff: datetime) -> None:
    database_name = scalar(cur, "SELECT current_database()")
    database_size = scalar(cur, "SELECT pg_database_size(current_database())")
    now = scalar(cur, "SELECT now()")
    print("--- Neon/PostgreSQL Audit ---")
    print(f"database: {database_name}")
    print(f"database_size: {format_bytes(database_size)}")
    print(f"server_now_utc: {now}")
    print(f"retention_days: {retention_days}")
    print(f"retention_cutoff_utc: {cutoff}")


def print_snapshot_details(cur) -> None:
    columns = table_columns(cur, "home_snapshots")
    if "active" in columns:
        print_group_counts(cur, "home_snapshots", "active")
    cur.execute(
        """
        SELECT id, cycle_id, active, created_at, expires_at,
               pg_column_size(payload_json) AS payload_bytes
        FROM home_snapshots
        ORDER BY pg_column_size(payload_json) DESC
        LIMIT 5
        """
    )
    print("\nLargest home_snapshots payloads:")
    for row in cur.fetchall():
        print(
            f"  id={row['id']} active={row['active']} created_at={row['created_at']} "
            f"payload={format_bytes(row['payload_bytes'])}"
        )


def main() -> None:
    load_dotenv()
    conn_string = os.getenv("DATABASE_URL")
    if not conn_string:
        raise SystemExit("DATABASE_URL is missing. Put it in backend/.env or the process environment.")

    retention_days = int(os.getenv("NEWSINTEL_RETENTION_DAYS", "7") or "7")
    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)

    with psycopg2.connect(conn_string, cursor_factory=RealDictCursor) as conn:
        conn.set_session(readonly=True, autocommit=True)
        with conn.cursor() as cur:
            cur.execute("SET statement_timeout = 15000")
            print_database_summary(cur, retention_days, cutoff)

            cur.execute(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                ORDER BY table_name
                """
            )
            tables = [row["table_name"] for row in cur.fetchall()]
            print(f"\nFound {len(tables)} tables.")

            print_top_sizes(cur)

            for table in tables:
                print_table_overview(cur, table, cutoff)

            print_group_counts(cur, "news_cycles", "status")
            print_group_counts(cur, "enrichment_queue", "status")
            print_group_counts(cur, "articles", "category")
            print_group_counts(cur, "stories", "category")

            if "home_snapshots" in tables:
                print_snapshot_details(cur)


if __name__ == "__main__":
    main()