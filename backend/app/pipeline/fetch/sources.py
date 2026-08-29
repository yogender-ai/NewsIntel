from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Feed:
    source_id: str
    source_name: str
    category: str
    url: str
    weight: int = 90


# Every feed below was fetched and confirmed to return items before being added.
# Categories match the topic ids the onboarding screen offers, so a reader who picks
# "crypto" or "defense" actually gets a feed behind it — previously the pipeline only
# knew four categories and silently discarded the rest of their choices.
DEFAULT_FEEDS: list[Feed] = [
    # ── tech ──
    Feed("ars", "Ars Technica", "tech", "https://feeds.arstechnica.com/arstechnica/index", 90),
    Feed("verge", "The Verge", "tech", "https://www.theverge.com/rss/index.xml", 85),
    Feed("techcrunch", "TechCrunch", "tech", "https://techcrunch.com/feed/", 85),
    Feed("wired", "Wired", "tech", "https://www.wired.com/feed/rss", 80),
    Feed("bbc-tech", "BBC", "tech", "https://feeds.bbci.co.uk/news/technology/rss.xml", 90),
    # ── ai ──
    Feed("mit-tech-review", "MIT Technology Review", "ai", "https://www.technologyreview.com/feed/", 90),
    Feed("venturebeat-ai", "VentureBeat", "ai", "https://venturebeat.com/category/ai/feed/", 80),
    # ── politics / geopolitics ──
    Feed("bbc-world", "BBC", "politics", "https://feeds.bbci.co.uk/news/world/rss.xml", 95),
    Feed("guardian-world", "The Guardian", "politics", "https://www.theguardian.com/world/rss", 90),
    Feed("aljazeera", "Al Jazeera", "politics", "https://www.aljazeera.com/xml/rss/all.xml", 85),
    Feed("npr-world", "NPR", "politics", "https://feeds.npr.org/1004/rss.xml", 85),
    # ── markets ──
    Feed(
        "cnbc-finance",
        "CNBC",
        "markets",
        "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664",
        90,
    ),
    Feed("marketwatch", "MarketWatch", "markets", "https://feeds.content.dowjones.io/public/rss/mw_topstories", 85),
    Feed("ft-companies", "Financial Times", "markets", "https://www.ft.com/companies?format=rss", 90),
    # ── climate & energy ──
    Feed("guardian-env", "The Guardian", "climate", "https://www.theguardian.com/environment/rss", 90),
    Feed("carbonbrief", "Carbon Brief", "climate", "https://www.carbonbrief.org/feed", 85),
    Feed("insideclimate", "Inside Climate News", "climate", "https://insideclimatenews.org/feed/", 80),
    # ── healthcare ──
    Feed("statnews", "STAT", "healthcare", "https://www.statnews.com/feed/", 90),
    Feed("npr-health", "NPR", "healthcare", "https://feeds.npr.org/1128/rss.xml", 85),
    # ── defense & security ──
    Feed(
        "defensenews",
        "Defense News",
        "defense",
        "https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml",
        90,
    ),
    # ── crypto ──
    Feed("coindesk", "CoinDesk", "crypto", "https://www.coindesk.com/arc/outboundfeeds/rss/", 85),
    Feed("decrypt", "Decrypt", "crypto", "https://decrypt.co/feed", 80),
    Feed("cointelegraph", "Cointelegraph", "crypto", "https://cointelegraph.com/rss", 75),
    # ── space ──
    Feed("spacenews", "SpaceNews", "space", "https://spacenews.com/feed/", 90),
    Feed("nasa", "NASA", "space", "https://www.nasa.gov/feed/", 85),
    # ── supply chain & trade ──
    Feed("gcaptain", "gCaptain", "trade", "https://gcaptain.com/feed/", 85),
    # ── automotive & EVs ──
    Feed("electrek", "Electrek", "auto", "https://electrek.co/feed/", 80),
    # ── telecom ──
    Feed("lightreading", "Light Reading", "telecom", "https://www.lightreading.com/rss.xml", 80),
    # ── media & entertainment ──
    Feed("variety", "Variety", "media", "https://variety.com/feed/", 80),
    Feed("hollywoodreporter", "The Hollywood Reporter", "media", "https://www.hollywoodreporter.com/feed/", 78),
    Feed(
        "bbc-entertainment",
        "BBC",
        "entertainment",
        "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml",
        85,
    ),
    # ── education ──
    Feed("guardian-education", "The Guardian", "education", "https://www.theguardian.com/education/rss", 85),
    Feed("bbc-education", "BBC", "education", "https://feeds.bbci.co.uk/news/education/rss.xml", 85),
    # ── legal & regulation ──
    Feed("scotusblog", "SCOTUSblog", "legal", "https://www.scotusblog.com/feed/", 85),
    Feed("abovethelaw", "Above the Law", "legal", "https://abovethelaw.com/feed/", 75),
    Feed("jurist", "JURIST", "legal", "https://www.jurist.org/news/feed/", 78),
]

SOURCE_WEIGHT = {feed.source_id: feed.weight for feed in DEFAULT_FEEDS}

# The full set of topic ids the product supports. Onboarding renders these and the
# pipeline accepts all of them.
ALL_CATEGORIES: list[str] = sorted({feed.category for feed in DEFAULT_FEEDS})


def feeds_for(categories: list[str] | None = None) -> list[Feed]:
    """Feeds for the requested categories, or every feed when none are given."""
    if not categories:
        return list(DEFAULT_FEEDS)
    wanted = {category.strip().lower() for category in categories if category.strip()}
    return [feed for feed in DEFAULT_FEEDS if feed.category in wanted] or list(DEFAULT_FEEDS)
