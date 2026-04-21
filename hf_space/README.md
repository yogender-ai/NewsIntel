---
title: NewsIntel NLP Pipeline
emoji: 🧠
colorFrom: purple
colorTo: blue
sdk: gradio
sdk_version: 4.44.1
app_file: app.py
pinned: false
---

# News-Intel NLP Pipeline

Real AI-powered NLP for the News-Intel platform.

## Models
- **Summarization**: `sshleifer/distilbart-cnn-12-6`
- **Sentiment**: `cardiffnlp/twitter-roberta-base-sentiment-latest`
- **NER**: `dslim/bert-base-NER`

## API Usage

Once deployed, use the API via `gradio_client`:

```python
from gradio_client import Client

client = Client("YOUR-USERNAME/newsintel-nlp")

# Summarize
result = client.predict(text, api_name="/summarize")

# Sentiment
result = client.predict(text, api_name="/analyze_sentiment")

# NER
result = client.predict(text, api_name="/extract_entities")
```

## Deployment

1. Create a new Space on HuggingFace (Gradio SDK)
2. Upload `app.py`, `requirements.txt`, and this `README.md`
3. The Space will auto-build and load all 3 models
4. CloudCmd pings the Space every 60s to keep it warm
