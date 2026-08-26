/**
 * TEN ANALYSIS UNITS — 4 FOUNDATION VARIABLES + 6 CONTRADICTION DEPARTMENTS.
 *
 * STATUS: **SYNTHESIS.** This grouping is not yet proven against a Canon
 * source document in this repo. `grep -r SPACE_GAP app` returned nothing
 * before this file existed, and no canon module names a four-variable
 * foundation set. It is therefore carried here as an explicitly-labelled
 * synthesis and must NOT be presented as canon until a source is cited and a
 * runtime derivation exists.
 *
 * NOT WIRED. As of this pass nothing imports this module: there is no
 * header, terminal, projection or store that reads it, and no runtime
 * derivation produces an `AnalysisUnitReading` from an Observation. It is a
 * contract and its integrity rules, unit-tested in isolation, and nothing
 * more. Any statement that a surface "shows the ten units" is false until an
 * import exists — check with `grep -rl analysisUnit app` before claiming it.
 *
 * NAMING IS LOAD-BEARING. These are TEN ANALYSIS UNITS composed of TWO
 * distinct groups. They are never "ten departments", "ten contradictions",
 * "ten personality types", or "ten values": the first four are variables of
 * the situation, the last six are departments in which a contradiction can
 * present. Any surface that later renders them must render two labelled
 * groups for exactly this reason — a flat list of ten would itself be the
 * error. No surface renders them today.
 *
 * WHAT THIS FILE DOES NOT DO:
 *   - It does not replace `observation.ts`'s `Domain`/`Frame`
 *     (PHYSICAL/EMOTIONAL/COGNITIVE × INTERNAL/EXTERNAL). That model stays
 *     exactly where it is, untouched, as a separate interpretation
 *     classifier. Nothing here imports it, deletes it, or claims to
 *     supersede it, and neither model is "the whole person".
 *   - It does not use Id/Ego/Superego anywhere.
 *   - It does not implement a 6×6 department relation matrix. Whether that
 *     matrix includes self-links is undefined in every source in this repo;
 *     without self-links it is 30 directed relations, not 36. Until that is
 *     decided explicitly, NO relation count is implemented here at all.
 *   - It computes no aggregate, no total, and no moral score. There is
 *     deliberately no `overall`, no `sum`, and no `weight` field: a reading
 *     is a reading, and ten readings do not add up to a verdict on a person.
 */

/**
 * The ten unit ids come from `../analysisUnitIds` — a neutral module with no
 * imports — so `canon/` can record a person's classification without taking a
 * dependency on this synthesis layer. Re-exported here so every existing
 * reader keeps its import unchanged.
 */
import type { AnalysisUnitId } from "../analysisUnitIds";

export type { AnalysisUnitId };
export { ANALYSIS_UNIT_IDS, isAnalysisUnitId, normalizeAnalysisUnitIds } from "../analysisUnitIds";

/**
 * Reading status. `unknown` is NOT zero and NOT a low value — it is the
 * absence of a reading, and the UI must render it as absence. `inferred` is
 * NOT `measured`: an inference carries no measurement authority regardless
 * of how confident it sounds.
 */
export type AnalysisUnitStatus =
  | "unknown" | "observed" | "inferred" | "measured" | "contradictory" | "not_applicable";

/**
 * ONE FORCE READING, at one time, in one context.
 *
 * A reading is a reading of a SITUATION as it presents, never a fixed trait
 * of the person. The same person re-read tomorrow, or in another context,
 * legitimately yields different readings; nothing in this shape supports
 * treating a reading as an identity.
 */
export type AnalysisUnitReading = {
  unitId: AnalysisUnitId;
  status: AnalysisUnitStatus;
  /** -1 / 0 / +1, or null when there is no directional reading at all. */
  direction: -1 | 0 | 1 | null;
  /** REQUIRES at least one entry in `sourceRefs`. A prose `explanation` is
   *  NOT a substitute: prose is not a calculation method, and a number
   *  justified only by a sentence is an invented number. `null` otherwise. */
  intensity: number | null;
  /** REQUIRES at least one entry in `sourceRefs`. Same rule as `intensity`;
   *  never a probability, never inferred from how sure the prose sounds. */
  confidence: number | null;
  /** Ids of the Observation / Evidence records this reading rests on. */
  sourceRefs: string[];
  explanation: string | null;
};

export type UnitGroup = "FOUNDATION" | "DEPARTMENT";

export interface AnalysisUnitMeta {
  id: AnalysisUnitId;
  group: UnitGroup;
  /** Hebrew label — the product's own language, as every terminal uses. */
  label: string;
  labelEn: string;
  /**
   * DISPLAY affinity only — a routing cue, never a diagnosis and never a
   * moral value. The ACTIVE color of a record may differ from this default
   * when the record's ROLE differs (an evidence row is white whatever unit
   * it describes). Keys index `COLOR_ROLE` in `shell/designTokens.ts`; this
   * file stores the key, not the hex, so the palette stays single-source.
   */
  colorRole: "white" | "purple" | "blue" | "green" | "yellow" | "orange" | "red";
}

/** 4 FOUNDATION VARIABLES — variables of the situation itself. */
export const FOUNDATION_4: readonly AnalysisUnitMeta[] = [
  { id: "time",      group: "FOUNDATION", label: "זמן",   labelEn: "Time",      colorRole: "yellow" },
  { id: "matter",    group: "FOUNDATION", label: "חומר",  labelEn: "Matter",    colorRole: "red" },
  { id: "space_gap", group: "FOUNDATION", label: "מרווח", labelEn: "Space/Gap", colorRole: "white" },
  { id: "energy",    group: "FOUNDATION", label: "אנרגיה", labelEn: "Energy",   colorRole: "orange" },
] as const;

/** 6 CONTRADICTION DEPARTMENTS — where a contradiction can present. */
export const DEPARTMENTS_6: readonly AnalysisUnitMeta[] = [
  { id: "emotional", group: "DEPARTMENT", label: "רגשית",   labelEn: "Emotional", colorRole: "yellow" },
  { id: "cognitive", group: "DEPARTMENT", label: "שכלית",   labelEn: "Cognitive", colorRole: "blue" },
  { id: "physical",  group: "DEPARTMENT", label: "גופנית",  labelEn: "Physical",  colorRole: "red" },
  { id: "personal",  group: "DEPARTMENT", label: "אישית",   labelEn: "Personal",  colorRole: "purple" },
  { id: "social",    group: "DEPARTMENT", label: "חברתית",  labelEn: "Social",    colorRole: "green" },
  { id: "systemic",  group: "DEPARTMENT", label: "מערכתית", labelEn: "Systemic",  colorRole: "white" },
] as const;

/** All ten, in the defined display order. Length asserted by the tests. */
export const ANALYSIS_UNITS: readonly AnalysisUnitMeta[] = [...FOUNDATION_4, ...DEPARTMENTS_6];

export const UNIT_META: Readonly<Record<AnalysisUnitId, AnalysisUnitMeta>> =
  Object.fromEntries(ANALYSIS_UNITS.map((u) => [u.id, u])) as Record<AnalysisUnitId, AnalysisUnitMeta>;

/**
 * The label the UI shows for the model as a whole. Rendered verbatim by the
 * header so the screen itself carries the caveat, not just this comment.
 */
export const MODEL_STATUS = "SYNTHESIS" as const;
export const MODEL_LABEL = "4 FOUNDATION VARIABLES + 6 CONTRADICTION DEPARTMENTS = 10 ANALYSIS UNITS" as const;

/** A reading with nothing known. Explicitly NOT a zero reading. */
export function unknownReading(unitId: AnalysisUnitId): AnalysisUnitReading {
  return {
    unitId, status: "unknown", direction: null,
    intensity: null, confidence: null, sourceRefs: [], explanation: null,
  };
}

export type ReadingIntegrityError =
  | "intensity_without_source"
  | "confidence_without_source"
  | "measured_without_source"
  | "unknown_with_direction"
  | "unknown_with_intensity"
  | "unknown_with_confidence";

/**
 * Structural integrity of one reading — the rules this engagement will not
 * bend, checked mechanically rather than trusted:
 *
 *   - A NUMBER REQUIRES A SOURCE REF, not prose. `intensity` and
 *     `confidence` are refused unless `sourceRefs` is non-empty. An
 *     `explanation` deliberately does NOT satisfy this: a sentence can
 *     describe where a number came from, but it cannot BE where it came
 *     from, and accepting prose here is exactly how an invented number
 *     acquires a justification.
 *   - `measured` with no source is a claim of measurement with nothing
 *     measured.
 *   - `unknown` must carry `direction`, `intensity` AND `confidence` all
 *     `null`. UNKNOWN IS NOT ZERO and is not a low reading; any value on any
 *     of the three turns an absence of knowledge into a quantity, which is
 *     the single confusion this model exists to prevent.
 *
 * Returns [] for a sound reading. Total; never throws.
 */
export function checkReadingIntegrity(r: AnalysisUnitReading): ReadingIntegrityError[] {
  const errors: ReadingIntegrityError[] = [];
  const hasSource = r.sourceRefs.length > 0;
  if (r.intensity !== null && !hasSource) errors.push("intensity_without_source");
  if (r.confidence !== null && !hasSource) errors.push("confidence_without_source");
  if (r.status === "measured" && !hasSource) errors.push("measured_without_source");
  if (r.status === "unknown") {
    if (r.direction !== null) errors.push("unknown_with_direction");
    if (r.intensity !== null) errors.push("unknown_with_intensity");
    if (r.confidence !== null) errors.push("unknown_with_confidence");
  }
  return errors;
}

/** Readings indexed by unit, filling absent units with an explicit unknown. */
export function readingsByUnit(
  readings: readonly AnalysisUnitReading[],
): Record<AnalysisUnitId, AnalysisUnitReading> {
  const out = {} as Record<AnalysisUnitId, AnalysisUnitReading>;
  for (const u of ANALYSIS_UNITS) out[u.id] = unknownReading(u.id);
  for (const r of readings) out[r.unitId] = r;
  return out;
}
