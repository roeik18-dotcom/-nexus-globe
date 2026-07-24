"""DelegationBus v1 — synchronous in-turn agent delegation.

Thin wrapper that routes a DelegationRequest to a registered adapter,
collects all yielded chunks, and returns a DelegationResult.

No queues, threads, retries, task IDs, or persistence — v1 is intentionally
minimal so it can be extended later without rewriting the core contract.
"""

import logging
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.adapters.base import VoiceAdapter

logger = logging.getLogger(__name__)


@dataclass
class DelegationRequest:
    target: str
    purpose: str
    prompt: str
    context: dict = field(default_factory=dict)


@dataclass
class DelegationResult:
    agent: str
    content: str
    metadata: dict = field(default_factory=dict)
    error: str | None = None


class DelegationBus:
    """Routes delegation calls to registered VoiceAdapter instances."""

    def __init__(self) -> None:
        self._adapters: dict[str, "VoiceAdapter"] = {}

    def register(self, name: str, adapter: "VoiceAdapter") -> None:
        self._adapters[name] = adapter
        logger.debug("delegation_bus: registered %r", name)

    async def call(self, request: DelegationRequest) -> DelegationResult:
        adapter = self._adapters.get(request.target)
        if adapter is None:
            logger.warning("delegation_bus: no adapter for %r", request.target)
            return DelegationResult(
                agent=request.target,
                content="",
                error=f"No adapter registered for {request.target!r}",
            )

        parent = request.context.get("parent_session", "anon")
        session_id = f"delegation_{request.target}_{parent}"
        parts: list[str] = []
        try:
            async for chunk in adapter.respond(request.prompt, session_id):
                parts.append(chunk)
        except Exception as exc:
            logger.error("delegation_bus: %r raised: %s", request.target, exc)
            return DelegationResult(
                agent=request.target,
                content="",
                error=str(exc),
            )

        return DelegationResult(
            agent=request.target,
            content="".join(parts),
            metadata={"purpose": request.purpose},
        )
