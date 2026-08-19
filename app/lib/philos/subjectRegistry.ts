/**
 * Subject classification + the one designated real current subject
 * (ledger §33).
 *
 * Real finding this pass: `.philos-canon-data/canon-events.jsonl` (the
 * only canon Observations that exist anywhere in this environment) is
 * entirely TEST/PLACEHOLDER/SYSTEM data —
 * `merlin_connectivity_test_person`, `person_e2e`, `person_live_e2e`,
 * `person_qa_natural_philos_PLACEHOLDER`. No real canon Observation for
 * any subject exists yet. `resolveDefaultSubject` (orientationCore.ts)
 * previously picked "whichever subject has the most recent Observation,"
 * which — given the above — always silently resolved to a test fixture
 * in normal product mode.
 *
 * This module does NOT fabricate an Observation to make a real subject
 * "look populated." It mints exactly one identity string,
 * `REAL_CURRENT_SUBJECT`, as the product's designated real user — with
 * zero attached data. Every state field for this subject renders UNKNOWN
 * until a real Observation is actually recorded, same as any other
 * subject (`buildMeasuredStateSpace` already degrades this way for any
 * subject with no canon nodes — no special-casing needed there).
 */

export type SubjectClassification = "real" | "demo" | "test" | "placeholder" | "system";

/** The one designated real current subject. A stable identity anchor,
 *  not personal data — no Observation, answer, or fact is attached to it
 *  by this module. */
export const REAL_CURRENT_SUBJECT = "person_roei";

/** Every subject_id this product has ever seen in canon or its own
 *  fixtures, classified explicitly. Real, not inferred — checked against
 *  `.philos-canon-data/canon-events.jsonl` and the codebase's own DEMO/
 *  test fixtures this pass. */
const KNOWN_SUBJECTS: Record<string, SubjectClassification> = {
  [REAL_CURRENT_SUBJECT]: "real",
  merlin_connectivity_test_person: "system",
  person_e2e: "test",
  person_live_e2e: "test",
  person_qa_natural_philos_PLACEHOLDER: "placeholder",
};

/**
 * Classifies a subject_id. Falls back to real, checked naming patterns
 * ONLY for ids not already in `KNOWN_SUBJECTS` (never guesses a subject
 * into "real" — an unrecognized id defaults to "test" so it never
 * silently qualifies for normal product mode). Explicit DEMO ids (from
 * `demoCommunities.ts`/`demoMusicDomain.ts`, e.g. `dg_lior`,
 * `demo_music_subject`) are classified "demo" by their own established
 * `demo_`/`dg_`/`dn_` prefixes, unchanged from how those fixtures already
 * self-identify — not reclassified here.
 */
export function classifySubject(subject: string): SubjectClassification {
  if (subject in KNOWN_SUBJECTS) return KNOWN_SUBJECTS[subject];
  if (subject.endsWith("_PLACEHOLDER")) return "placeholder";
  if (subject.includes("connectivity_test") || subject.includes("merlin_")) return "system";
  if (subject.includes("_e2e") || subject.includes("test")) return "test";
  if (subject.startsWith("demo_") || subject.startsWith("dg_") || subject.startsWith("dn_")) return "demo";
  return "test";
}

/** Normal product mode shows REAL and DEMO subjects only — TEST/
 *  PLACEHOLDER/SYSTEM subjects remain in the store (never deleted) but
 *  are excluded from the default, non-developer product surface. */
export function isNormalModeSubject(subject: string): boolean {
  const c = classifySubject(subject);
  return c === "real" || c === "demo";
}
