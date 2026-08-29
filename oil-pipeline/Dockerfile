FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y gcc libxml2-dev libxslt-dev && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

ENV OIL_EMBED_WORKER=1
ENV HF_SPACE_URL=YAsh213kadian/News-Intel
ENV NEWSINTEL_API_URL=https://newsintel-xvhe.onrender.com

EXPOSE 8000

# Dedicated oil-pipeline API + embedded hourly worker.
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
