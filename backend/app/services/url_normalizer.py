import hashlib
import re
from urllib.parse import parse_qsl, quote, unquote, urlencode, urlparse, urlunparse


TRACKING_PARAMS = {
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "utm_id",
    "gclid",
    "fbclid",
    "mc_cid",
    "mc_eid",
    "igshid",
    "ref",
    "ref_src",
    "source",
    "cmpid",
    "ocid",
    "smid",
}


GOOGLE_NEWS_PATTERNS = (
    re.compile(r"https?://news\.google\.com/rss/articles/(?P<token>[^?]+)", re.I),
    re.compile(r"https?://news\.google\.com/articles/(?P<token>[^?]+)", re.I),
)


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def normalize_url(url: str) -> str:
    """Return a stable canonical URL for dedupe.

    This removes common tracking parameters, lowercases scheme/host, strips
    fragments, normalizes default ports, and keeps only meaningful query params.
    True redirect expansion should happen before this function with an HTTP HEAD
    resolver; this function is pure and safe for tests/workers.
    """
    cleaned = unquote((url or "").strip())
    if not cleaned:
        return ""

    parsed = urlparse(cleaned)
    scheme = (parsed.scheme or "https").lower()
    host = (parsed.hostname or "").lower()
    if host.startswith("www."):
        host = host[4:]

    port = parsed.port
    netloc = host
    if port and not ((scheme == "https" and port == 443) or (scheme == "http" and port == 80)):
        netloc = f"{host}:{port}"

    path = quote(unquote(parsed.path or "/"), safe="/:%@")
    if path != "/" and path.endswith("/"):
        path = path[:-1]

    query_items = []
    for key, value in parse_qsl(parsed.query, keep_blank_values=False):
        key_lower = key.lower()
        if key_lower in TRACKING_PARAMS or key_lower.startswith("utm_"):
            continue
        query_items.append((key_lower, value))
    query = urlencode(sorted(query_items), doseq=True)

    return urlunparse((scheme, netloc, path, "", query, ""))


def url_hash(url: str) -> str:
    return sha256_text(normalize_url(url))


def looks_like_google_news_redirect(url: str) -> bool:
    return any(pattern.match(url or "") for pattern in GOOGLE_NEWS_PATTERNS)

