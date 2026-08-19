"""Controlled vocabularies for agent manifests.

Every enum here is a CLOSED set: a manifest value outside the set fails
validation (never silently accepted). This is what makes "unknown capability
fails" and "SYSTEM cannot appear by accident" mechanical rather than advisory.
"""

from __future__ import annotations

from enum import Enum


class AgentClass(str, Enum):
    """What KIND of agent this is — separate from its domain and its authority.

    Correction 2 (INTERFACE ROLE != SYSTEM AUTHORITY): an INTERFACE agent owns
    a human-facing surface but has no runtime authority; only a SYSTEM-class
    agent may hold system authority or reach the SYSTEM domain.
    """

    INTERFACE = "interface"     # human-facing surface (e.g. Merlin voice)
    SPECIALIST = "specialist"   # single-responsibility worker
    DEPARTMENT = "department"   # coordinates specialists within a domain
    SYSTEM = "system"           # runtime/system authority (protected)


class Authority(str, Enum):
    """Escalating authority tier (maps to the [U]/[E]/[M] Authority Model).

    Deny-by-default: an unspecified authority is NONE. SYSTEM authority is
    reachable only by a SYSTEM-class agent.
    """

    NONE = "none"
    READ_ONLY = "read_only"
    STANDARD = "standard"
    ELEVATED = "elevated"
    SYSTEM = "system"


class Capability(str, Enum):
    """Side-effect capabilities. Deny-by-default: absent == not granted.

    Memory read/write is governed separately by `memory_scope` (single owner),
    and cross-domain access by `allowed_domains`, so those are intentionally
    NOT capabilities here (avoids two owners for one gate).
    """

    FILESYSTEM_WRITE = "filesystem_write"
    NETWORK = "network"
    PROCESS_CONTROL = "process_control"
    DELEGATION = "delegation"


class Channel(str, Enum):
    """Input/output surfaces an agent may be admitted through (Gateway concern)."""

    VOICE = "voice"
    CONTROL_PANEL = "control_panel"
    CHAT = "chat"
    SCHEDULE = "schedule"
    API = "api"
    EVENT = "event"


class Status(str, Enum):
    """Declared lifecycle state (operator kill-switch / control-plane).

    Deny-by-default: a manifest that omits status is DISABLED (inert) until an
    operator explicitly enables it. `health` is runtime state, tracked on the
    registry record — not declared here.
    """

    DRAFT = "draft"
    DISABLED = "disabled"
    ENABLED = "enabled"
    DEGRADED = "degraded"
