from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from typing import Any, Iterable, Sequence

import httpx

from app.ai.types import AICall, ChatResult, EmbedResult, RerankResult
from app.core.config import get_settings

logger = logging.getLogger("newsintel-cf")

# Cloudflare rejects very large embedding batches; keep well under the limit.
EMBED_BATCH = 64
RETRY_STATUS = {408, 425, 429, 500, 502, 503, 504}
BACKOFF_SECONDS = (0.0, 1.0, 3.0)


def parse_json_response(raw: str) -> Any:
    """Pull a JSON object out of a model response.

    gpt-oss returns clean JSON most of the time, but can still wrap it in a fenced
    block or add a sentence before it, so unwrap fences first and fall back to the
    outermost brace/bracket span.
    """
    text = (raw or "").strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        text = text.rsplit("```", 1)[0]
        text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r"[\{\[].*[\}\]]", text, flags=re.S)
    if not match:
        raise ValueError("no JSON found in model response")
    return json.loads(match.group(0))


class CloudflareAIError(RuntimeError):
    pass


class CloudflareAI:
    """Client for Cloudflare Workers AI (chat, embeddings, reranking).

    Chat goes through the OpenAI-compatible endpoint because it returns a familiar
    payload shape and a `usage` block. Embeddings and reranking use the native
    `/ai/run/` endpoints, whose `result.meta` carries the neuron cost we surface in
    pipeline traces.
    """

    def __init__(self, *, account_id: str | None = None, token: str | None = None):
        settings = get_settings()
        self.settings = settings
        self.account_id = (account_id or settings.cloudflare_account_id or "").strip()
        self.token = (token or settings.cloudflare_api_token or "").strip()
        base = settings.cloudflare_api_base.rstrip("/")
        self.run_base = f"{base}/accounts/{self.account_id}/ai/run"
        self.openai_base = f"{base}/accounts/{self.account_id}/ai/v1"
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }

    @property
    def configured(self) -> bool:
        return bool(self.account_id and self.token)

    # ── internals ────────────────────────────────────────────────────────────

    async def _post(
        self,
        client: httpx.AsyncClient,
        url: str,
        payload: dict,
        *,
        timeout: float,
        retries: int,
    ) -> tuple[httpx.Response | None, int, str, int]:
        """POST with backoff. Returns (response, attempts_used, error, latency_ms)."""
        started = time.perf_counter()
        error = ""
        response: httpx.Response | None = None
        attempt = 0
        for attempt in range(1, retries + 2):
            if attempt > 1:
                await asyncio.sleep(BACKOFF_SECONDS[min(attempt - 1, len(BACKOFF_SECONDS) - 1)])
            try:
                response = await client.post(url, headers=self.headers, json=payload, timeout=timeout)
            except (httpx.TimeoutException, httpx.TransportError) as exc:
                error = f"{type(exc).__name__}: {exc}"[:300]
                response = None
                continue
            if response.status_code in RETRY_STATUS and attempt <= retries:
                error = f"HTTP {response.status_code}: {response.text[:200]}"
                continue
            error = "" if response.status_code == 200 else f"HTTP {response.status_code}: {response.text[:300]}"
            break
        latency_ms = int((time.perf_counter() - started) * 1000)
        return response, attempt, error, latency_ms

    # ── chat ─────────────────────────────────────────────────────────────────

    async def chat(
        self,
        client: httpx.AsyncClient,
        messages: Sequence[dict[str, str]],
        *,
        model: str | None = None,
        max_tokens: int = 900,
        temperature: float = 0.0,
        purpose: str = "",
        retries: int = 2,
        timeout: float | None = None,
    ) -> ChatResult:
        model = model or self.settings.cloudflare_chat_model
        if not self.configured:
            return ChatResult(
                ok=False,
                call=AICall(kind="chat", model=model, ok=False, purpose=purpose, error="cloudflare_not_configured"),
            )
        payload = {
            "model": model,
            "messages": list(messages),
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        response, attempts, error, latency_ms = await self._post(
            client,
            f"{self.openai_base}/chat/completions",
            payload,
            timeout=timeout or self.settings.cloudflare_chat_timeout_seconds,
            retries=retries,
        )
        prompt_preview = " | ".join(m.get("content", "")[:200] for m in messages)[:400]
        call = AICall(
            kind="chat",
            model=model,
            ok=False,
            status_code=response.status_code if response is not None else None,
            latency_ms=latency_ms,
            attempt=attempts,
            purpose=purpose,
            error=error,
            prompt_preview=prompt_preview,
        )
        if response is None or response.status_code != 200:
            logger.warning("cf.chat fail purpose=%s status=%s err=%s", purpose, call.status_code, error[:160])
            return ChatResult(ok=False, call=call)

        data = response.json()
        choice = (data.get("choices") or [{}])[0]
        message = choice.get("message") or {}
        content = (message.get("content") or "").strip()
        reasoning = (message.get("reasoning") or message.get("reasoning_content") or "").strip()
        usage = data.get("usage") or {}
        call.prompt_tokens = int(usage.get("prompt_tokens") or 0)
        call.completion_tokens = int(usage.get("completion_tokens") or 0)
        call.neurons = float(usage.get("neurons") or 0.0)
        call.output_preview = content[:400]
        call.ok = bool(content)
        if not call.ok:
            call.error = "empty_content"
        return ChatResult(ok=call.ok, content=content, reasoning=reasoning, call=call)

    async def chat_json(
        self,
        client: httpx.AsyncClient,
        messages: Sequence[dict[str, str]],
        **kwargs: Any,
    ) -> tuple[Any, ChatResult]:
        """Chat that must return JSON. Retries once with a repair instruction."""
        result = await self.chat(client, messages, **kwargs)
        if not result.ok:
            return None, result
        try:
            return parse_json_response(result.content), result
        except (ValueError, json.JSONDecodeError):
            repair = list(messages) + [
                {"role": "assistant", "content": result.content[:1500]},
                {"role": "user", "content": "That was not valid JSON. Reply with ONLY the JSON object, no prose, no code fences."},
            ]
            retry = await self.chat(client, repair, **kwargs)
            if retry.call:
                retry.call.purpose = f"{retry.call.purpose}:json_repair"
            if not retry.ok:
                return None, retry
            try:
                return parse_json_response(retry.content), retry
            except (ValueError, json.JSONDecodeError):
                if retry.call:
                    retry.call.ok = False
                    retry.call.error = "invalid_json"
                return None, retry

    # ── embeddings ───────────────────────────────────────────────────────────

    async def embed(
        self,
        client: httpx.AsyncClient,
        texts: Sequence[str],
        *,
        model: str | None = None,
        purpose: str = "",
        retries: int = 2,
    ) -> EmbedResult:
        model = model or self.settings.cloudflare_embed_model
        if not self.configured:
            return EmbedResult(
                ok=False,
                call=AICall(kind="embed", model=model, ok=False, purpose=purpose, error="cloudflare_not_configured"),
            )
        cleaned = [(text or "").strip()[: self.settings.cloudflare_embed_char_limit] or " " for text in texts]
        vectors: list[list[float]] = []
        total_neurons = 0.0
        total_tokens = 0
        total_latency = 0
        attempts = 0
        for start in range(0, len(cleaned), EMBED_BATCH):
            batch = cleaned[start : start + EMBED_BATCH]
            response, used, error, latency_ms = await self._post(
                client,
                f"{self.run_base}/{model}",
                {"text": batch},
                timeout=self.settings.cloudflare_embed_timeout_seconds,
                retries=retries,
            )
            attempts = max(attempts, used)
            total_latency += latency_ms
            if response is None or response.status_code != 200:
                logger.warning("cf.embed fail purpose=%s err=%s", purpose, error[:160])
                return EmbedResult(
                    ok=False,
                    call=AICall(
                        kind="embed",
                        model=model,
                        ok=False,
                        status_code=response.status_code if response is not None else None,
                        latency_ms=total_latency,
                        attempt=attempts,
                        purpose=purpose,
                        error=error,
                    ),
                )
            result = (response.json() or {}).get("result") or {}
            vectors.extend(result.get("data") or [])
            meta = result.get("meta") or {}
            total_neurons += float(meta.get("neurons") or 0.0)
            if meta.get("cost_metric_name_1") == "input_tokens":
                total_tokens += int(meta.get("cost_metric_value_1") or 0)

        ok = len(vectors) == len(cleaned)
        return EmbedResult(
            ok=ok,
            vectors=vectors,
            call=AICall(
                kind="embed",
                model=model,
                ok=ok,
                status_code=200,
                latency_ms=total_latency,
                prompt_tokens=total_tokens,
                neurons=total_neurons,
                attempt=attempts,
                purpose=purpose,
                error="" if ok else f"expected {len(cleaned)} vectors, got {len(vectors)}",
                output_preview=f"{len(vectors)} vectors x {len(vectors[0]) if vectors else 0}d",
            ),
        )

    async def embed_one(self, client: httpx.AsyncClient, text: str, **kwargs: Any) -> list[float] | None:
        result = await self.embed(client, [text], **kwargs)
        return result.vectors[0] if result.ok and result.vectors else None

    # ── reranking ────────────────────────────────────────────────────────────

    async def rerank(
        self,
        client: httpx.AsyncClient,
        query: str,
        contexts: Sequence[str],
        *,
        model: str | None = None,
        top_k: int | None = None,
        purpose: str = "",
        retries: int = 1,
    ) -> RerankResult:
        model = model or self.settings.cloudflare_rerank_model
        if not self.configured or not contexts:
            return RerankResult(
                ok=False,
                call=AICall(kind="rerank", model=model, ok=False, purpose=purpose, error="cloudflare_not_configured_or_empty"),
            )
        payload: dict[str, Any] = {
            "query": query,
            "contexts": [{"text": (text or "")[: self.settings.cloudflare_rerank_char_limit]} for text in contexts],
        }
        if top_k:
            payload["top_k"] = top_k
        response, attempts, error, latency_ms = await self._post(
            client,
            f"{self.run_base}/{model}",
            payload,
            timeout=self.settings.cloudflare_rerank_timeout_seconds,
            retries=retries,
        )
        call = AICall(
            kind="rerank",
            model=model,
            ok=False,
            status_code=response.status_code if response is not None else None,
            latency_ms=latency_ms,
            attempt=attempts,
            purpose=purpose,
            error=error,
            prompt_preview=query[:200],
        )
        if response is None or response.status_code != 200:
            logger.warning("cf.rerank fail purpose=%s err=%s", purpose, error[:160])
            return RerankResult(ok=False, call=call)
        result = (response.json() or {}).get("result") or {}
        rows = result.get("response") or []
        ranking: list[tuple[int, float]] = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            try:
                ranking.append((int(row["id"]), float(row.get("score") or 0.0)))
            except (KeyError, TypeError, ValueError):
                continue
        ranking.sort(key=lambda pair: pair[1], reverse=True)
        usage = result.get("usage") or {}
        call.prompt_tokens = int(usage.get("prompt_tokens") or 0)
        call.neurons = float(usage.get("neurons") or 0.0)
        call.ok = bool(ranking)
        call.output_preview = ", ".join(f"#{idx}:{score:.4f}" for idx, score in ranking[:8])
        return RerankResult(ok=call.ok, ranking=ranking, call=call)


def sum_neurons(calls: Iterable[AICall]) -> float:
    return round(sum(call.neurons for call in calls), 4)
