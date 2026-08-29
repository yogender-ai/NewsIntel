"""Embed a reader's profile so stories can be matched to them by meaning.

Topic checkboxes only get you keyword matching. Embedding the composed profile text
("Occupation: logistics planner … Industry: shipping … watching: Red Sea") lets a
story about canal transit fees rank highly for that reader even though it shares no
keyword with anything they ticked. The vector is recomputed only when the profile
text actually changes, tracked by hash.
"""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.cloudflare import CloudflareAI
from app.models.account import AccountProfile

logger = logging.getLogger("newsintel-profile")


def profile_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


async def schedule_profile_embedding(
    session: AsyncSession, profile: AccountProfile, *, force: bool = False
) -> bool:
    """Recompute the profile embedding if the profile text changed.

    Returns True when a new embedding was written. Failures are logged and swallowed:
    a reader must never be blocked from saving their profile because Cloudflare is
    briefly unavailable, and the next save (or the nightly backfill) will retry.
    """
    text = profile.profile_text()
    if not text:
        return False

    digest = profile_hash(text)
    if not force and profile.profile_embedding_hash == digest and profile.profile_embedding is not None:
        return False

    cf = CloudflareAI()
    if not cf.configured:
        logger.warning("profile.embed skipped — Cloudflare not configured")
        return False

    async with httpx.AsyncClient() as client:
        vector = await cf.embed_one(client, text, purpose="profile.embed")

    if vector is None:
        logger.warning("profile.embed failed account=%s", profile.account_id)
        return False

    profile.profile_embedding = vector
    profile.profile_embedding_hash = digest
    profile.profile_embedded_at = datetime.now(timezone.utc)
    session.add(profile)
    logger.info("profile.embed ok account=%s dims=%s", profile.account_id, len(vector))
    return True
