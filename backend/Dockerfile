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

ENV EMBED_WORKER=1
ENV HF_SPACE_URL=YAsh213kadian/News-Intel

EXPOSE 8000

# `main:app` re-exports the clean router app in app/main.py.
# Alembic must never block boot if the image and DB revision diverge.
CMD (alembic upgrade head || true) && uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
