"""AgentOrchestrator — multi-agent VoiceAdapter.

Routes each turn to the best available agent and streams its response.
Satisfies the VoiceAdapter interface, so it is a drop-in replacement for
ClaudeAdapter in main.py.
"""

import logging
from typing import AsyncIterator

from app.adapters.base import VoiceAdapter
from app.agents.definition import AgentDefinition
from app.agents.registry import AgentRegistry
from app.agents.router import AgentRouter

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
        agents: list[AgentDefinition] = self._registry.list()
        agent_name = await self._router.route(text, agents)
        adapter = self._resolve(agent_name)
        logger.info("orchestrator[%s] → %s", session_id, agent_name)
        async for chunk in adapter.respond(text, session_id):
            yield chunk

    async def reset(self, session_id: str) -> None:
        for adapter in self._adapters.values():
            await adapter.reset(session_id)
