# MERLIN OS × PHILOS — Gap Map & Dependency Graph v0.1

> Status framing (precise): **Voice activation is blocked. The project is not.**
> `Command STT` is the bottleneck for the *voice* path only. Architecture,
> Runtime, Globe, Memory, Knowledge Graph and Mission Control are **not** blocked
> and can progress in parallel.

---

## 1. Split the project (parallel tracks)

```
                         PROJECT
                            │
          ┌─────────────────┴─────────────────┐
          ▼                                   ▼
   MERLIN RUNTIME                       PHILOS RUNTIME
   (voice + execution)                  (knowledge + orientation)
          │                                   │
   Wake ✅                              Living Globe
   Command STT ⚠️  ◄── bottleneck       Knowledge Graph
   Audio / Speaker                      Orientation Engine
   TTS ✅ · LLM ✅                        Mission Control
          │                                   │
          └─────────────────┬─────────────────┘
                            ▼
                     INTEGRATION LAYER
                (shared: Memory, Event Bus, Identity)
```

The two tracks share the Integration Layer but **do not block each other**. A
weak microphone stops *hands-free voice*, not the Knowledge Graph or the Globe.

---

## 2. Dependency Graph (what blocks what)

The key tool: prioritize by **dependency**, not by importance. A component is
worth doing first if many others depend on it — not because it feels central.

```
Command STT  ⚠️ (bottleneck for VOICE only)
 ├──► Voice Commands
 ├──► Morning Brief (spoken delivery)      ← text delivery does NOT need STT
 └──► Hands-free Mode
        (nothing else depends on STT)

Memory / Event Store  (foundational, NOT blocked by STT)
 ├──► Change-Log (Layer 2)
 ├──► Intelligence / insights (Layer 5)
 └──► Continuous Learning (Layer 13)

Knowledge Graph  (NOT blocked by STT)
 ├──► Living Globe
 ├──► Search
 ├──► Timeline
 └──► Reasoning Graph

Mission Control  (NOT blocked by STT)
 ├──► Monitoring / Health
 ├──► KPIs
 └──► Daily Review / System Review
```

**Reading it:** `Command STT` blocks a small, self-contained subtree (voice I/O).
`Memory`, `Knowledge Graph`, and `Mission Control` each unblock large subtrees and
depend on **nothing that is currently broken** — so they are the highest-leverage
parallel work while the STT bottleneck is handled separately.

---

## 3. Coverage snapshot (rough, self-reported — verify before trusting)

```
PERCEPTION   ██░░░░░░░░  ~15% runtime   (wake works; command capture unreliable)
COGNITION    ███████░░░  ~55%           (LLM + context work; KG/reasoning missing)
EXECUTION    ███░░░░░░░  ~25%           (TTS works; agent fabric missing)
```
These are estimates, not measurements. Where a number matters, measure it
(`voice-gateway/tools/log_metrics.py`, `wake_ab_report.py`).

---

## 4. The 20 layers (reference index — NOT a build order)

Build order comes from the Dependency Graph above, not from this list.

1. Mathematical Foundations (State/Event/Time/Identity algebra, Causality, Confidence)
2. System Invariants (every Decision references Evidence·Context·Time·Confidence·Author·Version)
3. Universal Object Model (everything is a typed Entity)
4. Time Engine (Past · Current · Projected · Counterfactual · Simulation)
5. Evidence Engine (Evidence · Validation · Contradiction · Missing · Confidence)
6. Knowledge Graph (typed nodes/relations, inheritance, temporal + evidence links)
7. Reasoning Graph (Observation→Hypothesis→Evidence→Simulation→Decision→Execution)
8. Mission Control (health, projects, agents, events, risks, bottlenecks)
9. Kernel (Event Bus · Scheduler · Context · Routers · Task Queue · Recovery)
10. Agent Fabric (Planner · Research · Simulation · Memory · Coding · Review · …)
11. Human Model (identity, preferences, habits, goals, values, energy, attention)
12. Self Model (capabilities, limitations, performance, load, failures)
13. Continuous Learning (Experience→Evaluation→Correction→Policy update)
14. World Model (news, markets, GitHub, research, AI)
15. Observability (event · log · metrics · tracing · replay)
16. Verification (claim · evidence · sources · validation · confidence)
17. Visual Intelligence (Globe, Mission Control, graphs, heatmaps, sim viewer)
18. Simulation Engine (what-if · alternatives · risk · impact)
19. Economics (API/GPU/latency/memory/power/budget)
20. Governance (permissions · privacy · security · audit · policy · recovery)

Reference disciplines: Tanenbaum (OS), Kleppmann/Lamport (distributed), Pearl
(causality), Kahneman/Simon (decision), OpenTelemetry + Google SRE (observability),
ACT-R/Soar/Global Workspace (cognitive architectures), ROS 2 (perception→plan→act),
INCOSE/ISO 15288 (systems engineering), RDF/OWL/Wikidata (knowledge representation).

---

## 5. Daily System Review (template — text, does NOT need STT)

```
══════════════════════════════════════════════
MERLIN OS — SYSTEM REVIEW
══════════════════════════════════════════════
🟢 Health   🟡 Bottlenecks   🔴 Critical Risks

Architecture Coverage   ███████░░░ 68%
Runtime Coverage        ██░░░░░░░░ 22%
Verification Coverage   ███░░░░░░░ 30%
Documentation Coverage  ████████░░ 80%

Open Decisions:  STT pipeline · KG schema · Agent scheduler
Blocked By:      Command STT reliability (voice only) · Runtime integration
Next Verified Milestone: □ Living Globe runtime
══════════════════════════════════════════════
```

---

*v0.1 — captured 2026-07-31. The Dependency Graph (§2) is the working tool; the
20 layers (§4) are a reference, not a schedule. Coverage numbers are estimates
until measured.*
