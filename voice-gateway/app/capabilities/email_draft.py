"""EMAIL_DRAFT — READ_ONLY. Builds a draft object from EXPLICIT, caller-supplied
recipients. There is no send path in this module: it never imports an email
client, never calls out to n8n/SMTP/a provider, and its output never claims
anything was sent.

Anti-escalation, enforced here (not by convention):
  - Recipients are read ONLY from `to`/`cc`/`bcc`. No recipient is ever
    inferred from `subject`, `body`, or any other field — the handler never
    parses free text for an address.
  - Every address is validated (RFC-5322-lite) before it is echoed back; a
    single malformed address rejects the whole draft rather than silently
    dropping it (a silently dropped recipient is exactly the kind of "who did
    this actually go to" ambiguity this capability must not produce).
  - Attachments are REFERENCES ONLY (`{filename, reference}` — a pointer such
    as a local path or an existing store id). This module never reads file
    contents, never fetches a URL, never accepts inline bytes/base64 — so it
    cannot become a channel for exfiltrating file contents into a "draft".
  - The general framework invariant still applies on top of this: inputs can
    never carry `action_type`/`approval`/`side_effecting`/`capability`
    (`app/capabilities/_framework/models.py::FORBIDDEN_INPUT_KEYS`), so
    untrusted content flattened into inputs cannot change what this action is
    or how it is authorized. This module adds the domain-specific half of
    that guarantee: untrusted content cannot change WHO the draft is to.
"""

from __future__ import annotations

import re
from typing import Any, Mapping

from app.capabilities._framework.models import (
    ActionSpec, ApprovalPolicy, Executor, Idempotency, InputField,
    SideEffect, ValidationError,
)

ACTION_TYPE = "EMAIL_DRAFT"

# RFC-5322-lite: good enough to reject obvious garbage without a fragile
# false-positive-prone full grammar. Caps length so no single field can be
# used to smuggle an oversized payload into an address slot.
_ADDR_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,255}\.[^@\s]{1,24}$")
_MAX_ADDR_LEN = 320  # RFC 5321 upper bound
_MAX_RECIPIENTS = 50
_MAX_SUBJECT = 500
_MAX_BODY = 100_000
_MAX_ATTACHMENTS = 20
_MAX_FILENAME = 255
_MAX_REFERENCE = 2048


def _validate_address(raw: Any, *, field: str, index: int) -> str:
    if not isinstance(raw, str):
        raise ValidationError(f"{field}[{index}] must be a string")
    addr = raw.strip()
    if not addr or len(addr) > _MAX_ADDR_LEN or not _ADDR_RE.match(addr):
        raise ValidationError(f"{field}[{index}] is not a valid email address")
    return addr.lower()


def _validate_recipient_list(raw: Any, *, field: str, required: bool) -> list[str]:
    if raw is None:
        if required:
            raise ValidationError(f"{field} is required")
        return []
    if not isinstance(raw, list):
        raise ValidationError(f"{field} must be a list")
    if required and not raw:
        raise ValidationError(f"{field} must contain at least one recipient")
    if len(raw) > _MAX_RECIPIENTS:
        raise ValidationError(f"{field} exceeds max {_MAX_RECIPIENTS} recipients")
    out: list[str] = []
    for i, item in enumerate(raw):
        addr = _validate_address(item, field=field, index=i)
        if addr not in out:
            out.append(addr)  # de-dup, order-preserving; never silently drops a distinct address
    return out


def _validate_attachments(raw: Any) -> list[dict[str, str]]:
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise ValidationError("attachments must be a list")
    if len(raw) > _MAX_ATTACHMENTS:
        raise ValidationError(f"attachments exceeds max {_MAX_ATTACHMENTS}")
    out: list[dict[str, str]] = []
    for i, item in enumerate(raw):
        if not isinstance(item, Mapping) or "filename" not in item or "reference" not in item:
            raise ValidationError(f"attachments[{i}] must be {{filename, reference}}")
        filename, reference = item["filename"], item["reference"]
        if not isinstance(filename, str) or not filename.strip() or len(filename) > _MAX_FILENAME:
            raise ValidationError(f"attachments[{i}].filename is invalid")
        if not isinstance(reference, str) or not reference.strip() or len(reference) > _MAX_REFERENCE:
            raise ValidationError(f"attachments[{i}].reference is invalid")
        # Reference only: reject anything that looks like inline content rather
        # than a pointer (a data: URI is the classic way inline bytes sneak in
        # disguised as a "reference").
        if reference.strip().lower().startswith("data:"):
            raise ValidationError(f"attachments[{i}].reference must be a pointer, not inline data")
        out.append({"filename": filename.strip(), "reference": reference.strip()})
    return out


def handler(inputs: Mapping[str, Any], request: Any = None) -> dict[str, Any]:
    """Pure/offline: builds and returns a draft. Never sends anything —
    there is no code path here that opens a network connection."""
    to = _validate_recipient_list(inputs.get("to"), field="to", required=True)
    cc = _validate_recipient_list(inputs.get("cc"), field="cc", required=False)
    bcc = _validate_recipient_list(inputs.get("bcc"), field="bcc", required=False)

    subject = inputs["subject"]
    if not isinstance(subject, str) or not subject.strip():
        raise ValidationError("subject must be a non-empty string")
    if len(subject) > _MAX_SUBJECT:
        raise ValidationError(f"subject exceeds max {_MAX_SUBJECT} chars")

    body = inputs["body"]
    if not isinstance(body, str) or not body.strip():
        raise ValidationError("body must be a non-empty string")
    if len(body) > _MAX_BODY:
        raise ValidationError(f"body exceeds max {_MAX_BODY} chars")

    attachments = _validate_attachments(inputs.get("attachments"))

    # No recipient overlap ambiguity: an address appearing in more than one of
    # to/cc/bcc is a caller error to surface, not something to quietly resolve.
    seen: dict[str, str] = {}
    for field, addrs in (("to", to), ("cc", cc), ("bcc", bcc)):
        for a in addrs:
            if a in seen and seen[a] != field:
                raise ValidationError(f"{a!r} appears in both {seen[a]!r} and {field!r}")
            seen[a] = field

    action_id = getattr(request, "action_id", None) if request is not None else None
    draft_id = f"draft-{action_id}" if action_id else "draft-unbound"

    return {
        "draft_id": draft_id,
        "to": to,
        "cc": cc,
        "bcc": bcc,
        "subject": subject.strip(),
        "body": body,
        "attachments": attachments,
        "recipient_count": len(to) + len(cc) + len(bcc),
        "send_status": "not_sent",
        "capability_scope": "read_only_draft_no_send_path",
    }


def verify(inputs: Mapping[str, Any], result: Mapping[str, Any]) -> tuple[bool, str]:
    """Recipients/subject/body in the result must be an exact, non-inferred
    echo of validated inputs — never expanded, never guessed."""
    if result.get("send_status") != "not_sent":
        return False, "draft must never report anything other than not_sent"
    try:
        expected_to = _validate_recipient_list(inputs.get("to"), field="to", required=True)
        expected_cc = _validate_recipient_list(inputs.get("cc"), field="cc", required=False)
        expected_bcc = _validate_recipient_list(inputs.get("bcc"), field="bcc", required=False)
    except ValidationError:
        return False, "inputs failed re-validation at verify time"
    if (result.get("to"), result.get("cc"), result.get("bcc")) != (expected_to, expected_cc, expected_bcc):
        return False, "result recipients diverge from validated inputs"
    if result.get("subject") != inputs.get("subject", "").strip():
        return False, "result subject diverges from input"
    if not result.get("draft_id"):
        return False, "draft missing draft_id"
    return True, "recipients/subject/body match validated inputs exactly; no send occurred"


SPEC = ActionSpec(
    action_type=ACTION_TYPE,
    capability="email_draft",
    executor=Executor.LOCAL,
    side_effect=SideEffect.READ_ONLY,
    approval_policy=ApprovalPolicy.NONE,
    idempotency=Idempotency.PURE,
    timeout_s=1.0,
    max_retries=0,
    required_inputs=(
        InputField("to", (list,)),
        InputField("subject", (str,)),
        InputField("body", (str,)),
        InputField("cc", (list,), required=False),
        InputField("bcc", (list,), required=False),
        InputField("attachments", (list,), required=False),
    ),
    output_fields=("draft_id", "to", "cc", "bcc", "subject", "body", "attachments", "send_status"),
    verification="recipients_and_content_match_inputs_exactly",
    provenance_requirements=("explicit_recipients_only", "no_inferred_recipients", "no_send_path"),
    intent_patterns=("draft an email", "draft email", "email draft", "טיוטת אימייל", "כתוב טיוטת מייל"),
    handler=handler,
    verifier=verify,
)
