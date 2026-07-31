"""Merlin OS — Platform Track (mos).

First real platform code. Bootstraps the minimal substrate the canonical docs
specify, so Merlin moves from "infra that routes events" to "agent that decides":

  events.py     — Event model (ADR-003) + minimal in-memory bus/store (v0)
  cognition.py  — Cognition = Philos Orientation Engine shell (RFC-020)

Canonical governance: docs/architecture/ (system-constitution, adr-003-event-model,
rfc-020-orientation-engine). This package IMPLEMENTS those; it does not redefine them.
The Philos orientation ALGORITHM stays locked theory (INV-9) — v0 ships a transparent
rule stub behind the contract, swappable without touching any consumer (INV-7).
"""
