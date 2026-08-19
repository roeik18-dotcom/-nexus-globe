"""Generic, registry-driven n8n executor for the capability framework.

For an ActionSpec whose executor is N8N, the pipeline hands a CapabilityRequest
here; this module maps it 1:1 onto the PROVEN n8n ActionRequest contract fields
(so n8n's independent validation — auth / inputs_hash / expiry / approval-binding
/ idempotency — still applies) and posts it to the per-capability webhook.

Design note (collision-safe, 2026-08-12): the analogous private sender
`app/integrations/n8n/client.py::_send_action_request` is being actively edited
by the bookmark session. To avoid a merge collision we do NOT import or modify
that module here beyond the stable StructuredResult type. Once that refactor
settles, this and `_send_action_request` should be consolidated into one sender
(tracked as a follow-up; see the framework self-critique). No n8n-executor
capability is live in this pass, so this path is construction-tested only.
"""

from __future__ import annotations

import logging
from typing import Any, Optional
from urllib.parse import urlsplit

import httpx

from app.capabilities._framework.models import CapabilityRequest, StructuredResult

logger = logging.getLogger("merlin.capabilities.n8n_dispatch")

DEFAULT_TIMEOUT_SECONDS = 10.0


def _host_allowed(url: str, allowed_hosts: tuple[str, ...]) -> bool:
    host = (urlsplit(url).hostname or "").lower()
    return any(host == h.lower() for h in allowed_hosts)


def build_n8n_body(request: CapabilityRequest) -> dict[str, Any]:
    """Map the framework request onto the exact proven n8n contract field set.
    `action_type`/`capability` travel under provenance so the webhook contract
    (which validates a fixed field set) is unchanged."""
    provenance = dict(request.provenance)
    provenance.setdefault("action_type", request.action_type)
    provenance.setdefault("capability", request.capability)
    return {
        "schema_version": request.schema_version,
        "action_id": request.action_id,
        "correlation_id": request.correlation_id,
        "created_at": request.created_at,
        "expires_at": request.expires_at,
        "inputs_hash": request.inputs_hash,
        "approval": request.approval,
        "side_effecting": request.side_effecting,
        "approval_required": request.approval_required,
        "provenance": provenance,
        "inputs": request.inputs,
    }


async def dispatch_to_n8n(
    request: CapabilityRequest,
    *,
    webhook_url: str,
    token: Optional[str],
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
    allowed_hosts: tuple[str, ...] = (),
) -> StructuredResult:
    """POST a CapabilityRequest to an n8n webhook and return a StructuredResult.
    Never raises — every failure resolves to status='error'/'rejected'.

    `allowed_hosts` is OPT-IN (empty tuple = not enforced, the behaviour every
    capability had before this parameter existed). Pass `spec.allowed_hosts`
    for any capability where the target host must be pinned — e.g. a
    side-effecting one like EMAIL_SEND, where `webhook_url` ultimately comes
    from an env var and a misconfigured/tampered env value must not silently
    redirect a real send to an arbitrary host."""
    if allowed_hosts and not _host_allowed(webhook_url, allowed_hosts):
        logger.warning("n8n_dispatch: host not in allowed_hosts action_id=%s", request.action_id)
        return StructuredResult(
            status="rejected", code="host_not_allowed", action_id=request.action_id,
            correlation_id=request.correlation_id,
            message="webhook host is not in the registry's allowed_hosts",
            result=None, http_status=None,
        )
    if not token:
        logger.warning("n8n_dispatch: no token configured action_id=%s", request.action_id)
        return StructuredResult(
            status="error", code="not_configured", action_id=request.action_id,
            correlation_id=request.correlation_id, message="n8n webhook token not configured",
            result=None, http_status=None,
        )
    logger.info("n8n_dispatch: sending action_type=%s action_id=%s correlation_id=%s",
                request.action_type, request.action_id, request.correlation_id)
    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            resp = await client.post(
                webhook_url, json=build_n8n_body(request),
                headers={"X-Action-Token": token},
            )
    except httpx.TimeoutException:
        return StructuredResult("error", "network_timeout", request.action_id,
                                request.correlation_id, "request to n8n timed out", None, None)
    except httpx.RequestError:
        return StructuredResult("error", "network_error", request.action_id,
                                request.correlation_id, "connection to n8n failed", None, None)

    if resp.status_code == 403:
        return StructuredResult("rejected", "bad_auth", request.action_id,
                                request.correlation_id, "n8n rejected authentication", None, 403)
    try:
        body = resp.json()
    except ValueError:
        return StructuredResult("error", "invalid_response", request.action_id,
                                request.correlation_id, "non-JSON response from n8n", None,
                                resp.status_code)
    if not isinstance(body, dict) or body.get("status") not in {"accepted", "duplicate", "rejected"}:
        return StructuredResult("error", "invalid_response", request.action_id,
                                request.correlation_id, "unexpected n8n response shape", None,
                                resp.status_code)
    return StructuredResult(
        status=body["status"], code=str(body.get("code", "unknown")),
        action_id=request.action_id, correlation_id=request.correlation_id,
        message=body.get("message") if isinstance(body.get("message"), str) else None,
        result=body.get("result") if isinstance(body.get("result"), dict) else None,
        http_status=resp.status_code,
    )
