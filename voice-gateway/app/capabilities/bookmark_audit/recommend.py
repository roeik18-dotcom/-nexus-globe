"""Recommendation engine. Six possible outputs — keep, move, merge_duplicate,
review, archive, delete_candidate — each reachable by exactly one rule below,
evaluated in order, so every bookmark gets exactly one recommendation and a
plain-language reason. This is advisory text only: nothing here deletes,
moves, or renames anything (Phase 1, read-only)."""

from __future__ import annotations

from app.capabilities.bookmark_audit.models import Classification, DeadLinkResult


def recommend(
    *,
    classification: Classification,
    dead_link: DeadLinkResult,
    is_duplicate: bool,
) -> tuple[str, str]:
    if dead_link.dead:
        detail = (
            f"HTTP {dead_link.http_status}" if dead_link.http_status is not None
            else dead_link.reason
        )
        return "delete_candidate", f"URL appears unreachable ({detail}) — likely dead."

    if is_duplicate:
        return "merge_duplicate", "Same URL already present elsewhere in this snapshot — candidate to merge."

    unfiled = classification.project == "unfiled"
    has_content_signal = classification.topic != "general" or classification.source_type != "general"

    if unfiled and not has_content_signal:
        return "review", "No folder, topic, or site-type signal found — needs a human look."

    if unfiled and has_content_signal:
        return "move", (
            f"Classified as topic={classification.topic}/source_type={classification.source_type} "
            "but sits in an unfiled/root folder — suggest moving into a matching folder."
        )

    if classification.priority == "low":
        return "archive", (
            f"Filed under '{classification.project}' but added long ago with low relevance signal, "
            "link still live — candidate to archive rather than keep active."
        )

    return "keep", (
        f"Classified as topic={classification.topic}/source_type={classification.source_type}, "
        f"sits in a matching folder ('{classification.project}'), link is live."
    )
