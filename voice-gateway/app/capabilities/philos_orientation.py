"""PHILOS_ORIENTATION — the Merlin-side client for the ONE real PHILOS
endpoint (`GET /api/canon/observations/{canonEventId}/orientation` in the
-nexus-globe Next.js app, `app/api/canon/observations/[canonEventId]/
orientation/route.ts`). Contract read from that file directly this pass
(2026-08-14), not from memory or a prior summary:

  METHOD   GET
  PATH     /api/canon/observations/{canon_event_id}/orientation
  AUTH     Authorization: Bearer <CANON_READ_TOKEN>   (PHILOS-side secret;
           Merlin holds its own copy via PHILOS_CANON_READ_TOKEN, below —
           this file does not read or touch PHILOS's own env/config)
  QUERY    asOf=<ISO-8601 instant, explicit offset required>
  BODY     none (GET)
  RESPONSE 200 OrientationEndpointResponse = MerlinOrientationHandoff &
             { stop_point: {stage, reason} | null }
           401 {error:"unauthorized"}          — bad/missing token
           400 {error:"invalid_as_of", detail}  — asOf missing/unparseable
           404 {error:"not_found"}              — no such canon_event_id
           500 {error:"read_failed"}            — PHILOS-side store failure

This module NEVER modifies PHILOS. It is a plain HTTP GET client — no
different, from PHILOS's point of view, than any other authenticated reader
of its one read-only endpoint. `app/lib/philos/**`, `app/api/canon/**` are
never imported, edited, or written to from here or anywhere in voice-gateway.

Untrusted-data boundary, same discipline as web_research.py/
gov_il_research.py: the JSON response is DATA. `_FORBIDDEN_KEYS` — approval,
credentials, network/retry policy, tool identity — are recursively scanned
for and stripped from the response before it is returned, and are never read
by any code in this file to make a decision. This is defense in depth on top
of the real guarantee, which is structural: nothing in this handler's control
flow ever calls `pipeline.execute()` on anything derived from the response.
A `candidate_action` PHILOS returns is surfaced as INERT evidence only —
never auto-mapped to an action_type, never auto-approved, never dispatched.
Turning a specific candidate_action into an actual Merlin ActionSpec
execution is a deliberate, separate, human/policy-reviewed step this module
does not and cannot take (PHILOS's own handoff carries no tool name by
design — see merlinHandoff.ts's own "deliberately EXCLUDED" list — so there
is no field here to even attempt such a mapping from).

Return-path evidence envelope: `PhilosEffectEvidenceEnvelope` below is a
TYPE ONLY — the shape a future capability would need to send real Effect/
verification evidence back to PHILOS. PHILOS has no write-back endpoint for
this today (confirmed by reading its route directory this pass — only
`POST /observations` exists, for Observations, not Effects). No function in
this file sends one; there is no persistence, real or invented, anywhere
here.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Mapping, Optional
from urllib.parse import quote

import httpx

from app.capabilities._framework.models import (
    ActionSpec, ApprovalPolicy, DataTrust, Executor, Idempotency, InputField,
    SideEffect, ValidationError,
)

logger = logging.getLogger("merlin.capabilities.philos_orientation")

ACTION_TYPE = "PHILOS_ORIENTATION"
DEFAULT_BASE_URL = "http://127.0.0.1:3000"
USER_AGENT = "Merlin-Philos-Orientation-Client/1.0 (+read-only)"
_FETCH_TIMEOUT_S = 15.0
_MAX_ID_LEN = 200

# The ONLY keys this module ever treats as forbidden control fields, scanned
# for recursively at every depth of the PHILOS response (see
# `_scrub_forbidden`) — approval, credentials, network/retry policy, tool
# identity. Matches FORBIDDEN_INPUT_KEYS's own anti-escalation intent
# (app/capabilities/_framework/models.py), applied here to a RESPONSE rather
# than an input, because the same escalation risk exists on either side of a
# capability call.
_FORBIDDEN_KEYS = frozenset({
    "side_effecting", "capability", "max_retries", "api_key", "tool_authority",
    "credential", "approval_required", "tool_name", "network_scope", "secret",
    "network_permission", "retry_policy", "credentials", "approval", "approved",
    "allowed_hosts", "action_type", "token", "tool",
})


def _endpoint_base() -> str:
    return os.environ.get("PHILOS_CANON_BASE_URL", DEFAULT_BASE_URL).rstrip("/")


def _token() -> Optional[str]:
    """Merlin's OWN copy of the shared read secret. Deliberately a distinct
    env var name from PHILOS's `CANON_READ_TOKEN` (different process,
    different .env) — operationally the two values must match, which is a
    deployment concern outside this file's or PHILOS's own scope."""
    return os.environ.get("PHILOS_CANON_READ_TOKEN")


def _scrub_forbidden(obj: Any, path: str = "$") -> "tuple[Any, list[str]]":
    """Recursively strips any `_FORBIDDEN_KEYS` key found anywhere in `obj`.
    Returns (scrubbed_copy, [dotted-paths where something was removed]).
    Pure, no I/O. Never raises — an unexpected shape is passed through
    as-is (scrubbing only ever removes, never guesses a replacement)."""
    removed: list[str] = []
    if isinstance(obj, Mapping):
        clean: dict[str, Any] = {}
        for k, v in obj.items():
            if isinstance(k, str) and k in _FORBIDDEN_KEYS:
                removed.append(f"{path}.{k}")
                continue
            sub, sub_removed = _scrub_forbidden(v, path=f"{path}.{k}")
            clean[k] = sub
            removed.extend(sub_removed)
        return clean, removed
    if isinstance(obj, list):
        clean_list: list[Any] = []
        for i, item in enumerate(obj):
            sub, sub_removed = _scrub_forbidden(item, path=f"{path}[{i}]")
            clean_list.append(sub)
            removed.extend(sub_removed)
        return clean_list, removed
    return obj, removed


def _validate_as_of(raw: Any) -> str:
    if not (isinstance(raw, str) and raw.strip()):
        raise ValidationError("as_of must be a non-empty ISO-8601 string with an explicit offset")
    v = raw.strip()
    if not (v.endswith("Z") or v[-6] in ("+", "-")):
        raise ValidationError("as_of must end with Z or an explicit +HH:MM/-HH:MM offset")
    return v


def _validate_canon_event_id(raw: Any) -> str:
    if not (isinstance(raw, str) and raw.strip()):
        raise ValidationError("canon_event_id must be a non-empty string")
    v = raw.strip()
    if len(v) > _MAX_ID_LEN:
        raise ValidationError(f"canon_event_id exceeds max {_MAX_ID_LEN} chars")
    return v


async def handler(inputs: Mapping[str, Any], request: Any = None) -> dict[str, Any]:
    canon_event_id = _validate_canon_event_id(inputs["canon_event_id"])
    as_of = _validate_as_of(inputs["as_of"])

    token = _token()
    if not token:
        logger.warning("PHILOS_ORIENTATION: PHILOS_CANON_READ_TOKEN not configured — refusing")
        return {"connected": False, "http_status": None, "error": "not_configured",
                "handoff": None, "forbidden_fields_stripped": []}

    url = f"{_endpoint_base()}/api/canon/observations/{quote(canon_event_id, safe='')}/orientation"

    try:
        async with httpx.AsyncClient(timeout=_FETCH_TIMEOUT_S) as client:
            resp = await client.get(
                url, params={"asOf": as_of},
                headers={"Authorization": f"Bearer {token}", "User-Agent": USER_AGENT},
            )
    except httpx.TimeoutException:
        return {"connected": False, "http_status": None, "error": "timeout",
                "handoff": None, "forbidden_fields_stripped": []}
    except httpx.RequestError:
        return {"connected": False, "http_status": None, "error": "network_error",
                "handoff": None, "forbidden_fields_stripped": []}

    if resp.status_code == 401:
        return {"connected": False, "http_status": 401, "error": "unauthorized",
                "handoff": None, "forbidden_fields_stripped": []}
    if resp.status_code == 400:
        return {"connected": False, "http_status": 400, "error": "invalid_as_of",
                "handoff": None, "forbidden_fields_stripped": []}
    if resp.status_code == 404:
        return {"connected": False, "http_status": 404, "error": "not_found",
                "handoff": None, "forbidden_fields_stripped": []}
    if resp.status_code != 200:
        return {"connected": False, "http_status": resp.status_code, "error": "unexpected_status",
                "handoff": None, "forbidden_fields_stripped": []}

    try:
        body = resp.json()
    except ValueError:
        return {"connected": False, "http_status": 200, "error": "invalid_json",
                "handoff": None, "forbidden_fields_stripped": []}

    if not isinstance(body, dict):
        return {"connected": False, "http_status": 200, "error": "unexpected_shape",
                "handoff": None, "forbidden_fields_stripped": []}

    scrubbed, stripped_paths = _scrub_forbidden(body)
    if stripped_paths:
        logger.warning("PHILOS_ORIENTATION: stripped forbidden fields from response: %s", stripped_paths)

    return {"connected": True, "http_status": 200, "error": None,
            "handoff": scrubbed, "forbidden_fields_stripped": stripped_paths}


def verify(inputs: Mapping[str, Any], result: Mapping[str, Any]) -> tuple[bool, str]:
    if not result.get("connected"):
        return False, f"no orientation retrieved from PHILOS: {result.get('error')!r}"
    handoff = result.get("handoff")
    if not (isinstance(handoff, dict) and handoff.get("orientation_id")):
        return False, "connected but response carries no orientation_id"
    stripped = result.get("forbidden_fields_stripped") or []
    if stripped:
        return True, f"orientation retrieved but {len(stripped)} forbidden field(s) had to be stripped"
    return True, f"orientation_id={handoff['orientation_id']!r} retrieved with 0 forbidden fields"


SPEC = ActionSpec(
    action_type=ACTION_TYPE,
    capability="philos_orientation",
    executor=Executor.LOCAL,
    side_effect=SideEffect.READ_ONLY,
    approval_policy=ApprovalPolicy.NONE,
    idempotency=Idempotency.SOFT_CACHE,
    timeout_s=20.0,
    max_retries=0,
    required_inputs=(
        InputField("canon_event_id", (str,)),
        InputField("as_of", (str,)),
    ),
    output_fields=("connected", "http_status", "error", "handoff", "forbidden_fields_stripped"),
    verification="orientation_retrieved_with_id_and_no_forbidden_fields",
    provenance_requirements=("canon_event_id", "as_of", "philos_endpoint_url", "http_status"),
    intent_patterns=(),  # never voice-reachable — no field here to safely extract canon_event_id from free text
    handler=handler,
    verifier=verify,
    data_trust=DataTrust.EXTERNAL_UNTRUSTED,
)


@dataclass(frozen=True)
class PhilosEffectEvidenceEnvelope:
    """The shape a FUTURE capability would submit back to PHILOS as real
    Effect/verification evidence, once PHILOS exposes a write-back endpoint
    for it (it does not today — only Observation ingestion exists). Defined
    now so the contract is agreed and typed ahead of that endpoint existing.

    NOT sent anywhere by this module. NOT persisted anywhere by this module.
    No function here constructs PHILOS canon data or writes a PHILOS file.
    """

    orientation_id: str
    source_observation_id: str
    action_ref: str
    claimed_outcome: str
    verified_outcome: Optional[str]
    verification_source: str
    structured_result_status: str
    structured_result_code: str
    recorded_at: str
