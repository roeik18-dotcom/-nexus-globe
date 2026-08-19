"""Action-intent gate: decides whether a user turn is an explicit request to
execute an action (vs. a knowledge/conversation query), and if so, dispatches
it through app.integrations.n8n.

Deliberately separate from app.domain_router: domain_router classifies WHAT
KNOWLEDGE a turn is about (Philos / Human Config / Music / General / ...);
this package classifies WHETHER a turn should EXECUTE anything at all. The
two must never merge — a query can score high on domain_router's PHILOS or
MUSIC_CONFIG cues and still correctly dispatch nothing, because dispatch
requires an explicit action intent, not a topic keyword.

Phase 1 scope (2026-08-12): exactly one intent, EXECUTION_TEST_N8N_ECHO,
read-only, no side effects. See gate.py for the classifier and dispatch.py
for the n8n call + result formatting.
"""
