/**
 * Philos Canon — CanonEvent: the Observation → event-representation edge.
 *
 * This is the ONE integration edge approved after the read-only
 * canon→live-system audit: representing a canon `Observation`
 * (`observation.ts`, PHILOS-MELTING-POT-CANON.md §6) as event-shaped data,
 * structurally parallel to `PhilosEvent` (`../events.ts`), **without
 * importing from, extending, or modifying `events.ts` in any way.**
 *
 * **Why a wholly separate file, not an addition to the existing `EventType`
 * union:** `events.ts`'s `EventType` (16 values) and `EntityType` (5 values)
 * are live-depended-upon by `projectValueGroup.ts`, `projectDynamics.ts`,
 * `projectGlobeGraph.ts`, and 7 live-route files. Extending that union is a
 * materially riskier edit than proving this integration edge works at all —
 * and, per the prior audit, this repository already carries two live naming
 * collisions this file must not paper over:
 *
 *   1. **`Domain`**: `observation.ts` exports `Domain = "G"|"E"|"C"`;
 *      `projectDynamics.ts` separately exports `Domain =
 *      "people"|"community"|"activity"|"resources"|"impact"`. This file
 *      imports `Domain` (and `Frame`) **only** from `./observation` — it
 *      does not import, alias, rename, or otherwise touch
 *      `projectDynamics.ts`'s `Domain` at all. The collision is real,
 *      unresolved, and **not hidden by this file** — it simply isn't
 *      encountered here, because this file never imports the other export.
 *   2. **`Transfer`**: `canon/transfer.ts`'s `Transfer extends Action` and
 *      `projectValueGroup.ts`'s `TransferView` (a money-ledger UI
 *      projection) share only a name. This file does not reference either
 *      one — Transfer event representation is explicitly out of scope this
 *      pass (see the mission's own exclusion list).
 *
 * **Canonical Observation semantics preserved exactly**: `CanonEvent.payload`
 * is typed as the real `Observation` interface, re-used verbatim — not a
 * restructured, renamed, or field-subset copy. `validateCanonEvent`
 * delegates to `validateObservation` for the payload rather than
 * re-implementing any of its checks, the same "run the inner validator,
 * don't duplicate" discipline used throughout this directory (`transfer.ts`
 * calling `validateAction`, `effect.ts` calling `validateOutcomeVerification`,
 * etc.).
 *
 * **`recorded_at` vs. `Observation.time`, deliberately distinct**:
 * `Observation.time` is when the measurement itself occurred (canon §6).
 * `CanonEvent.recorded_at` is when this event-representation record was
 * created — potentially later than `time` (e.g. a delayed write). No
 * ordering constraint is enforced between them here — canon does not state
 * one, and inventing one would be exactly the kind of unsupported addition
 * this whole series avoids.
 *
 * **Scope, exactly as approved**: `canon_type` is a single-value literal
 * union (`"observation"`) this pass — not a placeholder for future values
 * silently pre-declared. Extending it to CellState/Need/Target/Offer/
 * Matching/Action/Transfer/Effect/Learning is separate, future,
 * explicitly-approved work, one primitive at a time, matching how every
 * other edge in this series was scoped.
 *
 * **No store wiring, no projection, no UI, no Merlin, no n8n — by design,
 * this pass.** This file has zero side effects: `validateCanonEvent` is a
 * pure function; nothing here calls `eventStore.ts`, `philos-event-store.ts`,
 * or any live route. "Event-store compatibility" is proven structurally
 * (id/type/payload/timestamp shape, immutability discipline, no field-name
 * collision with `PhilosEvent`) — never by actually appending anything
 * anywhere.
 *
 * Anti-ranking scope note (canon §21), matching every other file in this
 * directory: no scoring, ranking, aggregation, or persistence exists here.
 */
import {
  type Observation,
  type ObservationError,
  parseOffsetInstant,
  validateObservation,
} from "./observation";

/**
 * Single-value literal this pass — see module header. A `CanonEvent` is
 * event-SHAPED data about a canon primitive; it is not, and does not claim
 * to be, a `PhilosEvent` (`../events.ts`) or a member of its `EventType`
 * union.
 */
export type CanonType = "observation";

export interface CanonEvent {
  canon_event_id: string;
  canon_type: CanonType;
  /** The real `Observation` type, re-used verbatim — no field renamed, dropped, or added. */
  payload: Observation;
  /** When this event-representation record was created — distinct from `payload.time`. */
  recorded_at: string;
}

export type CanonEventError =
  | { field: "canon_event_id"; reason: "empty" }
  | { field: "canon_type"; reason: "invalid" }
  | { field: "recorded_at"; reason: "invalid_or_no_offset" }
  | { field: "payload"; reason: "not_an_object" }
  | { field: "payload"; reason: "invalid"; errors: ObservationError[] };

export interface ValidationResult {
  valid: boolean;
  errors: CanonEventError[];
}

const CANON_TYPES: CanonType[] = ["observation"];

function nonEmpty(s: unknown): s is string {
  return typeof s === "string" && s.trim() !== "";
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/**
 * Pure, deterministic, structural validator. Never throws — a malformed
 * `payload` (including `undefined`/non-object) is guarded before delegating
 * to `validateObservation`, matching the fix already applied to
 * `effect.ts::validateEffect` for the same class of bug. All applicable
 * checks run without short-circuiting.
 */
export function validateCanonEvent(e: CanonEvent): ValidationResult {
  const errors: CanonEventError[] = [];

  // Guard the top-level argument itself, not just its fields — a
  // null/undefined/non-object `e` must still return typed errors, never
  // throw. (Stricter than any other validator in this directory checks for
  // explicitly, but consistent with all of them in spirit — closing the gap
  // here rather than leaving it as an unexamined edge case.)
  if (!isObject(e)) {
    return {
      valid: false,
      errors: [
        { field: "canon_event_id", reason: "empty" },
        { field: "canon_type", reason: "invalid" },
        { field: "recorded_at", reason: "invalid_or_no_offset" },
        { field: "payload", reason: "not_an_object" },
      ],
    };
  }

  if (!nonEmpty(e.canon_event_id)) {
    errors.push({ field: "canon_event_id", reason: "empty" });
  }

  if (!CANON_TYPES.includes(e.canon_type)) {
    errors.push({ field: "canon_type", reason: "invalid" });
  }

  const recordedAtMs = parseOffsetInstant(e.recorded_at);
  if (recordedAtMs === null) {
    errors.push({ field: "recorded_at", reason: "invalid_or_no_offset" });
  }

  if (!isObject(e.payload)) {
    errors.push({ field: "payload", reason: "not_an_object" });
  } else {
    const payloadResult = validateObservation(e.payload);
    if (!payloadResult.valid) {
      errors.push({ field: "payload", reason: "invalid", errors: payloadResult.errors });
    }
  }

  return { valid: errors.length === 0, errors };
}
