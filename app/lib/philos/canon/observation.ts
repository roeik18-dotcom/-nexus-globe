/**
 * Philos Canon — Observation (PHILOS-MELTING-POT-CANON.md §6).
 *
 * Observation is a measurement of a cell, never a property of the person (§6).
 * This is the FIRST entity in the canon's own generative chain (§24):
 *   Matter + Gap + Time → Observation → Cell → CellState(Level, Stability) → ...
 * Nothing downstream of Observation is built here — no CellState, Need, Target,
 * Offer, Matching, Action, Transfer, Effect, Learning, or Pattern/Syndrome type
 * exists in this module. Adding them is separate, future, explicitly-approved
 * work, in canon's own dependency order.
 *
 * Type-boundary note (canon §25): `Person ≠ Observation ≠ CellState ≠ ...`.
 * Canon §6 lists `Level, Stability, DeficitType` among an Observation's required
 * fields, so an Observation CARRIES a Level/Stability reading — but carrying that
 * data does not make an Observation a CellState. A standalone `CellState` type is
 * intentionally not created here; it is the next canon primitive in the chain,
 * not this one.
 *
 * Deliberately separate from `app/lib/philos/{events,eventStore}.ts` — the
 * existing event-sourced Value Group system. The two vocabularies are disjoint by
 * design (confirmed by grep in this engagement's audits: zero shared terms) and
 * must not be merged. This module imports nothing from that system and is not
 * imported by it.
 *
 * Anti-ranking scope note (canon §21): this module is a single-record schema and
 * validator ONLY. It defines no aggregation, scoring, ranking, or cross-observation
 * comparison of any kind — building one would risk exactly what canon §21 forbids
 * (`NO_GLOBAL_PERSON_SCORE`, `NO_CROSS_FRAME_AGGREGATION`, ...), and is out of
 * scope for "Observation," which canon defines as a single measurement.
 */

// ── 3×3 state space (canon §3) ──────────────────────────────────────────────
// Canon-Domain: physical/emotional/cognitive kind of state. NEVER confuse with
// Event-Domain (the 9 event-log categories in projectDynamics.ts) or Merlin-Domain
// (the 7 voice-gateway routing categories) — see PHILOS-COLOR-SYSTEM-MASTER.md
// Part II for the three-way collision this repo already has around "Domain".
import {
  ANALYSIS_UNIT_IDS, type AnalysisUnitId, isAnalysisUnitId,
} from "../analysisUnitIds";

export type Domain = "G" | "E" | "C";

/** Frame: reference space (canon §3). */
export type Frame = "I" | "R" | "S";

/** canon §6. */
export type Provenance = "self_reported" | "inferred" | "third_party";

/** canon §5. */
export type DeficitType = "RELATIVE" | "OBJECTIVE";

/** canon §18 — required only when frame === "S". */
export type SystemicChannel =
  | "institutional"
  | "material"
  | "economic"
  | "informational"
  | "environmental"
  | "other";

/**
 * canon §6. Required fields per canon's own text: "subject/entity, domain, frame,
 * reference, context, time, provenance, confidence, expiry (+ Level, Stability,
 * DeficitType, and SystemicChannel when frame = S)."
 */
export interface Observation {
  subject: string;
  domain: Domain;
  frame: Frame;
  /** What Level is measured against — distinct from Target (canon §8). */
  reference: string;
  context: string;
  /** ISO 8601 with an explicit offset — see parseOffsetInstant below. */
  time: string;
  provenance: Provenance;
  /** Measurement metadata, never part of a human's value (canon §6). */
  confidence: number;
  /** ISO 8601 with an explicit offset — observations decay/expire (canon §21). */
  expiry: string;
  /**
   * signed(observed − reference(frame)) (canon §4). Canonically numeric — the
   * canon text itself says "signed deficit ← equilibrium → surplus."
   */
  level: number;
  /**
   * How well the state persists or destabilizes over time (canon §4). Canon
   * does NOT specify Stability's scale, units, or bounds — that is genuinely
   * unresolved in the canon text. This module does not invent one: `stability`
   * is typed as a finite number only, with no asserted range. Do not read a
   * bounded/normalized scale into this field; none is canon-cited.
   */
  stability: number;
  deficitType: DeficitType;
  /**
   * WHICH ANALYSIS UNITS A PERSON EXPLICITLY SAID THIS OBSERVATION BEARS ON.
   *
   * A SELECTION, NOT A MEASUREMENT. Listing a unit here means "this
   * observation is relevant to this unit" and nothing further — not that the
   * unit was measured, not a direction, not a magnitude, not a confidence,
   * and not a judgement about the person. Nothing reads this field and infers
   * a value from it.
   *
   * OPTIONAL, AND OLD RECORDS STAY VALID. Every Observation written before
   * this field existed simply has no key here; `validateObservation` treats
   * absent and empty identically, so no stored record became invalid when
   * this was added.
   *
   * NEVER DERIVED. There is no code path that fills this from `context`,
   * `domain`, `frame` or any keyword: a unit appears here because a human
   * ticked it, or it does not appear.
   *
   * The id type comes from `../analysisUnitIds`, a neutral module, so canon
   * does not depend on the synthesis layer that gives these units meaning.
   */
  analysis_unit_ids?: AnalysisUnitId[];
  /** Required iff frame === "S" (canon §18); optional and unconstrained otherwise
   *  — canon requires it FOR S, it does not forbid it elsewhere, and this
   *  validator does not invent a prohibition canon never states. */
  systemicChannel?: SystemicChannel;
}

/** The closed set of things that can be wrong with an Observation. */
export type ObservationError =
  | { field: "subject"; reason: "empty" }
  | { field: "domain"; reason: "invalid" }
  | { field: "frame"; reason: "invalid" }
  | { field: "reference"; reason: "empty" }
  | { field: "context"; reason: "empty" }
  | { field: "time"; reason: "invalid_or_no_offset" }
  | { field: "provenance"; reason: "invalid" }
  | { field: "confidence"; reason: "not_a_probability" }
  | { field: "expiry"; reason: "invalid_or_no_offset" }
  | { field: "expiry"; reason: "not_after_time" }
  | { field: "level"; reason: "not_finite" }
  | { field: "stability"; reason: "not_finite" }
  | { field: "deficitType"; reason: "invalid" }
  | { field: "systemicChannel"; reason: "required_when_frame_is_S" }
  | { field: "systemicChannel"; reason: "invalid" }
  | { field: "analysis_unit_ids"; reason: "not_an_array" }
  | { field: "analysis_unit_ids"; reason: "unknown_id" }
  | { field: "analysis_unit_ids"; reason: "duplicate_id" }
  | { field: "analysis_unit_ids"; reason: "too_many" };

export interface ValidationResult {
  valid: boolean;
  errors: ObservationError[];
}

const DOMAINS: Domain[] = ["G", "E", "C"];
const FRAMES: Frame[] = ["I", "R", "S"];
const PROVENANCES: Provenance[] = ["self_reported", "inferred", "third_party"];
const DEFICIT_TYPES: DeficitType[] = ["RELATIVE", "OBJECTIVE"];
/**
 * Exported so `need.ts`/`target.ts` (and any future canon module needing the
 * closed SystemicChannel vocabulary, canon §18) reuse this single literal list
 * rather than each re-declaring their own copy, which would risk silent drift
 * between copies. No behavior change to Observation itself.
 */
export const SYSTEMIC_CHANNELS: SystemicChannel[] = [
  "institutional",
  "material",
  "economic",
  "informational",
  "environmental",
  "other",
];

/**
 * Requires an explicit `Z`/`±HH:MM` offset and a parseable instant — the same
 * hardening `eventCausality.ts`'s `parent_after_child` check applies to
 * `PhilosEvent.timestamp`, reused here for the same reason: an offsetless
 * timestamp reads in the host timezone (non-deterministic); an unparseable one
 * silently no-ops a comparison. Neither is acceptable for a canon-cited field.
 * Exported for reuse by `need.ts`/`target.ts` — same time/expiry discipline,
 * one implementation.
 */
export function parseOffsetInstant(s: unknown): number | null {
  if (typeof s !== "string" || !/(Z|[+-]\d{2}:\d{2})$/.test(s)) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

/**
 * Pure, deterministic validator. No I/O, never throws — every malformed input
 * yields a typed error, per the "never crash, never fake" discipline already
 * established for `eventCausality.ts`'s `validateCausality()`. All applicable
 * checks run; errors are not short-circuited, so a caller sees every problem at
 * once rather than fixing one field per re-submission.
 */
export function validateObservation(o: Observation): ValidationResult {
  const errors: ObservationError[] = [];

  /* ANALYSIS UNITS — optional. Absent and empty are the same thing, which is
     what keeps every Observation written before this field existed valid.
     Present means it must be a real array of real ids, each once. */
  if (o.analysis_unit_ids !== undefined) {
    if (!Array.isArray(o.analysis_unit_ids)) {
      errors.push({ field: "analysis_unit_ids", reason: "not_an_array" });
    } else {
      if (o.analysis_unit_ids.length > ANALYSIS_UNIT_IDS.length) {
        errors.push({ field: "analysis_unit_ids", reason: "too_many" });
      }
      if (o.analysis_unit_ids.some((id) => !isAnalysisUnitId(id))) {
        errors.push({ field: "analysis_unit_ids", reason: "unknown_id" });
      }
      if (new Set(o.analysis_unit_ids).size !== o.analysis_unit_ids.length) {
        errors.push({ field: "analysis_unit_ids", reason: "duplicate_id" });
      }
    }
  }

  if (typeof o.subject !== "string" || o.subject.trim() === "") {
    errors.push({ field: "subject", reason: "empty" });
  }

  if (!DOMAINS.includes(o.domain)) {
    errors.push({ field: "domain", reason: "invalid" });
  }

  if (!FRAMES.includes(o.frame)) {
    errors.push({ field: "frame", reason: "invalid" });
  }

  if (typeof o.reference !== "string" || o.reference.trim() === "") {
    errors.push({ field: "reference", reason: "empty" });
  }

  if (typeof o.context !== "string" || o.context.trim() === "") {
    errors.push({ field: "context", reason: "empty" });
  }

  const timeMs = parseOffsetInstant(o.time);
  if (timeMs === null) {
    errors.push({ field: "time", reason: "invalid_or_no_offset" });
  }

  if (!PROVENANCES.includes(o.provenance)) {
    errors.push({ field: "provenance", reason: "invalid" });
  }

  if (
    typeof o.confidence !== "number" ||
    !Number.isFinite(o.confidence) ||
    o.confidence < 0 ||
    o.confidence > 1
  ) {
    errors.push({ field: "confidence", reason: "not_a_probability" });
  }

  const expiryMs = parseOffsetInstant(o.expiry);
  if (expiryMs === null) {
    errors.push({ field: "expiry", reason: "invalid_or_no_offset" });
  } else if (timeMs !== null && expiryMs <= timeMs) {
    errors.push({ field: "expiry", reason: "not_after_time" });
  }

  if (typeof o.level !== "number" || !Number.isFinite(o.level)) {
    errors.push({ field: "level", reason: "not_finite" });
  }

  if (typeof o.stability !== "number" || !Number.isFinite(o.stability)) {
    errors.push({ field: "stability", reason: "not_finite" });
  }

  if (!DEFICIT_TYPES.includes(o.deficitType)) {
    errors.push({ field: "deficitType", reason: "invalid" });
  }
  // canon §5: OBJECTIVE requires an explicit critical threshold and "must never
  // be inferred from group norms." Whether a given `reference` string names a
  // threshold versus a group norm is a semantic judgment a type validator cannot
  // mechanically decide — flagged here rather than falsely asserted as enforced.
  // The only mechanically checkable part (that `reference` is non-empty) is
  // already covered by the general `reference` check above; no separate
  // OBJECTIVE-specific rule is invented on top of it.

  if (o.frame === "S") {
    if (o.systemicChannel === undefined) {
      errors.push({ field: "systemicChannel", reason: "required_when_frame_is_S" });
    } else if (!SYSTEMIC_CHANNELS.includes(o.systemicChannel)) {
      errors.push({ field: "systemicChannel", reason: "invalid" });
    }
  } else if (
    o.systemicChannel !== undefined &&
    !SYSTEMIC_CHANNELS.includes(o.systemicChannel)
  ) {
    // Not required outside frame=S, but if present it must still be one of the
    // six declared values — canon §18's closed vocabulary applies whenever the
    // field is used, not only when it is mandatory.
    errors.push({ field: "systemicChannel", reason: "invalid" });
  }

  return { valid: errors.length === 0, errors };
}
