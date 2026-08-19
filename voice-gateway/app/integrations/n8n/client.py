"""Outbound client for the n8n "Authenticated Echo" ActionRequest contract.

Scope (Phase 1, 2026-08-12): READ_ONLY_ECHO only.

  Merlin -> ActionRequest -> authenticated n8n webhook -> n8n validation
        -> StructuredResult -> Merlin

Hard constraints enforced *in this module*, not just by convention:
  - send_echo_action_request and send_bookmark_extract_action_request have
    no parameter that lets a caller set `side_effecting` or `approval` —
    every request they build has side_effecting=False, approval_required=False,
    approval=None, unconditionally.
  - The one function that *can* build a side-effecting request,
    send_bookmark_apply_action_request (added 2026-08-12 — see
    app/capabilities/bookmark_audit/apply.py), requires the caller to pass
    an already-constructed `approval` dict; this module never fabricates
    one. That was the "new, deliberately-reviewed function" this docstring
    used to say a future side-effecting phase would need, instead of a flag
    on the read-only functions — it still holds: the read-only functions
    were not touched to add this.
  - n8n's response is treated as untrusted input: it is parsed into a typed
    StructuredResult with explicit shape validation. Any deviation (wrong
    types, missing fields, non-JSON body, unexpected HTTP status) resolves to
    a StructuredResult with status="error" — never a raw exception escaping
    to the caller, and never a silent pass-through of unvalidated fields.
  - Every send/receive is logged with action_id + correlation_id + outcome
    only. The webhook token and the `inputs` payload content are never
    logged.

Isolation: this module imports only stdlib, httpx, and app.config. It must
never be imported by app.router, app.domain_router, app.agents, app.audio,
or anything under service/ (the live voice/wake/barge/audio runtime). It is
meant to be called *into* by Merlin's domain/reasoning layer in a later
phase — this phase only proves the adapter works, standalone.
"""

from __future__ import annotations

import hashlib
import json
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger("merlin.integrations.n8n")

SCHEMA_VERSION = "1.0"
DEFAULT_TTL_SECONDS = 60
DEFAULT_TIMEOUT_SECONDS = 5.0


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _sha256_hex_compact_json(value: dict[str, Any]) -> str:
    """sha256 hex digest of `value`, serialized to match n8n's JS
    JSON.stringify(value) byte-for-byte: no extra whitespace, and non-ASCII
    characters emitted raw (not \\uXXXX-escaped) since JSON.stringify does
    not escape them."""
    compact = json.dumps(value, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(compact.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class ActionRequest:
    """The exact ActionRequest contract enforced by the n8n Echo workflow's
    validation Code node. Field set and names are fixed by that contract —
    do not add/rename fields here without updating the n8n workflow too."""

    schema_version: str
    action_id: str
    correlation_id: str
    created_at: str
    expires_at: str
    inputs_hash: str
    approval: dict[str, Any] | None
    side_effecting: bool
    approval_required: bool
    provenance: dict[str, Any]
    inputs: dict[str, Any]

    def to_json_body(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "action_id": self.action_id,
            "correlation_id": self.correlation_id,
            "created_at": self.created_at,
            "expires_at": self.expires_at,
            "inputs_hash": self.inputs_hash,
            "approval": self.approval,
            "side_effecting": self.side_effecting,
            "approval_required": self.approval_required,
            "provenance": self.provenance,
            "inputs": self.inputs,
        }


@dataclass(frozen=True)
class StructuredResult:
    """Strictly-parsed, typed view of n8n's response. `status` is always one
    of: "accepted", "duplicate", "rejected", "error". Anything n8n returns
    that doesn't fit this shape becomes status="error" here — callers never
    see a raw dict from an untrusted remote."""

    status: str
    code: str
    action_id: str | None
    correlation_id: str | None
    message: str | None
    result: dict[str, Any] | None
    http_status: int | None


_VALID_STATUSES = frozenset({"accepted", "duplicate", "rejected"})


def _parse_structured_result(
    *, http_status: int, raw_text: str, sent_action_id: str
) -> StructuredResult:
    """Defensive parse of n8n's HTTP response. Never raises."""
    try:
        body = json.loads(raw_text)
    except (json.JSONDecodeError, TypeError):
        return StructuredResult(
            status="error",
            code="invalid_response",
            action_id=sent_action_id,
            correlation_id=None,
            message=f"non-JSON response body (HTTP {http_status})",
            result=None,
            http_status=http_status,
        )

    if not isinstance(body, dict):
        return StructuredResult(
            status="error",
            code="invalid_response",
            action_id=sent_action_id,
            correlation_id=None,
            message="response body was not a JSON object",
            result=None,
            http_status=http_status,
        )

    status = body.get("status")
    if status not in _VALID_STATUSES:
        return StructuredResult(
            status="error",
            code="invalid_response",
            action_id=sent_action_id,
            correlation_id=None,
            message=f"unrecognized status field: {status!r}",
            result=None,
            http_status=http_status,
        )

    code = body.get("code")
    if not isinstance(code, str):
        code = "unknown"

    action_id = body.get("action_id")
    if not isinstance(action_id, str):
        action_id = None

    result = body.get("result")
    if not isinstance(result, dict):
        result = None

    # correlation_id is only ever echoed back inside result.correlation_id
    # (accepted/duplicate paths) — never trust a top-level one, since the
    # contract doesn't define one there.
    correlation_id = None
    if result is not None:
        rid = result.get("correlation_id")
        if isinstance(rid, str):
            correlation_id = rid

    message = body.get("message")
    if not isinstance(message, str):
        message = None

    return StructuredResult(
        status=status,
        code=code,
        action_id=action_id,
        correlation_id=correlation_id,
        message=message,
        result=result,
        http_status=http_status,
    )


async def _send_action_request(
    *,
    url: str,
    action_label: str,
    inputs: dict[str, Any],
    correlation_id: str | None,
    action_id: str | None,
    provenance_source: str,
    ttl_seconds: int,
    timeout_seconds: float,
    side_effecting: bool = False,
    approval: dict[str, Any] | None = None,
) -> StructuredResult:
    """Shared send/receive path. side_effecting/approval default to the safe
    read-only values (False/None) and only send_bookmark_apply_action_request
    ever passes anything else — see module docstring. approval_required is
    always set equal to side_effecting: a side-effecting call always needs
    approval, a read-only call never claims to.
    """
    action_id = action_id or f"{action_label}-{uuid.uuid4()}"
    correlation_id = correlation_id or f"corr-{uuid.uuid4()}"
    now = datetime.now(timezone.utc)
    created_at = now.isoformat().replace("+00:00", "Z")
    expires_at = (now + timedelta(seconds=ttl_seconds)).isoformat().replace("+00:00", "Z")

    request = ActionRequest(
        schema_version=SCHEMA_VERSION,
        action_id=action_id,
        correlation_id=correlation_id,
        created_at=created_at,
        expires_at=expires_at,
        inputs_hash=_sha256_hex_compact_json(inputs),
        approval=approval,
        side_effecting=side_effecting,
        approval_required=side_effecting,
        provenance={"source": provenance_source},
        inputs=inputs,
    )

    token = settings.n8n_webhook_token
    if not token:
        logger.warning(
            "n8n_client: N8N_WEBHOOK_TOKEN not configured; refusing to send "
            "(action_id=%s correlation_id=%s)",
            action_id, correlation_id,
        )
        return StructuredResult(
            status="error", code="not_configured", action_id=action_id,
            correlation_id=correlation_id, message="n8n webhook token not configured",
            result=None, http_status=None,
        )

    logger.info(
        "n8n_client: sending %s action_id=%s correlation_id=%s expires_at=%s",
        action_label, action_id, correlation_id, expires_at,
    )

    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            resp = await client.post(
                url, json=request.to_json_body(), headers={"X-Action-Token": token},
            )
    except httpx.TimeoutException:
        logger.warning("n8n_client: timeout action_id=%s correlation_id=%s", action_id, correlation_id)
        return StructuredResult(
            status="error", code="network_timeout", action_id=action_id,
            correlation_id=correlation_id, message="request to n8n timed out",
            result=None, http_status=None,
        )
    except httpx.RequestError as exc:
        logger.warning(
            "n8n_client: connection error action_id=%s correlation_id=%s type=%s",
            action_id, correlation_id, type(exc).__name__,
        )
        return StructuredResult(
            status="error", code="network_error", action_id=action_id,
            correlation_id=correlation_id, message="connection to n8n failed",
            result=None, http_status=None,
        )

    if resp.status_code == 403:
        logger.info(
            "n8n_client: rejected (bad auth) action_id=%s correlation_id=%s http=403",
            action_id, correlation_id,
        )
        return StructuredResult(
            status="rejected", code="bad_auth", action_id=action_id,
            correlation_id=correlation_id, message="n8n rejected authentication",
            result=None, http_status=403,
        )

    parsed = _parse_structured_result(
        http_status=resp.status_code, raw_text=resp.text, sent_action_id=action_id
    )
    # correlation_id is locally tracked regardless of what n8n echoed back —
    # this is the authoritative value for end-to-end correlation on our side.
    parsed = StructuredResult(
        status=parsed.status, code=parsed.code, action_id=parsed.action_id or action_id,
        correlation_id=correlation_id, message=parsed.message, result=parsed.result,
        http_status=parsed.http_status,
    )

    if parsed.correlation_id and parsed.result is not None:
        remote_corr = parsed.result.get("correlation_id")
        if isinstance(remote_corr, str) and remote_corr != correlation_id:
            logger.warning(
                "n8n_client: correlation_id mismatch — sent=%s echoed=%s (treating sent as authoritative)",
                correlation_id, remote_corr,
            )

    logger.info(
        "n8n_client: received action_id=%s correlation_id=%s status=%s code=%s http=%s",
        parsed.action_id, correlation_id, parsed.status, parsed.code, parsed.http_status,
    )

    return parsed


async def send_echo_action_request(
    inputs: dict[str, Any],
    *,
    correlation_id: str | None = None,
    action_id: str | None = None,
    provenance_source: str = "merlin",
    ttl_seconds: int = DEFAULT_TTL_SECONDS,
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
) -> StructuredResult:
    """Send a READ_ONLY_ECHO ActionRequest to n8n and return a strictly
    parsed StructuredResult. Never raises — see _send_action_request."""
    return await _send_action_request(
        url=settings.n8n_webhook_url, action_label="echo", inputs=inputs,
        correlation_id=correlation_id, action_id=action_id,
        provenance_source=provenance_source, ttl_seconds=ttl_seconds,
        timeout_seconds=timeout_seconds,
    )


async def send_bookmark_extract_action_request(
    *,
    correlation_id: str | None = None,
    action_id: str | None = None,
    provenance_source: str = "merlin",
    ttl_seconds: int = DEFAULT_TTL_SECONDS,
    timeout_seconds: float = 30.0,
) -> StructuredResult:
    """Send a READ_ONLY BOOKMARK_EXTRACT ActionRequest to n8n. Takes no
    caller-supplied path/inputs — the n8n workflow reads two hardcoded,
    pre-discovered local file paths (Chrome + Safari bookmark stores) and
    returns their raw bytes as base64; there is no field here through which
    a caller could redirect it to read an arbitrary file. Longer default
    timeout than Echo since it reads real files (~1-2MB combined) on n8n's
    side rather than a trivial echo.
    """
    return await _send_action_request(
        url=settings.n8n_bookmark_extract_url, action_label="bookmark-extract", inputs={},
        correlation_id=correlation_id, action_id=action_id,
        provenance_source=provenance_source, ttl_seconds=ttl_seconds,
        timeout_seconds=timeout_seconds,
    )


async def send_bookmark_apply_action_request(
    inputs: dict[str, Any],
    *,
    approval: dict[str, Any],
    correlation_id: str | None = None,
    action_id: str | None = None,
    provenance_source: str = "merlin",
    ttl_seconds: int = DEFAULT_TTL_SECONDS,
    timeout_seconds: float = 30.0,
) -> StructuredResult:
    """Send a side_effecting BOOKMARK_APPLY ActionRequest to n8n.

    `approval` is required (no default) and is never constructed by this
    function — the caller (app.capabilities.bookmark_audit.apply) must
    already hold an explicit, human-approved approval object bound to the
    exact inputs_hash of `inputs`. This is the one function in this module
    that can produce side_effecting=True; see the module docstring.
    """
    return await _send_action_request(
        url=settings.n8n_bookmark_apply_url, action_label="bookmark-apply", inputs=inputs,
        correlation_id=correlation_id, action_id=action_id,
        provenance_source=provenance_source, ttl_seconds=ttl_seconds,
        timeout_seconds=timeout_seconds, side_effecting=True, approval=approval,
    )
