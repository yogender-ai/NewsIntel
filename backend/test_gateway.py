import os
from dotenv import load_dotenv
from google import genai
import sys

# Load environment variables from .env
load_dotenv()

GATEWAY_SECRET = os.getenv("GATEWAY_SECRET", "").strip()

if not GATEWAY_SECRET or GATEWAY_SECRET == "your-gateway-secret-here":
    print("[ERROR] GATEWAY_SECRET is not set correctly in your .env file!")
    print(f"Current value: '{GATEWAY_SECRET}'")
    print("Please update it to match the actual secret from your Cloud Command dashboard.")
    sys.exit(1)

print("[INFO] Testing Cloud Command Gateway Connection...")
print(f"Using Secret: {GATEWAY_SECRET[:5]}...{GATEWAY_SECRET[-3:] if len(GATEWAY_SECRET) > 8 else ''}")

try:
    # Initialize the Gemini client pointing to the Gateway
    client = genai.Client(
        api_key=GATEWAY_SECRET,
        http_options={
            "base_url": "https://cloudcmd.yogender1.me/api/gateway/gemini",
            "headers": {
                "X-Gateway-Secret": GATEWAY_SECRET,
                "X-Project-Category": "News-Intel"
            }
        }
    )

    print("\n[INFO] Sending test request to Gemini via Gateway...")
    
    # Send a simple prompt
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents="Say 'Gateway connection successful!' and nothing else.",
    )
    
    print("\n[SUCCESS] Received response from Gemini:")
    print("-" * 40)
    print(response.text.strip())
    print("-" * 40)

except Exception as e:
    print("\n[ERROR] FAILED! Could not connect to Gemini via Gateway.")
    print("Error Details:")
    print(str(e))
