"""Signup / login / refresh / profile endpoints backed by NewsIntel's own JWTs."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_account, get_session
from app.core.auth import (
    create_access_token,
    hash_password,
    hash_refresh_token,
    needs_rehash,
    new_refresh_token,
    verify_password,
)
from app.models.account import Account, AccountProfile, RefreshSession
from app.services.profile_embedding import schedule_profile_embedding

router = APIRouter(tags=["auth"], prefix="/api/auth")

# Generic on purpose: never reveal whether an email exists.
BAD_CREDENTIALS = "Email or password is incorrect."


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)
    display_name: str | None = Field(default=None, max_length=160)

    @field_validator("password")
    @classmethod
    def password_strength(cls, value: str) -> str:
        if value.isdigit() or value.isalpha():
            raise ValueError("Password needs both letters and numbers.")
        return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class ProfileUpdate(BaseModel):
    topics: list[str] | None = None
    regions: list[str] | None = None
    keywords: list[str] | None = None
    muted_keywords: list[str] | None = None
    occupation: str | None = Field(default=None, max_length=120)
    role_title: str | None = Field(default=None, max_length=160)
    industry: str | None = Field(default=None, max_length=120)
    seniority: str | None = Field(default=None, max_length=60)
    employer: str | None = Field(default=None, max_length=160)
    country: str | None = Field(default=None, max_length=80)
    city: str | None = Field(default=None, max_length=120)
    self_description: str | None = Field(default=None, max_length=2000)
    goals: list[str] | None = None
    digest_frequency: str | None = None
    reading_level: str | None = None
    onboarded: bool | None = None
    onboarding_step: int | None = None


def _profile_payload(profile: AccountProfile | None) -> dict:
    if profile is None:
        return {"onboarded": False, "onboarding_step": 0, "topics": [], "regions": []}
    return {
        "topics": profile.topics,
        "regions": profile.regions,
        "keywords": profile.keywords,
        "muted_keywords": profile.muted_keywords,
        "occupation": profile.occupation,
        "role_title": profile.role_title,
        "industry": profile.industry,
        "seniority": profile.seniority,
        "employer": profile.employer,
        "country": profile.country,
        "city": profile.city,
        "self_description": profile.self_description,
        "goals": profile.goals,
        "digest_frequency": profile.digest_frequency,
        "reading_level": profile.reading_level,
        "onboarded": profile.onboarded,
        "onboarding_step": profile.onboarding_step,
        "has_profile_embedding": profile.profile_embedding is not None,
    }


def _account_payload(account: Account, profile: AccountProfile | None) -> dict:
    return {
        "id": str(account.id),
        "email": account.email,
        "display_name": account.display_name,
        "avatar_url": account.avatar_url,
        "auth_provider": account.auth_provider,
        "created_at": account.created_at.isoformat() if account.created_at else None,
        "profile": _profile_payload(profile),
    }


async def _issue_session(
    session: AsyncSession, account: Account, request: Request
) -> dict:
    raw_refresh, token_hash, expires_at = new_refresh_token()
    session.add(
        RefreshSession(
            account_id=account.id,
            token_hash=token_hash,
            expires_at=expires_at,
            user_agent=(request.headers.get("user-agent") or "")[:300] or None,
            ip_address=(request.client.host if request.client else None),
        )
    )
    account.last_login_at = datetime.now(timezone.utc)
    access, expires_in = create_access_token(str(account.id), email=account.email)
    return {
        "access_token": access,
        "refresh_token": raw_refresh,
        "token_type": "bearer",
        "expires_in": expires_in,
    }


@router.post("/signup", status_code=201)
async def signup(
    payload: SignupRequest, request: Request, session: AsyncSession = Depends(get_session)
):
    email = payload.email.lower().strip()
    existing = await session.scalar(select(Account).where(Account.email == email))
    if existing:
        raise HTTPException(status_code=409, detail="An account with that email already exists.")

    account = Account(
        email=email,
        password_hash=hash_password(payload.password),
        display_name=(payload.display_name or email.split("@")[0])[:160],
        auth_provider="password",
    )
    session.add(account)
    await session.flush()
    profile = AccountProfile(account_id=account.id)
    session.add(profile)

    tokens = await _issue_session(session, account, request)
    await session.commit()
    await session.refresh(account)
    return {**tokens, "account": _account_payload(account, profile)}


@router.post("/login")
async def login(
    payload: LoginRequest, request: Request, session: AsyncSession = Depends(get_session)
):
    email = payload.email.lower().strip()
    account = await session.scalar(select(Account).where(Account.email == email))
    if account is None or not verify_password(payload.password, account.password_hash):
        raise HTTPException(status_code=401, detail=BAD_CREDENTIALS)
    if not account.is_active:
        raise HTTPException(status_code=403, detail="This account is disabled.")

    # Transparently upgrade the hash if argon2 parameters have changed.
    if account.password_hash and needs_rehash(account.password_hash):
        account.password_hash = hash_password(payload.password)

    tokens = await _issue_session(session, account, request)
    profile = await session.scalar(
        select(AccountProfile).where(AccountProfile.account_id == account.id)
    )
    await session.commit()
    return {**tokens, "account": _account_payload(account, profile)}


@router.post("/refresh")
async def refresh(
    payload: RefreshRequest, request: Request, session: AsyncSession = Depends(get_session)
):
    token_hash = hash_refresh_token(payload.refresh_token)
    stored = await session.scalar(
        select(RefreshSession).where(RefreshSession.token_hash == token_hash)
    )
    now = datetime.now(timezone.utc)
    if stored is None or stored.revoked_at is not None or stored.expires_at <= now:
        raise HTTPException(status_code=401, detail="Refresh token is invalid or expired.")

    account = await session.get(Account, stored.account_id)
    if account is None or not account.is_active:
        raise HTTPException(status_code=401, detail="Account not found or disabled.")

    # Rotate: the presented token is retired and a fresh one issued, so a stolen
    # refresh token is usable at most once before the real user's next refresh
    # invalidates it.
    stored.revoked_at = now
    stored.last_used_at = now
    tokens = await _issue_session(session, account, request)
    await session.commit()
    return tokens


@router.post("/logout", status_code=204)
async def logout(
    payload: RefreshRequest,
    session: AsyncSession = Depends(get_session),
    _: Account = Depends(get_current_account),
):
    stored = await session.scalar(
        select(RefreshSession).where(RefreshSession.token_hash == hash_refresh_token(payload.refresh_token))
    )
    if stored and stored.revoked_at is None:
        stored.revoked_at = datetime.now(timezone.utc)
        await session.commit()
    return None


@router.get("/me")
async def me(
    account: Account = Depends(get_current_account),
    session: AsyncSession = Depends(get_session),
):
    profile = await session.scalar(
        select(AccountProfile).where(AccountProfile.account_id == account.id)
    )
    return _account_payload(account, profile)


@router.patch("/me/profile")
async def update_profile(
    payload: ProfileUpdate,
    account: Account = Depends(get_current_account),
    session: AsyncSession = Depends(get_session),
):
    profile = await session.scalar(
        select(AccountProfile).where(AccountProfile.account_id == account.id)
    )
    if profile is None:
        profile = AccountProfile(account_id=account.id)
        session.add(profile)
        await session.flush()

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)

    await session.commit()
    await session.refresh(profile)

    # Re-embed the profile so personal-impact matching reflects the new answers.
    await schedule_profile_embedding(session, profile)
    await session.commit()
    await session.refresh(profile)
    return _profile_payload(profile)


@router.delete("/me", status_code=204)
async def delete_account(
    account: Account = Depends(get_current_account),
    session: AsyncSession = Depends(get_session),
):
    await session.delete(account)
    await session.commit()
    return None
