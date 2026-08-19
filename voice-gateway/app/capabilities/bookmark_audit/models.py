"""Data model for the bookmark audit pipeline. Every stage below produces
one of these — parsers -> RawBookmark, snapshot -> CanonicalBookmark,
classify+recommend -> AuditedBookmark, orchestrator -> AuditReport."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class RawBookmark:
    """As read directly from a browser's bookmark file, before any
    normalization. `browser` is "chrome" or "safari"."""

    url: str
    title: str
    folder_path: tuple[str, ...]
    browser: str
    date_added: str | None  # ISO 8601 if the source provided a parseable timestamp


@dataclass
class CanonicalBookmark:
    """One entry in the persisted snapshot. bookmark_id is stable across
    runs (sha256 of a normalized URL) so the same real-world bookmark keeps
    the same id even if its title or folder changes."""

    bookmark_id: str
    url: str
    normalized_url: str
    title: str
    folder_path: tuple[str, ...]
    browser: str
    date_added: str | None
    first_seen: str
    last_seen: str
    status: str  # "new" | "existing"
    previous_folder_path: tuple[str, ...] | None = None  # set when folder changed since last_seen

    def to_dict(self) -> dict:
        return {
            "bookmark_id": self.bookmark_id,
            "url": self.url,
            "normalized_url": self.normalized_url,
            "title": self.title,
            "folder_path": list(self.folder_path),
            "browser": self.browser,
            "date_added": self.date_added,
            "first_seen": self.first_seen,
            "last_seen": self.last_seen,
        }

    @staticmethod
    def from_dict(d: dict) -> "CanonicalBookmark":
        return CanonicalBookmark(
            bookmark_id=d["bookmark_id"],
            url=d["url"],
            normalized_url=d["normalized_url"],
            title=d["title"],
            folder_path=tuple(d.get("folder_path", ())),
            browser=d["browser"],
            date_added=d.get("date_added"),
            first_seen=d["first_seen"],
            last_seen=d["last_seen"],
            status="existing",
        )


@dataclass(frozen=True)
class Classification:
    project: str
    topic: str
    domain: str
    source_type: str
    priority: str  # "high" | "medium" | "low"


@dataclass(frozen=True)
class DeadLinkResult:
    checked: bool
    dead: bool
    http_status: int | None
    reason: str  # "not_checked" | "ok" | "http_error" | "timeout" | "connection_error" | "access_restricted"


@dataclass(frozen=True)
class AuditedBookmark:
    canonical: CanonicalBookmark
    classification: Classification
    dead_link: DeadLinkResult
    is_duplicate: bool
    duplicate_of: str | None  # bookmark_id of the first-seen occurrence, if is_duplicate
    moved_candidate: bool
    recommendation: str  # keep | move | merge_duplicate | review | archive | delete_candidate
    reason: str


@dataclass(frozen=True)
class AuditReport:
    generated_at: str
    correlation_id: str
    browsers_found: list[str]
    bookmark_stores_found: list[str]
    total_bookmarks: int
    new_count: int
    existing_count: int
    removed_count: int
    removed_bookmarks: list[CanonicalBookmark]
    duplicate_count: int
    dead_count: int
    moved_candidate_count: int
    dead_links_checked: int
    dead_links_checked_capped: bool
    recommendation_counts: dict[str, int]
    bookmarks: list[AuditedBookmark]
