FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    libxml2-dev \
    libxslt-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download nltk data for newspaper3k
RUN python -c "import nltk; nltk.download('punkt_tab', quiet=True)"

COPY . .

EXPOSE 8000

# Product site uses the original FastAPI app. Alembic must never block boot
# (DB may already be stamped with a revision this image does not apply).
# The oil-pipeline product is a separate service — see /oil-pipeline.
CMD (alembic upgrade head || true) && uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
