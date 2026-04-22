import os
from dotenv import load_dotenv
from gradio_client import Client
import json
import logging

load_dotenv()

HF_TOKEN = os.getenv("HF_TOKEN")
HF_SPACE_URL = os.getenv("HF_SPACE_URL", "YAsh213kadian/News_intel_HF_space_1")

logger = logging.getLogger("hf_client")

if not HF_TOKEN:
    logger.error("HF_TOKEN is missing in your .env file!")

# Initialize the Gradio Client
try:
    client = (
        Client(HF_SPACE_URL, hf_token=HF_TOKEN)
        if "hf_token" in Client.__init__.__code__.co_varnames
        else Client(HF_SPACE_URL, token=HF_TOKEN)
    )
    logger.info(f"Connected to Hugging Face Space: {HF_SPACE_URL}")
except Exception as e:
    logger.error(f"Failed to connect to Hugging Face Space: {e}")
    client = None

async def summarize_text(text: str) -> dict:
    """Summarizes text using the /summarize endpoint."""
    if not client:
        return {"summary": "Hugging Face client not initialized."}
    try:
        response_raw = client.predict(text, api_name="/summarize")
        response = json.loads(response_raw) if isinstance(response_raw, str) else response_raw
        return response
    except Exception as e:
        logger.error(f"Summarization failed: {e}")
        return {"summary": f"Summarization failed: {str(e)}"}

async def analyze_sentiment(text: str) -> dict:
    """Analyzes sentiment using the /analyze_sentiment endpoint."""
    if not client:
        return {"label": "UNKNOWN", "score": 0.0}
    try:
        response_raw = client.predict(text, api_name="/analyze_sentiment")
        response = json.loads(response_raw) if isinstance(response_raw, str) else response_raw
        return response
    except Exception as e:
        logger.error(f"Sentiment analysis failed: {e}")
        return {"label": "ERROR", "score": 0.0}

async def extract_entities(text: str) -> dict:
    """Extracts entities using the /extract_entities endpoint."""
    if not client:
        return {"entities": []}
    try:
        response_raw = client.predict(text, api_name="/extract_entities")
        response = json.loads(response_raw) if isinstance(response_raw, str) else response_raw
        return response
    except Exception as e:
        logger.error(f"Entity extraction failed: {e}")
        return {"entities": []}
