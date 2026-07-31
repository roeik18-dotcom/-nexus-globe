# RFC-012 — Versioning Strategy

**Subordinate to [RFC-000](system-constitution.md).** Decision type: **[E].**
Status: v0.1 (2026-07-31).

## Rule
Each layer versions **independently** — the platform does not force-couple versions.

```
Platform   1.x     (the whole, integrated release line)
Kernel     0.x     (Event Bus/Store/Scheduler/…)
Philos     0.x     (Orientation Engine — see RFC-020; enables v1-vs-v2 comparison)
Plugins    independent  (each plugin its own semver)
```

## Rules
- **R-1** SemVer per component: MAJOR = breaking contract, MINOR = additive, PATCH = fix.
- **R-2** A component's **contract** (its interface/ADR) is what is versioned, not its
  internals. Changing a contract = MAJOR + ADR.
- **R-3** The Platform version pins a tested set of component versions (a manifest).
- **R-4** Philos is versioned so the **same inputs** can be run against `philos@0.n`
  vs `philos@0.n+1` for comparison (RFC-020 goal).
- **R-5** No component depends on another's *internal* version — only its contract
  version (RFC-000 §8).

*RFC-012 v0.1 — 2026-07-31.*
