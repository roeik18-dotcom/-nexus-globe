/**
 * Philos Canon — CellState (PHILOS-MELTING-POT-CANON.md §4).
 *
 * `CellState = (Level, Stability)` — locked. **Tension is explicitly NOT part of
 * CellState** (§4) — Tension is a derived relation computed in the Interpretation
 * layer (§7) from `(CellState, Target)`. This module does not add a `tension`
 * field, and never will without reopening §4 — the exclusion is cited, not
 * accidental.
 *
 * Second entity in canon's generative chain (§24):
 *   Matter + Gap + Time → Observation → Cell → CellState(Level, Stability) → ...
 * A "Cell" is identified by (Domain, Frame) per the locked 3×3 (§3) — nine cells,
 * no fourth Domain.
 *
 * Scope, matching observation.ts's discipline exactly: this module adds ONLY the
 * CellState value type + its validator. It deliberately does NOT add a function
 * that derives/aggregates a CellState from one or more Observations. Canon states
 * what an Observation carries (§6, including its own Level/Stability reading)
 * and what CellState IS (§4), but never states a combination rule for turning
 * multiple Observations of the same cell into one CellState — latest wins,
 * weighted average, confidence-weighted, or something else is never specified.
 * Inventing one here would be exactly the "silent aggregation" this engagement's
 * rules forbid. That derivation, if ever built, needs its own canon citation or
 * an explicit PROPOSED design pass — not assumed in this file.
 *
 * Field-boundary note (§25 type boundary, `Person ≠ Observation ≠ CellState`):
 * `Observation` carries `subject` because canon §6 lists it as a required
 * Observation field. Canon's CellState definition (§4) is literally the bare
 * pair "(Level, Stability)" — no subject field is stated. This module keeps
 * that asymmetry as written rather than inventing a subject binding onto
 * CellState that canon's own locked definition does not carry; a CellState
 * here describes a cell's state, addressed by (Domain, Frame), not a person's.
 * Whether/how a CellState is ever tied back to a specific subject is left to
 * whatever future, explicitly-approved layer needs that link (most likely
 * Observation → CellState derivation itself) — not decided here.
 *
 * Anti-ranking scope note (canon §21), same as observation.ts: no aggregation,
 * scoring, or ranking of any kind is defined here. A single cell's (Level,
 * Stability) pair is not a person score and this module provides no mechanism
 * to turn it into one (no summing across cells, no comparison across subjects).
 */
import type { Domain, Frame } from "./observation";

/**
 * canon §4. Deliberately exactly `{ domain, frame, level, stability }` — no
 * `tension` (excluded by name above), no `subject` (see field-boundary note),
 * no `confidence`/`provenance`/`expiry` (those are Observation-level metadata,
 * §6, not CellState fields, §4 — keeping them separate is the point of the
 * type boundary, not an oversight).
 */
export interface CellState {
  /** Which of the 9 cells this state describes — half the (Domain, Frame) pair. */
  domain: Domain;
  frame: Frame;
  /**
   * signed(observed − reference(frame)) (§4). "Every Level is relative to
   * reference, context, target, time" per canon's own text — but those are
   * properties of the OBSERVATION(S) that produced this reading, not fields of
   * CellState itself; canon's locked CellState definition carries only the
   * resulting number, not its provenance chain.
   */
  level: number;
  /**
   * How well the state persists or destabilizes over time (§4). Canon does not
   * specify Stability's scale, units, or bounds — same unresolved gap already
   * flagged in observation.ts. Not invented here either: `stability` is typed
   * as a finite number only, no asserted range.
   */
  stability: number;
}

export type CellStateError =
  | { field: "domain"; reason: "invalid" }
  | { field: "frame"; reason: "invalid" }
  | { field: "level"; reason: "not_finite" }
  | { field: "stability"; reason: "not_finite" };

export interface ValidationResult {
  valid: boolean;
  errors: CellStateError[];
}

const DOMAINS: Domain[] = ["G", "E", "C"];
const FRAMES: Frame[] = ["I", "R", "S"];

/**
 * Pure, deterministic validator. No I/O, never throws, all applicable checks
 * run without short-circuiting — same discipline as validateObservation().
 */
export function validateCellState(c: CellState): ValidationResult {
  const errors: CellStateError[] = [];

  if (!DOMAINS.includes(c.domain)) {
    errors.push({ field: "domain", reason: "invalid" });
  }

  if (!FRAMES.includes(c.frame)) {
    errors.push({ field: "frame", reason: "invalid" });
  }

  if (typeof c.level !== "number" || !Number.isFinite(c.level)) {
    errors.push({ field: "level", reason: "not_finite" });
  }

  if (typeof c.stability !== "number" || !Number.isFinite(c.stability)) {
    errors.push({ field: "stability", reason: "not_finite" });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * The 9-cell identity set (§3) — exactly the 3×3 product, no fourth Domain, no
 * fifth Frame. Exposed as a pure, static list (not a function of any data) so a
 * caller can enumerate "all cells" without this module inventing what a cell
 * MEANS beyond its (Domain, Frame) coordinate.
 */
export const ALL_CELLS: ReadonlyArray<{ domain: Domain; frame: Frame }> = DOMAINS.flatMap(
  (domain) => FRAMES.map((frame) => ({ domain, frame })),
);
