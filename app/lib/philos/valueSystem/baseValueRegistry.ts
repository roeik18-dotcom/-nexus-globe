/**
 * PHILOS Value System — Base Value Registry + Candidate Family Registry.
 *
 * System contract: PHILOS_VALUE_SYSTEM_MASTER_INGEST_COMBINED_v4.1.md
 * (§17.2 "ערכי בסיס — Base Values", §17.3 base-value→family sort, §6 Board
 * Candidate Set, §18 BASE_VALUE_INDEX_v1). The 65 labels and the 28-family
 * sort below are transcribed VERBATIM from that contract — this module
 * invents no value, no family, and no assignment.
 *
 * ONTOLOGY GUARDS (contract §5 / §17):
 *   - These are 65 BASE VALUES — small normalization units UNDER the
 *     families. They are NOT 65 Value Groups, NOT 65 Canon values, and
 *     NOT promotable by existing here (status carries the contract's own
 *     `NORMALIZATION_BASE / REVIEW_REQUIRED`).
 *   - The 28 families are CANDIDATE_VALUE_FAMILY, STATUS=REVIEW_REQUIRED —
 *     never silently promoted to final Canon. Their ids are the SAME
 *     `F01..F28` ids `valueUniverse328.ts::RAW_FAMILIES` already carries
 *     (verified 1:1 against the Board list) — this module layers status +
 *     base-value membership over the existing ids rather than minting a
 *     second family registry.
 *   - Reconciliation toward the planned ~30–50 top-level families is
 *     LATER work behind the Promotion Gate (§14/§15.4); `candidate_family_
 *     refs` being plural per base value keeps that door open.
 *   - "כבוד" is deliberately in TWO families (F01, F25) — the contract's
 *     own note: a cross-context base value whose family is decided by
 *     Context, never by blind dedup.
 */

export type BaseValueStatus = "NORMALIZATION_BASE / REVIEW_REQUIRED";
export type CandidateFamilyStatus = "REVIEW_REQUIRED";

export interface BaseValue {
  /** `BV01`..`BV65` — positional in the contract's own §17.2 list. */
  id: string;
  label: string;
  /** Family ids (`F01`..`F28`) this base value sorts into per §17.3 —
   *  plural where the contract itself lists it in more than one. */
  candidate_family_refs: string[];
  status: BaseValueStatus;
  provenance: string;
}

export interface CandidateValueFamily {
  /** Same id space as `RAW_FAMILIES` (`F01`..`F28`) — one registry. */
  id: string;
  label: string;
  base_value_refs: string[];
  status: CandidateFamilyStatus;
  provenance: string;
}

const PROVENANCE = "PHILOS_VALUE_SYSTEM_MASTER_INGEST_COMBINED_v4.1 §17.2–17.3 (Board)";

/** label → family ids, verbatim from §17.3. */
const FAMILY_SORT: [string, string[]][] = [
  ["חיים", ["F01"]], ["כבוד", ["F01", "F25"]],
  ["חופש", ["F02"]], ["אוטונומיה", ["F02"]],
  ["אחריות", ["F03"]], ["זכויות", ["F03"]], ["חובות", ["F03"]],
  ["ביטחון", ["F04"]], ["יציבות", ["F04"]],
  ["צדק", ["F05"]], ["שוויון", ["F05"]], ["הוגנות", ["F05"]],
  ["אמת", ["F06"]], ["מציאות", ["F06"]], ["יושר", ["F06"]],
  ["אמון", ["F07"]], ["נאמנות", ["F07"]],
  ["אהבה", ["F08"]], ["אכפתיות", ["F08"]], ["אמפתיה", ["F08"]],
  ["חיבור", ["F09"]], ["שייכות", ["F09"]], ["אחדות", ["F09"]],
  ["נתינה", ["F10"]], ["תרומה", ["F10"]],
  ["ידע", ["F11"]], ["הבנה", ["F11"]], ["אוריינטציה", ["F11"]],
  ["התפתחות", ["F12"]], ["שיפור", ["F12"]],
  ["יצירה", ["F13"]], ["ביטוי", ["F13"]],
  ["אומץ", ["F14"]], ["פעולה", ["F14"]],
  ["משמעת", ["F15"]], ["איפוק", ["F15"]], ["איזון", ["F15"]],
  ["התמדה", ["F16"]], ["המשכיות", ["F16"]],
  ["שיתוף פעולה", ["F17"]], ["תיאום", ["F17"]],
  ["שמירת משאבים", ["F18"]], ["אי-ריקון", ["F18"]],
  ["יכולת", ["F19"]], ["העצמה", ["F19"]],
  ["פרטיות", ["F20"]], ["בעלות", ["F20"]], ["גבולות", ["F20"]],
  ["קבלה", ["F21"]], ["שונות", ["F21"]], ["פלורליזם", ["F21"]],
  ["שקיפות", ["F22"]], ["אחריותיות", ["F22"]],
  ["רווחה", ["F23"]], ["איכות חיים", ["F23"]],
  ["הישג", ["F24"]], ["מצוינות", ["F24"]], ["פרודוקטיביות", ["F24"]],
  ["הכרה הדדית", ["F25"]],
  ["תקשורת", ["F26"]], ["הבנה הדדית", ["F26"]],
  ["הסתגלות", ["F27"]], ["חוסן", ["F27"]],
  ["הדדיות", ["F28"]], ["החלפה", ["F28"]],
];

/** The 65 Base Values — §17.2 order preserved (BV id = position). */
export const BASE_VALUES: BaseValue[] = FAMILY_SORT.map(([label, families], i) => ({
  id: `BV${String(i + 1).padStart(2, "0")}`,
  label,
  candidate_family_refs: families,
  status: "NORMALIZATION_BASE / REVIEW_REQUIRED",
  provenance: PROVENANCE,
}));

/** Board family labels, §6 order — ids match `RAW_FAMILIES` 1:1. */
const FAMILY_LABELS: string[] = [
  "חיים וכבוד האדם", "חופש ואוטונומיה", "אחריות, זכויות וחובות", "ביטחון ויציבות",
  "צדק, שוויון והוגנות", "אמת, מציאות ויושר", "אמון ונאמנות", "אהבה, אכפתיות ואמפתיה",
  "חיבור, שייכות ואחדות", "נתינה ותרומה", "ידע, הבנה ואוריינטציה", "התפתחות ושיפור",
  "יצירה וביטוי", "אומץ ופעולה", "משמעת, איפוק ואיזון", "התמדה והמשכיות",
  "שיתוף פעולה ותיאום", "שמירת משאבים ואי-ריקון", "יכולת והעצמה", "פרטיות, בעלות וגבולות",
  "קבלה, שונות ופלורליזם", "שקיפות ואחריותיות", "רווחה ואיכות חיים",
  "הישג, מצוינות ופרודוקטיביות", "כבוד והכרה הדדית", "תקשורת והבנה הדדית",
  "הסתגלות וחוסן", "הדדיות והחלפה",
];

/** The 28 candidate families — REVIEW_REQUIRED, never auto-promoted. */
export const CANDIDATE_VALUE_FAMILIES: CandidateValueFamily[] = FAMILY_LABELS.map((label, i) => {
  const id = `F${String(i + 1).padStart(2, "0")}`;
  return {
    id,
    label,
    base_value_refs: BASE_VALUES.filter((bv) => bv.candidate_family_refs.includes(id)).map((bv) => bv.id),
    status: "REVIEW_REQUIRED",
    provenance: PROVENANCE,
  };
});

export function findBaseValue(id: string): BaseValue | null {
  return BASE_VALUES.find((b) => b.id === id) ?? null;
}

export function findCandidateFamily(id: string): CandidateValueFamily | null {
  return CANDIDATE_VALUE_FAMILIES.find((f) => f.id === id) ?? null;
}
