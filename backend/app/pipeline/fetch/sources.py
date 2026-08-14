from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Feed:
    source_id: str
    source_name: str
    category: str
    url: str
    weight: int = 90


DEFAULT_FEEDS: list[Feed] = [
    Feed("bbc-home", "BBC", "politics", "https://feeds.bbci.co.uk/news/rss.xml", 90),
    Feed("bbc-tech", "BBC", "tech", "https://feeds.bbci.co.uk/news/technology/rss.xml", 90),
    Feed("bbc-education", "BBC", "education", "https://feeds.bbci.co.uk/news/education/rss.xml", 90),
    Feed("bbc-entertainment", "BBC", "entertainment", "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml", 90),
    Feed("guardian-world", "The Guardian", "politics", "https://www.theguardian.com/world/rss", 90),
    Feed("guardian-tech", "The Guardian", "tech", "https://www.theguardian.com/uk/technology/rss", 90),
    Feed("guardian-education", "The Guardian", "education", "https://www.theguardian.com/education/rss", 90),
    Feed("guardian-culture", "The Guardian", "entertainment", "https://www.theguardian.com/uk/culture/rss", 90),
    Feed("wired", "Wired", "tech", "https://www.wired.com/feed/rss", 80),
    Feed("variety", "Variety", "entertainment", "https://variety.com/feed/", 80),
]


SOURCE_WEIGHT = {feed.source_id: feed.weight for feed in DEFAULT_FEEDS}
