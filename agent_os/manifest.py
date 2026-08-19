"""AgentManifest — the declarative, immutable description of one agent.

Design rules honored:
  * DENY-BY-DEFAULT: every access field defaults to EMPTY. A manifest that omits
    memory / tools / capabilities / cross-domain / channels grants NONE.
  * INTERFACE ROLE != SYSTEM AUTHORITY: an interface-class agent may not hold
    system authority nor reach the SYSTEM domain.
  * CLOSED VOCABULARIES: unknown domain/capability/enum values fail validation.
  * IMMUTABLE + PURE: frozen dataclasses, no I/O, no side effects on construction.

Fields are justified in agent_os/README (A: required by an existing repo primitive,
B: required by an approved invariant, C: required for future Gateway/Conductor).
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .domains import Domain, PROTECTED_DOMAINS, parse_domain
from .errors import CapabilityError, DomainError, ManifestValidationError
from .vocab import AgentClass, Authority, Capability, Channel, Status


def _as_frozenset(value, coerce, field_name):
    """Coerce a (possibly None/list) manifest value to a frozenset via `coerce`."""
    if value is None:
        return frozenset()
    if isinstance(value, (str, bytes)):
        raise ManifestValidationError(f"{field_name} must be a list, got a scalar {value!r}")
    try:
        return frozenset(coerce(v) for v in value)
    except ValueError as exc:
        raise ManifestValidationError(f"{field_name}: {exc}") from exc


@dataclass(frozen=True)
class MemoryScope:
    """Capability-scoped memory. Empty read AND empty write == no memory access."""

    read: frozenset[str] = field(default_factory=frozenset)
    write: frozenset[str] = field(default_factory=frozenset)

    @classmethod
    def from_dict(cls, d: dict | None) -> "MemoryScope":
        d = d or {}
        return cls(
            read=_as_frozenset(d.get("read"), str, "memory_scope.read"),
            write=_as_frozenset(d.get("write"), str, "memory_scope.write"),
        )

    def to_dict(self) -> dict:
        return {"read": sorted(self.read), "write": sorted(self.write)}


@dataclass(frozen=True)
class RuntimeLimits:
    """Budgets/limits. max_concurrency defaults to 1 (mirrors Merlin single-turn
    ownership); token/timeout/budget default None = UNRESOLVED (no accounting yet)."""

    max_concurrency: int = 1
    max_tokens: int | None = None
    timeout_s: float | None = None
    budget_tokens: int | None = None

    @classmethod
    def from_dict(cls, d: dict | None) -> "RuntimeLimits":
        d = d or {}
        return cls(
            max_concurrency=int(d.get("max_concurrency", 1)),
            max_tokens=d.get("max_tokens"),
            timeout_s=d.get("timeout_s"),
            budget_tokens=d.get("budget_tokens"),
        )

    def to_dict(self) -> dict:
        return {
            "max_concurrency": self.max_concurrency,
            "max_tokens": self.max_tokens,
            "timeout_s": self.timeout_s,
            "budget_tokens": self.budget_tokens,
        }


@dataclass(frozen=True)
class AgentManifest:
    # --- identity ---
    agent_id: str
    agent_class: AgentClass
    name: str
    role: str
    primary_domain: Domain
    description: str = ""
    persona: str | None = None
    notes: str = ""                                   # honest "unresolved" annotations
    # --- domain access (deny-by-default: only the primary domain unless declared) ---
    allowed_domains: frozenset[Domain] = field(default_factory=frozenset)
    knowledge_sources: frozenset[Domain] = field(default_factory=frozenset)
    # --- authority / capabilities (deny-by-default) ---
    authority: Authority = Authority.NONE
    capabilities: frozenset[Capability] = field(default_factory=frozenset)
    # --- memory / tools (deny-by-default) ---
    memory_scope: MemoryScope = field(default_factory=MemoryScope)
    allowed_tools: frozenset[str] = field(default_factory=frozenset)
    denied_tools: frozenset[str] = field(default_factory=frozenset)
    # --- limits / channels / lifecycle ---
    runtime_limits: RuntimeLimits = field(default_factory=RuntimeLimits)
    input_channels: frozenset[Channel] = field(default_factory=frozenset)
    output_channels: frozenset[Channel] = field(default_factory=frozenset)
    status: Status = Status.DISABLED                  # inert until explicitly enabled

    # ---- construction from a plain dict (e.g. parsed YAML) ----
    @classmethod
    def from_dict(cls, raw: dict) -> "AgentManifest":
        if not isinstance(raw, dict):
            raise ManifestValidationError(f"manifest must be a mapping, got {type(raw).__name__}")

        def _enum(enum_cls, value, field_name, default=None):
            if value is None:
                if default is not None:
                    return default
                raise ManifestValidationError(f"{field_name} is required")
            try:
                return enum_cls(str(value))
            except ValueError as exc:
                valid = [e.value for e in enum_cls]
                raise ManifestValidationError(f"{field_name}={value!r} invalid; valid: {valid}") from exc

        primary = parse_domain_or_raise(raw.get("primary_domain"), "primary_domain")
        declared_allowed = raw.get("allowed_domains")
        allowed = (
            _as_frozenset(declared_allowed, parse_domain, "allowed_domains")
            if declared_allowed is not None
            else frozenset({primary})              # deny-by-default: primary only
        ) | {primary}

        manifest = cls(
            agent_id=_require_str(raw.get("agent_id"), "agent_id"),
            agent_class=_enum(AgentClass, raw.get("agent_class"), "agent_class"),
            name=_require_str(raw.get("name"), "name"),
            role=_require_str(raw.get("role"), "role"),
            primary_domain=primary,
            description=str(raw.get("description", "") or ""),
            persona=(str(raw["persona"]) if raw.get("persona") is not None else None),
            notes=str(raw.get("notes", "") or ""),
            allowed_domains=allowed,
            knowledge_sources=_as_frozenset(raw.get("knowledge_sources"), parse_domain, "knowledge_sources"),
            authority=_enum(Authority, raw.get("authority"), "authority", default=Authority.NONE),
            capabilities=_as_frozenset(raw.get("capabilities"), _parse_capability, "capabilities"),
            memory_scope=MemoryScope.from_dict(raw.get("memory_scope")),
            allowed_tools=_as_frozenset(raw.get("allowed_tools"), str, "allowed_tools"),
            denied_tools=_as_frozenset(raw.get("denied_tools"), str, "denied_tools"),
            runtime_limits=RuntimeLimits.from_dict(raw.get("runtime_limits")),
            input_channels=_as_frozenset(raw.get("input_channels"), lambda v: Channel(str(v)), "input_channels"),
            output_channels=_as_frozenset(raw.get("output_channels"), lambda v: Channel(str(v)), "output_channels"),
            status=_enum(Status, raw.get("status"), "status", default=Status.DISABLED),
        )
        manifest.validate()
        return manifest

    # ---- invariants ----
    def validate(self) -> "AgentManifest":
        if not self.agent_id or not self.agent_id.strip():
            raise ManifestValidationError("agent_id must be non-empty")

        # primary must be inside allowed (from_dict guarantees this; enforce for direct construction)
        if self.primary_domain not in self.allowed_domains:
            raise DomainError(
                f"primary_domain {self.primary_domain.value} not in allowed_domains "
                f"{[d.value for d in self.allowed_domains]}"
            )

        # runtime limits
        if self.runtime_limits.max_concurrency < 1:
            raise ManifestValidationError("runtime_limits.max_concurrency must be >= 1")

        touches_system = (Domain.SYSTEM in self.allowed_domains) or (self.primary_domain is Domain.SYSTEM)

        # INTERFACE ROLE != SYSTEM AUTHORITY (Correction 2)
        if self.agent_class is AgentClass.INTERFACE:
            if self.authority is Authority.SYSTEM:
                raise ManifestValidationError(
                    "interface-class agent may not hold SYSTEM authority (INTERFACE ROLE != SYSTEM AUTHORITY)"
                )
            if touches_system:
                raise DomainError(
                    "interface-class agent may not access the SYSTEM domain (INTERFACE ROLE != SYSTEM AUTHORITY)"
                )

        # SYSTEM authority requires a SYSTEM-class agent
        if self.authority is Authority.SYSTEM and self.agent_class is not AgentClass.SYSTEM:
            raise ManifestValidationError(
                f"SYSTEM authority requires agent_class=system, got {self.agent_class.value}"
            )

        # Any protected (SYSTEM) domain requires SYSTEM class AND elevated/system authority.
        # This makes "SYSTEM cannot appear by accident through defaults" mechanical.
        for d in self.allowed_domains:
            if d in PROTECTED_DOMAINS:
                if self.agent_class is not AgentClass.SYSTEM:
                    raise DomainError(
                        f"protected domain {d.value} requires agent_class=system"
                    )
                if self.authority not in (Authority.ELEVATED, Authority.SYSTEM):
                    raise DomainError(
                        f"protected domain {d.value} requires authority in {{elevated, system}}"
                    )
        return self

    def to_dict(self) -> dict:
        return {
            "agent_id": self.agent_id,
            "agent_class": self.agent_class.value,
            "name": self.name,
            "role": self.role,
            "description": self.description,
            "persona": self.persona,
            "notes": self.notes,
            "primary_domain": self.primary_domain.value,
            "allowed_domains": sorted(d.value for d in self.allowed_domains),
            "knowledge_sources": sorted(d.value for d in self.knowledge_sources),
            "authority": self.authority.value,
            "capabilities": sorted(c.value for c in self.capabilities),
            "memory_scope": self.memory_scope.to_dict(),
            "allowed_tools": sorted(self.allowed_tools),
            "denied_tools": sorted(self.denied_tools),
            "runtime_limits": self.runtime_limits.to_dict(),
            "input_channels": sorted(c.value for c in self.input_channels),
            "output_channels": sorted(c.value for c in self.output_channels),
            "status": self.status.value,
        }


# ---- small helpers ----
def _require_str(value, field_name) -> str:
    if value is None or not str(value).strip():
        raise ManifestValidationError(f"{field_name} is required and must be non-empty")
    return str(value)


def parse_domain_or_raise(value, field_name) -> Domain:
    if value is None:
        raise ManifestValidationError(f"{field_name} is required")
    try:
        return parse_domain(value)
    except ValueError as exc:
        raise DomainError(f"{field_name}: {exc}") from exc


def _parse_capability(value) -> Capability:
    try:
        return Capability(str(value))
    except ValueError as exc:
        valid = [c.value for c in Capability]
        raise CapabilityError(f"unknown capability {value!r}; valid: {valid}") from exc
