"""agent_os — P0 Agent Factory foundation (offline manifest + registry).

Self-contained by design: this package imports ONLY the Python stdlib and
PyYAML. It must NOT import from voice-gateway `service/*` or `app/*`, from
`mos/`, or from `kernel/` — P0 is a pure, side-effect-free data model +
registry, with no runtime, gateway, conductor, voice, or control-plane
integration. Substrate selection is deliberately deferred (see docs/audit).

Public surface:
    from agent_os import (
        AgentManifest, MemoryScope, RuntimeLimits,
        AgentClass, Authority, Capability, Channel, Status, Domain,
        AgentRegistry, AgentRecord, HealthState,
        load_manifest, load_dir,
        ManifestValidationError, DuplicateAgentError, DomainError, CapabilityError,
    )
"""

from .vocab import AgentClass, Authority, Capability, Channel, Status
from .domains import Domain
from .manifest import AgentManifest, MemoryScope, RuntimeLimits
from .registry import AgentRegistry, AgentRecord, HealthState
from .loader import load_manifest, load_dir
from .errors import (
    AgentOSError,
    ManifestValidationError,
    DuplicateAgentError,
    DomainError,
    CapabilityError,
)

__all__ = [
    "AgentClass", "Authority", "Capability", "Channel", "Status", "Domain",
    "AgentManifest", "MemoryScope", "RuntimeLimits",
    "AgentRegistry", "AgentRecord", "HealthState",
    "load_manifest", "load_dir",
    "AgentOSError", "ManifestValidationError", "DuplicateAgentError",
    "DomainError", "CapabilityError",
]
