import os, json, re
from dotenv import load_dotenv
from google import genai

load_dotenv()
client = genai.Client(api_key=os.getenv('GEMINI_API_KEY'))

prompt = """You are a Geospatial Intelligence AI parsing news headlines to plot on a global map. Extract the primary countries involved in each headline.
Return JSON format strictly as an array of objects:
```json
[
  {
    "id": 0,
    "countries": ["United States", "Russia"],
    "event_label": "CYBERATTACK",
    "severity": "critical"
  }
]
```
Rules:
- 'countries' must be an array of EXACT full country names ONLY (e.g., 'United States', never 'USA', 'United Kingdom', never 'UK'). If none, return empty array.
- 'event_label' MUST be a highly professional 1-2 word tactical tag.
- 'severity' MUST be one of: 'critical', 'high', 'medium', 'low'.
- Return ONLY valid JSON.

Headlines:
0. Russia and Ukraine accuse each other of violating Putin's Easter ceasefire.
"""

response = client.models.generate_content(model='gemini-2.0-flash', contents=prompt)
print(response.text)
