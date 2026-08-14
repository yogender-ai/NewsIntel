from app.services.text_fingerprint import normalize_title, title_hash
from app.services.url_normalizer import normalize_url, sha256_text
from app.pipeline.types import CleanArticle, RawItem


def to_clean_article(item: RawItem, image_url: str) -> CleanArticle:
    canonical = normalize_url(item.url)
    return CleanArticle(
        canonical_url=canonical,
        url_hash=sha256_text(canonical),
        title=item.title,
        title_hash=title_hash(item.title),
        source_id=item.source_id,
        source_name=item.source_name,
        category=item.category,
        summary=item.summary or item.title,
        image_url=image_url,
        published_at=item.published_at,
    )
