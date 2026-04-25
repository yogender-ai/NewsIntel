import re

from app.services.text_fingerprint import normalize_title, title_similarity


COMPANY_SUFFIXES = {
    "corp",
    "corporation",
    "inc",
    "ltd",
    "llc",
    "plc",
    "co",
    "company",
    "group",
}

GENERIC_EVENT_WORDS = {
    "announces",
    "announce",
    "announced",
    "plans",
    "plan",
    "launches",
    "launch",
    "reports",
    "report",
    "shares",
    "stock",
    "market",
    "deal",
    "new",
    "latest",
    "today",
    "after",
    "before",
    "amid",
    "says",
    "ai",
}


def significant_tokens(title: str) -> set[str]:
    normalized = normalize_title(title)
    tokens = {
        token
        for token in normalized.split()
        if len(token) >= 3 and token not in COMPANY_SUFFIXES and token not in GENERIC_EVENT_WORDS
    }
    return tokens


def numeric_tokens(title: str) -> set[str]:
    return set(re.findall(r"\b\d+(?:\.\d+)?%?|\$?\d+(?:\.\d+)?\s?(?:bn|billion|m|million)?\b", title.lower()))


def entity_like_tokens(title: str) -> set[str]:
    """Cheap entity proxy until NER/embeddings are in the clustering path."""
    return {
        token.lower()
        for token in re.findall(r"\b[A-Z][A-Za-z0-9&.-]{2,}\b", title or "")
        if token.lower() not in COMPANY_SUFFIXES and token.lower() not in GENERIC_EVENT_WORDS
    }


def should_cluster_titles(
    incoming_title: str,
    candidate_title: str,
    *,
    threshold: float,
) -> bool:
    similarity = title_similarity(incoming_title, candidate_title)
    if similarity < 0.5:
        return False

    incoming_tokens = significant_tokens(incoming_title)
    candidate_tokens = significant_tokens(candidate_title)
    token_overlap = len(incoming_tokens & candidate_tokens) / max(len(incoming_tokens | candidate_tokens), 1)

    incoming_entities = entity_like_tokens(incoming_title)
    candidate_entities = entity_like_tokens(candidate_title)
    entity_overlap = bool(incoming_entities & candidate_entities)
    entity_conflict = bool(incoming_entities and candidate_entities and incoming_entities.isdisjoint(candidate_entities))

    incoming_numbers = numeric_tokens(incoming_title)
    candidate_numbers = numeric_tokens(candidate_title)
    number_conflict = bool(incoming_numbers and candidate_numbers and incoming_numbers.isdisjoint(candidate_numbers))

    if number_conflict:
        return False
    if entity_conflict:
        return False

    if entity_overlap and token_overlap >= 0.40:
        return True

    # Some feeds lowercase everything; allow strong lexical match even without entity casing.
    return similarity >= max(0.86, threshold) and token_overlap >= 0.58
