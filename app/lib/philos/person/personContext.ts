/**
 * PHILOS — PersonContext: the frame a reading is relative to (STEP 2).
 *
 * Contract: `PHILOS-PERSON-CONTRACT.md` §3, grounded in canon §19:
 *
 *   `P = P(person, reference_group, context, time)`
 *
 * A Level without a stated reference is not interpretable. Today every
 * surface renders `רגש −1` with no frame at all, which reads as an absolute
 * fact about a person. It is not: it is a signed difference from a stated
 * reference (canon §4, `signed(observed − reference(frame))`).
 *
 * ── WHAT THIS ADDS, AND WHAT IT DOES NOT ─────────────────────────────────
 *
 * It adds **no measurement and no store**. It carries two things that are
 * already real, plus one that honestly is not:
 *
 *   `reference`        REAL — `Observation.reference`, a required canon §6
 *                      field already persisted on every record. Today it is
 *                      loaded and then discarded before the screen.
 *   `as_of`            REAL — the caller's own clock reading.
 *   `reference_group`  **UNKNOWN, always, today.** No store records one.
 *                      Canon §20 requires it to be explicit and contestable
 *                      by the subject; canon §21 `NO_DEFAULT_REFERENCE_GROUP`
 *                      forbids inventing one. So it renders as the word
 *                      UNKNOWN — never omitted, never filled.
 *
 * Making the absence visible IS the deliverable. A number whose frame is
 * unstated is worse than a number whose frame is stated as unknown.
 *
 * `context` is `Observation.context` — the verbatim text the measurement was
 * taken in. Never summarized, never rewritten here.
 */
import type { PersonRef } from "./personRef";

/** Why a reference group is absent. Only one value is reachable today; the
 *  type exists so a future real store does not need a new shape. */
export type ReferenceGroupStatus = "UNKNOWN_NO_STORE" | "DECLARED" | "CONTESTED";

export interface PersonContext {
  /** The subject this frame belongs to — always a resolved `PersonRef`. */
  person_id: string;
  /**
   * The explicit, contestable reference group a Level is measured against
   * (canon §19/§20). `null` = genuinely none recorded. **Never defaulted.**
   */
  reference_group: string | null;
  /** Why `reference_group` is what it is — stated, never implied. */
  reference_group_status: ReferenceGroupStatus;
  /**
   * `Observation.reference` — WHAT the Level was measured against, verbatim
   * (canon §6). `null` = no Observation resolved for this frame.
   * Distinct from a `Target` (canon §8), which this module neither reads
   * nor requires.
   */
  reference: string | null;
  /** `Observation.context` — the verbatim situation text. `null` = none. */
  context: string | null;
  /** The clock reading this frame was assembled at. */
  as_of: string;
}

/**
 * The ONE resolver for "what frame is this screen's reading relative to".
 *
 * Pure and synchronous — no store read, no canon projection. The caller
 * passes the Observation fields it has already loaded; this module never
 * fetches.
 *
 * `reference_group` is hard-coded to `null` / `UNKNOWN_NO_STORE` because no
 * store records one. That is not a placeholder to fill in later by guessing
 * — it is the honest current state, and canon §21 forbids a default.
 */
export function resolvePersonContext(params: {
  person: PersonRef;
  /** `Observation.reference` from the record the screen is showing. */
  reference?: string | null;
  /** `Observation.context` from that same record. */
  context?: string | null;
  asOf: string;
}): PersonContext {
  return {
    person_id: params.person.person_id,
    reference_group: null,
    reference_group_status: "UNKNOWN_NO_STORE",
    reference: params.reference ?? null,
    context: params.context ?? null,
    as_of: params.asOf,
  };
}
