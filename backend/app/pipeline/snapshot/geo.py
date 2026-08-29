"""Turn story text into country hits the world map can actually plot."""

from __future__ import annotations

COUNTRIES: list[dict] = [
    {"code": "AF", "name": "Afghanistan", "lat": 34.5, "lng": 69.2, "keys": ["afghanistan", "kabul"]},
    {"code": "AR", "name": "Argentina", "lat": -34.6, "lng": -58.4, "keys": ["argentina", "buenos aires"]},
    {"code": "AU", "name": "Australia", "lat": -35.3, "lng": 149.1, "keys": ["australia", "sydney", "canberra"]},
    {"code": "BD", "name": "Bangladesh", "lat": 23.8, "lng": 90.4, "keys": ["bangladesh", "dhaka"]},
    {"code": "BE", "name": "Belgium", "lat": 50.8, "lng": 4.4, "keys": ["belgium", "brussels"]},
    {"code": "BR", "name": "Brazil", "lat": -15.8, "lng": -47.9, "keys": ["brazil", "brasilia", "são paulo", "sao paulo"]},
    {"code": "CA", "name": "Canada", "lat": 45.4, "lng": -75.7, "keys": ["canada", "ottawa", "toronto"]},
    {"code": "CN", "name": "China", "lat": 39.9, "lng": 116.4, "keys": ["china", "beijing", "shanghai", "chinese"]},
    {"code": "DE", "name": "Germany", "lat": 52.5, "lng": 13.4, "keys": ["germany", "berlin", "german"]},
    {"code": "EG", "name": "Egypt", "lat": 30.0, "lng": 31.2, "keys": ["egypt", "cairo"]},
    {"code": "ES", "name": "Spain", "lat": 40.4, "lng": -3.7, "keys": ["spain", "madrid"]},
    {"code": "ET", "name": "Ethiopia", "lat": 9.0, "lng": 38.7, "keys": ["ethiopia", "addis"]},
    {"code": "FR", "name": "France", "lat": 48.9, "lng": 2.3, "keys": ["france", "paris", "french"]},
    {"code": "GB", "name": "United Kingdom", "lat": 51.5, "lng": -0.1, "keys": ["united kingdom", "britain", "british", "england", "scotland", "wales", "london", "uk"]},
    {"code": "GH", "name": "Ghana", "lat": 5.6, "lng": -0.2, "keys": ["ghana", "accra"]},
    {"code": "GR", "name": "Greece", "lat": 37.98, "lng": 23.7, "keys": ["greece", "athens"]},
    {"code": "ID", "name": "Indonesia", "lat": -6.2, "lng": 106.8, "keys": ["indonesia", "jakarta"]},
    {"code": "IE", "name": "Ireland", "lat": 53.3, "lng": -6.3, "keys": ["ireland", "dublin"]},
    {"code": "IL", "name": "Israel", "lat": 31.8, "lng": 35.2, "keys": ["israel", "jerusalem"]},
    {"code": "IN", "name": "India", "lat": 28.6, "lng": 77.2, "keys": ["india", "new delhi", "delhi", "mumbai"]},
    {"code": "IQ", "name": "Iraq", "lat": 33.3, "lng": 44.4, "keys": ["iraq", "baghdad"]},
    {"code": "IR", "name": "Iran", "lat": 35.7, "lng": 51.4, "keys": ["iran", "tehran"]},
    {"code": "IT", "name": "Italy", "lat": 41.9, "lng": 12.5, "keys": ["italy", "rome"]},
    {"code": "JP", "name": "Japan", "lat": 35.7, "lng": 139.7, "keys": ["japan", "tokyo"]},
    {"code": "KE", "name": "Kenya", "lat": -1.3, "lng": 36.8, "keys": ["kenya", "nairobi"]},
    {"code": "KR", "name": "South Korea", "lat": 37.6, "lng": 127.0, "keys": ["south korea", "seoul", "korea"]},
    {"code": "MX", "name": "Mexico", "lat": 19.4, "lng": -99.1, "keys": ["mexico", "mexico city"]},
    {"code": "NG", "name": "Nigeria", "lat": 9.1, "lng": 7.5, "keys": ["nigeria", "abuja", "lagos"]},
    {"code": "NL", "name": "Netherlands", "lat": 52.4, "lng": 4.9, "keys": ["netherlands", "amsterdam", "dutch"]},
    {"code": "NZ", "name": "New Zealand", "lat": -41.3, "lng": 174.8, "keys": ["new zealand", "wellington"]},
    {"code": "PK", "name": "Pakistan", "lat": 33.7, "lng": 73.1, "keys": ["pakistan", "islamabad"]},
    {"code": "PH", "name": "Philippines", "lat": 14.6, "lng": 121.0, "keys": ["philippines", "manila"]},
    {"code": "PL", "name": "Poland", "lat": 52.2, "lng": 21.0, "keys": ["poland", "warsaw"]},
    {"code": "QA", "name": "Qatar", "lat": 25.3, "lng": 51.5, "keys": ["qatar", "doha"]},
    {"code": "RU", "name": "Russia", "lat": 55.8, "lng": 37.6, "keys": ["russia", "moscow", "russian"]},
    {"code": "SA", "name": "Saudi Arabia", "lat": 24.7, "lng": 46.7, "keys": ["saudi", "riyadh"]},
    {"code": "TR", "name": "Turkey", "lat": 39.9, "lng": 32.9, "keys": ["turkey", "ankara", "istanbul"]},
    {"code": "UA", "name": "Ukraine", "lat": 50.5, "lng": 30.5, "keys": ["ukraine", "kyiv", "kiev"]},
    {"code": "AE", "name": "United Arab Emirates", "lat": 24.5, "lng": 54.4, "keys": ["uae", "dubai", "abu dhabi", "emirates"]},
    {"code": "US", "name": "United States", "lat": 38.9, "lng": -77.0, "keys": ["united states", "america", "american", "washington", "hawaii", "honolulu", "california", "new york"]},
    {"code": "ZA", "name": "South Africa", "lat": -25.7, "lng": 28.2, "keys": ["south africa", "pretoria", "johannesburg"]},
]


def _haystack(card: dict) -> str:
    bits = [
        card.get("title") or "",
        card.get("thread_title") or "",
        card.get("summary") or "",
        card.get("source_name") or "",
    ]
    for entity in card.get("entities") or []:
        if isinstance(entity, dict):
            bits.append(str(entity.get("name") or ""))
        else:
            bits.append(str(entity))
    return f" {' '.join(bits)} ".lower()


def countries_from_cards(cards: list[dict]) -> list[dict]:
    buckets: dict[str, dict] = {}
    for card in cards:
        text = _haystack(card)
        pulse = float(card.get("pulse_score") or 50)
        for country in COUNTRIES:
            if not any(f" {key} " in text or text.strip().startswith(key) for key in country["keys"]):
                continue
            row = buckets.setdefault(
                country["code"],
                {
                    "id": country["code"],
                    "code": country["code"],
                    "name": country["name"],
                    "lat": country["lat"],
                    "lng": country["lng"],
                    "mode": "country",
                    "intensity": 0.0,
                    "event_count": 0,
                    "pulses": [],
                },
            )
            row["event_count"] += 1
            row["pulses"].append(pulse)
    out = []
    for row in buckets.values():
        pulses = row.pop("pulses")
        intensity = round(sum(pulses) / max(len(pulses), 1), 2)
        row["intensity"] = intensity
        row["risk"] = "high" if intensity >= 70 else "medium" if intensity >= 45 else "low"
        row["opportunity"] = "high" if intensity >= 65 else "medium" if intensity >= 40 else "low"
        out.append(row)
    out.sort(key=lambda item: item["event_count"], reverse=True)
    return out
