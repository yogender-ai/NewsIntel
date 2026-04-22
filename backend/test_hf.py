import os
from dotenv import load_dotenv
from gradio_client import Client
import json
import time
import requests
import sys

# Set encoding to utf-8 to avoid charmap errors on Windows
if sys.platform == "win32":
    import io

    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

load_dotenv()

HF_TOKEN = os.getenv("HF_TOKEN")
HF_SPACE_URL = os.getenv("HF_SPACE_URL", "YAsh213kadian/News_intel_HF_space_1")
GATEWAY_SECRET = os.getenv("GATEWAY_SECRET")

if not HF_TOKEN:
    print("[ERROR] HF_TOKEN is missing in your .env file!")
    exit(1)

print("==================================================")
print(f"[INFO] Connecting to your Hugging Face Space: {HF_SPACE_URL}")
print("==================================================\n")

try:
    print("[INFO] Booting up Hugging Face Gradio Client...")
    # This initializes the connection to your Hugging Face NLP Pipeline
    client = (
        Client(HF_SPACE_URL, hf_token=HF_TOKEN)
        if "hf_token" in Client.__init__.__code__.co_varnames
        else Client(HF_SPACE_URL, token=HF_TOKEN)
    )

    sample_text = """
    Apple Inc. announced a revolutionary new AI chip on Monday, sending shockwaves through the tech industry.
    The new M4 processor is designed to handle massive LLMs locally on your phone. Investors responded positively,
    pushing the stock up by 3% in early trading. Tim Cook stated this is the biggest leap forward since the iPhone.
    """

    print("\n[TEST 1] Testing Summarization (distilBART)...")
    start = time.time()
    summary_raw = client.predict(sample_text, api_name="/summarize")
    summary = json.loads(summary_raw) if isinstance(summary_raw, str) else summary_raw
    print(f"[SUCCESS] Done in {time.time() - start:.2f}s")
    print(f"Summary: {summary.get('summary', '')}")

    print("\n[TEST 2] Testing Sentiment Analysis (RoBERTa)...")
    start = time.time()
    sentiment_raw = client.predict(sample_text, api_name="/analyze_sentiment")
    sentiment = json.loads(sentiment_raw) if isinstance(sentiment_raw, str) else sentiment_raw
    print(f"[SUCCESS] Done in {time.time() - start:.2f}s")
    print(f"Sentiment: {sentiment.get('label').upper()} (Confidence: {sentiment.get('score', 0):.2f})")

    print("\n[TEST 3] Testing Named Entity Recognition (BERT-NER)...")
    start = time.time()
    ner_raw = client.predict(sample_text, api_name="/extract_entities")
    ner = json.loads(ner_raw) if isinstance(ner_raw, str) else ner_raw
    print(f"[SUCCESS] Done in {time.time() - start:.2f}s")
    entities = ner.get("entities", [])
    for e in entities:
        print(f" - {e['name']} ({e['type']})")

    gateway_ok = None
    if GATEWAY_SECRET:
        print("\n==================================================")
        print("[INFO] Testing Cloud Command Gateway (Hugging Face Proxy)")
        print("==================================================")

        # Robust URL construction: derive the gateway root from a provider base URL.
        gateway_base_url_env = os.getenv(
            "GATEWAY_BASE_URL", "https://cloud-command.onrender.com/api/gateway/gemini"
        )
        if "/api/gateway" in gateway_base_url_env:
            base_parts = gateway_base_url_env.split("/api/gateway")
            gateway_root = f"{base_parts[0].rstrip('/')}/api/gateway"
        else:
            gateway_root = gateway_base_url_env.rstrip("/")

        # Prefer routing through your Hugging Face Space via the Gateway to avoid HF Inference Provider credits.
        # This endpoint is implemented in the Cloud Command backend as:
        #   POST /api/gateway/huggingface-space/{space_id}/{endpoint}
        gateway_hf_url = f"{gateway_root}/huggingface-space/{HF_SPACE_URL}/summarize"

        headers = {
            "X-Gateway-Secret": GATEWAY_SECRET,
            "X-Project-Category": "News-Intel",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

        payload = {"inputs": "The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris, France. i hate you"}

        print(f"[INFO] Gateway Root: {gateway_root}")
        print("[INFO] Target Provider: huggingface")
        print(f"[INFO] Calling Gateway URL: {gateway_hf_url}")

        try:
            start = time.time()
            # Use allow_redirects=False to see if we are being bounced
            response = requests.post(
                gateway_hf_url,
                headers=headers,
                json=payload,
                timeout=20,
                allow_redirects=False,
            )

            print(f"[DEBUG] Status Code: {response.status_code}")
            if response.status_code == 200:
                gateway_ok = True
                print(f"[SUCCESS] Gateway connection confirmed ({time.time() - start:.2f}s)")
                try:
                    data = response.json()
                    # Space returns your JSON string; gateway may return parsed dict.
                    if isinstance(data, str):
                        data = json.loads(data)
                    if isinstance(data, dict):
                        print(f"Gateway Response: {data.get('summary', '')[:120]}...")
                    else:
                        print(f"Gateway Response: {str(data)[:200]}")
                except Exception:
                    print(f"Gateway Response (Raw): {response.text[:200]}")
            elif response.status_code in (301, 302, 307, 308):
                gateway_ok = False
                print(f"[WARN] Gateway redirected to: {response.headers.get('Location')}")
            else:
                gateway_ok = False
                print(f"[FAILED] Gateway error! Status: {response.status_code}")
                print(f"Response Snippet: {response.text[:500]}")
        except Exception as ge:
            gateway_ok = False
            print(f"[ERROR] Gateway call failed: {ge}")

    print("\n==================================================")
    if gateway_ok is False:
        print("AI PIPELINE OK, BUT CLOUD COMMAND GATEWAY TEST FAILED (see details above).")
    else:
        print("ALL AI PIPELINE SERVICES ARE RESPONDING!")
    print("==================================================")

except Exception as e:
    print(f"\n[ERROR] Test failed: {e}")
