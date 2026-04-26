from __future__ import annotations

import hashlib
import os
import smtplib
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.news import Alert, AlertRule, Event, EventArticle, Preference, User
from app.services.dashboard_read_model import ai_metadata, pulse_from_event, tier_from_event


DEFAULT_RULES = [
    ("critical_event", "any", "*", 0, 360),
    ("pulse_spike", "any", "*", 12, 360),
    ("exposure_jump", "any", "*", 75, 360),
    ("tracked_entity", "entity", "*", 0, 360),
    ("heat_spike", "topic", "*", 12, 360),
]
MAX_ALERTS_PER_DAY = 10
MAX_CRITICAL_PER_HOUR = 3


@dataclass(slots=True)
class AlertCandidate:
    alert_type: str
    severity: str
    title: str
    message: str
    event: Event
    rule: AlertRule | None
    target_value: str
    reason_json: dict[str, Any]


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def fingerprint(user_id: UUID, alert_type: str, event_id: UUID | None, target_value: str) -> str:
    raw = f"{user_id}:{alert_type}:{event_id or 'none'}:{target_value.lower().strip()}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


async def ensure_user(session: AsyncSession, external_id: str, email: str | None = None) -> User:
    cleaned = (external_id or "local_user_123").strip() or "local_user_123"
    user = await session.scalar(select(User).where(User.external_id == cleaned))
    if user:
        if email and not user.email:
            user.email = email
        return user
    user = User(external_id=cleaned, email=email)
    session.add(user)
    await session.flush()
    return user


async def ensure_default_rules(session: AsyncSession, user: User) -> list[AlertRule]:
    existing = (await session.scalars(select(AlertRule).where(AlertRule.user_id == user.id))).all()
    if existing:
        return list(existing)
    rules = [
        AlertRule(
            user_id=user.id,
            rule_type=rule_type,
            target_type=target_type,
            target_value=target_value,
            threshold=threshold,
            cooldown_minutes=cooldown,
        )
        for rule_type, target_type, target_value, threshold, cooldown in DEFAULT_RULES
    ]
    session.add_all(rules)
    await session.flush()
    return rules


def _preference_enabled(preference: Preference | None, key: str, default: bool = True) -> bool:
    policy = preference.refresh_policy if preference and isinstance(preference.refresh_policy, dict) else {}
    return bool(policy.get(key, default))


def _event_text(event: Event) -> str:
    ai = ai_metadata(event)
    parts = [event.title, event.summary or "", event.category or "", event.region or ""]
    parts.extend(str(item) for item in event.entities or [])
    for entity in ai.get("entities") or []:
        if isinstance(entity, dict):
            parts.append(str(entity.get("name") or ""))
        else:
            parts.append(str(entity))
    return " ".join(parts).lower()


def _event_delta(event: Event) -> float:
    ai = ai_metadata(event)
    breakdown = ai.get("pulse_breakdown") if isinstance(ai.get("pulse_breakdown"), dict) else {}
    if isinstance(breakdown.get("delta"), int | float):
        return float(breakdown["delta"])
    phase6 = (event.metadata_json or {}).get("phase6")
    history = phase6.get("intensity_history") if isinstance(phase6, dict) else []
    values = [float(item.get("score")) for item in history or [] if isinstance(item, dict) and isinstance(item.get("score"), int | float)]
    if len(values) >= 2:
        return values[-1] - values[-2]
    return 0.0


def _matches_profile(event: Event, preference: Preference | None) -> bool:
    if not preference:
        return True
    categories = {item.lower() for item in preference.categories or []}
    regions = {item.lower() for item in preference.regions or []}
    category_match = not categories or (event.category or "").lower() in categories
    region_match = not regions or "global" in regions or (event.region or "").lower() in regions
    return category_match and region_match


def _matched_entities(event: Event, preference: Preference | None) -> list[str]:
    text = _event_text(event)
    return [entity for entity in (preference.tracked_entities if preference else []) if entity and entity.lower() in text]


def _rule_for(rules: list[AlertRule], rule_type: str, target: str = "*") -> AlertRule | None:
    enabled = [rule for rule in rules if rule.enabled and rule.rule_type == rule_type]
    exact = [rule for rule in enabled if rule.target_value.lower() == target.lower()]
    return (exact or [rule for rule in enabled if rule.target_value == "*"] or [None])[0]


def build_candidates(user: User, preference: Preference | None, rules: list[AlertRule], event: Event) -> list[AlertCandidate]:
    if not _preference_enabled(preference, "alerts_enabled", True):
        return []
    tier = tier_from_event(event)
    pulse = pulse_from_event(event)
    delta = _event_delta(event)
    candidates: list[AlertCandidate] = []
    matched_entities = _matched_entities(event, preference)
    matched_topics = [event.category] if event.category and _matches_profile(event, preference) else []
    reason_base = {
        "event_id": str(event.id),
        "event_title": event.title,
        "tier": tier,
        "pulse_after": pulse,
        "delta": delta,
        "matched_topics": matched_topics,
        "matched_entities": matched_entities,
        "sources": event.source_count,
    }

    rule = _rule_for(rules, "critical_event")
    if rule and tier == "CRITICAL" and _matches_profile(event, preference):
        candidates.append(AlertCandidate("critical_event", "critical", "Critical signal in your world pulse", event.title, event, rule, event.category or "*", {**reason_base, "trigger": "critical_event"}))

    rule = _rule_for(rules, "pulse_spike")
    if rule and delta >= (rule.threshold or 12):
        candidates.append(AlertCandidate("pulse_spike", "high" if delta >= 20 else "medium", "Pulse spike detected", f"{event.title} rose {delta:+.0f} points", event, rule, event.category or "*", {**reason_base, "trigger": "pulse_spike", "pulse_before": pulse - delta}))

    rule = _rule_for(rules, "exposure_jump")
    if rule and _matches_profile(event, preference) and pulse >= (rule.threshold or 75):
        candidates.append(AlertCandidate("exposure_jump", "high", "Your exposure jumped", f"{event.title} is now highly relevant to your profile", event, rule, event.category or "*", {**reason_base, "trigger": "exposure_jump", "exposure_score": pulse}))

    rule = _rule_for(rules, "tracked_entity")
    if rule and tier in {"SIGNAL", "CRITICAL"} and matched_entities:
        for entity in matched_entities[:3]:
            candidates.append(AlertCandidate("tracked_entity", "critical" if tier == "CRITICAL" else "high", f"{entity} appeared in a {tier.lower()} signal", event.title, event, rule, entity, {**reason_base, "trigger": "tracked_entity", "target_entity": entity}))

    rule = _rule_for(rules, "heat_spike")
    if rule and event.category and _matches_profile(event, preference) and delta >= (rule.threshold or 12):
        candidates.append(AlertCandidate("heat_spike", "medium", f"{event.category.title()} heat is rising", f"{event.category.title()} moved {delta:+.0f} points", event, rule, event.category, {**reason_base, "trigger": "heat_spike"}))

    return candidates


async def _can_create(session: AsyncSession, user_id: UUID, candidate: AlertCandidate) -> tuple[bool, str]:
    now = utcnow()
    fp = fingerprint(user_id, candidate.alert_type, candidate.event.id, candidate.target_value)
    cooldown = timedelta(minutes=candidate.rule.cooldown_minutes if candidate.rule else 360)
    recent = await session.scalar(
        select(Alert)
        .where(Alert.user_id == user_id, Alert.fingerprint == fp, Alert.created_at >= now - cooldown)
        .order_by(Alert.created_at.desc())
        .limit(1)
    )
    if recent:
        return False, "cooldown_duplicate"

    unread_same = await session.scalar(
        select(Alert)
        .where(Alert.user_id == user_id, Alert.event_id == candidate.event.id, Alert.rule_id == (candidate.rule.id if candidate.rule else None), Alert.status == "unread")
        .limit(1)
    )
    if unread_same:
        return False, "duplicate_unread_event_rule"

    today_count = await session.scalar(select(func.count(Alert.id)).where(Alert.user_id == user_id, Alert.created_at >= now - timedelta(days=1)))
    if int(today_count or 0) >= MAX_ALERTS_PER_DAY:
        return False, "daily_cap"

    if candidate.severity == "critical":
        critical_count = await session.scalar(select(func.count(Alert.id)).where(Alert.user_id == user_id, Alert.severity == "critical", Alert.created_at >= now - timedelta(hours=1)))
        if int(critical_count or 0) >= MAX_CRITICAL_PER_HOUR:
            return False, "critical_hourly_cap"
    return True, fp


async def create_alert_if_allowed(session: AsyncSession, user: User, candidate: AlertCandidate) -> tuple[Alert | None, str]:
    allowed, value = await _can_create(session, user.id, candidate)
    if not allowed:
        return None, value
    alert = Alert(
        user_id=user.id,
        event_id=candidate.event.id,
        rule_id=candidate.rule.id if candidate.rule else None,
        alert_type=candidate.alert_type,
        severity=candidate.severity,
        title=candidate.title,
        message=candidate.message,
        reason_json=candidate.reason_json,
        status="unread",
        unread=True,
        resolved=False,
        fingerprint=value,
    )
    session.add(alert)
    await session.flush()
    return alert, "created"


async def evaluate_user_alerts(session: AsyncSession, user: User, *, hours: int = 24, limit: int = 80) -> dict[str, int]:
    preference = await session.scalar(select(Preference).where(Preference.user_id == user.id))
    rules = await ensure_default_rules(session, user)
    cutoff = utcnow() - timedelta(hours=hours)
    events = (
        await session.scalars(
            select(Event)
            .options(selectinload(Event.article_links).selectinload(EventArticle.article))
            .where(Event.last_seen_at >= cutoff, Event.status == "active")
            .order_by(Event.last_seen_at.desc())
            .limit(limit)
        )
    ).unique().all()
    created = 0
    skipped = 0
    for event in events:
        for candidate in build_candidates(user, preference, list(rules), event):
            alert, _ = await create_alert_if_allowed(session, user, candidate)
            if alert:
                created += 1
                await maybe_send_email(user, alert)
            else:
                skipped += 1
    return {"checked_users": 1, "events_checked": len(events), "alerts_created": created, "alerts_skipped": skipped}


async def evaluate_all_users(session: AsyncSession, *, limit_users: int = 100) -> dict[str, int]:
    users = (await session.scalars(select(User).where(User.is_active == True).limit(limit_users))).all()
    totals = {"checked_users": 0, "events_checked": 0, "alerts_created": 0, "alerts_skipped": 0}
    for user in users:
        result = await evaluate_user_alerts(session, user)
        for key in totals:
            totals[key] += result.get(key, 0)
    return totals


async def maybe_send_email(user: User, alert: Alert) -> None:
    host = os.getenv("SMTP_HOST")
    if not host or not user.email:
        return
    message = EmailMessage()
    message["Subject"] = f"NewsIntel alert: {alert.title or alert.alert_type}"
    message["From"] = os.getenv("SMTP_FROM", os.getenv("SMTP_USER", "alerts@newsintel.local"))
    message["To"] = user.email
    message.set_content(f"{alert.title or 'NewsIntel alert'}\n\n{alert.message}")
    try:
        def send() -> None:
            port = int(os.getenv("SMTP_PORT", "587"))
            with smtplib.SMTP(host, port, timeout=10) as smtp:
                if os.getenv("SMTP_TLS", "true").lower() == "true":
                    smtp.starttls()
                if os.getenv("SMTP_USER"):
                    smtp.login(os.getenv("SMTP_USER", ""), os.getenv("SMTP_PASSWORD", ""))
                smtp.send_message(message)
        import asyncio
        await asyncio.to_thread(send)
        alert.delivered_at = utcnow()
    except Exception as exc:
        reason = dict(alert.reason_json or {})
        reason["email_error"] = str(exc)[:240]
        alert.reason_json = reason
