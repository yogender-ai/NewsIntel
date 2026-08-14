from fastapi import Header, HTTPException, Request

from app.core.config import get_settings


def require_ingest_secret(
    request: Request,
    x_ingest_secret: str | None = Header(default=None, alias="X-Ingest-Secret"),
    x_gateway_secret: str | None = Header(default=None, alias="X-Gateway-Secret"),
) -> None:
    settings = get_settings()
    expected = settings.effective_ingest_secret
    if not expected:
        raise HTTPException(status_code=401, detail="Ingest secret is not configured")
    supplied = (x_ingest_secret or x_gateway_secret or "").strip()
    if supplied != expected:
        raise HTTPException(status_code=401, detail="Invalid ingestion secret")
    _ = request
