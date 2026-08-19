"""Outbound n8n execution-layer integration.

Isolated on purpose: this package must never be imported by app.router,
app.domain_router, app.agents, app.audio, or service/ (voice/wake/barge/audio
runtime). It is a standalone outbound client Merlin's domain code may call
into, not a dependency of the voice pipeline.

Phase 1 scope (2026-08-12): READ_ONLY_ECHO action only. No side-effecting
actions are constructible through this client — see client.py.
"""
