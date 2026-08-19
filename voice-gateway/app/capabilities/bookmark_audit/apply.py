"""BOOKMARK_APPLY — the mutation half of the bookmark_audit capability.

  deterministic preview -> explicit approval -> n8n (backup -> mutate ->
  post-write verification) -> StructuredResult -> Merlin

Pipeline split, mirrored from BOOKMARK_AUDIT's own read/n8n split:
  - build_preview() is pure and local — no n8n call, so no mutation is
    physically possible from calling it. It computes the exact inputs +
    inputs_hash that apply() will send once approved.
  - apply() is the only function in this module that calls n8n, and it
    requires an already-constructed approval object as a required
    parameter — this module never fabricates one. See
    app.integrations.n8n.client.send_bookmark_apply_action_request's own
    docstring for the matching guarantee on the client side.

Scope as of 2026-08-12 — READ THIS BEFORE POINTING ANYTHING AT REAL DATA:
  The n8n "Bookmark Apply" workflow behind this currently targets an
  ISOLATED MOCK bookmark file (~/n8n-runtime/test_bookmarks/Bookmarks_mock.json),
  not the real Chrome/Safari stores. This was a deliberate decision, not an
  oversight: Chrome was confirmed running live during this build, and
  Chrome only persists bookmarks from its in-memory model — it does not
  watch its Bookmarks file for external changes. A direct write to the live
  file while Chrome is running risks the change being silently overwritten
  by Chrome's next autosave (or, in the unlucky case, a corrupt
  interleaved write if Chrome saves at the same moment). Every mutation
  operation, the approval-binding gate, backup, and post-write verification
  are fully implemented and proven end-to-end against the mock file. Only
  reason to move it: (a) close Chrome first, or (b) accept the autosave
  race — both are the user's call, not this module's, so the target path
  is not switched to the real file automatically.

Operations: MOVE, RENAME, MERGE_DUPLICATE, ARCHIVE, DELETE — see
apply_models.py. Also read app/capabilities/bookmark_audit/apply_models.py.
"""

from __future__ import annotations

import logging
from typing import Any

from app.capabilities.bookmark_audit.apply_models import (
    DELETE,
    ApplyOutcome,
    MutationPreview,
    MutationRequest,
)
from app.capabilities.bookmark_audit.browser_guard import BrowserRunningError, assert_browser_not_running
from app.integrations.n8n.client import _sha256_hex_compact_json, send_bookmark_apply_action_request

logger = logging.getLogger("merlin.bookmark_audit.apply")


def build_preview(mutations: list[MutationRequest]) -> MutationPreview:
    """Pure, local, no n8n call — computes the exact request apply() will
    send. Never raises for well-formed MutationRequest objects (their own
    __post_init__ already validates operation-specific required fields)."""
    inputs: dict[str, Any] = {"mutations": [m.to_dict() for m in mutations]}
    inputs_hash = _sha256_hex_compact_json(inputs)
    operations = tuple(dict.fromkeys(m.operation for m in mutations))  # de-duplicated, order preserved
    browsers = frozenset(m.browser for m in mutations)
    return MutationPreview(
        inputs=inputs, inputs_hash=inputs_hash, operations=operations,
        mutation_count=len(mutations), browsers=browsers,
    )


def build_approval(preview: MutationPreview, *, operations_approved: list[str], approved: bool) -> dict[str, Any]:
    """Constructs an approval object bound to `preview`'s exact inputs_hash.

    This is a formatting helper, not an approval decision — the caller
    (whatever surfaces the preview to a human and collects their yes/no)
    must pass `approved` explicitly; this function does not default it to
    True and does not infer it from anything. `operations_approved` must be
    supplied explicitly too — no "approve everything in the preview"
    shortcut, so a caller can't accidentally approve an operation type it
    never actually showed the human.
    """
    return {
        "approved": approved,
        "inputs_hash": preview.inputs_hash,
        "operations_approved": list(operations_approved),
    }


async def apply(preview: MutationPreview, approval: dict[str, Any]) -> ApplyOutcome:
    """Sends the preview's exact inputs to n8n's Bookmark Apply webhook
    with the given approval. Never raises — every failure mode (bad auth,
    timeout, rejected approval, stale target, post-write verification
    failure, BROWSER_RUNNING) is already reduced to a typed ApplyOutcome.

    Logs action_id/correlation_id/status/code only — never the mutation
    content or approval object contents beyond that.

    Hard safety gate, checked first, before anything else including the
    approval-hash check: if any browser targeted by this preview's
    mutations is currently running, this returns immediately with
    status="rejected", code="BROWSER_RUNNING" — no network call to n8n is
    made, so there is no backup, no write, no partial execution. See
    browser_guard.py for why this check lives here and not in n8n.
    """
    for browser in sorted(preview.browsers):
        try:
            assert_browser_not_running(browser)
        except BrowserRunningError as exc:
            return ApplyOutcome(
                status="rejected", code=exc.code, action_id=None, correlation_id=None,
                message=str(exc), applied=None, verification=None, backup_path=None, http_status=None,
            )

    if approval.get("inputs_hash") != preview.inputs_hash:
        logger.warning(
            "bookmark_apply: approval inputs_hash does not match preview — refusing to send "
            "(this would be rejected by n8n anyway; caught here to avoid the round-trip)"
        )
        return ApplyOutcome(
            status="rejected", code="approval_mismatch_local", action_id=None, correlation_id=None,
            message="approval is not bound to this preview's inputs_hash", applied=None,
            verification=None, backup_path=None, http_status=None,
        )

    result = await send_bookmark_apply_action_request(preview.inputs, approval=approval)

    logger.info(
        "bookmark_apply: action_id=%s correlation_id=%s status=%s code=%s mutation_count=%d operations=%s",
        result.action_id, result.correlation_id, result.status, result.code,
        preview.mutation_count, ",".join(preview.operations),
    )

    r = result.result or {}
    return ApplyOutcome(
        status=result.status, code=result.code, action_id=result.action_id,
        correlation_id=result.correlation_id, message=result.message,
        applied=r.get("applied"), verification=r.get("verification"),
        backup_path=r.get("backup_path"), http_status=result.http_status,
    )


def requires_delete_approval(mutations: list[MutationRequest]) -> bool:
    """True if this mutation set includes DELETE (or MERGE_DUPLICATE, which
    deletes the non-surviving entry) — a convenience check for a caller
    building the approval UI, so it knows to surface the extra DELETE
    confirmation. The actual enforcement lives in n8n regardless of whether
    a caller uses this helper."""
    return any(m.operation in (DELETE, "MERGE_DUPLICATE") for m in mutations)
