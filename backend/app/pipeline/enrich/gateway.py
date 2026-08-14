from __future__ import annotations

import json
import logging

import httpx

from app.core.config import get_settings

logger = logging.getLogger("newsintel-gateway")


class GatewayClient:
    def __init__(self):
        self.settings = get_settings()
        root = self.settings.gateway_root
        self.openrouter_url = f"{root}/openrouter/v1/chat/completions"
        self.gemini_url = f"{root}/gemini"
        self.hf_base = f"{root}/huggingface-space/{self.settings.hf_space_id}"
        self.headers = {
            "X-Gateway-Secret": self.settings.gateway_secret or "",
            "X-Project-Category": "News-Intel",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    async def call_hf(self, client: httpx.AsyncClient, endpoint: str, text: str) -> dict:
        url = f"{self.hf_base}/{endpoint.lstrip('/')}"
        response = await client.post(url, headers=self.headers, json={"inputs": text}, timeout=12.0)
        if response.status_code != 200:
            raise RuntimeError(f"HF {endpoint} {response.status_code}: {response.text[:200]}")
        data = response.json()
        if isinstance(data, str):
            data = json.loads(data)
        return data if isinstance(data, dict) else {"result": data}

    async def call_openrouter(self, client: httpx.AsyncClient, prompt: str, model: str, max_tokens: int) -> dict:
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0,
            "max_tokens": max_tokens,
        }
        response = await client.post(self.openrouter_url, headers=self.headers, json=payload, timeout=45.0)
        content = ""
        if response.status_code == 200:
            data = response.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        return {
            "ok": response.status_code == 200 and bool(content),
            "status_code": response.status_code,
            "content": content,
            "body": response.text[:800],
            "provider": "openrouter",
            "model": model,
        }

    async def call_gemini(self, client: httpx.AsyncClient, prompt: str, max_tokens: int) -> dict:
        payload = {
            "model": "gemini-2.5-flash-lite",
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0, "maxOutputTokens": max_tokens},
        }
        response = await client.post(self.gemini_url, headers=self.headers, json=payload, timeout=45.0)
        content = ""
        if response.status_code == 200:
            data = response.json()
            parts = (((data.get("candidates") or [{}])[0].get("content") or {}).get("parts") or [])
            content = "".join(part.get("text", "") for part in parts if isinstance(part, dict))
        return {
            "ok": response.status_code == 200 and bool(content),
            "status_code": response.status_code,
            "content": content,
            "body": response.text[:800],
            "provider": "gemini",
        }
