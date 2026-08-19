# PHILOS — the Learning / State(t+1) boundary

**Status: OPEN. This document RECORDS the problem. It does not solve it.**
Nothing below is canon, and nothing below may be cited as an answer. Every
one of the five questions in §3 is marked UNRESOLVED deliberately; a future
canon task resolves them, with its own authority.

## 1. The ruling this document implements

The current authoritative runtime truth is:

```
Observation / State(t0)
  → Action
  → Effect
  → OutcomeVerification
  → [ Learning / State′ transition boundary ]
  → UNKNOWN
```

A VERIFIED Effect proves an **Effect outcome, according to its own
verification record**. By itself it does **not** prove:

- Learning
- a changed Level
- a changed Stability
- State(t+1)
- `prior.level + 1`
- any other state transition

An accepted `candidate_state_prime` (`learning.ts`) remains a **CANDIDATE**.
It is not State(t+1), and no code path turns it into one.

## 2. What the repository actually contains today (evidence, not opinion)

| Fact | Where it is verifiable |
|---|---|
| `Observation` is the only canon primitive with a "current state" meaning, and `CellState` is DERIVED 1:1 from a single Observation — no store, because canon states no rule for combining multiple Observations of one cell | `PERSISTENCE_POLICY.md`, `cellStateDerivation.ts` |
| `deriveLearning` never computes a Level/Stability. It only GATES a caller-proposed candidate, by explicit design, because canon §26 keeps the regeneration premise an open empirical assumption | `learning.ts` module header + implementation |
| The gated result is named `candidate_state_prime` — candidate, in the type | `learning.ts::LearningResult` |
| Nothing writes a new "current" `CellState` anywhere | `PERSISTENCE_POLICY.md` (CellState row), absence of any CellState store |
| `learnings.jsonl` does not exist on disk; the real store holds 1 Action, 1 verified Effect, 0 Learning records | `.philos-canon-data/` |
| A separate, EXISTING product rule does advance a `DomainState.level` by `prior.level + 1` | `valueDomain/valueDomainConfig.ts::deriveDomainStateUpdate`, called by `canon/domainStateLearning.ts` |
| That rule is QUARANTINED, not canon, and not deleted | headers of `domainStateLearning.ts`, `domainStateLearningAction.ts`, `deriveDomainStateUpdate` |

`DomainState` and `CellState` are also **different objects**, and the
difference is the reason the DomainState track cannot simply be promoted:
`DomainState` carries `subject`, `domain_id`, `parameter_id`;
canon's `CellState` is exactly `(domain, frame, level, stability)` and
carries **no subject** at all (canon §4; `cellState.ts`).

## 3. The five unresolved questions

### Q1 — SUBJECT BINDING · UNRESOLVED
How is a `CellState` associated with a subject without violating
`Person ≠ CellState`? `CellState` has no subject field by canon-literal
design; the subject travels alongside it (on the `Observation`, on the
`Effect`, on the `Action.owner`) as a sibling value. A stored State(t+1)
needs a binding that does not turn a cell reading into a person profile
(canon §21's forbidden shapes) and does not silently re-type `CellState`.

### Q2 — PERSISTENCE · UNRESOLVED
What record/store represents State(t+1)? What is its append / supersede /
history behavior? No `CellState` store exists, and creating one currently
forces inventing the multi-Observation combination rule canon does not
state (latest-wins? weighted? per-frame?) — the same bar
`PERSISTENCE_POLICY.md` already applies to every other primitive.

### Q3 — TRANSITION AUTHORITY · UNRESOLVED
What evidence is SUFFICIENT to permit a state update? `isEffectVerified`
is a real, tested threshold for whether an *Effect* is verified. Whether a
verified Effect is sufficient authority for a *state* update is a
different, unanswered question — and canon's own §26 framing says it must
be measured, not asserted.

### Q4 — UPDATE RULE · UNRESOLVED
How is the new Level/Stability obtained, without inventing `prior.level + 1`
or any other unsupported aggregation formula? Canon states no update rule.
`deriveLearning` refuses to supply one. `deriveDomainStateUpdate`'s `+1` is
a product-level increment and is explicitly NOT the answer to this
question.

### Q5 — OBSERVATION RELATION · UNRESOLVED
Does State(t+1) require a NEW Observation/measurement, or may a verified
Effect produce a candidate that must LATER be observed? Today the second
reading of the same cell is simply another Observation — a measurement,
not a transition — and the system has no way to say which of the two
models it is following.

## 4. Rules that hold while this stays open

1. No surface renders State(t+1) as reached. `STATE(t1)` renders UNKNOWN
   with the reason, never a re-shown Observation. (`CausalChainFlow.tsx`,
   `DynamicsView.tsx::ActionEffectLearningFlow`.)
2. No surface infers Learning from a verified Effect. Learning is UNKNOWN /
   0 unless a real Learning record exists. (`brainDerivation.ts`,
   `CanonicalBrainPanel.tsx`, `BrainV2.tsx`.)
3. `prior.level + 1` is never presented as canonical, on any surface.
4. The full chronology stays visible. The stages are the intended model;
   the missing bridge is shown, not hidden by deleting stages.
5. No Learning or State(t+1) record is fabricated to make the loop look
   complete, and no existing real record is altered.

## 5. What resolving this requires

An explicit canon decision — a change to locked canon and/or a new
persistence schema — which is outside any implementation pass's authority.
Until then, this file is the record, and the boundary stays open and
visible.
