# RFC-000 — Merlin System Constitution

> **Supremacy clause.** RFC-000 sits above every other document. Every ADR, future
> RFC, module, and test refers to it. **No architectural decision may contradict
> RFC-000. If a contradiction is found, the decision is wrong by default and must be
> revised — or RFC-000 must be formally amended through Change Control (§12).** This
> is the constitutional contract of the system, not documentation.
>
> **Decision-type legend** (used throughout, defined formally in §10): **[U]** User ·
> **[E]** Engineering · **[M]** Empirical. A blank `[U]` is `____` awaiting Roei.
> Authoritative term definitions live in **RFC-000A — Glossary**.

---

# PART I — FOUNDATIONS

## 1. Purpose
- **Problem [U]:** Roei runs several deep, parallel efforts (Merlin, Philos, Music)
  whose state, memory, decisions, and events are scattered across tools and time.
  There is no single, evidence-based, always-current view to think and act from.
- **Who [U]:** Roei — single primary operator.
- **Success [U/M]:** at any moment the operator can see what is true, what changed,
  what is blocked, what is next — grounded in evidence, low-latency. Numeric
  thresholds are **[M]** (measured, never asserted).

## 2. Scope
- **The system IS:** a personal cognitive runtime for Roei's projects and context —
  perception, memory, reasoning, orientation, planning, execution, review.
- **The system IS NOT (Non-Goals, binding):** a general web-search engine · an OS for
  the computer · a substitute for human judgment · an autonomous unbounded actor · a
  product for users other than Roei (for now). Defining the "not" is as binding as
  the "yes."
- Scope changes only via §12.

## 3. Definitions
Terms are defined **authoritatively in RFC-000A — Glossary**. No *new* core term
enters the system before it is defined there. No component may use a defined term
with any other meaning.

## 4. System Axioms (design-guiding principles — NOT auto-testable)
Axioms shape how the system is designed; they are premises, not checks.
- **AX-1** Every observable change is an Event.
- **AX-2** Every Decision occurs in a Context.
- **AX-3** State exists independently of its presentation.
- **AX-4** Time is first-class data.
- **AX-5** Orientation precedes action.
- **AX-6** Measure before change; always keep a working reference to roll back to.

## 5. System Invariants (testable rules — a valid system MUST satisfy)
Each is checkable; `[auto]` marks ones a test/CI can enforce mechanically.
- **INV-1** `[auto]` Every Event has a Timestamp.
- **INV-2** `[auto]` Every Decision references Evidence · Context · Time · Confidence
  · Author · Version.
- **INV-3** `[auto]` Every Action has an Origin.
- **INV-4** `[auto]` Every Entity has a stable, unique Identifier.
- **INV-5** `[auto]` Every state transition is Replayable — State is reconstructable
  from the Event log.
- **INV-6** Evidence discipline: Observation, Interpretation, Root cause kept
  distinct; a hypothesis is never stated as a conclusion; one variable per experiment.
- **INV-7** Never fabricate facts about Roei's projects/files/state; unknown → say so.
- **INV-8** Any irreversible or outward-facing Action requires human approval unless
  the Policy Engine explicitly whitelists it.
- **INV-9** Philos's locked core is not redesigned for engineering convenience; every
  change touching it is recorded via ADR.

---

# PART II — ARCHITECTURE

## 6. Architectural Principles **[E]**
- Event-driven: components react to Events, not to each other directly.
- Context precedes execution.
- State is explicit — no hidden or implicit state.
- Modules communicate only through contracts.

## 7. Layer Contracts **[E]**
```
Perception → Cognition → Planning → Execution → Learning
```
| Layer | Receives | Returns | MUST NOT |
|---|---|---|---|
| Perception | raw signals / input | structured Events | reason or act |
| Cognition | Events + Context | interpretations, hypotheses, orientation | cause side effects |
| Planning | goals + interpretations | ordered Actions + dependencies | execute |
| Execution | approved Actions | results + Events | set policy or skip approval |
| Learning | outcomes | corrections, policy updates | silently alter invariants |

## 8. Dependency Rules **[E]**
- One-way coupling: `UI → Runtime → Kernel`. The Kernel knows nothing above it.
- All cross-module communication goes through the Event Bus. No back-channels.
- Plugins never bypass the Event Bus.
- Memory does not call Execution; Execution does not read Memory directly (only via
  Context / contracts).
- Merlin (runtime) and Philos (orientation/knowledge) couple **only** through the
  Integration Layer's contracts — neither reaches into the other's internals.

## 9. Authority Model
Who is authorized to decide what. Each domain is **sovereign in its lane**: a
measurement never overrides a value; a personal preference never overrides a fact.
```
USER (Roei)            ENGINEERING              EMPIRICAL (data)
├── Vision             ├── Architecture         ├── Benchmarks
├── Values             ├── APIs / contracts     ├── Experiments
├── Long-term Goals    ├── Runtime              ├── Telemetry
└── Product Direction  ├── Performance design   ├── Measurements
                       └── Implementation       └── A/B results
```
Conflicts across lanes are resolved by scope, not by force: value questions go to
User, design questions to Engineering, "is it actually true/fast/accurate?" to
Empirical. No lane may annul another's verdict inside that other's lane.

---

# PART III — GOVERNANCE

## 10. Decision Taxonomy
Every decision is tagged **[U] / [E] / [M]** (see §9 for authority):
- **[U] User** — vision, values, goals, philosophy. Changed only by Roei.
- **[E] Engineering** — architecture, interfaces, dependencies. Changed by ADR.
- **[M] Empirical** — settled only by measurement/experiment; changed by new data.
This taxonomy prevents mixing personal preference, engineering constraint, and
measured fact — and lets the Constitution grow for years without every technical
change looking like a change of vision.

## 11. Verification Policy
A claim is accepted only via: Claim → Evidence → Sources → Contradiction check →
Confidence. Never assert from intuition or a model's fluent output alone. "It sounds
right" is not Evidence (INV-6).

## 12. Change Control
- Every architectural decision is an **ADR**: Identifier · Context · Alternatives ·
  Decision · Consequences · Review Trigger.
- **RFC-000 changes only** via a new RFC **or** an approved ADR, **with** impact
  analysis and passing checks. Nothing here is silently overwritten.
- Enforcement of the Supremacy clause: any artifact found to contradict RFC-000 is
  revised, or RFC-000 is amended here — never left in silent contradiction.
- `[U]` changed by Roei · `[E]` by ADR · `[M]` by new measurement.

---

## Appendix A — Open items by authority
- **[U] Roei:** meta-goals in his words (§1); canonical Philos source + Merlin↔Philos
  relationship (§3/RFC-000A); hard scope edges (§2); success-intent (§1).
- **[E] Engineering (stands until an ADR revises):** §6–§8, ADR format (§12).
- **[M] Empirical (await data):** success/latency/accuracy thresholds (§1).

## Appendix B — Companion documents (to be created next)
- **RFC-000A — Glossary** (authoritative term definitions). Highest priority after
  this RFC; term drift causes more architectural debt than bad code.
- **RFC-001+** — per-subsystem RFCs, each subordinate to RFC-000.

*RFC-000 v0.2 — 2026-07-31. Three-part structure; Axioms separated from Invariants;
Authority Model added; supremacy clause binding. [U] await Roei · [E] stand until
ADR · [M] await measurement.*
