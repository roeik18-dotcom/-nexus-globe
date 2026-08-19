"""Canonical snapshot: stable bookmark_id, first_seen/last_seen tracking,
diff against the previous run. Persisted at
voice-gateway/state/bookmark_audit_snapshot.json — Merlin's own runtime
state, not Philos canon.

URL normalization is deliberately conservative: lowercase scheme+host,
strip exactly one trailing slash on a bare path. Query strings and
fragments are kept as-is. This avoids false "duplicate" merges between
genuinely different pages that happen to share a host — over-normalizing
is worse here than under-normalizing, since a merge recommendation is
harder to safely automate away than a "review" one.
"""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

from app.capabilities.bookmark_audit.models import CanonicalBookmark, RawBookmark

logger = logging.getLogger("merlin.bookmark_audit")

_ROOT = Path(__file__).resolve().parent.parent.parent.parent  # voice-gateway/
SNAPSHOT_PATH = _ROOT / "state" / "bookmark_audit_snapshot.json"


def normalize_url(url: str) -> str:
    try:
        parts = urlsplit(url.strip())
    except ValueError:
        return url.strip().lower()
    scheme = parts.scheme.lower()
    netloc = parts.netloc.lower()
    path = parts.path
    if path == "/":
        # bare-root path: "https://x.com" and "https://x.com/" must
        # normalize identically, or bookmark_id stability breaks.
        path = ""
    elif path.endswith("/"):
        path = path[:-1]
    return urlunsplit((scheme, netloc, path, parts.query, parts.fragment))


def bookmark_id_for(normalized_url: str) -> str:
    return hashlib.sha256(normalized_url.encode("utf-8")).hexdigest()[:16]


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def load_previous_snapshot() -> dict[str, CanonicalBookmark]:
    if not SNAPSHOT_PATH.exists():
        return {}
    try:
        raw = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        logger.warning("bookmark_audit: previous snapshot unreadable, treating as empty")
        return {}
    out: dict[str, CanonicalBookmark] = {}
    for entry in raw.get("bookmarks", []):
        try:
            cb = CanonicalBookmark.from_dict(entry)
        except (KeyError, TypeError):
            continue
        out[cb.bookmark_id] = cb
    return out


def save_snapshot(bookmarks: list[CanonicalBookmark], *, generated_at: str) -> None:
    SNAPSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "generated_at": generated_at,
        "bookmark_count": len(bookmarks),
        "bookmarks": [b.to_dict() for b in bookmarks],
    }
    tmp_path = SNAPSHOT_PATH.with_suffix(".json.tmp")
    tmp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp_path.replace(SNAPSHOT_PATH)


def build_canonical_snapshot(
    raw_bookmarks: list[RawBookmark], previous: dict[str, CanonicalBookmark]
) -> list[CanonicalBookmark]:
    """One CanonicalBookmark per distinct bookmark_id. If the same
    normalized URL appears more than once in this run (across browsers or
    folders), the FIRST occurrence encountered becomes the canonical entry;
    later occurrences are still returned as separate CanonicalBookmark
    entries with the same bookmark_id (the caller, classify.py, uses that
    to flag them as duplicates) — this function does not drop rows.

    moved_candidate (previous_folder_path) is only ever set for bookmark_ids
    that are NOT duplicated in this run. `previous` can hold at most one
    entry per bookmark_id, so when a URL has multiple occurrences there is
    no reliable way to say which occurrence in the previous run corresponds
    to which occurrence now (browsers don't guarantee stable ordering) —
    comparing them anyway produced spurious moved_candidate flags on every
    duplicated bookmark. Better to report "moved" only where it's
    unambiguous than to report it incorrectly for ~20% of a real corpus.
    """
    now = _utc_now_iso()
    occurrence_counts: dict[str, int] = {}
    for raw in raw_bookmarks:
        bid = bookmark_id_for(normalize_url(raw.url))
        occurrence_counts[bid] = occurrence_counts.get(bid, 0) + 1

    out: list[CanonicalBookmark] = []
    for raw in raw_bookmarks:
        normalized = normalize_url(raw.url)
        bid = bookmark_id_for(normalized)
        prev = previous.get(bid)
        unambiguous = occurrence_counts[bid] == 1
        if prev is None:
            out.append(CanonicalBookmark(
                bookmark_id=bid, url=raw.url, normalized_url=normalized, title=raw.title,
                folder_path=raw.folder_path, browser=raw.browser, date_added=raw.date_added,
                first_seen=now, last_seen=now, status="new",
            ))
        else:
            moved_from = (
                prev.folder_path if unambiguous and prev.folder_path != raw.folder_path else None
            )
            out.append(CanonicalBookmark(
                bookmark_id=bid, url=raw.url, normalized_url=normalized, title=raw.title,
                folder_path=raw.folder_path, browser=raw.browser, date_added=raw.date_added,
                first_seen=prev.first_seen, last_seen=now, status="existing",
                previous_folder_path=moved_from,
            ))
    return out
