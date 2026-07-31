# RFC-011 — Repository Architecture

**Subordinate to [RFC-000](system-constitution.md).** Decision type: **[E].**
Status: v0.1 (2026-07-31). Defines how the repo is organized (not how code works), so
structure doesn't drift into anarchy as the platform grows.

## Target layout
```
/apps          user-facing apps / entrypoints
/kernel        Merlin Kernel (Event Bus, Store, Scheduler, Registry, Context, State)
/runtime       Merlin Runtime (pipeline, agents, execution)
/interfaces    Speech · Vision · Browser · CLI adapters
/philos        Philos Orientation Engine (pluggable)
/plugins       third-party / optional capabilities
/docs          RFCs, ADRs, OBS, gap-map (this dir → docs/architecture)
/tests         mirrors the tree above
/tools         read-only measurement/analysis (log_metrics, wake_ab_report, e2_summary)
```

## Rules
- **R-1** Every core file lives under exactly one top-level domain (maps to RFC-010
  ownership).
- **R-2** `/interfaces` depend on `/kernel` contracts, never the reverse (RFC-000 §8).
- **R-3** `/philos` is a **pluggable** module: nothing in `/kernel` or `/runtime`
  imports Philos internals — only its contract.
- **R-4** `/tools` is read-only; it never imports runtime state, only reads logs/events.
- **R-5** The current `voice-gateway/` is the seed of `/runtime` + `/interfaces/speech`;
  migration is incremental, tracked by ADR.

*RFC-011 v0.1 — 2026-07-31.*
