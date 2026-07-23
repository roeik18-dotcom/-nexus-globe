"""Agent routing — decides which agent handles an incoming transcript."""

import logging
from abc import ABC, abstractmethod

from app.agents.definition import AgentDefinition

logger = logging.getLogger(__name__)


class AgentRouter(ABC):
    @abstractmethod
    async def route(self, transcript: str, agents: list[AgentDefinition]) -> str:
        """Return the name of the best agent for this transcript."""
        ...


class RuleBasedRouter(AgentRouter):
    """Keyword-based routing — upgradeable to LLM routing later.

    Routes to Philos for philosophical/analytical queries; falls back to
    the configured default (or the first registered agent).
    """

    _PHILOS_TRIGGERS: frozenset[str] = frozenset({
        "philosophy", "philosophical", "philosophically",
        "analyze", "analysis", "analyse",
        "abstract", "theory", "theoretical",
        "ethics", "ethical", "moral", "morality",
        "consciousness", "existence", "existential",
        "meaning of", "thought experiment",
        "ponder", "contemplate",
        "what is the nature", "what does it mean to",
    })

    def __init__(self, default_agent: str = "") -> None:
        # If empty, falls back to first registered agent.
        self._default = default_agent

    async def route(self, transcript: str, agents: list[AgentDefinition]) -> str:
        if not agents:
            raise ValueError("No agents available to route to")

        agent_names = {a.name for a in agents}
        lower = transcript.lower()

        if "philos" in agent_names:
            if any(trigger in lower for trigger in self._PHILOS_TRIGGERS):
                logger.info("router: philos trigger in %r", transcript[:60])
                return "philos"

        if self._default and self._default in agent_names:
            return self._default
        return agents[0].name
