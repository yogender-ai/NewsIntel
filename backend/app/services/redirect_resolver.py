import logging

import httpx

from app.services.url_normalizer import normalize_url


logger = logging.getLogger(__name__)


class RedirectResolver:
    """Resolve publisher redirects before URL hashing.

    Google News RSS links are often redirect wrappers. This resolver follows
    redirects with a short timeout and returns the normalized final URL. If a
    source blocks HEAD, it falls back to GET without reading the whole body.
    """

    def __init__(self, timeout_seconds: float = 8.0):
        self.timeout_seconds = timeout_seconds

    async def resolve(self, url: str) -> str:
        async with httpx.AsyncClient(
            timeout=self.timeout_seconds,
            follow_redirects=True,
            headers={"User-Agent": "NewsIntelBot/1.0 (+https://newsintel.local)"},
        ) as client:
            try:
                response = await client.head(url)
                return normalize_url(str(response.url))
            except Exception as exc:
                logger.debug("HEAD redirect resolve failed for %s: %s", url, exc)

            try:
                response = await client.get(url)
                return normalize_url(str(response.url))
            except Exception as exc:
                logger.warning("Redirect resolve failed for %s: %s", url, exc)
                return normalize_url(url)

