"""EMAIL_SEND — side-effecting. Explicit, approval-bound, verified.

  build preview/approval (local, pure) -> human approval (out of this module)
      -> pipeline.execute(..., approval=...) -> dispatch_to_n8n (Email Send
      workflow) -> provider evidence required to ever report "sent"

Guarantees, enforced in code (not by convention):
  - Recipients/subject/body/attachments are validated with the EXACT SAME
    rules as EMAIL_DRAFT (`app.capabilities.email_draft`, imported not
    duplicated) — explicit recipients only, no inference from body text,
    attachments are references only.
  - Approval is BOUND_STRONG (`app/capabilities/_framework/models.py`):
    the pipeline requires an approval object explicitly marked
    `policy="bound_strong"` and bound to the exact sha256 of the normalized
    {to, cc, bcc, subject, body, attachments} — any changed field invalidates
    it, and a plain BOUND approval collected for a different action can never
    be replayed here. `build_approval()` below is the only way to construct
    one FOR THIS ACTION, and it never sets `approved=True` itself — the
    caller must already hold an explicit human "yes".
  - idempotency=STRICT_DEDUP (framework-level): the same action_id can never
    execute twice; a retry with the same action_id returns the first result.
  - max_retries=0 / retry_policy=NONE: this module never retries a send, and
    neither does the framework (no retry loop exists in pipeline.execute at
    all) — an ambiguous delivery is surfaced as delivery_status="unknown",
    never silently retried into a possible duplicate send.
  - verification_policy=REQUIRED: `verify()` only passes when the n8n
    response carries an explicit, non-empty provider `message_id` AND
    `accepted is True`. Sending is NEVER inferred from n8n merely accepting
    the HTTP request into its queue. When that evidence is absent, the
    framework downgrades the whole result to status="unverified" (this
    module's UNKNOWN state) rather than letting it read as a plain success.
  - allowed_hosts is pinned to the local n8n instance only (127.0.0.1/
    localhost) — dispatch_to_n8n rejects (code=host_not_allowed) before any
    network call if N8N_EMAIL_SEND_URL is ever pointed somewhere else. As of
    this pass there is NO real provider wired behind the n8n "Email Send"
    workflow (mirrors the documented state of BOOKMARK_APPLY's mock target,
    see app/capabilities/bookmark_audit/apply.py) — this capability cannot
    reach an uncontrolled real recipient today because it cannot reach
    anything but a local, not-yet-provider-backed n8n webhook.
"""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any, Mapping, Optional

from app.capabilities._framework.models import (
    ActionSpec, ApprovalPolicy, DataTrust, Executor, Idempotency, InputField,
    NetworkScope, RetryPolicy, SideEffect, ValidationError, VerificationPolicy,
    inputs_hash, to_iso, utc_now,
)
from app.capabilities.email_draft import _validate_attachments, _validate_recipient_list

logger = logging.getLogger("merlin.capabilities.email_send")

ACTION_TYPE = "EMAIL_SEND"
DEFAULT_URL = "http://127.0.0.1:5678/webhook/email-send"
ALLOWED_HOSTS = ("127.0.0.1", "localhost")

_MAX_SUBJECT = 500
_MAX_BODY = 100_000

# The ONLY keys ever read out of the untrusted n8n/provider response.
_RESULT_WHITELIST = ("message_id", "accepted", "provider")


def _endpoint() -> str:
    import os
    return os.environ.get("N8N_EMAIL_SEND_URL", DEFAULT_URL)


def _token() -> Optional[str]:
    import os
    tok = os.environ.get("N8N_WEBHOOK_TOKEN")
    if tok:
        return tok
    try:  # read-only reuse of the already-configured token; config.py is NOT modified
        from app.config import settings
        return settings.n8n_webhook_token
    except Exception:  # noqa: BLE001
        return None


def normalize_inputs(raw: Mapping[str, Any]) -> dict[str, Any]:
    """Pure, local, no network — validates and normalizes to EXACTLY the
    shape the pipeline's own input-cleaning will produce for this spec, so a
    caller can compute the true inputs_hash and build a bound approval BEFORE
    ever calling pipeline.execute(). Raises ValidationError on bad input,
    same as the handler would.

    Mirrors `pipeline._validate_inputs`'s own rule for optional fields
    exactly: a key OMITTED from `raw` is omitted from the normalized dict
    too (not defaulted to `[]`) — required so the inputs_hash computed here
    matches the hash the pipeline computes bit-for-bit. `raw` must therefore
    be the exact same mapping (same keys present/absent) later passed to
    `pipeline.execute()`."""
    to = _validate_recipient_list(raw.get("to"), field="to", required=True)

    subject = raw.get("subject")
    if not isinstance(subject, str) or not subject.strip():
        raise ValidationError("subject must be a non-empty string")
    if len(subject) > _MAX_SUBJECT:
        raise ValidationError(f"subject exceeds max {_MAX_SUBJECT} chars")

    body = raw.get("body")
    if not isinstance(body, str) or not body.strip():
        raise ValidationError("body must be a non-empty string")
    if len(body) > _MAX_BODY:
        raise ValidationError(f"body exceeds max {_MAX_BODY} chars")

    out: dict[str, Any] = {"to": to, "subject": subject.strip(), "body": body}
    if "cc" in raw:
        out["cc"] = _validate_recipient_list(raw.get("cc"), field="cc", required=False)
    if "bcc" in raw:
        out["bcc"] = _validate_recipient_list(raw.get("bcc"), field="bcc", required=False)
    if "attachments" in raw:
        out["attachments"] = _validate_attachments(raw.get("attachments"))

    cc, bcc = out.get("cc", []), out.get("bcc", [])
    seen: dict[str, str] = {}
    for field, addrs in (("to", to), ("cc", cc), ("bcc", bcc)):
        for a in addrs:
            if a in seen and seen[a] != field:
                raise ValidationError(f"{a!r} appears in both {seen[a]!r} and {field!r}")
            seen[a] = field

    return out


def build_approval(normalized_inputs: Mapping[str, Any], *, approved: bool,
                    ttl_s: float = 300.0) -> dict[str, Any]:
    """Constructs a BOUND_STRONG approval object bound to `normalized_inputs`'
    exact hash. This is a formatting helper, not an approval decision: the
    caller must already have collected an explicit human yes/no and pass it
    as `approved` — this function never defaults it to True. Any change to
    to/cc/bcc/subject/body/attachments after this call produces a different
    hash and invalidates the approval (pipeline-enforced, not by convention)."""
    return {
        "approved": approved,
        "inputs_hash": inputs_hash(normalized_inputs),
        "policy": "bound_strong",
        "expires_at": to_iso(utc_now() + timedelta(seconds=ttl_s)),
    }


def _sanitize_provider_result(raw: Any) -> tuple[Optional[str], bool, Optional[str]]:
    """Whitelist-extract provider evidence from the untrusted n8n response.
    Returns (message_id, accepted, provider). Anything outside the whitelist
    is dropped without inspection — the same untrusted-data-boundary pattern
    as web_research._sanitize_source."""
    if not isinstance(raw, Mapping):
        return None, False, None
    mid = raw.get("message_id")
    message_id = mid.strip() if isinstance(mid, str) and mid.strip() else None
    accepted = raw.get("accepted") is True
    provider = raw.get("provider") if isinstance(raw.get("provider"), str) else None
    return message_id, accepted, provider


async def handler(inputs: Mapping[str, Any], request: Any = None) -> dict[str, Any]:
    from app.integrations.n8n.action_dispatch import dispatch_to_n8n

    if request is None:
        raise ValidationError("email_send requires the framework request context")

    # Re-validates (address format, attachment-reference-only, cross-role
    # overlap) via the exact same rules as EMAIL_DRAFT — the pipeline's own
    # generic input validation only checked types (list/str), not content.
    normalized = normalize_inputs(inputs)
    to, cc, bcc = normalized["to"], normalized.get("cc", []), normalized.get("bcc", [])
    subject, body = normalized["subject"], normalized["body"]
    attachments = normalized.get("attachments", [])

    sr = await dispatch_to_n8n(
        request, webhook_url=_endpoint(), token=_token(),
        timeout_seconds=inputs.get("_timeout_s", 20.0), allowed_hosts=ALLOWED_HOSTS,
    )

    base = {"to": to, "cc": cc, "bcc": bcc, "subject": subject, "attachments": attachments,
            "retrieval_status": sr.status, "retrieval_code": sr.code}

    if sr.status == "rejected":
        # A rejection (bad_auth, host_not_allowed, n8n's own validation) means
        # the request never reached a provider — a definite non-send, not an
        # ambiguity.
        logger.info("EMAIL_SEND rejected before provider code=%s", sr.code)
        return {**base, "delivery_status": "failed", "provider_message_id": None, "provider": None}

    if sr.status not in ("accepted", "duplicate"):
        # network_timeout / network_error / not_configured / invalid_response:
        # we do NOT know whether the provider ever saw this request. Never
        # inferred as sent, never inferred as failed.
        logger.info("EMAIL_SEND ambiguous delivery code=%s", sr.code)
        return {**base, "delivery_status": "unknown", "provider_message_id": None, "provider": None}

    message_id, accepted, provider = _sanitize_provider_result(sr.result)
    if message_id and accepted:
        logger.info("EMAIL_SEND accepted by provider message_id_present=True")
        return {**base, "delivery_status": "sent", "provider_message_id": message_id, "provider": provider}

    # n8n itself accepted the HTTP call, but returned no independently
    # verifiable provider evidence — this is exactly the case the task's own
    # contract calls out: never infer a send from a queue-accept alone.
    logger.info("EMAIL_SEND queued but no provider evidence — delivery_status=unknown")
    return {**base, "delivery_status": "unknown", "provider_message_id": None, "provider": provider}


def verify(inputs: Mapping[str, Any], result: Mapping[str, Any]) -> tuple[bool, str]:
    status = result.get("delivery_status")
    if status != "sent":
        return False, f"delivery_status={status!r} — no confirmed provider evidence"
    if not result.get("provider_message_id"):
        return False, "delivery_status=sent but provider_message_id missing"
    return True, f"provider confirmed message_id={result['provider_message_id']!r}"


SPEC = ActionSpec(
    action_type=ACTION_TYPE,
    capability="email_send",
    executor=Executor.N8N,
    side_effect=SideEffect.SIDE_EFFECTING,
    approval_policy=ApprovalPolicy.BOUND_STRONG,
    idempotency=Idempotency.STRICT_DEDUP,
    timeout_s=20.0,
    max_retries=0,
    required_inputs=(
        InputField("to", (list,)),
        InputField("subject", (str,)),
        InputField("body", (str,)),
        InputField("cc", (list,), required=False),
        InputField("bcc", (list,), required=False),
        InputField("attachments", (list,), required=False),
    ),
    output_fields=("delivery_status", "provider_message_id", "to", "cc", "bcc", "subject"),
    verification="provider_message_id_and_accepted_required",
    provenance_requirements=("explicit_recipients_only", "no_inferred_recipients",
                             "provider_message_id_required_for_sent"),
    intent_patterns=(),  # deliberately NOT resolved from free text this pass — see LIVE_INTENTS report
    handler=handler,
    verifier=verify,
    n8n_webhook_key="N8N_EMAIL_SEND_URL",
    network_scope=NetworkScope.N8N_ONLY,
    allowed_hosts=ALLOWED_HOSTS,
    credential_scope="n8n_webhook_token",
    data_trust=DataTrust.EXTERNAL_UNTRUSTED,
    retry_policy=RetryPolicy.NONE,
    verification_policy=VerificationPolicy.REQUIRED,
)
