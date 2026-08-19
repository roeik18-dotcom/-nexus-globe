"""AgentRegistry — the in-memory catalog + create_agent() registration path.

P0 has NO runtime, so an agent's `health` is always UNKNOWN here: health is
authoritative RUNTIME state (to be fed by the Gateway/Conductor in later phases),
never invented at registration time. The declared lifecycle intent lives on the
manifest (`status`); the observed runtime health lives on the record.

Ordering is deterministic (insertion order) so list()/ids() are reproducible.
The registry performs no I/O.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum

from .errors import DuplicateAgentError
from .manifest import AgentManifest


class HealthState(str, Enum):
    UNKNOWN = "unknown"   # P0 default — no runtime has observed this agent yet
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    ERROR = "error"


@dataclass(frozen=True)
class AgentRecord:
    """A registered agent: its (validated) manifest + observed runtime health."""

    manifest: AgentManifest
    health: HealthState = HealthState.UNKNOWN

    @property
    def agent_id(self) -> str:
        return self.manifest.agent_id


class AgentRegistry:
    def __init__(self) -> None:
        self._agents: dict[str, AgentRecord] = {}
        self._order: list[str] = []

    def create_agent(self, manifest: AgentManifest) -> AgentRecord:
        """Validate -> duplicate-check -> register. Returns the new record.

        This is the P0 slice of the factory: validate manifest (re-runs invariants),
        enforce unique agent_id, expose health/state. Later phases extend the same
        call to resolve domain / attach knowledge / bind memory & tool scope /
        register routing — all additive, no change to this signature.
        """
        manifest.validate()  # idempotent; guards direct (non-loader) construction
        aid = manifest.agent_id
        if aid in self._agents:
            raise DuplicateAgentError(f"agent_id already registered: {aid!r}")
        record = AgentRecord(manifest=manifest, health=HealthState.UNKNOWN)
        self._agents[aid] = record
        self._order.append(aid)
        return record

    # convenience alias
    def register(self, manifest: AgentManifest) -> AgentRecord:
        return self.create_agent(manifest)

    def get(self, agent_id: str) -> AgentRecord:
        return self._agents[agent_id]

    def has(self, agent_id: str) -> bool:
        return agent_id in self._agents

    def list(self) -> list[AgentRecord]:
        return [self._agents[aid] for aid in self._order]

    def ids(self) -> list[str]:
        return list(self._order)

    def names(self) -> list[str]:
        return [self._agents[aid].manifest.name for aid in self._order]

    def __len__(self) -> int:
        return len(self._order)

    def load_and_register(self, manifests) -> list[AgentRecord]:
        """Register an iterable of manifests (e.g. from loader.load_dir)."""
        return [self.create_agent(m) for m in manifests]
