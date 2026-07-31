# RFC-001 — Capability Roadmap

**Subordinate to [RFC-000](system-constitution.md).** Decision type: **[E]** (build
order) with **[U]** ratification of priorities. Status: v0.1 (2026-07-31). This is a
roadmap of **capabilities, not dates** — it connects the Constitution, ADRs, and Gap
Map into one build path so we never have governance without a "what first."

Build order follows the **Dependency Graph** (`gap-map.md` §2), not importance.

## Platform framing (language change, adopted)
The project is a **platform**, not two entities. This modularity lets the Philos
Orientation Engine be swapped or run outside Merlin without touching the kernel.
```
Merlin Platform
├── Merlin Kernel            (Event Bus · Scheduler · Context · Routers · Registry)
├── Merlin Runtime           (agents, execution, layer contracts)
├── Merlin Interfaces        (Speech · Vision · Browser · CLI)
└── Philos Orientation Engine (pluggable: orientation + knowledge + values)
```

## Capability levels
```
LEVEL 0 — Foundation
────────────────────
✓ RFC-000   Constitution
✓ RFC-000A  Language (Glossary)
✓ RFC-000B  Data Model (Ontology)
✓ ADR-001   Speech Engine Interface
✓ ADR-002   Canonical Transcription Object
✓ ADR-003   Event Model
□ ADR framework adoption (all future decisions as ADRs)

LEVEL 1 — Core Runtime (Merlin Kernel)
────────────────────
□ Event Bus            (implements ADR-003)
□ Event Store          (append-only, replayable)
□ Context Engine
□ Memory Core          (working/episodic/semantic/project)
□ Scheduler
□ Capability Registry

LEVEL 2 — Cognition (Philos + Merlin)
────────────────────
□ Knowledge Graph Engine   (implements RFC-000B)
□ Reasoning Engine
□ Decision Engine          (enforces INV-2)
□ Planning Engine

LEVEL 3 — Interaction (Merlin Interfaces)
────────────────────
◑ Speech Interface     (wake ✓, TTS ✓; Command-STT reliability = open bottleneck)
□ Vision Interface
□ Browser Interface
□ CLI Interface

LEVEL 4 — Execution (Merlin Runtime)
────────────────────
□ Action Engine        (enforces INV-8 approval)
□ Automation Engine
□ Tool Runtime

LEVEL 5 — Intelligence
────────────────────
□ Learning
□ Simulation
□ Prediction
□ Optimization

LEVEL 6 — Mission Control
────────────────────
□ Live Dashboard
□ Health
□ Metrics
□ Replay        (reads the Event Store from ADR-003)
```

## Two parallel tracks (from gap-map split)
- **Architecture/Kernel track (NOT STT-blocked):** LEVEL 0 ✓ → LEVEL 1 (Event Bus,
  Memory Core, Context) → LEVEL 2 (Knowledge Graph). Highest leverage now.
- **Voice track (STT-blocked):** LEVEL 3 Speech Interface — advances via ADR-001/002
  (pluggable engine + canonical object) and the E2 experiment. Blocked only for
  hands-free voice; does not block the Kernel track.

## Next verified milestones
1. **Kernel track:** Event Bus + Event Store (LEVEL 1) — makes INV-5 real, unblocks
   Memory/KG/Replay.
2. **Voice track:** implement ADR-001/002 additively (enrich `STTProvider` →
   `Transcription`, add one 2nd engine) → run E2 to decide Whisper-specific vs
   input-specific [M].

## Pending [U]
- Ratify the level ordering and which track gets priority effort.
- Confirm Philos Orientation Engine as a pluggable, independently-runnable module.

*RFC-001 v0.1 — 2026-07-31. Capabilities, not dates. Order = Dependency Graph.*
