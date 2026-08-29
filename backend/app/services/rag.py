"""Ask NewsIntel: hybrid retrieval over the signal corpus, with a visible trace.

Pipeline for one question:

    1. embed        query -> bge-m3 vector
    2. vector       cosine-nearest chunks via pgvector
    3. lexical      Postgres full-text over the same chunks
    4. fuse         reciprocal-rank fusion of the two candidate lists
    5. rerank       bge-reranker-base cross-encoder scores query x chunk
    6. filter       drop anything below the relevance floor
    7. generate     gpt-oss-120b answers using only surviving passages, citing [S#]

Every step appends to a trace so the UI can show what was retrieved, what was
thrown away, and why — the answer is never a black box. Vector and lexical search
each catch what the other misses: vectors handle paraphrase, full-text handles exact
names and tickers that embeddings blur.
"""

from __future__ import annotations

import hashlib
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any

import httpx
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.cloudflare import CloudflareAI
from app.ai.types import AICall
from app.core.config import get_settings
from app.models.account import AccountProfile
from app.models.rag import SignalChunk
from app.models.signal import Signal

logger = logging.getLogger("newsintel-rag")

RRF_K = 60  # standard reciprocal-rank-fusion damping constant

# plainto_tsquery ANDs every term, so a full sentence practically never matches a
# short news passage. We OR the meaningful terms instead and let ts_rank_cd sort out
# which passages matched the most of them.
STOPWORDS = {
    "the", "and", "for", "are", "but", "not", "you", "your", "with", "that", "this",
    "from", "have", "has", "had", "was", "were", "will", "would", "can", "could",
    "should", "what", "when", "where", "which", "who", "why", "how", "does", "did",
    "about", "into", "than", "then", "them", "they", "there", "their", "its", "it",
    "may", "might", "more", "most", "some", "any", "all", "also", "been", "being",
    "year", "years", "now", "get", "got",
}


def build_tsquery(question: str) -> str:
    """Turn a question into an OR-ed tsquery string, e.g. 'ship | goods | europe'."""
    terms = []
    for raw in re.findall(r"[A-Za-z0-9][A-Za-z0-9\-']+", question.lower()):
        term = raw.strip("-'")
        if len(term) < 3 or term in STOPWORDS or term in terms:
            continue
        terms.append(term)
    return " | ".join(terms)


# ── chunking ─────────────────────────────────────────────────────────────────


def _split(body: str, size: int, overlap: int) -> list[str]:
    """Split on sentence boundaries, packing up to `size` chars per chunk."""
    body = re.sub(r"\s+", " ", body or "").strip()
    if not body:
        return []
    if len(body) <= size:
        return [body]

    sentences = re.split(r"(?<=[.!?])\s+", body)
    chunks: list[str] = []
    current = ""
    for sentence in sentences:
        if len(current) + len(sentence) + 1 <= size:
            current = f"{current} {sentence}".strip()
            continue
        if current:
            chunks.append(current)
        # Carry the tail of the previous chunk so a fact split across the boundary
        # is still retrievable from the following chunk.
        tail = current[-overlap:] if overlap and current else ""
        current = f"{tail} {sentence}".strip() if tail else sentence
        while len(current) > size:
            chunks.append(current[:size])
            current = current[size - overlap :]
    if current:
        chunks.append(current)
    return chunks


def build_chunks(signal: Signal) -> list[tuple[str, str]]:
    """Return (section, content) pairs for one signal.

    The title+summary chunk is emitted first and standalone because it is what most
    questions actually match against.
    """
    settings = get_settings()
    out: list[tuple[str, str]] = []
    headline = f"{signal.title}. {signal.summary}".strip()
    if headline:
        out.append(("summary", headline))
    if signal.why_it_matters:
        out.append(("why_it_matters", f"{signal.title}. Why it matters: {signal.why_it_matters}"))
    body = getattr(signal, "body_text", "") or ""
    for piece in _split(body, settings.rag_chunk_chars, settings.rag_chunk_overlap):
        out.append(("body", piece))
    return out


def content_hash(text_value: str) -> str:
    return hashlib.sha256(text_value.encode("utf-8")).hexdigest()


def normalize_citations(answer: str) -> str:
    """gpt-oss sometimes emits CJK full-width brackets around citations.

    Left unnormalised these render as 【S1】 and never match the [S#] parser, so the
    UI shows an answer with zero linked sources.
    """
    answer = answer.replace("\u3010", "[").replace("\u3011", "]")
    answer = answer.replace("\uff3b", "[").replace("\uff3d", "]")
    # "[S1, S2]" and "[S1][S2]" both appear; split combined forms into single refs.
    def _split_group(match: re.Match) -> str:
        nums = re.findall(r"\d+", match.group(0))
        return "".join(f"[S{n}]" for n in nums)

    return re.sub(r"\[\s*S\s*\d+(?:\s*[,;/&]\s*S?\s*\d+)*\s*\]", _split_group, answer)


def extract_citations(answer: str) -> list[int]:
    return sorted({int(n) for n in re.findall(r"\[S(\d+)\]", answer)})


async def index_signals(
    session: AsyncSession, signals: list[Signal], *, client: httpx.AsyncClient | None = None
) -> tuple[int, list[AICall]]:
    """Chunk + embed signals into `signal_chunks`. Returns (chunks_written, ai_calls).

    Chunks are keyed by content hash, so re-running over unchanged signals costs
    nothing and never re-embeds text that is already indexed.
    """
    cf = CloudflareAI()
    calls: list[AICall] = []
    if not cf.configured or not signals:
        return 0, calls

    pending: list[tuple[Signal, str, int, str]] = []
    for signal in signals:
        existing = set(
            (
                await session.scalars(
                    select(SignalChunk.content_hash).where(SignalChunk.signal_id == signal.id)
                )
            ).all()
        )
        for index, (section, content) in enumerate(build_chunks(signal)):
            digest = content_hash(content)
            if digest in existing:
                continue
            pending.append((signal, section, index, content))

    if not pending:
        return 0, calls

    owns_client = client is None
    client = client or httpx.AsyncClient()
    try:
        result = await cf.embed(client, [item[3] for item in pending], purpose="rag.index")
    finally:
        if owns_client:
            await client.aclose()

    if result.call:
        calls.append(result.call)
    if not result.ok:
        logger.warning("rag.index embed failed for %s chunks", len(pending))
        return 0, calls

    settings = get_settings()
    written = 0
    for (signal, section, index, content), vector in zip(pending, result.vectors):
        session.add(
            SignalChunk(
                signal_id=signal.id,
                article_id=signal.article_id,
                chunk_index=index,
                section=section,
                content=content,
                token_estimate=len(content) // 4,
                embedding=vector,
                embedding_model=settings.cloudflare_embed_model,
                content_hash=content_hash(content),
                category=signal.category,
                source_name=signal.source_name,
                published_at=signal.published_at,
            )
        )
        written += 1
    await session.flush()
    logger.info("rag.index wrote=%s chunks signals=%s", written, len(signals))
    return written, calls


# ── retrieval ────────────────────────────────────────────────────────────────


@dataclass
class Candidate:
    chunk_id: str
    signal_id: str
    content: str
    section: str
    title: str
    source_name: str
    source_url: str
    published_at: str | None
    vector_rank: int | None = None
    vector_score: float | None = None
    lexical_rank: int | None = None
    lexical_score: float | None = None
    fused_score: float = 0.0
    rerank_score: float | None = None


@dataclass
class RagTrace:
    steps: list[dict[str, Any]] = field(default_factory=list)
    calls: list[AICall] = field(default_factory=list)

    def step(self, name: str, *, ms: int = 0, **detail: Any) -> None:
        self.steps.append({"step": len(self.steps) + 1, "name": name, "elapsed_ms": ms, **detail})

    @property
    def total_neurons(self) -> float:
        return round(sum(call.neurons for call in self.calls), 4)

    def as_dict(self) -> dict[str, Any]:
        return {
            "steps": self.steps,
            "ai_calls": [call.as_dict() for call in self.calls],
            "total_neurons": self.total_neurons,
            "total_ms": sum(step.get("elapsed_ms", 0) for step in self.steps),
        }


async def _vector_search(
    session: AsyncSession, vector: list[float], limit: int, days: int | None
) -> list[dict]:
    where = "WHERE c.embedding IS NOT NULL"
    params: dict[str, Any] = {"q": str(vector), "k": limit}
    if days:
        where += " AND (c.published_at IS NULL OR c.published_at >= now() - make_interval(days => :days))"
        params["days"] = days
    sql = text(
        f"""
        SELECT c.id, c.signal_id, c.content, c.section, c.published_at,
               s.title, s.source_name, s.source_url,
               1 - (c.embedding <=> CAST(:q AS vector)) AS score
        FROM signal_chunks c
        JOIN signals s ON s.id = c.signal_id
        {where}
        ORDER BY c.embedding <=> CAST(:q AS vector)
        LIMIT :k
        """
    )
    rows = (await session.execute(sql, params)).mappings().all()
    return [dict(row) for row in rows]


async def _lexical_search(
    session: AsyncSession, question: str, limit: int, days: int | None
) -> list[dict]:
    tsquery = build_tsquery(question)
    if not tsquery:
        return []
    where = "WHERE c.search_vector @@ to_tsquery('english', :q)"
    params: dict[str, Any] = {"q": tsquery, "k": limit}
    if days:
        where += " AND (c.published_at IS NULL OR c.published_at >= now() - make_interval(days => :days))"
        params["days"] = days
    sql = text(
        f"""
        SELECT c.id, c.signal_id, c.content, c.section, c.published_at,
               s.title, s.source_name, s.source_url,
               ts_rank_cd(c.search_vector, to_tsquery('english', :q)) AS score
        FROM signal_chunks c
        JOIN signals s ON s.id = c.signal_id
        {where}
        ORDER BY score DESC
        LIMIT :k
        """
    )
    rows = (await session.execute(sql, params)).mappings().all()
    return [dict(row) for row in rows]


def _to_candidate(row: dict) -> Candidate:
    published = row.get("published_at")
    return Candidate(
        chunk_id=str(row["id"]),
        signal_id=str(row["signal_id"]),
        content=row["content"],
        section=row.get("section") or "body",
        title=row.get("title") or "",
        source_name=row.get("source_name") or "",
        source_url=row.get("source_url") or "",
        published_at=published.isoformat() if hasattr(published, "isoformat") else published,
    )


def _fuse(vector_rows: list[dict], lexical_rows: list[dict]) -> list[Candidate]:
    """Reciprocal-rank fusion — combines two rankings without needing their
    scores to be on comparable scales."""
    merged: dict[str, Candidate] = {}
    for rank, row in enumerate(vector_rows, start=1):
        candidate = merged.setdefault(str(row["id"]), _to_candidate(row))
        candidate.vector_rank = rank
        candidate.vector_score = round(float(row["score"]), 4)
        candidate.fused_score += 1.0 / (RRF_K + rank)
    for rank, row in enumerate(lexical_rows, start=1):
        candidate = merged.setdefault(str(row["id"]), _to_candidate(row))
        candidate.lexical_rank = rank
        candidate.lexical_score = round(float(row["score"]), 4)
        candidate.fused_score += 1.0 / (RRF_K + rank)
    ordered = sorted(merged.values(), key=lambda c: c.fused_score, reverse=True)
    for candidate in ordered:
        candidate.fused_score = round(candidate.fused_score, 6)
    return ordered


ANSWER_SYSTEM = (
    "You are NewsIntel's analyst. Answer strictly from the numbered sources given. "
    "Cite every factual claim with [S#] matching the source number. "
    "If the sources do not answer the question, say so plainly and name what is missing — "
    "never fill the gap with outside knowledge. Be specific and concise: 3-6 sentences."
)

PERSONAL_SUFFIX = (
    "\n\nAfter the answer, add a final line beginning exactly with 'FOR YOU: ' explaining in "
    "one sentence how this specifically affects a reader with this profile:\n{profile}"
)


async def answer_question(
    session: AsyncSession,
    question: str,
    *,
    profile: AccountProfile | None = None,
    days: int | None = 14,
    max_sources: int | None = None,
) -> dict[str, Any]:
    """Answer a question over the indexed corpus and return answer + trace."""
    settings = get_settings()
    trace = RagTrace()
    cf = CloudflareAI()
    keep = max_sources or settings.rag_rerank_keep

    if not cf.configured:
        return {"status": "error", "error": "Cloudflare Workers AI is not configured.", "trace": trace.as_dict()}

    async with httpx.AsyncClient() as client:
        # 1 ── embed the question
        started = time.perf_counter()
        embed = await cf.embed(client, [question], purpose="rag.query")
        if embed.call:
            trace.calls.append(embed.call)
        if not embed.ok:
            trace.step("embed_query", ms=int((time.perf_counter() - started) * 1000), ok=False)
            return {"status": "error", "error": "Could not embed the question.", "trace": trace.as_dict()}
        query_vector = embed.vectors[0]
        trace.step(
            "embed_query",
            ms=int((time.perf_counter() - started) * 1000),
            model=settings.cloudflare_embed_model,
            dimensions=len(query_vector),
        )

        # 2 ── vector search
        started = time.perf_counter()
        vector_rows = await _vector_search(session, query_vector, settings.rag_vector_candidates, days)
        trace.step(
            "vector_search",
            ms=int((time.perf_counter() - started) * 1000),
            candidates=len(vector_rows),
            window_days=days,
            top=[
                {"title": row["title"][:80], "score": round(float(row["score"]), 4)}
                for row in vector_rows[:5]
            ],
        )

        # 3 ── lexical search
        started = time.perf_counter()
        lexical_rows = await _lexical_search(session, question, settings.rag_keyword_candidates, days)
        trace.step(
            "lexical_search",
            ms=int((time.perf_counter() - started) * 1000),
            candidates=len(lexical_rows),
            top=[
                {"title": row["title"][:80], "score": round(float(row["score"]), 4)}
                for row in lexical_rows[:5]
            ],
        )

        # 4 ── fuse
        started = time.perf_counter()
        fused = _fuse(vector_rows, lexical_rows)
        both = sum(1 for c in fused if c.vector_rank and c.lexical_rank)
        trace.step(
            "fuse_rrf",
            ms=int((time.perf_counter() - started) * 1000),
            merged=len(fused),
            found_by_both=both,
            vector_only=sum(1 for c in fused if c.vector_rank and not c.lexical_rank),
            lexical_only=sum(1 for c in fused if c.lexical_rank and not c.vector_rank),
        )
        if not fused:
            trace.step("halt", reason="no_candidates")
            return {
                "status": "no_results",
                "question": question,
                "answer": "Nothing in the indexed news matches that question yet.",
                "sources": [],
                "trace": trace.as_dict(),
            }

        # 5 ── cross-encoder rerank
        shortlist = fused[: settings.rag_vector_candidates]
        started = time.perf_counter()
        rerank = await cf.rerank(
            client, question, [c.content for c in shortlist], purpose="rag.rerank"
        )
        if rerank.call:
            trace.calls.append(rerank.call)
        if rerank.ok:
            for position, score in rerank.ranking:
                if 0 <= position < len(shortlist):
                    shortlist[position].rerank_score = round(score, 6)
            ranked = sorted(
                shortlist, key=lambda c: (c.rerank_score if c.rerank_score is not None else -1), reverse=True
            )
        else:
            # Reranker unavailable — fall back to fusion order rather than failing.
            ranked = shortlist
        trace.step(
            "rerank",
            ms=int((time.perf_counter() - started) * 1000),
            model=settings.cloudflare_rerank_model,
            ok=rerank.ok,
            scored=len(shortlist),
            top=[
                {"title": c.title[:80], "score": c.rerank_score}
                for c in ranked[:5]
            ],
        )

        # 6 ── relevance floor, then one passage per story so citations stay diverse
        # bge-reranker scores are not calibrated to an absolute scale — they shift
        # with question phrasing — so cut relative to the best hit, with a small
        # absolute floor to catch the case where nothing is relevant at all.
        top_score = next(
            (c.rerank_score for c in ranked if c.rerank_score is not None), None
        )
        if top_score is not None and top_score > 0:
            cutoff = max(settings.rag_min_rerank_score, top_score * settings.rag_relative_cutoff)
        else:
            cutoff = 0.0

        kept: list[Candidate] = []
        seen_signals: set[str] = set()
        dropped_low = 0
        for candidate in ranked:
            if candidate.signal_id in seen_signals:
                continue
            below = candidate.rerank_score is not None and candidate.rerank_score < cutoff
            # Always admit a few best-ranked passages; a single source makes for a
            # thin, uncheckable answer even when the rest score modestly.
            if below and len(kept) >= settings.rag_min_sources:
                dropped_low += 1
                continue
            seen_signals.add(candidate.signal_id)
            kept.append(candidate)
            if len(kept) >= keep:
                break
        trace.step(
            "filter",
            kept=len(kept),
            dropped_below_threshold=dropped_low,
            cutoff=round(cutoff, 6),
            top_rerank_score=top_score,
            relative_cutoff=settings.rag_relative_cutoff,
            min_sources=settings.rag_min_sources,
            deduped_to_one_chunk_per_story=True,
        )

        if not kept:
            trace.step("halt", reason="all_below_threshold")
            return {
                "status": "no_results",
                "question": question,
                "answer": (
                    "The indexed news does not contain a relevant answer to that question. "
                    "Everything retrieved scored below the relevance threshold."
                ),
                "sources": [],
                "trace": trace.as_dict(),
            }

        # 7 ── generate
        blocks = [
            f"[S{i}] {c.title}\nsource: {c.source_name}\npublished: {c.published_at or 'unknown'}\n{c.content}"
            for i, c in enumerate(kept, start=1)
        ]
        prompt = f"Question: {question}\n\nSources:\n\n" + "\n\n".join(blocks)
        system = ANSWER_SYSTEM
        profile_text = profile.profile_text() if profile else ""
        if profile_text:
            system += PERSONAL_SUFFIX.format(profile=profile_text[:600])

        started = time.perf_counter()
        answer = await cf.chat(
            client,
            [{"role": "system", "content": system}, {"role": "user", "content": prompt}],
            purpose="rag.answer",
            max_tokens=900,
        )
        if answer.call:
            trace.calls.append(answer.call)
        trace.step(
            "generate",
            ms=int((time.perf_counter() - started) * 1000),
            model=settings.cloudflare_chat_model,
            ok=answer.ok,
            sources_in_context=len(kept),
            context_chars=len(prompt),
            personalized=bool(profile_text),
        )

    if not answer.ok:
        return {
            "status": "error",
            "question": question,
            "error": "The model did not return an answer.",
            "sources": _source_payload(kept),
            "trace": trace.as_dict(),
        }

    body = normalize_citations(answer.content.strip())
    personal_note = ""
    if "FOR YOU:" in body:
        body, _, personal_note = body.partition("FOR YOU:")
        body = body.strip()
        personal_note = personal_note.strip()

    return {
        "status": "success",
        "question": question,
        "answer": body,
        "personal_impact": personal_note,
        "sources": _source_payload(kept),
        "cited": extract_citations(body),
        "trace": trace.as_dict(),
    }


def _source_payload(candidates: list[Candidate]) -> list[dict]:
    return [
        {
            "n": index,
            "signal_id": c.signal_id,
            "title": c.title,
            "source": c.source_name,
            "url": c.source_url,
            "published": c.published_at,
            "passage": c.content[:400],
            "section": c.section,
            "scores": {
                "vector": c.vector_score,
                "lexical": c.lexical_score,
                "fused": c.fused_score,
                "rerank": c.rerank_score,
            },
        }
        for index, c in enumerate(candidates, start=1)
    ]


async def corpus_stats(session: AsyncSession) -> dict[str, Any]:
    total = await session.scalar(select(func.count()).select_from(SignalChunk)) or 0
    embedded = (
        await session.scalar(
            select(func.count()).select_from(SignalChunk).where(SignalChunk.embedding.isnot(None))
        )
        or 0
    )
    signals = await session.scalar(select(func.count(func.distinct(SignalChunk.signal_id)))) or 0
    newest = await session.scalar(select(func.max(SignalChunk.created_at)))
    return {
        "chunks": total,
        "embedded": embedded,
        "signals_indexed": signals,
        "last_indexed_at": newest.isoformat() if newest else None,
        "embed_model": get_settings().cloudflare_embed_model,
    }
