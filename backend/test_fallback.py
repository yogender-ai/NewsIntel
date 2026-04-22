"""Quick test: verify model fallback list is used"""
import sys, asyncio
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, '.')
from dotenv import load_dotenv
load_dotenv()
import hf_client

async def test():
    print("Testing Gemini with model fallback...")
    print(f"  Models in fallback chain: {hf_client._GEMINI_MODELS}")
    
    r = await hf_client.generate_narrative_brief(
        "[Reuters] US chip restrictions cause NVIDIA stock drop. [Bloomberg] Fed hints at rate cuts."
    )
    print(f"\n  Brief ({len(r)} chars): {r[:200]}")
    print(f"\n  Status: {'✅ SUCCESS' if len(r) > 20 else '❌ FAILED'}")

asyncio.run(test())
