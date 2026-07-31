# RFC-013 — Release Policy

**Subordinate to [RFC-000](system-constitution.md).** Decision type: **[E].**
Status: v0.1 (2026-07-31).

## Maturity states
Every component and capability carries one label:

| State | Meaning | May depend on |
|---|---|---|
| **Draft** | design only (RFC/ADR exists, no impl) | anything |
| **Experimental** | implemented, unverified, may change/break | Experimental+ |
| **Stable** | verified, contract frozen, safe to build on | Stable / LTS |
| **LTS** | long-term supported, breaking changes need migration path | LTS |
| **Deprecated** | scheduled for removal; replacement named | — |

## Rules
- **R-1** A **Stable** component may not depend on an **Experimental** one (no stable
  house on shifting ground).
- **R-2** Promotion (Experimental→Stable) requires: passing Quality Gates (RFC-014),
  contract frozen, and observability in place (OBS-001).
- **R-3** Deprecation names its replacement and a removal date, recorded as an ADR.
- **R-4** Current honest labels (2026-07-31): Meta-Architecture docs = **Stable**;
  Voice pipeline = **Experimental** (Command-STT reliability open); Kernel = **Draft**;
  Philos Orientation Engine = **Draft** (RFC-020).

*RFC-013 v0.1 — 2026-07-31.*
