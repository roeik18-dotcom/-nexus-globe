/**
 * Real Human Config hierarchy — pure projections over
 * `masterUnitsSource.ts`'s raw sheet rows. No I/O here; every function
 * takes already-loaded data.
 *
 * CONFIG FAMILY → DOMAIN → DIMENSION → PARAMETER → SOURCE ITEMS, using the
 * REAL fields the source workbook actually has:
 *   CONFIG FAMILY = "Human" (this module only ever reads `Domain === "אדם"`
 *     rows — the workbook's other Domain values, "מוזיקה"/"מבנה"/"משותף",
 *     are out of this task's scope — plus the "תאוריה מוזיקלית" Section
 *     exclusion below, for rows that carry Domain="אדם" but are Value-
 *     Domain content in practice)
 *   DOMAIN (in the product-hierarchy sense)  = the real `Section` column
 *     (10 real values after the exclusion, e.g. "מנגנוני הסתגלות והגנה",
 *     "תאוריית הדחף")
 *   DIMENSION = the real `Heading` column
 *   PARAMETER = the real `Canonical_ID` + `Canonical_Text`
 *   SOURCE ITEMS = individual `MasterUnitRecord` rows under a Canonical_ID
 *
 * **No 9-cell PHYSICAL/EMOTIONAL/COGNITIVE × PERSONAL/SOCIAL/SYSTEMIC
 * matrix exists in this real source.** Checked directly against the
 * workbook: `Domain` has exactly 4 values (אדם/מוזיקה/מבנה/משותף),
 * `Section` has 11 values, and neither factors into a 3×3 grid anywhere
 * in the schema. Building that matrix here would be exactly the invented
 * structure this session's standing rule forbids — the real structuring
 * dimensions (`Domain`, `Section`) are exposed instead, honestly, not
 * force-fit into a matrix the source doesn't have.
 */
import type { CollisionAuditRecord, CoverageMetric, MasterUnitRecord, ReviewQueueRecord } from "./masterUnitsSource";
import type { MissionDimension } from "../mission/missionOrientation";
import { TEMPERAMENT_DIMENSIONS } from "./temperamentDimensions";

export const HUMAN_CONFIG_DOMAIN_VALUE = "אדם";

/**
 * A real source-tagging inconsistency, found and fixed this pass (ledger
 * §27): 30 real rows carry `Domain === "אדם"` (Human) but sit under a
 * Section literally named "תאוריה מוזיקלית" (Music Theory) — Value-Domain
 * content, not general-human content, mistagged at the source. Trusting
 * `Domain` alone therefore leaked an entire Music-specific theory section
 * into what this product presents as the domain-agnostic Human Config,
 * contradicting the product's own "Person → Human Config" vs "Person →
 * Selected Value Domain → Music Config" separation (Fusion connects the
 * two; they must never be the same set of rows).
 *
 * This is the ONLY Section excluded here, and only because it is,
 * unambiguously, an entire Value-Domain theory section rather than
 * general human content — individual rows elsewhere that merely use a
 * musical example/metaphor within genuine psychology content (e.g. a
 * defense-mechanism illustration) are NOT stripped; doing so on a bare
 * substring match would risk deleting legitimate general-human content
 * on no real evidence it's domain-specific.
 *
 * **Second instance, found this pass (ledger §30)**: 2 more rows carry
 * `Domain === "אדם"` under a DIFFERENT, legitimate Section
 * ("התפתחות פסיכוסקסואלית") but are tagged `Heading === "תאוריה
 * מוזיקלית"`. Checked their real `Canonical_Text` directly — the content
 * is genuine psychoanalytic material (Id, a reality/familiarity
 * principle), not music content; the HEADING LABEL is simply wrong at
 * the source, a filing artifact (both are `CAN-XDUP-*` — cross-duplicate
 * — ids, meaning this content also exists correctly filed elsewhere).
 * Since the hard rule is "no Music-labeled content visible in Human
 * Config" (not "no Music-adjacent content"), and no correct replacement
 * Heading can be inferred without fabricating one, these 2 rows are
 * excluded by Heading too — `EXCLUDED_VALUE_DOMAIN_HEADINGS` — rather
 * than relabeled. The content survives under its other, correctly-filed
 * Canonical_ID occurrence.
 *
 * **Third and fourth instance, found this pass (ledger §31), from an
 * explicit audit of every Section under `Domain === "אדם"`** — not
 * Music this time, but the same underlying defect (Domain="אדם" is not
 * sufficient proof content belongs in a universal Human model):
 *   - "פטנטים" (18 rows) — checked its real content directly: invention/
 *     business notes ("water plugin patent", "cotton field clothing
 *     shop", "internet page-sorting software") with no psychological
 *     content whatsoever. Not human-model material by any reading.
 *   - "מיוצגים" (3 rows) — checked its real content directly: a header
 *     label plus two REAL PEOPLE'S NAMES (apparently music artists the
 *     source's author represents). This is a genuine privacy concern on
 *     top of being off-topic — real third-party names must never surface
 *     in a generic Human Config product view. Excluded outright, not
 *     merely relabeled.
 * Every other real Section under Domain="אדם" was checked against its
 * own real content this session (מנגנוני הסתגלות והגנה, רעיונות/הבנת
 * עולם/תודעה, קוגניציה, מבנה נפשי ופסיכודינמיקה, תאוריית הדחף, תודעה/
 * הכרה/אדם, התפתחות פסיכוסקסואלית) and confirmed to be genuine
 * general-psychology theory content — none of those are excluded.
 */
export const EXCLUDED_VALUE_DOMAIN_SECTIONS = ["תאוריה מוזיקלית", "פטנטים", "מיוצגים"];
export const EXCLUDED_VALUE_DOMAIN_HEADINGS = ["תאוריה מוזיקלית"];

export type MappingStatus = "mapped" | "unmapped" | "review_required";

export interface ClassifiedUnit {
  record: MasterUnitRecord;
  status: MappingStatus;
  reviewReason?: string;
}

export function classifyUnits(units: MasterUnitRecord[], reviewQueue: ReviewQueueRecord[]): ClassifiedUnit[] {
  const reviewByAtomicId = new Map(reviewQueue.map((r) => [r.Atomic_ID, r.Reason_Open]));
  return units.map((record) => {
    const reviewReason = reviewByAtomicId.get(record.Atomic_ID);
    if (reviewReason) return { record, status: "review_required", reviewReason };
    if (record.Heading === "Explicitly Unmapped" || !record.Canonical_ID) return { record, status: "unmapped" };
    return { record, status: "mapped" };
  });
}

export function humanDomainUnits(units: MasterUnitRecord[]): MasterUnitRecord[] {
  return units.filter(
    (u) =>
      u.Domain === HUMAN_CONFIG_DOMAIN_VALUE &&
      !EXCLUDED_VALUE_DOMAIN_SECTIONS.includes(u.Section) &&
      !EXCLUDED_VALUE_DOMAIN_HEADINGS.includes(u.Heading),
  );
}

export interface DimensionGroup {
  heading: string;
  units: ClassifiedUnit[];
  canonicalConceptCount: number;
}

export interface DomainGroup {
  section: string;
  dimensions: DimensionGroup[];
  unitCount: number;
}

/** Section → Heading → (grouped source items), classified. Deterministic
 *  order: sections/headings sorted by real unit count, descending. */
export function buildHumanConfigHierarchy(classified: ClassifiedUnit[]): DomainGroup[] {
  const bySection = new Map<string, ClassifiedUnit[]>();
  for (const c of classified) {
    const key = c.record.Section || "(ללא Section)";
    if (!bySection.has(key)) bySection.set(key, []);
    bySection.get(key)!.push(c);
  }
  const domains: DomainGroup[] = [...bySection.entries()].map(([section, sectionUnits]) => {
    const byHeading = new Map<string, ClassifiedUnit[]>();
    for (const c of sectionUnits) {
      const key = c.record.Heading || "(ללא Heading)";
      if (!byHeading.has(key)) byHeading.set(key, []);
      byHeading.get(key)!.push(c);
    }
    const dimensions: DimensionGroup[] = [...byHeading.entries()].map(([heading, headingUnits]) => ({
      heading,
      units: headingUnits,
      canonicalConceptCount: new Set(headingUnits.map((u) => u.record.Canonical_ID).filter(Boolean)).size,
    })).sort((a, b) => b.units.length - a.units.length);
    return { section, dimensions, unitCount: sectionUnits.length };
  });
  return domains.sort((a, b) => b.unitCount - a.unitCount);
}

export interface CanonicalConcept {
  canonicalId: string;
  canonicalText: string;
  section: string;
  heading: string;
  sourceItems: ClassifiedUnit[];
}

/** One card per real Canonical_ID — the PARAMETER level. */
export function buildCanonicalConcepts(classified: ClassifiedUnit[]): CanonicalConcept[] {
  const byId = new Map<string, ClassifiedUnit[]>();
  for (const c of classified) {
    if (!c.record.Canonical_ID) continue;
    if (!byId.has(c.record.Canonical_ID)) byId.set(c.record.Canonical_ID, []);
    byId.get(c.record.Canonical_ID)!.push(c);
  }
  return [...byId.entries()].map(([canonicalId, sourceItems]) => ({
    canonicalId,
    canonicalText: sourceItems[0].record.Canonical_Text || canonicalId,
    section: sourceItems[0].record.Section,
    heading: sourceItems[0].record.Heading,
    sourceItems,
  }));
}

// ── Semantic concept typing (ledger §32) ────────────────────────────────────
//
// "926 Canonical concepts" was implicitly presented as if all of them were
// equally measurable Human Parameters. Checked directly: they are not. The
// source's own real `Type` column (10 real values — verified since §23,
// re-confirmed this pass over the post-exclusion 1184 human rows: 665
// אקסיומה/אפוריזם, 249 טענה/עיקרון, 88 תובנה אישית, 60 מנגנון, 58
// שלב/תהליך, 21 ציטוט, 16 מודל, 14 הערת עבודה, 8 הגדרה, 5 מבנה/מפריד) is
// the REAL, existing semantic signal — this maps it to the requested
// product-facing categories rather than inventing a second, parallel
// 21-category scheme applied row-by-row by hand (infeasible to do
// responsibly at ~1200 rows, and unnecessary when a real signal exists).
//
// **MEASURABLE_PARAMETER is reserved, not inferred from Type.** Checked
// directly: only ONE real Heading in the entire human-domain dataset has
// the structural shape of an actual parameter/scale list — short,
// dash-wrapped labels ("-רמת פעילות-", "-קצב-", ...) — "ממדי מזג —
// פרמטרים לאבחון" (Temperament, already built in §24). Even within that
// ONE Heading, not every row is a real parameter: it has 10 total rows,
// but 3 are decorative separators/the Heading's own repeated label (each
// happening to carry its own Canonical_ID) — checked directly and
// excluded by §24's `temperamentDimensions.ts`, which curated the exact
// 7 real Canonical_IDs by hand against the real content. This module
// reuses that SAME curated list (`TEMPERAMENT_DIMENSIONS`) rather than a
// looser Heading-membership check, so "10 by heading" never silently
// disagrees with "7 real parameters" elsewhere in the product — one
// source of truth for what counts as measurable. Calling any of the
// other concepts "measurable" would be fabrication; they remain their
// real Type-derived category instead.

export type SemanticConceptType =
  | "MEASURABLE_PARAMETER" | "MECHANISM" | "PROCESS" | "THEORY"
  | "SUBJECT_DECLARATION" | "REFERENCE" | "OTHER";

/** Kept for display/navigation (the Heading a subject would browse to
 *  find the 7 curated parameters) — no longer used alone to decide
 *  MEASURABLE_PARAMETER membership (see header note above). */
export const MEASURABLE_PARAMETER_HEADING = "ממדי מזג — פרמטרים לאבחון";

const MEASURABLE_PARAMETER_CANONICAL_IDS = new Set(TEMPERAMENT_DIMENSIONS.map((d) => d.canonical_id));

/** Real Type value → product-facing semantic category. A principled,
 *  documented mapping over the source's OWN 10 real Type values — not a
 *  per-row judgment call. */
const TYPE_TO_SEMANTIC: Record<string, SemanticConceptType> = {
  "מנגנון": "MECHANISM",
  "שלב/תהליך": "PROCESS",
  "אקסיומה/אפוריזם": "THEORY",
  "טענה/עיקרון": "THEORY",
  "מודל": "THEORY",
  "תובנה אישית": "SUBJECT_DECLARATION",
  "ציטוט": "REFERENCE",
  "הגדרה": "REFERENCE",
  "הערת עבודה": "OTHER",
  "מבנה/מפריד": "OTHER",
};

/** Real classification for one Canonical concept — MEASURABLE_PARAMETER
 *  only for the 7 curated real temperament Canonical_IDs; every other
 *  concept gets its real Type-derived category, defaulting to OTHER only
 *  when the source's own Type value is itself missing or unrecognized
 *  (never silently dropped). */
export function classifySemanticType(concept: CanonicalConcept): SemanticConceptType {
  if (MEASURABLE_PARAMETER_CANONICAL_IDS.has(concept.canonicalId)) return "MEASURABLE_PARAMETER";
  const type = concept.sourceItems[0]?.record.Type;
  return TYPE_TO_SEMANTIC[type] ?? "OTHER";
}

export interface SemanticTypeCounts {
  type: SemanticConceptType;
  count: number;
}

/** Real counts per semantic category, over the SAME concepts the rest of
 *  this module already builds. */
export function buildSemanticTypeCounts(concepts: CanonicalConcept[]): SemanticTypeCounts[] {
  const counts = new Map<SemanticConceptType, number>();
  for (const c of concepts) {
    const type = classifySemanticType(c);
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return [...counts.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);
}

export interface HumanConfigSummary {
  totalUnits: number;
  humanDomainUnits: number;
  mapped: number;
  unmapped: number;
  reviewRequired: number;
  sectionCount: number;
  /** UNIQUE_CANONICAL_HEADINGS — distinct Heading TEXT only, ignoring
   *  which Section(s) it appears under. Real, checked finding this pass
   *  (ledger §32): 27 real Heading names recur under more than one
   *  Section (e.g. "תאוריית הדחף" appears under 3 different Sections),
   *  so this number is smaller than the actual navigable dimension count
   *  below — never presented as the same thing. */
  uniqueHeadingTextCount: number;
  /** HUMAN_PRODUCT_HEADINGS — unique (Section, Heading) pairs, i.e. the
   *  real number of navigable Dimension nodes `buildHumanConfigHierarchy`
   *  actually produces (`dimensionCoverage.length` is this same number,
   *  by construction — one source of truth, not re-derived twice). */
  navigableDimensionCount: number;
  canonicalConceptCount: number;
  collisionAuditEntries: number;
  /** Verbatim from the source's own COVERAGE sheet — the authoritative
   *  count, not re-derived by this module's own classification logic
   *  (both are shown; a mismatch would itself be a real, worth-surfacing
   *  finding, never silently reconciled). */
  sourceCoverage: CoverageMetric[];
}

// ── Parameter instrumentation ───────────────────────────────────────────────
//
// Every real Canonical_ID becomes an inspectable measurement object, per
// the product's own critical rule: SOURCE STRUCTURE ≠ USER ANSWER ≠
// OBSERVATION ≠ DERIVED STATE. `ParameterDetail` states this explicitly
// per field — every state-like field is `unknown()` for every real
// parameter today, because no canon Observation ties to any of these
// Canonical_IDs yet (verified repeatedly since §23). This is not a
// second Human Config model: it is one more projection of the SAME
// `ClassifiedUnit`/`CanonicalConcept` data `buildCanonicalConcepts`
// already produces.
//
// **On "source questions"**: this source's own `Type` column has no
// "question" value (real distinct types: axiom/aphorism, claim/
// principle, structure/separator, personal insight, mechanism, stage/
// process, quote, model, work note, definition — checked directly, see
// ledger §23). Calling these rows "questions" would misrepresent the
// source. They are instead labeled `sourceStatements` — the real
// diagnostic/theoretical basis a future measurement could be built from —
// and the UI states plainly that none are phrased as answerable
// questions today.

function unknownDim<T>(): MissionDimension<T> {
  return { value: null, status: "unknown" };
}

export interface ParameterDetail {
  parameterId: string;
  name: string;
  /** Real, Type-derived classification (ledger §32) — only
   *  `MEASURABLE_PARAMETER` concepts (Temperament today) get real
   *  state/baseline/delta/etc. treatment below; every other type still
   *  shows the same fields for schema uniformity, but the UI must not
   *  imply a THEORY or REFERENCE concept is a scalar measurement. */
  semanticType: SemanticConceptType;
  /** No separate "definition"/"operational meaning" column exists in the
   *  real source — checked directly (§23's real header list). `name`
   *  (Canonical_Text) IS the operational meaning; this field states that
   *  honestly rather than fabricating a second definition string that
   *  would just duplicate `name`. */
  operationalMeaning: MissionDimension<string>;
  configFamily: "Human";
  domain: string;
  dimension: string;
  sourceStatements: ClassifiedUnit[];
  currentState: MissionDimension<string>;
  baseline: MissionDimension<string>;
  delta: MissionDimension<string>;
  direction: MissionDimension<string>;
  stability: MissionDimension<string>;
  contradiction: MissionDimension<string>;
  epistemicStatus: MissionDimension<string>;
  evidenceCount: number;
  observationCount: number;
  openReviewCount: number;
  lastUpdate: MissionDimension<string>;
  /** A real time series requires real Observations over time — none exist
   *  for any Canonical_ID yet, so this is always empty with an explicit
   *  `INSUFFICIENT_HISTORY` reason, same convention §26 established for
   *  Dynamics' time heatmap. Not omitted, not a fabricated single point. */
  history: { status: "INSUFFICIENT_HISTORY"; reason: string };
  sourceFileName: string;
}

/** One inspectable measurement object per real Canonical_ID. Pure
 *  projection over an already-built `CanonicalConcept` — no new source
 *  read, no new fact. */
export function buildParameterDetail(concept: CanonicalConcept, sourceFileName: string): ParameterDetail {
  const openReviewCount = concept.sourceItems.filter((i) => i.status === "review_required").length;
  return {
    parameterId: concept.canonicalId,
    name: concept.canonicalText,
    semanticType: classifySemanticType(concept),
    operationalMeaning: { value: concept.canonicalText, status: "declared", evidence: "no separate definition column exists in source — Canonical_Text serves as both name and operational meaning", source: sourceFileName },
    configFamily: "Human",
    domain: concept.section,
    dimension: concept.heading,
    sourceStatements: concept.sourceItems,
    // Every state-like field: genuinely unknown for every real parameter
    // today — no canon Observation exists for any Canonical_ID here.
    currentState: unknownDim(),
    baseline: unknownDim(),
    delta: unknownDim(),
    direction: unknownDim(),
    stability: unknownDim(),
    contradiction: unknownDim(),
    epistemicStatus: { value: "unknown", status: "unknown", evidence: "no Observation/answer/derivation exists for this Canonical_ID yet" },
    evidenceCount: 0,
    observationCount: 0,
    openReviewCount,
    lastUpdate: unknownDim(),
    history: { status: "INSUFFICIENT_HISTORY", reason: "no canon Observation exists for this Canonical_ID at any point in time yet" },
    sourceFileName,
  };
}

export type ParameterFilterKey =
  | "known" | "unknown" | "conflict" | "review_required"
  | "has_evidence" | "no_evidence" | "changed" | "stable" | "has_open_questions";

export const PARAMETER_FILTER_KEYS: ParameterFilterKey[] = [
  "known", "unknown", "conflict", "review_required", "has_evidence", "no_evidence", "changed", "stable", "has_open_questions",
];

/**
 * Real filters over `CanonicalConcept[]`. Several are honestly empty for
 * EVERY real parameter today (`known`, `has_evidence`, `changed`,
 * `stable`) because no live-state data exists anywhere in this product
 * for any Canonical_ID — this is the correct, checked answer, not a bug.
 * `conflict` is also empty: `TAXONOMY_COLLISION_AUDIT` has no reliable
 * join key to a specific Canonical_ID (it keys on `Heading_ID`), so no
 * per-parameter conflict is asserted without one — the one real
 * collision case stays visible at the Section/audit-trail level only
 * (see `HumanConfigView.tsx`'s collision-audit block), never guessed
 * down to a parameter.
 */
export function filterConceptsByStatus(concepts: CanonicalConcept[], filter: ParameterFilterKey): CanonicalConcept[] {
  switch (filter) {
    case "known": return [];
    case "unknown": return concepts;
    case "conflict": return [];
    case "review_required": return concepts.filter((c) => c.sourceItems.some((i) => i.status === "review_required"));
    case "has_evidence": return [];
    case "no_evidence": return concepts;
    case "changed": return [];
    case "stable": return [];
    case "has_open_questions": return concepts.filter((c) => c.sourceItems.some((i) => i.status === "review_required"));
  }
}

export interface DimensionCoverage {
  section: string;
  heading: string;
  unitCount: number;
  mapped: number;
  unmapped: number;
  reviewRequired: number;
  canonicalConceptCount: number;
}

/** Source-coverage counts by Dimension (Heading) — real counts only,
 *  reusing the SAME hierarchy `buildHumanConfigHierarchy` already built. */
export function buildDimensionCoverage(hierarchy: DomainGroup[]): DimensionCoverage[] {
  return hierarchy.flatMap((d) =>
    d.dimensions.map((h) => ({
      section: d.section,
      heading: h.heading,
      unitCount: h.units.length,
      mapped: h.units.filter((u) => u.status === "mapped").length,
      unmapped: h.units.filter((u) => u.status === "unmapped").length,
      reviewRequired: h.units.filter((u) => u.status === "review_required").length,
      canonicalConceptCount: h.canonicalConceptCount,
    })),
  );
}

export function buildHumanConfigSummary(params: {
  allUnits: MasterUnitRecord[];
  classifiedHuman: ClassifiedUnit[];
  collisionAudit: CollisionAuditRecord[];
  coverage: CoverageMetric[];
}): HumanConfigSummary {
  const { allUnits, classifiedHuman, collisionAudit, coverage } = params;
  return {
    totalUnits: allUnits.length,
    humanDomainUnits: classifiedHuman.length,
    mapped: classifiedHuman.filter((c) => c.status === "mapped").length,
    unmapped: classifiedHuman.filter((c) => c.status === "unmapped").length,
    reviewRequired: classifiedHuman.filter((c) => c.status === "review_required").length,
    sectionCount: new Set(classifiedHuman.map((c) => c.record.Section)).size,
    uniqueHeadingTextCount: new Set(classifiedHuman.map((c) => c.record.Heading)).size,
    navigableDimensionCount: new Set(classifiedHuman.map((c) => `${c.record.Section}␟${c.record.Heading}`)).size,
    canonicalConceptCount: new Set(classifiedHuman.map((c) => c.record.Canonical_ID).filter(Boolean)).size,
    collisionAuditEntries: collisionAudit.length,
    sourceCoverage: coverage,
  };
}
