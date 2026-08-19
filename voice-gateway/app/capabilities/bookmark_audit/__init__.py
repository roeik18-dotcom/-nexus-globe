"""BOOKMARK_AUDIT: Merlin's first real read-only n8n-backed capability.

  Browser bookmarks -> (n8n) read-only extractor -> raw bytes -> Merlin:
  parse -> canonical snapshot -> diff -> classify -> duplicate/dead-link
  checks -> recommendations -> StructuredResult -> Merlin response

Split of responsibilities, matching the project's stated architecture
(Merlin = reasoning/routing/knowledge/recommendation, n8n = external
execution/orchestration only):

  - n8n (app/integrations/n8n, workflow "Bookmark Extract") does exactly one
    thing: read two hardcoded, pre-discovered local bookmark files and
    return their raw bytes. No parsing, no classification, no path taken
    from caller input — see that workflow's module docs for why.
  - Everything else — parsing, canonical snapshot construction, diffing,
    classification, duplicate detection, dead-link checking, and
    recommendation generation with reasons — is reasoning/analysis and
    lives here, in Python, under Merlin's side of the boundary.

Read-only, Phase 1: no bookmark is ever deleted, moved, renamed, or
otherwise mutated by this package. Recommendations are advisory text only.

State: canonical snapshots persist at
voice-gateway/state/bookmark_audit_snapshot.json — Merlin's own runtime
state, not Philos canon.
"""
