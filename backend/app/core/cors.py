import os


DEFAULT_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "http://localhost:5180",
    "http://127.0.0.1:5180",
    "https://newsintel.yogender1.me",
    "https://www.newsintel.yogender1.me",
    "https://yogender1.me",
    "https://www.yogender1.me",
    "https://newsintel-xvhe.onrender.com",
    "https://oil-pipeline.vercel.app",
    "https://newsintel-pipeline.vercel.app",
    "https://news-intel-pipeline.vercel.app",
]


def allowed_origins() -> list[str]:
    extra = [
        origin.strip()
        for origin in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",")
        if origin.strip()
    ]
    return sorted(set(DEFAULT_ALLOWED_ORIGINS + extra))


# Match any subdomain of yogender1.me, plus the preview/production domains of the
# hosts we deploy to. pages.dev is Cloudflare Pages, where the frontend now lives —
# without it the deployed site is blocked by CORS on every API call.
ALLOWED_ORIGIN_REGEX = (
    r"https://.*(\.yogender1\.me|\.pages\.dev|\.vercel\.app|\.onrender\.com)$"
)
