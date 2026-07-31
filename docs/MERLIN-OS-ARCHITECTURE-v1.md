# Merlin OS — Architecture v1

**Chief Systems Architecture · Navigational INDEX (not a competing source of truth)**
Status: this document is an **index/orientation layer** over the canonical governance
set in `docs/architecture/`. Where a topic is owned by an RFC/ADR, **that document is
canonical and wins**; this file only orients and cross-links (avoids doc-fork, INV-8 /
one-source-of-truth). Sections original to this file are marked *(this doc)*.

### Crosswalk — Blueprint topic → canonical source
| Topic | Canonical owner (`docs/architecture/`) | Status |
| --- | --- | --- |
| Invariants / constitution | `system-constitution.md` (INV-*/AX-*) | Canonical — this file's §2 must reconcile numbering to INV-* |
| Event model (Event · State · fold) | `adr-003-event-model.md`, `rfc-030-state-model.md` | Canonical — verified |
| Cognition / Orientation Engine | `rfc-020-orientation-engine.md` | Canonical — verified; **implemented** in `voice-gateway/mos/cognition.py` (v0 shell) |
| Speech / transcription interface | `adr-001-speech-engine-interface.md`, `adr-002-canonical-transcription-object.md` | Canonical (Voice Track) |
| Telemetry / observability | `adr-004-telemetry-ownership.md`, `obs-001-system-observability.md` | Canonical |
| Living World Graph | `rfc-021-living-world-graph.md` | Canonical |
| Glossary / ontology | `rfc-000a-glossary.md`, `rfc-000b-ontology.md` | Canonical |
| Capability roadmap / repo / versioning | `rfc-001`, `rfc-010..014` | Canonical |
| The cognition **loop** as one picture (§4) | — | *(this doc)* — orientation only |
| Anti-fiction status discipline (§0.2) + live status | — → Mission Control | *(this doc)* + `tools/mission_control.py` |

> Reconciliation TODO (tracked, not done): align this file's §2 "I-1..I-9" to the
> canonical `INV-*` in `system-constitution.md`; demote any §3 event-shape detail that
> diverges from `adr-003` (canonical shape is implemented in `mos/events.py`).

---

## 0. Preface — how to read this document

### 0.1 Method
This document is written in the order a system must be *reasoned*, not the order it
is *built*:

```
Problem  →  Invariants  →  Information Model  →  Information Flow  →  Contracts  →  Modules
(§1)        (§2)           (§3)                  (§4)                (§5)          (Part II)
```

Everything above "Modules" is **implementation-independent**: it is true no matter
which language, model, or library implements it, and it *constrains* every module.
Modules are downstream of contracts, contracts downstream of the information model,
the information model downstream of the invariants, the invariants downstream of the
one problem the system exists to solve.

### 0.2 Anti-fiction discipline
A world-class foundational spec is dangerous if it describes a system that does not
exist. Two rules keep this document honest:

- **Foundations (Part I) are specified in full** — they have leverage and are cheap
  to get right on paper and ruinous to get wrong in code.
- **Module specs (Part II) are written only when the module is built.** Until then
  a module appears as a *contract stub* + a status tag. Status is the same taxonomy
  Mission Control renders live: `built` · `prototype` · `not-built`. This document
  and Mission Control are two projections of one truth (§10).

### 0.3 Intellectual lineage (what each part borrows, and why)
| Domain | Source | Borrowed for |
| --- | --- | --- |
| Cognitive architecture | Global Workspace Theory; ACT-R; Soar | §4 the cognition loop, the "workspace" as the arbitration point |
| Operating systems | Mach, Windows NT, Linux | §5 the Kernel: event bus, scheduler, IPC as typed contracts |
| Distributed systems | Event Sourcing, CQRS, Raft | §3 state-as-fold-over-events; read/write separation; ordered log |
| Robotics | ROS 2 | §4 the perception → decision → action real-time pipeline |
| Systems engineering | INCOSE | §5 boundaries, interfaces, V&V (§6) |
| Software design | Domain-Driven Design | §5 bounded contexts = layers with owned language |
| Observability | OpenTelemetry | Invariant I-5; every decision emits a trace |

---

## 1. The fundamental problem

> **Merlin exists to continuously convert a noisy, multi-modal, real-world signal
> stream into oriented, evidence-qualified action — across one person's physical,
> digital, and cognitive world — in real time, and to keep doing so, correctly,
> for years.**

Decomposition of that one sentence (each clause is a design forcing-function):

- **continuously** → the system is a *running process*, not a request/response
  service. There is no "idle"; there is only lower-priority perception. (Kills the
  "voice assistant" framing.)
- **noisy, multi-modal signal stream** → input is unreliable by nature (the Command-STT
  evidence: 71% of captures contained no speech). The system must *quantify its own
  input quality*, not assume it. → Invariant I-2, I-4.
- **oriented** → raw information is not the product; *meaning + priority* is. This is
  the job of Cognition = Philos (the Orientation Engine). → §4, I-3.
- **evidence-qualified** → every output carries where it came from and how sure the
  system is. → I-4.
- **action** → the loop closes on the world (Git, apps, speech, agents), not on a
  reply. Side effects are real and sometimes irreversible. → I-6.
- **one person's world** → single-tenant, deeply personalized, long-lived context.
  The unit of value is *continuity*, not any single answer.
- **for years** → the architecture must admit new modules without breaking existing
  contracts. → I-7, §7.

**Non-goals (v1):** multi-tenant/cloud SaaS; replacing the human's judgment on
irreversible decisions; being a chatbot. These are explicitly out of scope so the
invariants below are not diluted to accommodate them.

---

## 2. System Invariants (inviolable laws)

An invariant is a property that **must hold at all times**, in every module, forever.
If a design would violate one, the design is wrong — not the invariant. Each is
stated as a testable predicate.

- **I-1 · Everything is an Event.**
  Every input, decision, state change, and action is represented as an immutable,
  timestamped, typed event on the bus. Nothing bypasses the bus.
  *Test:* no module mutates another module's state except by emitting/consuming events.

- **I-2 · No action without context.**
  No decision is taken on a signal alone; it is taken on `(signal, context)` where
  context answers *where / when / which project / what state / with whom*.
  *Test:* every Decision event references a Context snapshot id.

- **I-3 · Orientation before Action.**
  Between perceiving and acting, the system must pass through Cognition (Philos):
  *what is really happening, why it matters, what is the priority.* No Perception
  event may bind directly to an Action event.
  *Test:* the causal chain of every Action event contains an Orientation event.

- **I-4 · Every claim carries Confidence + Evidence.**
  No statement, transcript, inference, or recommendation is emitted without
  `{confidence ∈ [0,1], evidence_source, is_fact|is_inference}`.
  *Test:* the type system rejects an assertion lacking these fields.

- **I-5 · Every decision is explainable (Observability).**
  For any action the system took, it can reconstruct *why*: the events, context,
  confidence, and reasoning that produced it. Reasoning that cannot be traced did
  not happen.
  *Test:* given an Action id, the full causal trace is queryable.

- **I-6 · Side effects pass permission gates.**
  Irreversible or outward-facing actions (send, publish, delete, purchase, spend,
  external write) require an explicit gate; the gate is a first-class event, not a
  code branch. Reversibility class is a property of every Action type.
  *Test:* no Action with `reversible=false` executes without a corresponding
  Approval event.

- **I-7 · Contracts are versioned; modules are replaceable.**
  A module interacts with the system only through its published contract (§5). A
  module may be replaced by any other module honoring the same contract version.
  Contracts evolve by versioning, never by silent change.
  *Test:* swapping a module's implementation, contract-version held constant,
  changes no other module.

- **I-8 · One source of truth per fact.**
  Any given fact (a context value, a memory, a status) has exactly one owning
  module. Others read it via contract; none copy-and-diverge.
  *Test:* no fact is writable by two modules.

- **I-9 · Time is explicit and dual.**
  Every event distinguishes *event-time* (when it happened in the world) from
  *ingest-time* (when the system saw it). Ordering and replay use the log, not
  wall-clock. (Enables I-5 replay and deterministic tests.)
  *Test:* both timestamps present on every event; replay reproduces state.

These nine are the constitution. §3–§7 are their consequences.

---

## 3. Unified Information Model (Event · Entity · State · Time)

The whole system speaks **one** data language. Four primitives.

### 3.1 Event
The atom (I-1). An immutable record that *something happened*.

```
Event {
  id            : ULID              // monotonic, sortable
  type          : EventType         // namespaced, e.g. perception.audio.speech
  event_time    : Timestamp         // when it happened in the world     (I-9)
  ingest_time   : Timestamp         // when the system observed it       (I-9)
  source        : ModuleId          // who emitted it                    (I-8)
  context_ref   : ContextId?        // snapshot it was produced against  (I-2)
  causation_id  : EventId?          // the event that directly caused it (I-5)
  correlation_id: EventId?          // the originating event of the chain(I-5)
  confidence    : float [0,1]       //                                   (I-4)
  evidence      : EvidenceRef[]     //                                   (I-4)
  payload       : <type-specific>
}
```

`causation_id` + `correlation_id` are what make I-5 (explainability) and I-3
(orientation-in-the-chain) *checkable* rather than aspirational: the causal graph is
literally stored.

### 3.2 Entity
A thing in the person's world that persists and changes: **Person, Project, Document,
Commit, Service, Agent, Value, Community, Company, Idea**. Entities are *not* stored
as mutable rows; an Entity's current state is a **fold over the events about it**
(§3.4). This is what the Living Globe renders (a Node = an Entity; an Edge = a
Relationship asserted by events).

### 3.3 State
State is **derived, never primary** (Event Sourcing). For any entity or subsystem:

```
state(t) = fold(reduce, events where event_time ≤ t, seed)
```

Consequences that fall out for free:
- **Time travel / Timeline** (Memory §, Morning Brief): `state(yesterday)` vs
  `state(now)` is just two folds → "what changed" is a diff, not a special feature.
- **Prediction**: `state(now + Δ)` is a projection function over the same log.
- **CQRS**: writes append events; reads hit *projections* (materialized views like
  Mission Control, the Globe). Read models never write.

### 3.4 Time
Three clocks, never conflated (I-9): **event-time** (world), **ingest-time**
(observation), **logical order** (the ULID sequence / the log offset). All ordering,
replay, and testing use logical order. Wall-clock is a payload value, not a control
signal — which is also why this document's implementation may not call
`Date.now()` inside deterministic paths.

---

## 4. Information Flow — the cognition loop

The canonical cycle. Borrows ROS 2 (perception→decision→action) for the outer shape
and Global Workspace Theory for the arbitration point.

```
        ┌──────────────────────────────  EVENT BUS (append-only log)  ──────────────────────────────┐
        │                                                                                            │
   ┌────┴─────┐   ┌──────────┐   ┌──────────────────┐   ┌──────────┐   ┌──────────┐   ┌───────────┐ │
   │PERCEPTION│──▶│  INTENT  │──▶│ COGNITION (Philos)│──▶│ PLANNING │──▶│  ACTION  │──▶│ LEARNING  │─┘
   │  sense   │   │ classify │   │   orient          │   │ decide   │   │  effect  │   │  update   │
   └──────────┘   └──────────┘   └──────────────────┘   └──────────┘   └──────────┘   └───────────┘
        ▲              ▲                  ▲                    ▲              │              │
        └──────────────┴──────── CONTEXT (read) ──────────────┴──────────────┘              │
                                        MEMORY  ◀───────────── writes/reads ─────────────────┘
```

Stage responsibilities (each is a *contract*, §5, not yet a module):

1. **Perception** — turn raw signal into typed, confidence-tagged observation events.
   *Does not interpret meaning.* (The current blocker lives at its boundary: the
   RMS gate mis-classifies 71% of audio — a Perception-quality defect, I-2/I-4.)
2. **Intent** — classify *what the person wants / what kind of event this is*
   (command vs music vs another speaker vs ambient). The Perception→Intent edge is
   the reliability bottleneck of the whole system: everything above it inherits its
   error rate. Stabilizing it is the current priority.
3. **Cognition = Philos (Orientation Engine)** — the Global Workspace. Computes
   meaning, priority, risk, opportunity, potential, dependencies, confidence. This
   is where **I-3** is enforced. Philos is *an* engine here, not the system; future
   engines (simulation, research, scheduling) may sit beside it.
4. **Planning** — turn an oriented situation into goals, critical path, and a chosen
   next action, with reversibility class attached (I-6).
5. **Action** — effect the world through the Action contract; emit result events.
6. **Learning** — fold outcomes back into Memory; update priors, preferences,
   calibration (e.g. Potential-detection calibration, Perception thresholds).

The loop is **event-sourced end to end**: each arrow is events on the bus, so I-1,
I-5, and time-travel (§3.4) hold across the entire cognition cycle, not just storage.

---

## 5. Layer Contracts (Interfaces)

A contract specifies **what a layer consumes, what it emits, and the invariants it
must preserve** — never *how*. This is the DDD/INCOSE boundary and the I-7 unit of
replaceability. Stated as consumed/emitted event types + guarantees.

### 5.0 Kernel contract (the substrate all others use)
- **Provides:** the Event Bus (ordered, append-only, replayable log); the Scheduler
  (priority + backpressure); the Context Manager (snapshotting for I-2); the
  Permission gate (I-6); the Telemetry sink (I-5); State/Recovery.
- **Guarantees:** total order per correlation chain; at-least-once delivery with
  idempotency keys; no event loss across restart (durability); every delivered event
  is traceable.
- *This is Mach/NT ported to a cognitive system: IPC = typed events, syscalls =
  contract calls, drivers = Perception/Action modules.*

### 5.1 Perception contract
- **Consumes:** raw device/system signals (audio frames, screen, filesystem, git,
  processes, calendar, network…).
- **Emits:** `perception.*` observation events, each with `confidence`, `evidence`,
  and a modality-specific quality metric (e.g. `audio.speech_probability`).
- **Must preserve:** I-4 (no observation without confidence); I-2 (stamp context);
  never interpret meaning (that is Cognition's monopoly, I-8).

### 5.2 Intent contract
- **Consumes:** `perception.*`.
- **Emits:** `intent.classified { kind, confidence }` where kind ∈ {command, query,
  music, other-speaker, ambient, clap, …} and, for commands, a natural-intent
  representation (not a fixed keyword table — commands are *shortcuts*, not the API).
- **Must preserve:** I-4; must emit `intent.rejected` for low-confidence input
  rather than fabricating (directly fixes "act on hallucinated transcript").

### 5.3 Cognition / Orientation contract (Philos)
- **Consumes:** `intent.*`, `perception.*`, Context, Memory (read).
- **Emits:** `orientation { meaning, priority, risk, opportunity, potential,
  dependencies, tradeoffs, confidence, recommendation }`.
- **Must preserve:** I-3 (nothing reaches Action without passing here); I-4 on every
  field; must separate observation/interpretation (evidence-discipline as a type).

### 5.4 Memory contract
- **Consumes:** all events (for episodic capture); Learning updates.
- **Emits/serves:** typed recall — by time, project, person, entity — across memory
  classes (episodic, semantic, procedural, project, relationship, preference,
  decision, mistake/success, timeline).
- **Must preserve:** I-8 (owns the memory-of-record); I-9 (recall is a fold to a
  point in time); recall carries provenance (I-4/I-5).

### 5.5 Planning contract
- **Consumes:** `orientation.*`, Memory, goals.
- **Emits:** `plan { goal, critical_path, next_action, reversibility_class, KPIs }`.
- **Must preserve:** attach reversibility class to every proposed action (feeds I-6).

### 5.6 Action contract
- **Consumes:** `plan.next_action`.
- **Emits:** `action.requested` → (gate if needed, I-6) → `action.result`.
- **Must preserve:** I-6 (gate irreversible/outward actions); every effect emits a
  result event with outcome + evidence; no silent failure.

### 5.7 Multi-Agent contract
- Agents are **specialist Action/Cognition modules** behind the same bus. Merlin
  (the Coordinator) does not replace them; it schedules and arbitrates (Kernel §5.0).
- **Must preserve:** every agent's work is events (I-1, I-5); an agent may only act
  through the Action contract (so I-6 applies to agents too).

*(Presentation surfaces — Mission Control §10, Living Globe §11, Morning Brief §12 —
are **read-model projections** (CQRS). They consume events and render; they never
emit domain state. This is why they can never "lie": they are functions of the log.)*

---

## 6. Verification & Validation

- **Invariant tests (continuous):** each Iₙ in §2 has a machine-checkable predicate;
  CI fails if any is violable. These are the acceptance gate for *any* module.
- **Contract tests:** each §5 contract has consumer-driven contract tests; a module
  is "done" when it passes its contract tests in isolation (I-7).
- **Replay tests (I-9):** a recorded event log replays to a byte-identical state —
  the definition of deterministic correctness and the basis of regression tests.
- **Perception ground-truth (V):** labeled capture corpora (e.g. the Silero probe
  over real WAVs) validate Perception/Intent quality against reality, with reported
  confidence and *declared* known-limitations (no silent sampling caps).
- **Validation (is it the right system?):** does an oriented, evidence-qualified
  action measurably beat a raw reply for the user? — the C3-style falsification
  stance applied to the product, not just to Potential.

---

## 7. Evolution model (years, not features)

- New capability = new **module honoring an existing contract** (I-7), or a new
  contract version negotiated on the bus. Never a patch that reaches across a
  boundary (I-8).
- Growth axis is **modules and agents**, not commands: 100 modules / hundreds of
  agents, each replaceable, each observable.
- Contract versioning is the only sanctioned way the system changes shape; a
  deprecation is an event, with a migration window, not a silent break.
- The log is the system's long-term memory *and* its audit trail *and* its test
  fixture — one artifact, three lifetimes.

---

## Part II — Module specifications (skeleton; written when built)

Per §0.2, each module below is a **contract stub + status**, expanded to a full spec
only when it is built. Status mirrors Mission Control (§10) live.

| # | Module | Contract | Status |
| --- | --- | --- | --- |
| Kernel | Event Bus / Scheduler / Context / Permissions / Telemetry | §5.0 | ⚪ not-built |
| Perception · Audio | wake · speaker-id · music · echo · speech-quality | §5.1 | 🟡 prototype (wake built; VAD being replaced) |
| Perception · Vision | screen · OCR · window · gesture | §5.1 | ⚪ not-built |
| Perception · Digital | git · fs · processes · calendar · mail · network | §5.1 | 🟡 prototype (git/service/log read by Mission Control) |
| Intent | command/music/other-speaker/ambient classifier | §5.2 | 🔴 blocker (RMS gate → Silero) |
| Cognition · Philos | orientation engine (meaning/priority/…) | §5.3 | 🟡 theory locked; runtime not-built |
| Memory | episodic/semantic/project/relationship/… | §5.4 | 🟡 prototype (files; not event-sourced) |
| Planning | goals/critical-path/next-action | §5.5 | ⚪ not-built |
| Action | terminal/git/browser/apps/agents | §5.6 | ⚪ not-built |
| Multi-Agent | research/coding/review/… coordinator | §5.7 | ⚪ not-built (0 running) |
| Mission Control | live read-model dashboard | §5 (read-model) | 🟢 built (v0) |
| Living Globe | entity/relationship read-model over time | §5 (read-model) | 🟡 prototype |
| Morning Brief | scheduled read-model: what+why+confidence | §5 (read-model) | ⚪ not-built |

> **The one true north:** the loop of §4, governed by the invariants of §2, speaking
> the model of §3, across the contracts of §5. Everything else is a module that
> plugs in — and can be pulled out — without touching the spine.

---

*Merlin OS Architecture v1 · Part I authored 2026-07-31. Grounded in the session's
established principles (evidence-discipline, orientation-before-action, confidence,
Perception→Intent→Cognition→Action) and real evidence (Silero probe, Mission Control
live data). Part II expands per-module as modules are built.*
