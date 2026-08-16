"""News-Intel product entrypoint.

The old 2k-line god file is gone. All HTTP lives in app/api/routes/*.
Docker / Render still start `uvicorn main:app` — this file only re-exports
the clean FastAPI app.
"""

from app.main import app

__all__ = ["app"]
