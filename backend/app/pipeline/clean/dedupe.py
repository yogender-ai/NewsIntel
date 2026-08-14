from app.core.config import get_settings
from app.services.text_fingerprint import title_similarity
from app.pipeline.types import CleanArticle


def dedupe_articles(articles: list[CleanArticle], recent: list[tuple[str, str]]) -> tuple[list[CleanArticle], int]:
    settings = get_settings()
    threshold = float(settings.title_similarity_threshold)
    kept: list[CleanArticle] = []
    seen_urls: set[str] = set()
    seen_titles: list[str] = []
    dropped = 0
    recent_titles = [title for _, title in recent]
    recent_hashes = {url_hash for url_hash, _ in recent}

    for article in articles:
        if article.url_hash in seen_urls or article.url_hash in recent_hashes:
            dropped += 1
            continue
        if any(title_similarity(article.title, seen) >= threshold for seen in seen_titles):
            dropped += 1
            continue
        if any(title_similarity(article.title, seen) >= threshold for seen in recent_titles):
            dropped += 1
            continue
        kept.append(article)
        seen_urls.add(article.url_hash)
        seen_titles.append(article.title)
    return kept, dropped
