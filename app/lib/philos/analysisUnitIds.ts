/**
 * THE TEN ANALYSIS UNIT IDENTIFIERS — the neutral vocabulary.
 *
 * WHY THIS MODULE EXISTS. `canon/` and `analysis/` import nothing from each
 * other, and that separation is deliberate: canon is the stable, cited layer
 * and `analysis/` is explicitly SYNTHESIS. An Observation that records which
 * units a person classified it into needs the id type, but importing it from
 * `analysis/` would make canon depend on synthesis — the layer edge running
 * exactly the wrong way.
 *
 * So the shared thing is the SMALLEST thing: ten string literals and the
 * guards over them. This file imports nothing, asserts nothing about what a
 * unit means, and carries no reading, grouping, colour or label. Both sides
 * import it and neither imports the other.
 *
 * The MEANING of the units — the 4 + 6 grouping, labels, colour roles and the
 * reading contract — stays in `analysis/analysisUnit.ts`, which is where the
 * synthesis lives and where it is marked as such.
 */

/** Canonical order: the four foundation variables, then the six departments. */
export const ANALYSIS_UNIT_IDS = [
  "time", "matter", "space_gap", "energy",
  "emotional", "cognitive", "physical", "personal", "social", "systemic",
] as const;

export type AnalysisUnitId = (typeof ANALYSIS_UNIT_IDS)[number];

const ID_SET: ReadonlySet<string> = new Set(ANALYSIS_UNIT_IDS);

export function isAnalysisUnitId(v: unknown): v is AnalysisUnitId {
  return typeof v === "string" && ID_SET.has(v);
}

/**
 * Accept a submitted selection and return the ids that are actually real.
 *
 * TOTAL, and never throws: an unknown id is DROPPED rather than rejecting the
 * whole Observation, because a person's observation should not be lost to a
 * stale client sending a unit name this build does not know. What it never
 * does is invent one — anything unrecognised simply does not appear.
 *
 * Duplicates collapse (selecting a unit twice is selecting it once), order
 * follows `ANALYSIS_UNIT_IDS` so two equal selections serialise identically,
 * and the result cannot exceed ten because there are only ten.
 */
export function normalizeAnalysisUnitIds(input: unknown): AnalysisUnitId[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<AnalysisUnitId>();
  for (const v of input) if (isAnalysisUnitId(v)) seen.add(v);
  return ANALYSIS_UNIT_IDS.filter((id) => seen.has(id));
}
