"""AgentOrchestrator — multi-agent VoiceAdapter.

Routes each turn to the best available agent and streams its response.
Satisfies the VoiceAdapter interface, so it is a drop-in replacement for
ClaudeAdapter in main.py.
"""

import logging
import time
from typing import AsyncIterator

from app import turn_context
from app.adapters.base import VoiceAdapter
from app.agents.definition import AgentDefinition
from app.agents.registry import AgentRegistry
from app.agents.router import AgentRouter
from app.trace import TraceStep

logger = logging.getLogger(__name__)


class AgentOrchestrator(VoiceAdapter):
    def __init__(
        self,
        registry: AgentRegistry,
        router: AgentRouter,
        adapters: dict[str, VoiceAdapter],
    ) -> None:
        self._registry = registry
        self._router = router
        self._adapters = adapters

    @property
    def name(self) -> str:
        return "orchestrator"

    def _resolve(self, agent_name: str) -> VoiceAdapter:
        adapter = self._adapters.get(agent_name)
        if adapter is not None:
            return adapter
        # Fallback to first registered adapter if routing returned unknown name.
        first = next(iter(self._adapters.values()), None)
        if first is None:
            raise RuntimeError("AgentOrchestrator has no adapters configured")
        logger.warning(
            "orchestrator: unknown agent %r — falling back to %s",
            agent_name, next(iter(self._adapters)),
        )
        return first

    async def respond(self, text: str, session_id: str) -> AsyncIterator[str]:
        t0 = time.perf_counter()
        agents: list[AgentDefinition] = self._registry.list()
        turn_context.emit(TraceStep(
            from_node="gateway", to_node="router",
            type="routing.start",
            payload_size=len(text),
        ))
        agent_name = await self._router.route(text, agents)
        turn_context.emit(TraceStep(
            from_node="router", to_node=agent_name,
            type="routing.complete",
            latency_ms=round((time.perf_counter() - t0) * 1000),
            description=agent_name,
        ))
        adapter = self._resolve(agent_name)
        logger.info("orchestrator[%s] → %s", session_id, agent_name)
        async for chunk in adapter.respond(text, session_id):
            yield chunk

    async def reset(self, session_id: str) -> None:
        for adapter in self._adapters.values():
            await adapter.reset(session_id)
