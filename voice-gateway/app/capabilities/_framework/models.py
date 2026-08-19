"""Framework data model: ActionSpec (the registry entry), CapabilityRequest
(the framework's superset of the proven n8n ActionRequest), typed errors, and
the shared StructuredResult (imported, not redefined, from the proven client).
"""

from __future__ import annotations

import enum
import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Mapping, Optional, Union

# Reuse the ALREADY-PROVEN result contract so every capability (local or n8n)
# speaks the exact same StructuredResult shape. Import only — never modified here.
from app.integrations.n8n.client import StructuredResult

SCHEMA_VERSION = "1.0"


class Executor(str, enum.Enum):
    LOCAL = "local"   # runs a pure Python handler in-process
    N8N = "n8n"       # dispatched to an n8n workflow via action_dispatch


class SideEffect(str, enum.Enum):
    READ_ONLY = "read_only"
    SIDE_EFFECTING = "side_effecting"


class ApprovalPolicy(str, enum.Enum):
    NONE = "none"                # read-only actions
    BOUND = "bound"              # side-effecting: approval bound to inputs_hash
    BOUND_STRONG = "bound_strong"  # e.g. EMAIL_SEND / DELETE: explicit, per-op


class Idempotency(str, enum.Enum):
    PURE = "pure"               # deterministic; same action_id returns cached result
    SOFT_CACHE = "soft_cache"   # cache by inputs_hash + TTL
    STRICT_DEDUP = "strict_dedup"  # side-effecting: action_id must never run twice


class NetworkScope(str, enum.Enum):
    NONE = "none"        # handler makes no network call (pure/offline)
    N8N_ONLY = "n8n_only"  # handler may call out only to the configured n8n instance


class DataTrust(str, enum.Enum):
    INTERNAL = "internal"                   # no untrusted external content involved
    EXTERNAL_UNTRUSTED = "external_untrusted"  # handler ingests provider/web content as DATA


class RetryPolicy(str, enum.Enum):
    NONE = "none"        # never retried (max_retries == 0)
    LIMITED = "limited"  # retried up to max_retries times by the caller/executor layer


class VerificationPolicy(str, enum.Enum):
    OPTIONAL = "optional"              # verification is informational only (current/legacy default)
    REQUIRED = "required"              # a failed/unverified verifier downgrades status to "unverified"
    REQUIRED_STRICT = "required_strict"  # a failed/unverified verifier REJECTS the result outright


# handler(inputs) -> result dict (may be sync or async)
# handler(inputs, request) -> result dict (sync or async). `request` is the generic
# CapabilityRequest (action_id/correlation_id/inputs_hash/...); pure capabilities
# simply ignore it, external ones thread it through for end-to-end correlation.
Handler = Callable[..., Union[Mapping[str, Any], Awaitable[Mapping[str, Any]]]]
# verifier(inputs, result) -> (ok, detail)
Verifier = Callable[[Mapping[str, Any], Mapping[str, Any]], "tuple[bool, str]"]


class CapabilityError(Exception):
    """Base for controlled capability failures. The pipeline catches these and
    turns them into a StructuredResult — they never escape to the caller."""
    code = "error"


class ValidationError(CapabilityError):
    code = "malformed_request"


class MissingInputError(ValidationError):
    code = "missing_input"


@dataclass(frozen=True)
class InputField:
    name: str
    types: tuple[type, ...]
    required: bool = True


@dataclass(frozen=True)
class ActionSpec:
    """One row of the Action Registry. Declarative: the pipeline reads this and
    needs no per-capability branching. side_effect/approval come from HERE only —
    never from caller inputs (that is the core anti-escalation invariant).

    The execution-security fields below (network_scope, allowed_hosts,
    credential_scope, data_trust, retry_policy, verification_policy) are
    likewise registry-authoritative: nothing in `inputs`, a provider response,
    or fetched web content can ever set or influence them (see
    FORBIDDEN_INPUT_KEYS and the pipeline's inputs-validation step, which
    strips inputs down to only the fields a capability itself declared).
    `network_scope`/`credential_scope`/`data_trust` default to a value derived
    from `executor` in __post_init__ when left as None, so every one of the
    capabilities registered before this contract existed gets a truthful
    value with zero per-file changes."""

    action_type: str
    capability: str
    executor: Executor
    side_effect: SideEffect
    approval_policy: ApprovalPolicy
    idempotency: Idempotency
    timeout_s: float
    max_retries: int
    required_inputs: tuple[InputField, ...]
    output_fields: tuple[str, ...]
    verification: str                       # descriptive method name
    provenance_requirements: tuple[str, ...]
    intent_patterns: tuple[str, ...] = ()   # substrings that resolve text -> action_type
    handler: Optional[Handler] = None       # LOCAL executor
    verifier: Optional[Verifier] = None
    n8n_webhook_key: Optional[str] = None   # N8N executor: settings key for the URL

    # Execution security contract (registry-authoritative; see class docstring).
    network_scope: Optional[NetworkScope] = None
    allowed_hosts: tuple[str, ...] = ()     # non-empty => dispatch_to_n8n enforces it
    credential_scope: Optional[str] = None
    data_trust: Optional[DataTrust] = None
    retry_policy: Optional[RetryPolicy] = None
    verification_policy: VerificationPolicy = VerificationPolicy.OPTIONAL

    def __post_init__(self) -> None:
        # frozen dataclass: derived defaults are filled via object.__setattr__.
        if self.network_scope is None:
            object.__setattr__(
                self, "network_scope",
                NetworkScope.NONE if self.executor is Executor.LOCAL else NetworkScope.N8N_ONLY,
            )
        if self.credential_scope is None:
            object.__setattr__(
                self, "credential_scope",
                "none" if self.executor is Executor.LOCAL else "n8n_webhook_token",
            )
        if self.data_trust is None:
            object.__setattr__(
                self, "data_trust",
                DataTrust.INTERNAL if self.executor is Executor.LOCAL else DataTrust.EXTERNAL_UNTRUSTED,
            )
        if self.retry_policy is None:
            object.__setattr__(
                self, "retry_policy",
                RetryPolicy.NONE if self.max_retries == 0 else RetryPolicy.LIMITED,
            )
        if self.retry_policy is RetryPolicy.NONE and self.max_retries != 0:
            raise ValueError(f"{self.action_type}: retry_policy=NONE but max_retries={self.max_retries}")
        if self.side_effect is SideEffect.SIDE_EFFECTING and self.approval_policy is ApprovalPolicy.NONE:
            raise ValueError(f"{self.action_type}: side-effecting action must not have approval_policy=NONE")

    @property
    def is_side_effecting(self) -> bool:
        return self.side_effect is SideEffect.SIDE_EFFECTING


# Control fields a caller's `inputs` may never set — enforcing that a capability
# input (or upstream untrusted content flattened into inputs) cannot make an
# action side-effecting, self-approve, or change which action runs.
FORBIDDEN_INPUT_KEYS = frozenset(
    {
        "side_effecting", "approval_required", "approval", "action_type", "capability",
        # Execution-security-contract fields — same anti-escalation invariant:
        # an input can never widen its own network/credential/verification posture.
        "network_scope", "allowed_hosts", "credential_scope", "data_trust",
        "retry_policy", "verification_policy",
    }
)


def inputs_hash(inputs: Mapping[str, Any]) -> str:
    """Deterministic sha256 over the inputs (sorted-compact JSON). Used for
    approval binding: the same inputs always hash identically, and any change
    invalidates a bound approval."""
    compact = json.dumps(inputs, separators=(",", ":"), ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(compact.encode("utf-8")).hexdigest()


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def to_iso(dt: datetime) -> str:
    return dt.isoformat().replace("+00:00", "Z")


@dataclass(frozen=True)
class CapabilityRequest:
    """The framework request — a superset of the proven n8n ActionRequest, adding
    action_type/capability. For n8n-executed actions, action_dispatch maps this
    1:1 onto the n8n contract fields, so n8n's independent validation still holds."""

    schema_version: str
    action_type: str
    capability: str
    action_id: str
    correlation_id: str
    created_at: str
    expires_at: str
    inputs: dict[str, Any]
    inputs_hash: str
    approval: Optional[dict[str, Any]]
    side_effecting: bool        # AUTHORITATIVE: copied from the spec, never inputs
    approval_required: bool
    provenance: dict[str, Any]


__all__ = [
    "SCHEMA_VERSION", "Executor", "SideEffect", "ApprovalPolicy", "Idempotency",
    "NetworkScope", "DataTrust", "RetryPolicy", "VerificationPolicy",
    "Handler", "Verifier", "CapabilityError", "ValidationError", "MissingInputError",
    "InputField", "ActionSpec", "FORBIDDEN_INPUT_KEYS", "inputs_hash", "utc_now",
    "to_iso", "CapabilityRequest", "StructuredResult",
]
