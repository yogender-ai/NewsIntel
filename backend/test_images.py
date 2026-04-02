import requests
r = requests.get('http://localhost:8000/analyze', params={'topic': 'Artificial Intelligence', 'force': 'true'})
data = r.json()
print(f"Total articles: {len(data.get('all_articles', []))}")
print()
for a in data.get('all_articles', []):
    img = a.get('image_url', '')
    if img:
        print(f"  ✅ {a['source']:25s} → {img[:100]}")
    else:
        print(f"  ❌ {a['source']:25s} → NO IMAGE")
