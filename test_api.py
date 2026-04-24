import httpx
import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

# Your Cloud Command Gateway URL
CLOUD_COMMAND_BASE_URL = "http://127.0.0.1:8000"

# Your Master Gateway Secret
GATEWAY_SECRET = os.getenv("GATEWAY_SECRET", "")

# The path we want to hit on Gemini
target_provider = "gemini"
target_path = "v1beta/models/gemini-2.5-flash:generateContent"

async def test_gateway():
    if not GATEWAY_SECRET:
        print("GATEWAY_SECRET is missing. Add it to your local .env before running this test.")
        return

    print(f"Connecting to Cloud Command Gateway at {CLOUD_COMMAND_BASE_URL}...")
    
    url = f"{CLOUD_COMMAND_BASE_URL}/api/gateway/{target_provider}/{target_path}"
    
    headers = {
        "Authorization": f"Bearer {GATEWAY_SECRET}",
        "Content-Type": "application/json",
        "X-Project-Category": "News-Intel"
    }
    
    payload = {
        "contents": [{
            "parts": [{"text": "Hello Gemini! I am testing my new API Gateway tracking system."}]
        }]
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            print(f"\n--- GATEWAY RESPONSE [STATUS: {response.status_code}] ---")
            
            if response.status_code == 200:
                data = response.json()
                text = data.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '')
                print(f"\nGemini: {text}")
                
                usage = data.get('usageMetadata', {})
                print(f"\n[Usage Tracked] Input Tokens: {usage.get('promptTokenCount')}")
                print(f"[Usage Tracked] Output Tokens: {usage.get('candidatesTokenCount')}")
                print(f"[✅] Total Tokens logged to Cloud Command DB: {usage.get('totalTokenCount')}")
            else:
                print("Error from Gateway:")
                print(response.text)
                
    except Exception as e:
        print(f"Request failed! Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_gateway())
