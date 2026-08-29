from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any, Literal

CallKind = Literal["chat", "embed", "rerank"]


@dataclass
class AICall:
    """One inference call, recorded so the pipeline and RAG traces can show it.

    Every Cloudflare call produces one of these whether it succeeded or not. The
    pipeline persists them onto the run so /pipeline can render exactly which model
    ran, how long it took, what it cost, and what came back.
    """

    kind: CallKind
    model: str
    ok: bool
    status_code: int | None = None
    latency_ms: int = 0
    prompt_tokens: int = 0
    completion_tokens: int = 0
    neurons: float = 0.0
    attempt: int = 1
    purpose: str = ""
    error: str = ""
    # Trimmed so traces stay readable in the UI and small in Postgres.
    prompt_preview: str = ""
    output_preview: str = ""

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class ChatResult:
    ok: bool
    content: str = ""
    reasoning: str = ""
    call: AICall | None = None

    @property
    def neurons(self) -> float:
        return self.call.neurons if self.call else 0.0


@dataclass
class EmbedResult:
    ok: bool
    vectors: list[list[float]] = field(default_factory=list)
    call: AICall | None = None


@dataclass
class RerankResult:
    ok: bool
    # (original_index, score) ordered best-first
    ranking: list[tuple[int, float]] = field(default_factory=list)
    call: AICall | None = None
