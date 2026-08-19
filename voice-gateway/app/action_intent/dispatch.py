"""Dispatches an explicit dispatch=True decision to the matching capability
and turns its result into a short, controlled user-facing string.

Only called after gate.classify_action_intent() has already returned
dispatch=True — this module does not itself decide whether to dispatch.
Each intent branch below calls exactly one capability; there is no generic
"run whatever the caller names" path.
"""

from __future__ import annotations

import logging

from app.action_intent.gate import BOOKMARK_AUDIT, EXECUTION_TEST_N8N_ECHO, ActionIntentDecision
from app.action_intent.registry_dispatch import dispatch_registry_action
from app.capabilities.bookmark_audit.models import AuditReport
from app.capabilities.bookmark_audit.orchestrator import BookmarkAuditError, run_bookmark_audit
from app.integrations.n8n.client import StructuredResult, send_echo_action_request

logger = logging.getLogger("merlin.action_intent")


async def dispatch(
    decision: ActionIntentDecision, session_id: str, *, action_id: str | None = None
) -> str:
    """Execute the decision's intent and return Merlin's user-facing reply.

    Never raises: every capability called here already reduces its own
    failure modes to a controlled result/exception this function catches,
    so a caller always gets back a plain-language string, never a traceback.

    action_id is only meaningful for EXECUTION_TEST_N8N_ECHO — normally
    omitted (each real turn gets a fresh, adapter-generated action_id), it
    exists so a proof/test harness can force the same action_id across two
    calls and confirm n8n's idempotency guarantee still holds when reached
    through this dispatch path.
    """
    if not decision.dispatch:
        logger.warning("ACTION_DISPATCH called with a non-dispatch decision — refusing")
        return "לא בוצעה פעולה."

    if decision.intent == EXECUTION_TEST_N8N_ECHO:
        return await _dispatch_echo_test(decision, session_id, action_id=action_id)
    if decision.intent == BOOKMARK_AUDIT:
        return await _dispatch_bookmark_audit(decision)

    from app.capabilities.registry import REGISTRY
    if decision.intent is not None and REGISTRY.get(decision.intent) is not None:
        return await _dispatch_registry_capability(decision, action_id=action_id)

    logger.warning("ACTION_DISPATCH: unrecognized intent %r — refusing", decision.intent)
    return "לא בוצעה פעולה."


async def _dispatch_registry_capability(decision: ActionIntentDecision, *, action_id: str | None) -> str:
    # action_id threaded through unchanged (same optional pass-through the
    # echo path already has, generalized) — lets a duplicate real turn (or a
    # proof/test harness forcing the same id twice) exercise the underlying
    # capability's own idempotency guarantee (PURE/STRICT_DEDUP) through this
    # path too, exactly-once semantics, not a new dedup mechanism.
    result = await dispatch_registry_action(decision, action_id=action_id)
    logger.info(
        "ACTION_DISPATCH intent=%s action_id=%s correlation_id=%s status=%s code=%s",
        decision.intent, result.action_id, result.correlation_id, result.status, result.code,
    )
    if result.status == "accepted":
        return f"{decision.intent} הושלם בהצלחה (action_id={result.action_id})."
    if result.status == "duplicate":
        return f"הפעולה הזו כבר בוצעה קודם (action_id={result.action_id})."
    if result.code == "no_structured_input_available" or result.code == "missing_input":
        return f"זיהיתי בקשה עבור {decision.intent} אך חסרים פרטים מובנים לביצוע."
    return f"{decision.intent} נכשל: {result.code}."


async def _dispatch_echo_test(
    decision: ActionIntentDecision, session_id: str, *, action_id: str | None
) -> str:
    result = await send_echo_action_request(
        {"probe": "merlin-live-dispatch", "session_id": session_id},
        action_id=action_id,
        provenance_source="merlin-live",
    )
    logger.info(
        "ACTION_DISPATCH intent=%s action_id=%s correlation_id=%s status=%s code=%s",
        decision.intent, result.action_id, result.correlation_id, result.status, result.code,
    )
    return _format_echo_reply(result)


async def _dispatch_bookmark_audit(decision: ActionIntentDecision) -> str:
    try:
        report = await run_bookmark_audit()
    except BookmarkAuditError as exc:
        result = exc.structured_result
        logger.info(
            "ACTION_DISPATCH intent=%s action_id=%s correlation_id=%s status=%s code=%s",
            decision.intent, result.action_id, result.correlation_id, result.status, result.code,
        )
        return f"בדיקת הסימניות נכשלה: {result.code}."

    logger.info(
        "ACTION_DISPATCH intent=%s correlation_id=%s status=accepted total=%d new=%d removed=%d duplicate=%d dead=%d",
        decision.intent, report.correlation_id, report.total_bookmarks, report.new_count,
        report.removed_count, report.duplicate_count, report.dead_count,
    )
    return _format_bookmark_audit_reply(report)


def _format_echo_reply(result: StructuredResult) -> str:
    if result.status == "accepted":
        return f"בדיקת n8n הצליחה. n8n אישר וביצע echo (action_id={result.action_id})."
    if result.status == "duplicate":
        return (
            "הבדיקה הזו כבר בוצעה קודם — n8n מנע ביצוע כפול "
            f"(action_id={result.action_id})."
        )
    if result.status == "rejected":
        return f"n8n דחה את הבקשה: {result.code}."
    return f"בדיקת n8n נכשלה: {result.code}."


def _format_bookmark_audit_reply(report: AuditReport) -> str:
    browsers = ", ".join(report.browsers_found) if report.browsers_found else "לא נמצא"
    rec_parts = ", ".join(f"{k}={v}" for k, v in sorted(report.recommendation_counts.items()))
    return (
        f"בדיקת הסימניות הושלמה. דפדפנים: {browsers}. "
        f"סה\"כ {report.total_bookmarks} סימניות — {report.new_count} חדשות, "
        f"{report.removed_count} הוסרו, {report.duplicate_count} כפולות, "
        f"{report.dead_count} קישורים מתים (נבדקו {report.dead_links_checked}). "
        f"המלצות: {rec_parts}."
    )
