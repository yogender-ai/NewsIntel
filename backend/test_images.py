import requests
r = requests.get('http://localhost:8000/analyze', params={'topic': 'Artificial Intelligence', 'force': 'true'})
data = r.json()

with open('test_results.txt', 'w', encoding='utf-8') as f:
    f.write(f"Total articles: {len(data.get('all_articles', []))}\n\n")
    images_found = 0
    for a in data.get('all_articles', []):
        img = a.get('image_url', '')
        if img:
            images_found += 1
            f.write(f"  OK  {a['source']:25s} -> {img[:120]}\n")
        else:
            f.write(f"  NO  {a['source']:25s} -> NO IMAGE\n")
    f.write(f"\nImages found: {images_found}/{len(data.get('all_articles', []))}\n")

print("Done - check test_results.txt")
