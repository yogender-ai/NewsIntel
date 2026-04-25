import os


DEFAULT_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "https://newsintel.yogender1.me",
    "https://www.newsintel.yogender1.me",
    "https://yogender1.me",
    "https://www.yogender1.me",
    "https://newsintel-xvhe.onrender.com",
]


def allowed_origins() -> list[str]:
    extra = [
        origin.strip()
        for origin in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",")
        if origin.strip()
    ]
    return sorted(set(DEFAULT_ALLOWED_ORIGINS + extra))


# Match any subdomain of yogender1.me, vercel.app, or onrender.com
ALLOWED_ORIGIN_REGEX = r"https://.*(\.yogender1\.me|\.vercel\.app|\.onrender\.com)$"
