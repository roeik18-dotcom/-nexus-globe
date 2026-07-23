"""AgentRegistry — ordered collection of available agents."""

from __future__ import annotations

from app.agents.definition import AgentDefinition


class AgentRegistry:
    def __init__(self) -> None:
        self._agents: dict[str, AgentDefinition] = {}
        self._order: list[str] = []

    def register(self, agent: AgentDefinition) -> None:
        if agent.name not in self._agents:
            self._order.append(agent.name)
        self._agents[agent.name] = agent

    def get(self, name: str) -> AgentDefinition | None:
        return self._agents.get(name)

    def list(self) -> list[AgentDefinition]:
        return [self._agents[n] for n in self._order]

    def names(self) -> list[str]:
        return list(self._order)
