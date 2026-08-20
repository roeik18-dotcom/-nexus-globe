/**
 * The MEASURED STATE SPACE — a real, read-only selection of canon
 * Observations by (subject, Domain, Frame), never a new store, never a new
 * fact.
 *
 * **What this is, and what it is NOT** (PHILOS-PERSON-CONTRACT.md §4):
 * canon's cell identity is `Domain (G|E|C) × Frame (I|R|S)` — nine
 * measurement cells (canon §3, `cellState.ts::ALL_CELLS`). This module
 * enumerates all nine and reports, per cell, either the most recent real
 * Observation or UNKNOWN. That is the measured state space.
 *
 *   **PERSON ≠ 9 CELLS.** The nine cells describe what has been MEASURED,
 *   never who someone is (canon §6: "Observation is a measurement of a
 *   cell, never a property of the person"; canon §25 type boundary). No
 *   name in this file may assert otherwise — hence `MeasuredStateSpace`,
 *   never `PersonModel`/`PersonCellState`/`PersonStateModel`.
 *
 * This pass fixed a real defect: the previous `buildOrientationCore`
 * grouped by Domain ONLY and discarded Frame, collapsing canon's 9-cell
 * space into 3 slots — which made one measurement of one cell read as a
 * complete Body/Emotion/Cognition person model. The Domain rollup is kept
 * (below) for the consumers that already read it, explicitly labelled as a
 * rollup rather than as cells.
 *
 * **No aggregation is introduced.** Canon §4 states no rule for combining
 * multiple Observations of one cell, so selection is "most recent
 * Observation per cell" — a chronological selection, never an aggregate.
 * Canon §21 `NO_CROSS_FRAME_AGGREGATION`: nothing here sums, averages,
 * ranks, or reduces the nine cells to a score, a total, or a dominant
 * domain.
 *
 * Track A of the
 * "visible source-locked prototype" pass: uses ONLY concepts already
 * source-locked and already live in this repo — canon's own `Domain`
 * (G/E/C), `Level` (signed deficit←equilibrium→surplus, canon §4), and the
 * SAME `resolveSharedContext`/`findKnownNeeds`/`buildActionSpaceSummary`
 * Dynamics/Globe/Marketplace already use. No 3×3 Personal/Relational/
 * Systemic axis is added here — Hub's first slice groups by Domain only,
 * since Frame-level grouping is a separate, not-yet-decided product
 * question (see `PHILOS-PRODUCT-MASTER-LEDGER.md`).
 */
import type { CanonDynamicsGraph, CanonObservationMark } from "./canon/projectCanonDynamics";
import type { Domain, Frame, Observation } from "./canon/observation";

/** The canon axes, re-exported so a caller enumerating cells never
 *  re-declares them. Exactly 3 × 3 — no fourth Domain, no fifth Frame
 *  (canon §3). */
export const CELL_DOMAINS: readonly Domain[] = ["G", "E", "C"];
export const CELL_FRAMES: readonly Frame[] = ["I", "R", "S"];

/** `"G/I"` … `"C/S"` — the nine cell addresses, and only those. */
export type CellKey = `${Domain}/${Frame}`;

export function cellKey(domain: Domain, frame: Frame): CellKey {
  return `${domain}/${frame}`;
}

/** All nine cell keys in a fixed, deterministic order. */
export const ALL_CELL_KEYS: readonly CellKey[] = CELL_DOMAINS.flatMap((d) => CELL_FRAMES.map((f) => cellKey(d, f)));

/** `OBSERVED` = a real Observation exists for this cell. `UNKNOWN` = none
 *  does. There is no third value: a cell is never "partially" measured and
 *  never defaulted to a fabricated mid-point. */
export type MeasuredCellStatus = "OBSERVED" | "UNKNOWN";

/**
 * One cell of the measured state space. Every populated field is copied
 * VERBATIM off the real `CanonObservationMark` — nothing is derived,
 * rounded, normalized, or combined. Every field is `undefined` when
 * `status === "UNKNOWN"`.
 */
export interface MeasuredCell {
  key: CellKey;
  domain: Domain;
  frame: Frame;
  status: MeasuredCellStatus;
  /** canon §4 — signed deficit ← equilibrium → surplus. */
  level?: number;
  /** canon §4 — no scale/bounds are asserted; canon specifies none. */
  stability?: number;
  /** canon §5 — RELATIVE vs OBJECTIVE, never blurred. */
  deficit_type?: Observation["deficitType"];
  /** canon §6 — self_reported | inferred | third_party. */
  provenance?: Observation["provenance"];
  /** canon §6 — measurement metadata, never part of a human's value. */
  confidence?: number;
  observed_at?: string;
  canon_event_id?: string;
  /** canon §6/§8 — WHAT the Level was measured against. Distinct from a
   *  `Target`, which this module neither reads nor requires. */
  reference?: string;
}

/**
 * DOMAIN ROLLUP — not a cell and not a person model.
 *
 * The pre-existing per-Domain view (most recent Observation for a Domain,
 * ignoring Frame), kept so the consumers that already read `core.G`/
 * `core.E`/`core.C` and the `prior*` fields keep working unchanged. It is a
 * ROLLUP over cells, not an address in the state space, and it must never
 * be presented as "the person" or as canon's cell identity.
 */
export interface OrientationCore {
  subject: string;
  /** Domain rollup — not a cell and not a person model. Most recent real
   *  Observation per DOMAIN for this subject (Frame ignored); `undefined`
   *  means genuinely no Observation exists for that domain, never a guess. */
  G?: CanonObservationMark;
  E?: CanonObservationMark;
  C?: CanonObservationMark;
  /** Domain rollup — not a cell and not a person model. The most recent
   *  PRIOR Observation per DOMAIN, chronological only — same "prior state"
   *  discipline `resolveCoreContext.priorState` already applies.
   *  `undefined` = genuinely no earlier real Observation for this
   *  domain/subject, never a fabricated t0. */
  priorG?: CanonObservationMark;
  priorE?: CanonObservationMark;
  priorC?: CanonObservationMark;
}

/**
 * The measured state space for one subject: all nine canon cells, plus the
 * Domain rollup above for backward compatibility.
 *
 * `observed_count` is the honesty anchor — it is what stops a partially
 * measured space from reading as a complete person. It is a COUNT OF
 * RECORDS, not a score: no sum, average, total, dominant domain, or person
 * level exists on this type, by construction.
 */
export interface MeasuredStateSpace extends OrientationCore {
  /** All nine cells, always present, keyed `"G/I"` … `"C/S"`. */
  cells: Record<CellKey, MeasuredCell>;
  /** How many of the nine cells have a real Observation. 0–9. */
  observed_count: number;
}

/* `resolveDefaultSubject(canon)` stood here. It ignored its argument and
   returned `REAL_CURRENT_SUBJECT` unconditionally — a single-user default
   wearing the name of a resolver. By the end of this phase it had no runtime
   call sites left (the pages take their subject from the viewer), so it is
   DELETED rather than left as a working way to obtain person_roei without an
   identity. `resolveMostRecentObservedSubject` below is untouched and is
   still explicitly diagnostic-only. */


/** The subject of the most recent real Observation across the whole canon
 *  store, regardless of classification — real, but may resolve to a TEST/
 *  PLACEHOLDER/SYSTEM subject. Not used by normal product mode; kept for
 *  developer/diagnostic tooling that explicitly wants "whatever canon has
 *  most recently, unfiltered." `undefined` when the canon store is
 *  genuinely empty. */
export function resolveMostRecentObservedSubject(canon: CanonDynamicsGraph): string | undefined {
  if (canon.nodes.length === 0) return undefined;
  const mostRecent = [...canon.nodes].sort((a, b) => b.observed_at.localeCompare(a.observed_at))[0];
  return mostRecent.subject;
}

/**
 * Selects a subject's real Observations into the nine canon cells, keeping
 * only the most recent per `(Domain, Frame)` — the same "most recent wins"
 * discipline `resolveCoreContext` already applies for `priorState`. A cell
 * with zero real Observations for this subject is `UNKNOWN`, never
 * defaulted to a fabricated mid-point.
 *
 * The Domain rollup (`G`/`E`/`C` + `prior*`) is computed exactly as before,
 * so every existing consumer of that shape is bit-for-bit unaffected.
 *
 * No aggregation, no scoring, no cross-frame reduction — see the module
 * header for the canon citations.
 */
export function buildMeasuredStateSpace(canon: CanonDynamicsGraph, subject: string): MeasuredStateSpace {
  const forSubject = canon.nodes.filter((n) => n.subject === subject);

  // ── the nine cells: most recent Observation per (Domain, Frame) ──
  const cells = {} as Record<CellKey, MeasuredCell>;
  let observed_count = 0;
  for (const domain of CELL_DOMAINS) {
    for (const frame of CELL_FRAMES) {
      const key = cellKey(domain, frame);
      const mark = forSubject
        .filter((n) => n.domain === domain && n.frame === frame)
        .sort((a, b) => b.observed_at.localeCompare(a.observed_at))[0];
      if (!mark) {
        cells[key] = { key, domain, frame, status: "UNKNOWN" };
        continue;
      }
      observed_count += 1;
      cells[key] = {
        key, domain, frame, status: "OBSERVED",
        level: mark.level,
        stability: mark.stability,
        deficit_type: mark.deficitType,
        provenance: mark.provenance,
        confidence: mark.confidence,
        observed_at: mark.observed_at,
        canon_event_id: mark.canon_event_id,
        reference: mark.reference,
      };
    }
  }

  // ── Domain rollup — not a cell and not a person model ──
  const byDomain = (domain: Domain) =>
    forSubject.filter((n) => n.domain === domain).sort((a, b) => b.observed_at.localeCompare(a.observed_at));
  const current = { G: byDomain("G")[0], E: byDomain("E")[0], C: byDomain("C")[0] };
  const prior = { G: byDomain("G")[1], E: byDomain("E")[1], C: byDomain("C")[1] };

  return {
    subject,
    cells,
    observed_count,
    G: current.G,
    E: current.E,
    C: current.C,
    priorG: prior.G,
    priorE: prior.E,
    priorC: prior.C,
  };
}
