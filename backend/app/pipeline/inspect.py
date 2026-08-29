"""Compact rows so the oil board can open a stage and see what sat there."""


def raw_row(item) -> dict:
    published = item.published_at.isoformat() if getattr(item, "published_at", None) else None
    return {
        "title": (item.title or "")[:220],
        "source": item.source_name,
        "url": item.url,
        "category": item.category,
        "published_at": published,
    }


def clean_row(article, extra: dict | None = None) -> dict:
    published = article.published_at.isoformat() if getattr(article, "published_at", None) else None
    row = {
        "title": (article.title or "")[:220],
        "source": article.source_name,
        "url": article.canonical_url,
        "category": article.category,
        "image_url": article.image_url,
        "summary": (article.summary or "")[:280],
        "published_at": published,
    }
    if extra:
        row.update(extra)
    return row


def signal_row(signal) -> dict:
    published = signal.published_at.isoformat() if getattr(signal, "published_at", None) else None
    return {
        "title": (signal.title or "")[:220],
        "source": signal.source_name,
        "url": signal.source_url,
        "category": signal.category,
        "image_url": signal.image_url,
        "summary": (signal.summary or "")[:280],
        "pulse": signal.pulse,
        "importance": signal.importance,
        "sentiment": signal.sentiment,
        "published_at": published,
    }


def take(rows: list, limit: int = 24) -> list:
    return list(rows[:limit])
