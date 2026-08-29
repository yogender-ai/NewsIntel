from collections.abc import AsyncIterator
from uuid import UUID

from fastapi import Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.core.redis import redis_api


async def get_session() -> AsyncIterator[AsyncSession]:
    async with AsyncSessionLocal() as session:
        yield session


async def get_redis():
    return redis_api


async def get_current_account(
    session: AsyncSession = Depends(get_session),
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> "Account":
    """Resolve the caller from a Bearer access token. 401s if absent or invalid."""
    from app.core.auth import AuthError, decode_access_token
    from app.models.account import Account

    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = decode_access_token(token)
    except AuthError:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from None

    account = await session.get(Account, UUID(payload["sub"]))
    if account is None or not account.is_active:
        raise HTTPException(status_code=401, detail="Account not found or disabled")
    return account


async def get_optional_account(
    session: AsyncSession = Depends(get_session),
    authorization: str | None = Header(default=None, alias="Authorization"),
):
    """Same as get_current_account but returns None instead of raising.

    Used by endpoints that work anonymously but personalize when signed in.
    """
    if not authorization:
        return None
    try:
        return await get_current_account(session=session, authorization=authorization)
    except HTTPException:
        return None
