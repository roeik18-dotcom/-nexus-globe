/**
 * Philos Canon — Persisted Observation → CellState derivation boundary.
 *
 * The first downstream runtime edge from a PERSISTED canon event: reading a
 * `CanonEvent<Observation>` back out of `CanonEventStore` (`canonEventStore.ts`
 * / `canonEventStoreAccessor.ts`, both read again this pass) and producing a
 * `CellState` candidate from it, per canon's §24 generative chain:
 *   `Matter + Gap + Time → Observation → Cell → CellState(Level, Stability) → ...`
 *
 * **Why this is buildable when `learning.ts` explicitly refused an analogous
 * function — read this before anything else.** `learning.ts` (four passes
 * ago) declined to build a function deriving a `CellState` from `Effect`
 * evidence, because canon states no COMBINATION rule for turning MULTIPLE
 * observations of the same cell into one `CellState` (latest wins? weighted
 * average? something else?) — building one would invent exactly the
 * regeneration/aggregation formula canon leaves as an open empirical
 * question (§26). **This module does not face that problem, because it does
 * not combine anything.** Canon §6 already lists `Level, Stability` among an
 * `Observation`'s own required fields — a single `Observation` already
 * CARRIES a `(Level, Stability)` reading. Deriving a `CellState` candidate
 * from ONE `Observation` is therefore a direct, mechanical, 1:1 field
 * projection (`domain`, `frame`, `level`, `stability` copied across) of data
 * canon already says exists — not an invented formula. The distinction is
 * the whole reason this edge is safe to build now and the multi-observation
 * one still is not.
 *
 * **This is a different edge from `learning.ts`'s `Effect → Learning →
 * State'` path, not a competing or overlapping one.** Canon's §24 chain has
 * TWO distinct places a `CellState`-shaped value appears: first, early,
 * as the direct reading of a single `Observation` (this file); later, as
 * `State'`, produced by `Learning` from a VERIFIED `Effect` (`learning.ts`,
 * already built). Nothing here calls into `learning.ts` or vice versa — they
 * are parallel entry points onto the same value shape, not stages of one
 * pipeline this file completes.
 *
 * **Provenance, without adding fields to `CellState` itself**: `CellState`
 * (`cellState.ts`) is deliberately exactly `{domain, frame, level,
 * stability}` — no id, no provenance field, unchanged since it was built.
 * That discipline is preserved here: the derivation's provenance
 * (`source_canon_event_id`, the Observation's own `provenance`/`time`/
 * `confidence`, and its `systemicChannel` when `frame === "S"`) lives in a
 * separate `CellStateDerivationProvenance` record ALONGSIDE the candidate,
 * never merged into it — the same "wrapper carries the metadata, the value
 * type stays pristine" pattern `learning.ts`'s `Learning` record already
 * uses for its own `candidate_state_prime`.
 *
 * **Deterministic, no invented "insufficient evidence" threshold**: the one
 * numeric gate this module applies — `confidence === 0` is treated as
 * insufficient — is the same literal floor-of-an-already-established-scale
 * reasoning `learning.ts` used for its own `"insufficient_evidence"` gate,
 * not a new threshold invented for this file. Expiry is checked against an
 * explicit, CALLER-SUPPLIED `asOf` time (this module has no clock of its
 * own, matching every other pure function in this directory) — never a
 * fabricated staleness window.
 *
 * **What this module does NOT do, on purpose**: no `Need`/`Target`/`Offer`/
 * `Matching` code is imported or exercised — a `CellState` candidate is not
 * a `Need`, and none is manufactured. No `Tension`/`Deficit` inference — the
 * candidate carries only `Level`/`Stability`, never a derived tension value.
 * No cross-frame aggregation — this function addresses exactly one cell,
 * from exactly one Observation, every call. No scoring/ranking. No
 * persistence — this module returns a candidate; nothing here writes a
 * `CellState` anywhere, because no `CellState` store exists yet and none is
 * created this pass ("first prove deterministic derivation," per this
 * pass's own instruction). No legacy event write, no projection, no
 * Dynamics, no UI, no Merlin, no n8n, no Nexus coordinator — none of their
 * modules are imported here. Domain/Transfer naming collisions are not
 * referenced by this file at all, same as every file before it.
 */
import { type CanonEvent, validateCanonEvent } from "./canonEvent";
import type { CanonEventStore } from "./canonEventStore";
import { type CellState, validateCellState } from "./cellState";
import {
  type Domain,
  type Frame,
  parseOffsetInstant,
  type Provenance,
  type SystemicChannel,
} from "./observation";

/**
 * `"canon_event_invalid"` already covers a wrong `canon_type`: `CanonType`
 * (`canonEvent.ts`) has exactly one value, `"observation"`, and
 * `validateCanonEvent` enforces that closed vocabulary as part of
 * structural validity — so nothing can reach this function's own logic with
 * a non-`"observation"` `canon_type` while that remains true. A separate
 * `"not_an_observation_event"` reason was drafted and removed during this
 * pass's own testing: it was unreachable dead code given today's
 * `CanonType`, not a real gate. If `CanonType` ever gains a second value,
 * this function needs its own explicit re-check at that time — not assumed
 * here.
 */
export type CellStateDerivationReason =
  | "canon_event_invalid"
  | "event_not_found"
  | "as_of_unparseable"
  | "zero_confidence"
  | "expired";

/**
 * Traceability, kept separate from `CellState` itself (see module header).
 * Every field here is copied verbatim from the source `Observation`/
 * `CanonEvent` — nothing here is computed or invented.
 */
export interface CellStateDerivationProvenance {
  source_canon_event_id: string;
  source_observation_provenance: Provenance;
  source_observation_time: string;
  source_observation_confidence: number;
  /** Present iff the source Observation's frame === "S" — carried
   *  alongside the candidate exactly because CellState itself has no field
   *  for it (cellState.ts's own, earlier design choice, unchanged here). */
  source_observation_systemic_channel?: SystemicChannel;
}

export type CellStateDerivationResult =
  | { kind: "cell_state"; candidate: CellState; provenance: CellStateDerivationProvenance }
  | { kind: "no_derivation"; reason: CellStateDerivationReason };

/**
 * Pure, deterministic, no I/O, never throws. The candidate's `domain`/
 * `frame`/`level`/`stability` are a direct copy of the source Observation's
 * own fields — never recomputed, never combined with anything else.
 */
export function deriveCellStateFromObservation(
  canonEvent: CanonEvent,
  asOf: string,
): CellStateDerivationResult {
  const eventValidation = validateCanonEvent(canonEvent);
  if (!eventValidation.valid) {
    return { kind: "no_derivation", reason: "canon_event_invalid" };
  }
  // No separate canon_type check here — see the CellStateDerivationReason
  // doc comment above for why validateCanonEvent already makes one redundant.

  const asOfMs = parseOffsetInstant(asOf);
  if (asOfMs === null) {
    return { kind: "no_derivation", reason: "as_of_unparseable" };
  }

  const observation = canonEvent.payload;

  if (observation.confidence === 0) {
    return { kind: "no_derivation", reason: "zero_confidence" };
  }

  const expiryMs = parseOffsetInstant(observation.expiry);
  if (expiryMs === null || expiryMs <= asOfMs) {
    return { kind: "no_derivation", reason: "expired" };
  }

  const candidate: CellState = {
    domain: observation.domain,
    frame: observation.frame,
    level: observation.level,
    stability: observation.stability,
  };

  const candidateValidation = validateCellState(candidate);
  if (!candidateValidation.valid) {
    // Defensive only — a well-formed Observation (already checked above)
    // cannot structurally fail this, since the fields are copied verbatim
    // and Observation's own domain/frame/level/stability checks are a
    // superset of CellState's. Kept as a named path, not a silent
    // impossibility, matching this directory's "never assume, always check"
    // discipline.
    return { kind: "no_derivation", reason: "canon_event_invalid" };
  }

  const provenance: CellStateDerivationProvenance = {
    source_canon_event_id: canonEvent.canon_event_id,
    source_observation_provenance: observation.provenance,
    source_observation_time: observation.time,
    source_observation_confidence: observation.confidence,
    ...(observation.frame === "S" && observation.systemicChannel !== undefined
      ? { source_observation_systemic_channel: observation.systemicChannel }
      : {}),
  };

  return { kind: "cell_state", candidate, provenance };
}

/**
 * The one place this module performs I/O: read the store, find the named
 * event, delegate to the pure function above. Never writes anything.
 */
export async function deriveCellStateForPersistedObservation(
  store: CanonEventStore,
  canon_event_id: string,
  asOf: string,
): Promise<CellStateDerivationResult> {
  const events = await store.load();
  const found = events.find((e) => e.canon_event_id === canon_event_id);
  if (!found) {
    return { kind: "no_derivation", reason: "event_not_found" };
  }
  return deriveCellStateFromObservation(found, asOf);
}
