"""Data model for BOOKMARK_APPLY — the mutation half of the bookmark_audit
capability. Separate module from models.py (audit/read side) so the two
are easy to reason about independently: nothing here is imported by
orchestrator.py (the audit pipeline), and models.py is not modified.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

MOVE = "MOVE"
RENAME = "RENAME"
MERGE_DUPLICATE = "MERGE_DUPLICATE"
ARCHIVE = "ARCHIVE"
DELETE = "DELETE"
VALID_OPERATIONS = frozenset({MOVE, RENAME, MERGE_DUPLICATE, ARCHIVE, DELETE})


@dataclass(frozen=True)
class MutationRequest:
    """One proposed change to one bookmark. expected_current_title/folder
    are captured at preview time and re-checked against the live file at
    apply time — a mismatch means the real state changed since preview
    (someone moved it, or a prior apply already touched it) and n8n aborts
    that mutation rather than applying it blind."""

    bookmark_id: str
    url: str
    browser: str  # "chrome" | "safari" — required, no default: the browser-running
                  # safety gate (browser_guard.py) keys off this field, so a caller
                  # can't accidentally leave it unset and skip the check.
    expected_current_title: str
    expected_current_folder_path: tuple[str, ...]
    operation: str
    new_title: str | None = None
    new_folder_path: tuple[str, ...] | None = None

    def __post_init__(self) -> None:
        if self.operation not in VALID_OPERATIONS:
            raise ValueError(f"invalid operation: {self.operation!r}")
        if self.operation == RENAME and not self.new_title:
            raise ValueError("RENAME requires new_title")
        if self.operation == MOVE and not self.new_folder_path:
            raise ValueError("MOVE requires new_folder_path")

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {
            "bookmark_id": self.bookmark_id,
            "url": self.url,
            "browser": self.browser,
            "expected_current_title": self.expected_current_title,
            "expected_current_folder_path": list(self.expected_current_folder_path),
            "operation": self.operation,
        }
        if self.new_title is not None:
            d["new_title"] = self.new_title
        if self.new_folder_path is not None:
            d["new_folder_path"] = list(self.new_folder_path)
        return d


@dataclass(frozen=True)
class MutationPreview:
    """Output of build_preview() — pure, local, makes no n8n call. inputs
    and inputs_hash are exactly what apply() will send once approved;
    computing them here means the human (or the proof harness standing in
    for one) approves the *actual* request, not a paraphrase of it."""

    inputs: dict[str, Any]
    inputs_hash: str
    operations: tuple[str, ...]  # distinct operation types present, for the approval UI to list
    mutation_count: int
    browsers: frozenset[str]  # distinct browsers targeted — apply() gates each independently


@dataclass(frozen=True)
class ApplyOutcome:
    status: str  # "accepted" | "duplicate" | "rejected" | "error"
    code: str
    action_id: str | None
    correlation_id: str | None
    message: str | None
    applied: list[dict[str, Any]] | None
    verification: list[dict[str, Any]] | None
    backup_path: str | None
    http_status: int | None
