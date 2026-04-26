from __future__ import annotations

import json
from datetime import date, datetime, time, timedelta, timezone
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

import hf_client
from app.models.news import Alert, DailyDigest, DigestDeliveryLog, Event, Preference, User
from app.services.dashboard_read_model import build_dashboard_payload
from app.services.event_enrichment import clean_json_text


class DigestPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    headline: str
    date: str
    world_pulse: int = Field(ge=0, le=100)
    top_3: list[dict[str, Any]]
    what_changed: list[dict[str, Any]]
    watch_next: list[dict[str, Any]]
    quiet_topics: list[dict[str, Any]]
    alerts_summary: dict[str, int]


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def digest_day(value: date | None = None) -> datetime:
    today = value or utcnow().date()
    return datetime.combine(today, time.min, tzinfo=timezone.utc)


def _alert_summary(alerts: list[Alert]) -> dict[str, int]:
    return {
        "critical": sum(1 for alert in alerts if alert.severity == "critical"),
        "high": sum(1 for alert in alerts if alert.severity == "high"),
        "unread": sum(1 for alert in alerts if alert.status == "unread"),
    }


def _rules_only_digest(payload: dict, alerts: list[Alert], topics: list[str], digest_date: datetime) -> dict[str, Any]:
    clusters = payload.get("clusters", []) or []
    top = clusters[:3]
    pulse_scores = [int(cluster.get("pulse_score", 50)) for cluster in clusters]
    world_pulse = round(sum(pulse_scores) / len(pulse_scores)) if pulse_scores else 50
    deltas = payload.get("daily_delta", []) or []
    quiet = [topic for topic in topics if topic and not any(topic == item.get("label") or topic == item.get("topic") for item in deltas)]
    return {
        "headline": "No major digest narrative is available yet" if not clusters else "Your NewsIntel daily pulse is ready",
        "date": digest_date.date().isoformat(),
        "world_pulse": world_pulse,
        "top_3": [
            {
                "title": cluster.get("thread_title"),
                "impact_line": cluster.get("impact_line"),
                "why_it_matters": cluster.get("why_it_matters"),
                "tier": cluster.get("signal_tier"),
                "pulse": cluster.get("pulse_score"),
            }
            for cluster in top
        ],
        "what_changed": [
            {
                "topic": item.get("label") or item.get("topic"),
                "direction": "rising" if item.get("delta", 0) > 0 else "cooling" if item.get("delta", 0) < 0 else "stable",
                "delta": item.get("delta", 0),
                "reason": "Pulse movement from event-backed history.",
            }
            for item in deltas[:5]
        ],
        "watch_next": [
            {"topic": cluster.get("thread_title"), "reason": cluster.get("impact_line") or "Monitor for follow-up updates."}
            for cluster in clusters[:3]
        ],
        "quiet_topics": [{"topic": topic, "message": "No major update"} for topic in quiet[:5]],
        "alerts_summary": _alert_summary(alerts),
        "status_note": "generated_rules_only",
    }


def _digest_prompt(base: dict, alerts: list[Alert], topics: list[str], entities: list[str], digest_date: datetime) -> str:
    clusters = base.get("clusters", [])[:8]
    deltas = base.get("daily_delta", [])[:8]
    compact_alerts = [
        {"title": alert.title, "severity": alert.severity, "type": alert.alert_type, "reason": alert.reason_json}
        for alert in alerts[:10]
    ]
    return f"""You are NewsIntel's daily digest editor. Return ONLY strict JSON.

Schema:
{{
  "headline": "...",
  "date": "{digest_date.date().isoformat()}",
  "world_pulse": 72,
  "top_3": [{{"title": "...", "impact_line": "...", "why_it_matters": "...", "tier": "SIGNAL", "pulse": 77}}],
  "what_changed": [{{"topic": "AI", "direction": "rising", "delta": 12, "reason": "..."}}],
  "watch_next": [{{"topic": "...", "reason": "..."}}],
  "quiet_topics": [{{"topic": "...", "message": "No major update"}}],
  "alerts_summary": {{"critical": 1, "high": 2, "unread": 3}}
}}

Rules:
- Be concise. No essay.
- Use only supplied facts.
- If little changed, say so honestly.

Tracked topics: {topics}
Tracked entities: {entities}
Top events: {json.dumps(clusters, default=str)[:5000]}
What changed: {json.dumps(deltas, default=str)[:2000]}
Alerts: {json.dumps(compact_alerts, default=str)[:2500]}
"""


async def _call_digest_ai(base: dict, alerts: list[Alert], topics: list[str], entities: list[str], digest_date: datetime) -> tuple[dict[str, Any] | None, str]:
    prompt = _digest_prompt(base, alerts, topics, entities, digest_date)
    provider = "none"
    raw = await hf_client._call_openrouter(prompt, model="openrouter/auto")
    if raw:
        provider = "openrouter"
    if not raw:
        raw = await hf_client._call_gemini(prompt)
        if raw:
            provider = "gemini"
    if not raw:
        return None, "rules_only"
    try:
        parsed = DigestPayload.model_validate(json.loads(clean_json_text(raw)))
        return parsed.model_dump(), provider
    except (json.JSONDecodeError, ValidationError, TypeError):
        return None, "rules_only"


async def generate_digest(session: AsyncSession, user: User, *, force: bool = False, target_date: date | None = None) -> DailyDigest:
    day = digest_day(target_date)
    existing = await session.scalar(select(DailyDigest).where(DailyDigest.user_id == user.id, DailyDigest.digest_date == day))
    if existing and not force:
        return existing
    preference = await session.scalar(select(Preference).where(Preference.user_id == user.id))
    topics = list(preference.categories if preference else [])
    regions = list(preference.regions if preference else [])
    tracked_entities = list(preference.tracked_entities if preference else [])
    if preference and isinstance(preference.refresh_policy, dict) and preference.refresh_policy.get("digest_enabled") is False:
        summary = _rules_only_digest({"clusters": [], "daily_delta": []}, [], topics, day)
        summary["headline"] = "Daily digest is disabled"
        provider = "rules_only"
    else:
        base = await build_dashboard_payload(session, topics=topics, regions=regions, limit=30)
        alerts = (
            await session.scalars(
                select(Alert)
                .where(Alert.user_id == user.id, Alert.created_at >= day, Alert.created_at < day + timedelta(days=1))
                .order_by(Alert.created_at.desc())
                .limit(20)
            )
        ).all()
        summary, provider = await _call_digest_ai(base, list(alerts), topics, tracked_entities, day)
        if summary is None:
            summary = _rules_only_digest(base, list(alerts), topics, day)
            provider = "rules_only"

    digest = existing or DailyDigest(user_id=user.id, digest_date=day)
    digest.summary_json = summary
    digest.provider_used = provider
    digest.status = "generated" if provider != "rules_only" else "generated_rules_only"
    digest.generated_at = utcnow()
    digest.error = None
    if not existing:
        session.add(digest)
    await session.flush()
    session.add(DigestDeliveryLog(digest_id=digest.id, user_id=user.id, channel="api", status="created"))
    await session.flush()
    return digest


async def generate_all_digests(session: AsyncSession, *, limit_users: int = 100) -> dict[str, int]:
    users = (await session.scalars(select(User).where(User.is_active == True).limit(limit_users))).all()
    generated = 0
    failed = 0
    for user in users:
        try:
            await generate_digest(session, user)
            generated += 1
        except Exception:
            failed += 1
    return {"checked_users": len(users), "digests_generated": generated, "failed": failed}
