"""Agent definition — metadata used by the registry and router."""

from dataclasses import dataclass, field


@dataclass
class AgentDefinition:
    name: str
    persona: str          # maps to prompts/{persona}.md
    description: str      # shown to the router when choosing agents
    capabilities: list[str] = field(default_factory=list)
