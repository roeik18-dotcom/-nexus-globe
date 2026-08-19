"""PHILOS_OBSERVE — the ONE path by which Merlin ever writes a canon
Observation to PHILOS. Takes ALREADY-EXPLICIT evidence fields (never raw
utterance text — that parsing happens one layer up, in
app.action_intent.philos_observation_gate, deterministically, never by
inference) and calls PHILOS's real ingestion endpoint
(`POST /api/canon/observations`, contract read from
`app/api/canon/observations/route.ts` this pass).

**Every field this handler sends is copied verbatim from `inputs` — nothing
is invented, defaulted, or inferred here.** `domain`/`frame`/`level`/
`stability`/`deficitType`/`context`/`reference`/`confidence`/`expiry` are
all required inputs; there is no fallback value for any of them anywhere in
this file. `provenance` is the one fixed constant, `"self_reported"` — a
structural fact about WHAT KIND of evidence a direct self-report turn is
(the same category `canon_type: "observation"` is a structural fact, not
user-asserted data), not a per-turn guess.

**Deterministic canon_event_id, computed from the evidence itself** — the
concrete mechanism behind "no duplicate-ingest on replay": the exact same
evidence (same subject/domain/frame/level/stability/deficitType/context/
reference/confidence/expiry, i.e. the exact same self-report) always hashes
to the same id, so a genuine retry (network redelivery, WebSocket
reconnect resending the last turn) lands on the SAME id, and PHILOS's own
append-only store rejects the second write (`canon_event_id_already_stored`,
409) — treated here as a SUCCESS ("already recorded"), not an error. A
deliberately-repeated identical self-report in the same session is,
by this same mechanism, treated as one Observation, not two — a disclosed
design choice, not a bug: a genuinely NEW measurement should differ in at
least one evidence field (most naturally `context` or `time`, though `time`
is not part of the hash — see below).

**`time` is intentionally excluded from the hash** — it is stamped at
call time (`datetime.now(timezone.utc)`), so identical evidence submitted
minutes apart would otherwise never collide on `canon_event_id` even though
it's the same reported self-state; excluding it from the hash means a
genuine near-immediate replay (same wall-clock second or two) reliably
dedups, while the SAME evidence resubmitted much later (a new self-report
with the same words) still gets a stable id and is treated as the same
Observation, not silently duplicated — this module does not attempt to
guess "how much time makes it a new measurement," so it makes evidence
content, not time, the identity key. If that granularity is ever wrong for
a real product need, it is a deliberate, revisitable choice — not an
oversight.

**PHILOS ingestion is separate from Action Registry execution** (this pass's
explicit rule): this module never imports philos_transfer_execute, never
calls pipeline.execute, and creating an Observation here grants no
execution permission — PHILOS_TRANSFER_EXECUTE's own approval gate is
completely unaffected by whether an Observation exists.

Classified `SideEffect.READ_ONLY` — same precedent as
`automation_actions.py`'s SCHEDULE_REPORT/CONDITION_WATCH: this writes only
a canon DATA record (an expiring, revisable measurement), never a
real-world mutation, so it is not treated as the class of side effect the
SIDE_EFFECTING/approval machinery exists to gate — matching that module's
own stated reasoning exactly.

Known, disclosed gap (same shape as philos_orientation.py's own): a LOCAL
executor making a real external network call, for which NetworkScope has no
accurate member yet (NONE | N8N_ONLY). Left at its LOCAL-inferred default,
flagged here rather than hidden — not fixed unilaterally, matching
precedent.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Mapping, Optional

import httpx

from app.capabilities._framework.models import (
    ActionSpec, ApprovalPolicy, Executor, Idempotency, InputField,
    SideEffect, ValidationError,
)

logger = logging.getLogger("merlin.capabilities.philos_observe")

ACTION_TYPE = "PHILOS_OBSERVE"
DEFAULT_BASE_URL = "http://127.0.0.1:3000"
_FETCH_TIMEOUT_S = 15.0

_VALID_DOMAINS = frozenset({"G", "E", "C"})
_VALID_FRAMES = frozenset({"I", "R", "S"})
_VALID_DEFICIT_TYPES = frozenset({"RELATIVE", "OBJECTIVE"})
_VALID_CHANNELS = frozenset({
    "institutional", "material", "economic", "informational", "environmental", "other",
})

# The exact, fixed set of evidence fields that determine identity — see
# module header's "time is intentionally excluded from the hash" note.
_HASH_FIELDS = (
    "subject", "domain", "frame", "level", "stability", "deficitType",
    "context", "reference", "confidence", "expiry_days", "systemicChannel",
)


def _base_url() -> str:
    return os.environ.get("PHILOS_CANON_BASE_URL", DEFAULT_BASE_URL).rstrip("/")


def _ingest_token() -> Optional[str]:
    """Merlin's OWN copy of PHILOS's ingest secret — distinct env var name
    from PHILOS's own `CANON_INGEST_TOKEN`, same reasoning as
    philos_orientation.py's `_token()`."""
    return os.environ.get("PHILOS_CANON_INGEST_TOKEN")


def _nonempty_str(v: Any) -> Optional[str]:
    return v.strip() if isinstance(v, str) and v.strip() else None


def _build_observation(inputs: Mapping[str, Any], now: datetime) -> dict:
    """Whitelist copy of exactly the required evidence fields, plus defense-
    in-depth structural validation (the gate/parser one layer up already
    validated this — this is the same "never trust upstream alone" discipline
    every other capability in this codebase applies at its own boundary)."""
    subject = _nonempty_str(inputs.get("subject"))
    domain = _nonempty_str(inputs.get("domain"))
    frame = _nonempty_str(inputs.get("frame"))
    context = _nonempty_str(inputs.get("context"))
    reference = _nonempty_str(inputs.get("reference"))
    deficit_type = _nonempty_str(inputs.get("deficit_type"))
    systemic_channel = _nonempty_str(inputs.get("systemic_channel"))

    if not subject:
        raise ValidationError("subject must be a non-empty string")
    if domain not in _VALID_DOMAINS:
        raise ValidationError(f"domain must be one of {sorted(_VALID_DOMAINS)}")
    if frame not in _VALID_FRAMES:
        raise ValidationError(f"frame must be one of {sorted(_VALID_FRAMES)}")
    if not context:
        raise ValidationError("context must be a non-empty string")
    if not reference:
        raise ValidationError("reference must be a non-empty string")
    if deficit_type not in _VALID_DEFICIT_TYPES:
        raise ValidationError(f"deficit_type must be one of {sorted(_VALID_DEFICIT_TYPES)}")

    level = inputs.get("level")
    if isinstance(level, bool) or not isinstance(level, (int, float)):
        raise ValidationError("level must be a number")
    stability = inputs.get("stability")
    if isinstance(stability, bool) or not isinstance(stability, (int, float)):
        raise ValidationError("stability must be a number")
    confidence = inputs.get("confidence")
    if isinstance(confidence, bool) or not isinstance(confidence, (int, float)) or not (0.0 <= confidence <= 1.0):
        raise ValidationError("confidence must be a number in [0,1]")
    expiry_days = inputs.get("expiry_days")
    if isinstance(expiry_days, bool) or not isinstance(expiry_days, int) or expiry_days <= 0:
        raise ValidationError("expiry_days must be a positive integer")

    if frame == "S" and not systemic_channel:
        raise ValidationError("systemic_channel is required when frame is 'S'")
    if systemic_channel is not None and systemic_channel not in _VALID_CHANNELS:
        raise ValidationError(f"systemic_channel must be one of {sorted(_VALID_CHANNELS)}")

    time_iso = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    expiry_iso = (now + timedelta(days=expiry_days)).strftime("%Y-%m-%dT%H:%M:%SZ")

    obs: dict[str, Any] = {
        "subject": subject,
        "domain": domain,
        "frame": frame,
        "reference": reference,
        "context": context,
        "time": time_iso,
        "provenance": "self_reported",
        "confidence": float(confidence),
        "expiry": expiry_iso,
        "level": float(level),
        "stability": float(stability),
        "deficitType": deficit_type,
    }
    if systemic_channel is not None:
        obs["systemicChannel"] = systemic_channel
    return obs


def deterministic_canon_event_id(inputs: Mapping[str, Any]) -> str:
    """Pure, no I/O. Same evidence -> same id, always — see module header."""
    payload = {
        "subject": _nonempty_str(inputs.get("subject")),
        "domain": _nonempty_str(inputs.get("domain")),
        "frame": _nonempty_str(inputs.get("frame")),
        "level": inputs.get("level"),
        "stability": inputs.get("stability"),
        "deficitType": _nonempty_str(inputs.get("deficit_type")),
        "context": _nonempty_str(inputs.get("context")),
        "reference": _nonempty_str(inputs.get("reference")),
        "confidence": inputs.get("confidence"),
        "expiry_days": inputs.get("expiry_days"),
        "systemicChannel": _nonempty_str(inputs.get("systemic_channel")),
    }
    compact = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    digest = hashlib.sha256(compact.encode("utf-8")).hexdigest()[:32]
    return f"canon_evt_merlin_{digest}"


async def handler(inputs: Mapping[str, Any], request: Any = None) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    obs = _build_observation(inputs, now)
    canon_event_id = deterministic_canon_event_id(inputs)

    token = _ingest_token()
    if not token:
        logger.warning("PHILOS_OBSERVE: PHILOS_CANON_INGEST_TOKEN not configured — refusing")
        return {"ingested": False, "duplicate": False, "canon_event_id": None, "error": "not_configured"}

    url = f"{_base_url()}/api/canon/observations"
    body = {"canon_event_id": canon_event_id, "observation": obs}

    try:
        async with httpx.AsyncClient(timeout=_FETCH_TIMEOUT_S) as client:
            resp = await client.post(url, json=body, headers={"Authorization": f"Bearer {token}"})
    except httpx.TimeoutException:
        return {"ingested": False, "duplicate": False, "canon_event_id": None, "error": "timeout"}
    except httpx.RequestError:
        return {"ingested": False, "duplicate": False, "canon_event_id": None, "error": "network_error"}

    if resp.status_code == 201:
        logger.info("PHILOS_OBSERVE ingested canon_event_id=%s", canon_event_id)
        return {"ingested": True, "duplicate": False, "canon_event_id": canon_event_id, "error": None}
    if resp.status_code == 409:
        # Append-only store already has this exact evidence — idempotent
        # replay, not a failure. See module header.
        logger.info("PHILOS_OBSERVE already recorded (409) canon_event_id=%s", canon_event_id)
        return {"ingested": True, "duplicate": True, "canon_event_id": canon_event_id, "error": None}
    if resp.status_code == 401:
        return {"ingested": False, "duplicate": False, "canon_event_id": None, "error": "unauthorized"}
    if resp.status_code == 400:
        return {"ingested": False, "duplicate": False, "canon_event_id": None, "error": "invalid_observation"}
    return {"ingested": False, "duplicate": False, "canon_event_id": None,
            "error": f"unexpected_status_{resp.status_code}"}


def verify(inputs: Mapping[str, Any], result: Mapping[str, Any]) -> tuple[bool, str]:
    if not result.get("ingested"):
        return False, f"not ingested: {result.get('error')!r}"
    if not result.get("canon_event_id"):
        return False, "ingested but no canon_event_id in result"
    return True, f"canon_event_id={result['canon_event_id']!r} (duplicate={result.get('duplicate')})"


SPEC = ActionSpec(
    action_type=ACTION_TYPE,
    capability="philos_observe",
    executor=Executor.LOCAL,
    side_effect=SideEffect.READ_ONLY,
    approval_policy=ApprovalPolicy.NONE,
    idempotency=Idempotency.PURE,
    timeout_s=20.0,
    max_retries=0,
    required_inputs=(
        InputField("subject", (str,)),
        InputField("domain", (str,)),
        InputField("frame", (str,)),
        InputField("level", (int, float)),
        InputField("stability", (int, float)),
        InputField("deficit_type", (str,)),
        InputField("context", (str,)),
        InputField("reference", (str,)),
        InputField("confidence", (int, float)),
        InputField("expiry_days", (int,)),
        InputField("systemic_channel", (str,), required=False),
    ),
    output_fields=("ingested", "duplicate", "canon_event_id", "error"),
    verification="observation_ingested_with_canon_event_id",
    provenance_requirements=("subject", "canon_event_id"),
    intent_patterns=(),  # reached only via the dedicated philos_observation_gate path, never the generic text bridge
    handler=handler,
    verifier=verify,
)
