# Philos Canon — persisted-vs-derived policy

> **Open boundary:** persisting a `Learning` record is NOT the same as
> persisting `State(t+1)`. Nothing in this repository writes a new "current"
> `CellState`, and `deriveLearning` only gates a caller-proposed
> `candidate_state_prime` — a candidate, never a reached state. The five
> unresolved questions behind that gap are recorded, deliberately unsolved,
> in [`STATE-TRANSITION-BOUNDARY.md`](./STATE-TRANSITION-BOUNDARY.md). The
> `prior.level + 1` rule in `valueDomain/valueDomainConfig.ts` is an
> EXISTING/EXPERIMENTAL product rule, quarantined there and in
> `domainStateLearning.ts` — it is not a canonical state transition.

One-line policy: **`Observation` is the only persisted canon primitive.**
Everything downstream of it is either **derived** (computed fresh, every call,
from explicit inputs — never cached, never stored) or **caller-supplied**
(validated, never fabricated, never stored). This is not an oversight; it is
this pass's own explicit, evidence-based decision, re-derived from what each
primitive's own file already established before this document existed.

| Primitive | File | Status | Why |
|---|---|---|---|
| `Observation` | `observation.ts` + `canonEvent.ts`/`canonEventStore.ts` | **PERSISTED** | The only entity with a real store (`CanonEventStore`, JSONL-backed, append-only, idempotent by `canon_event_id`). Read live via `app/api/canon/observations/route.ts` (write) and `.../[canonEventId]/route.ts` (read). |
| `CellState` | `cellState.ts` + `cellStateDerivation.ts` | **DERIVED**, single-Observation only | `deriveCellStateFromObservation` is a pure 1:1 field projection from ONE persisted Observation. No store exists because canon states no combination rule for MULTIPLE Observations of the same cell (latest-wins? weighted average? — genuinely unresolved, §26). Building a store now would force inventing that rule. |
| `Need` | `need.ts` | **CALLER-SUPPLIED**, not persisted | Canon §21's `NO_PERMANENT_DEFICIT_PROFILE` invariant — an "all of a subject's needs" store is exactly what canon forbids becoming a permanent profile. |
| `Target` | `target.ts` | **CALLER-SUPPLIED**, not persisted | Same reasoning as Need; no "all of a subject's targets" aggregate exists or is planned. |
| `Offer` | `offer.ts` | **CALLER-SUPPLIED**, not persisted | Canon §11 states Offer is explicitly "ephemeral / per-match — never a permanent donor-capacity or contribution/reputation profile." Persisting it would create exactly that profile. |
| `MatchResult` | `matching.ts` | **DERIVED** | `evaluateMatch` is a pure boolean gate over a Need+Offer+attempt, recomputed every call. No history of past match attempts is stored (would risk becoming a contribution/reputation signal, §21). |
| `Transfer` (⊂ `Action`) | `action.ts` + `transfer.ts` | **CALLER-SUPPLIED candidate**, never persisted, never executed | A validated candidate only. No store, and — separately, more importantly — no execution path of any kind exists in this codebase's canon layer. Real dispatch is out of scope categorically, not merely unbuilt (see `verticalSlice.ts` header on the Merlin Action Registry boundary). |
| `Action` (PROPOSED ACTION, ACTOR) | `action.ts` + `actionStore.ts` | **PERSISTED**, approved this pass | Explicit approval given for this pass to persist Action/Effect/Learning as the real record of what was proposed/attempted, distinct from `Transfer`'s caller-supplied-candidate role above. `ActionStore` mirrors `needStore.ts`'s discipline exactly — own file (`actions.jsonl`), append-only, `action.action_id` is the real identity. Recording an Action does not execute it and does not imply an Effect (`actionStore.ts` header). |
| `Effect` | `effect.ts` + `effectStore.ts` | **PERSISTED**, approved this pass | Same approval as `Action`. `EffectStore` (`effects.jsonl`) holds both EXPECTED EFFECT (`claimed_outcome`) and OBSERVED EFFECT (`verified_outcome`) as the same record, append-only — a later `verified_outcome` is a NEW record referencing the same `action_ref`, never an in-place edit, so "NO VERIFIED EFFECT != NO EFFECT" stays true on disk, not just in memory. This does not create a forbidden §21 profile: it is a log of individual claimed/verified outcomes, not an aggregated reputation or contribution score. |
| `OutcomeVerification` | `outcomeVerification.ts` | **CALLER-SUPPLIED**, not independently persisted | Embedded inside a persisted `Effect.claimed_outcome`/`verified_outcome` (see `Effect` row); no independent store of its own. |
| `Learning` / `State'` / `StateDelta` | `learning.ts` + `learningStore.ts` + `stateDelta.ts` | **PERSISTED** (`Learning` + computed `StateDelta`), gated; approved this pass | `deriveLearning` itself is unchanged — still never computes a candidate Level/Stability, only gates a caller-proposed one (§26's regeneration premise stays an open empirical assumption). What's new: the gated result (`state_prime` or `no_update`) is now durably recorded via `learningStore.ts`, and `LearningRecord.delta` — a strictly descriptive `computeStateDelta(prior, state_prime)` — is computed once at record-creation time and stored alongside it (never inside canon's own `Learning` type). `delta: null` for every `no_update` Learning is a real, meaningful, persisted value, not "not computed". This is still not a `CellState` store: nothing here writes a new "current" CellState anywhere — see the `CellState` row above, unchanged. |

## Ratified schema addition — `Effect.observed_in_ref` (2026-08-19)

The temporal chain could express `Action -> Observation(t0)` (via
`Action.inputs`, already read that way by `CausalChainFlow`) but had **no
way to express the other half**: which Observation recorded what happened
*after*. Two real observations could therefore be compared, but a change
could never be attributed to an Action, because no record said the second
observation was the one that observed this Effect.

`Effect.observed_in_ref?: string` closes exactly that gap and nothing more.

- **On `Effect`, not on `Observation`** — an Observation is a MEASUREMENT;
  giving it a pointer at an Action would place a causal claim inside a
  measurement record, and canon §6 already defines `Observation.reference`
  as the baseline a Level was measured against, not a record link. `Effect`
  is already the chain's linking record (it carries `action_ref`).
- **Optional, load-bearing** — every Effect recorded before this field
  existed stays structurally valid. Absent means "no Observation recorded
  this outcome", a real state, never a default.
- **Checked, not trusted** — `actionLifecycle.ts::recordEffect` rejects an
  `observed_in_ref` that does not name a real, already-stored Observation,
  with the same discipline it already applies to `action_ref`.
- **Grants no change claim** — it says which Observation recorded the
  outcome. Whether anything changed still requires the comparison to find a
  real difference, and whether that difference is a state transition is
  still governed by [`STATE-TRANSITION-BOUNDARY.md`](./STATE-TRANSITION-BOUNDARY.md),
  which remains open.

## The rule this table encodes

A primitive gets its own store only when **both** are true:
1. Canon states (or a prior, explicitly-approved pass established) a concrete,
   non-invented rule for how repeated writes combine or supersede each other.
2. Persisting it would not, by itself, create one of canon §21's forbidden
   shapes (a permanent profile, a contribution counter, a reputation score).

`Observation` clears both bars on its own: canon's append-only,
reject-on-duplicate-id semantics (§21's `NO_PERMANENT_...` invariants are
about *derived judgments*, not raw measurements) are already fully specified,
and a log of individual, timestamped, expiring measurements is not itself a
profile or a score. `Action`/`Effect`/`Learning` clear both bars by explicit
approval this pass: each is an append-only log of individual, timestamped
records (never an edit-in-place, never an aggregate), and each store's own
header (`actionStore.ts`, `effectStore.ts`, `learningStore.ts`) states plainly
what it does not do — no execution, no cross-store inference, no fabricated
delta — to keep clear of §21's forbidden shapes.

Every other primitive (`Need`, `Target`, `Offer`, `MatchResult`,
`OutcomeVerification`, `CellState`) still fails bar (1), bar (2), or both —
each file above documents its own specific reason, this table just collects
them in one place. Adding a store for any of them is separate, future, and
needs its own explicit approval — same discipline this pass's own
Action/Effect/Learning approval followed.

## Consuming this policy

Two live orchestrators read across this table today. `verticalSlice.ts`
reads the persisted `Observation`, derives `CellState` from it, and threads
caller-supplied `Need`/`Target`/`Offer`/`Transfer`/`Effect`/`Learning` params
through the rest of canon's §24 chain — writing nothing beyond the one
`Observation` read; see its own header for the full transition-by-transition
provenance trail. `actionLifecycle.ts` is the second, newer orchestrator: it
reads/writes the three stores added this pass (`actionStore.ts`,
`effectStore.ts`, `learningStore.ts`), enforcing referential integrity
between them (an Effect's `action_ref`, a Learning's `effect_ref`) purely via
explicit id lookups against the real store — never via recency or storage
order (CHRONOLOGY != CAUSALITY, its own header's term for this). The two
orchestrators are not yet wired together — `verticalSlice.ts` does not call
into `actionLifecycle.ts` or vice versa; that integration is separate,
open work.
