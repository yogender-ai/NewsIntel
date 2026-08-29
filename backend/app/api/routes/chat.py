"""A general-purpose chat endpoint backed by Cloudflare Workers AI.

Separate from /api/ask: Ask is grounded RAG that refuses to answer outside the
indexed news, while this is an open assistant over gpt-oss-120b. Streaming is
server-sent events so the page renders tokens as they arrive rather than waiting
for the whole reply.
"""

from __future__ import annotations

import json
import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.ai.cloudflare import CloudflareAI
from app.api.deps import get_optional_account
from app.core.config import get_settings
from app.models.account import Account

logger = logging.getLogger("newsintel-chat")

router = APIRouter(tags=["chat"])

MAX_HISTORY = 20
REASONING_MIN_TOKENS = 400


class Message(BaseModel):
    role: str = Field(pattern="^(system|user|assistant)$")
    content: str = Field(min_length=1, max_length=16000)


class ChatRequest(BaseModel):
    messages: list[Message] = Field(min_length=1, max_length=MAX_HISTORY * 2)
    model: str | None = None
    max_tokens: int = Field(default=1200, ge=64, le=8000)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    stream: bool = True


def _allowed_models() -> list[str]:
    settings = get_settings()
    return [
        settings.cloudflare_chat_model,
        settings.cloudflare_fast_chat_model,
        "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        "@cf/qwen/qwen2.5-coder-32b-instruct",
        "@cf/mistralai/mistral-small-3.1-24b-instruct",
    ]


@router.get("/api/chat/models")
async def chat_models():
    settings = get_settings()
    return {
        "default": settings.cloudflare_chat_model,
        "models": _allowed_models(),
        "provider": "cloudflare-workers-ai",
    }


@router.post("/api/chat")
async def chat(
    payload: ChatRequest,
    account: Account | None = Depends(get_optional_account),
):
    settings = get_settings()
    cf = CloudflareAI()
    if not cf.configured:
        raise HTTPException(status_code=503, detail="Cloudflare Workers AI is not configured.")

    model = payload.model or settings.cloudflare_chat_model
    if model not in _allowed_models():
        raise HTTPException(status_code=400, detail=f"Unknown model: {model}")

    # Keep only the most recent turns so a long conversation cannot blow the context.
    messages = [m.model_dump() for m in payload.messages][-(MAX_HISTORY * 2):]

    # gpt-oss models emit reasoning tokens before any visible output and count them
    # against max_tokens, so a small budget returns finish_reason=length with empty
    # content. Floor the budget for those models rather than shipping a blank reply.
    max_tokens = payload.max_tokens
    if "gpt-oss" in model:
        max_tokens = max(max_tokens, REASONING_MIN_TOKENS)

    if not payload.stream:
        async with httpx.AsyncClient() as client:
            result = await cf.chat(
                client, messages, model=model,
                max_tokens=max_tokens, temperature=payload.temperature,
                purpose="chat.completion",
            )
        if not result.ok:
            raise HTTPException(status_code=503, detail=result.call.error or "No response from the model.")
        return {
            "content": result.content,
            "reasoning": result.reasoning,
            "model": model,
            "usage": {
                "prompt_tokens": result.call.prompt_tokens,
                "completion_tokens": result.call.completion_tokens,
                "neurons": round(result.call.neurons, 4),
                "latency_ms": result.call.latency_ms,
            },
        }

    async def event_stream():
        body = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": payload.temperature,
            "stream": True,
        }
        try:
            async with httpx.AsyncClient(timeout=settings.cloudflare_chat_timeout_seconds) as client:
                async with client.stream(
                    "POST", f"{cf.openai_base}/chat/completions", headers=cf.headers, json=body
                ) as response:
                    if response.status_code != 200:
                        detail = (await response.aread()).decode("utf-8", "replace")[:300]
                        yield f"data: {json.dumps({'error': f'HTTP {response.status_code}: {detail}'})}\n\n"
                        return
                    async for line in response.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        chunk = line[6:].strip()
                        if chunk == "[DONE]":
                            break
                        try:
                            parsed = json.loads(chunk)
                        except json.JSONDecodeError:
                            continue
                        delta = ((parsed.get("choices") or [{}])[0].get("delta") or {})
                        text = delta.get("content")
                        if text:
                            yield f"data: {json.dumps({'delta': text})}\n\n"
        except Exception as exc:  # noqa: BLE001 - surface as a stream event, not a 500
            logger.warning("chat.stream failed: %s", exc)
            yield f"data: {json.dumps({'error': str(exc)[:200]})}\n\n"
        yield f"data: {json.dumps({'done': True, 'model': model})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
