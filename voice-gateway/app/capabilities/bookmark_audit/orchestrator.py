"""Ties the pipeline together: n8n extract -> parse -> snapshot/diff ->
classify -> duplicate/dead-link checks -> recommend -> AuditReport.

This is the only function other code should call to run a bookmark audit.
Everything upstream of the n8n call (this module) and downstream of it
(parsers/snapshot/classify/deadlinks/recommend) is read-only: nothing here
writes back to a browser, and the only local write is this package's own
snapshot state file.
"""

from __future__ import annotations

import base64
import logging
from datetime import datetime, timezone

from app.capabilities.bookmark_audit import deadlinks
from app.capabilities.bookmark_audit.classify import classify, detect_duplicates
from app.capabilities.bookmark_audit.models import AuditedBookmark, AuditReport, DeadLinkResult, RawBookmark
from app.capabilities.bookmark_audit.parsers import parse_chrome_bookmarks, parse_safari_bookmarks
from app.capabilities.bookmark_audit.recommend import recommend
from app.capabilities.bookmark_audit.snapshot import build_canonical_snapshot, load_previous_snapshot, save_snapshot
from app.integrations.n8n.client import StructuredResult, send_bookmark_extract_action_request

logger = logging.getLogger("merlin.bookmark_audit")


class BookmarkAuditError(Exception):
    """Raised when the n8n extract step itself failed (auth/timeout/reject/
    invalid response) — no report can be built. Callers get this instead of
    a partial/fabricated AuditReport."""

    def __init__(self, structured_result: StructuredResult):
        self.structured_result = structured_result
        super().__init__(f"bookmark extract failed: status={structured_result.status} code={structured_result.code}")


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


async def run_bookmark_audit(
    *, dead_link_sample_size: int = deadlinks.DEFAULT_MAX_CHECKS
) -> AuditReport:
    extract_result = await send_bookmark_extract_action_request()
    if extract_result.status != "accepted" or extract_result.result is None:
        # A "duplicate" status here would mean n8n replayed a cached extract
        # from an earlier action_id — send_bookmark_extract_action_request
        # always mints a fresh action_id, so that shouldn't happen in
        # practice, but treat it the same as a hard failure: no report.
        raise BookmarkAuditError(extract_result)

    sources = extract_result.result.get("sources", {})
    browsers_found: list[str] = []
    bookmark_stores_found: list[str] = []
    raw_bookmarks: list[RawBookmark] = []

    chrome_source = sources.get("chrome", {})
    if chrome_source.get("read_ok"):
        browsers_found.append("chrome")
        bookmark_stores_found.append(chrome_source.get("path") or "chrome_bookmarks")
        chrome_bytes = base64.b64decode(chrome_source["content_base64"])
        raw_bookmarks.extend(parse_chrome_bookmarks(chrome_bytes))

    safari_source = sources.get("safari", {})
    if safari_source.get("read_ok"):
        browsers_found.append("safari")
        bookmark_stores_found.append(safari_source.get("path") or "safari_bookmarks")
        safari_bytes = base64.b64decode(safari_source["content_base64"])
        raw_bookmarks.extend(parse_safari_bookmarks(safari_bytes))

    previous = load_previous_snapshot()
    canonical = build_canonical_snapshot(raw_bookmarks, previous)
    duplicate_flags = detect_duplicates(canonical)

    current_ids = {cb.bookmark_id for cb in canonical}
    removed_bookmarks = [cb for bid, cb in previous.items() if bid not in current_ids]

    unique_urls = list(dict.fromkeys(b.url for b in canonical))
    dead_link_results = await deadlinks.check_dead_links(unique_urls, max_checks=dead_link_sample_size)

    audited: list[AuditedBookmark] = []
    for i, cb in enumerate(canonical):
        cls = classify(cb)
        dl = dead_link_results.get(cb.url, DeadLinkResult(checked=False, dead=False, http_status=None, reason="not_checked"))
        is_dup = duplicate_flags.get(i, False)
        moved = cb.previous_folder_path is not None
        rec, reason = recommend(classification=cls, dead_link=dl, is_duplicate=is_dup)
        audited.append(AuditedBookmark(
            canonical=cb, classification=cls, dead_link=dl, is_duplicate=is_dup,
            duplicate_of=cb.bookmark_id if is_dup else None,
            moved_candidate=moved, recommendation=rec, reason=reason,
        ))

    generated_at = _utc_now_iso()
    save_snapshot(canonical, generated_at=generated_at)

    rec_counts: dict[str, int] = {}
    for a in audited:
        rec_counts[a.recommendation] = rec_counts.get(a.recommendation, 0) + 1

    dead_checked = sum(1 for r in dead_link_results.values() if r.checked)
    report = AuditReport(
        generated_at=generated_at,
        correlation_id=extract_result.correlation_id or "",
        browsers_found=browsers_found,
        bookmark_stores_found=bookmark_stores_found,
        total_bookmarks=len(canonical),
        new_count=sum(1 for b in canonical if b.status == "new"),
        existing_count=sum(1 for b in canonical if b.status == "existing"),
        removed_count=len(removed_bookmarks),
        removed_bookmarks=removed_bookmarks,
        duplicate_count=sum(1 for v in duplicate_flags.values() if v),
        dead_count=sum(1 for r in dead_link_results.values() if r.dead),
        moved_candidate_count=sum(1 for b in canonical if b.previous_folder_path is not None),
        dead_links_checked=dead_checked,
        dead_links_checked_capped=len(unique_urls) > dead_link_sample_size,
        recommendation_counts=rec_counts,
        bookmarks=audited,
    )
    logger.info(
        "bookmark_audit: complete correlation_id=%s total=%d new=%d removed=%d duplicate=%d dead=%d checked=%d/%d",
        report.correlation_id, report.total_bookmarks, report.new_count, report.removed_count,
        report.duplicate_count, report.dead_count, dead_checked, len(unique_urls),
    )
    return report
