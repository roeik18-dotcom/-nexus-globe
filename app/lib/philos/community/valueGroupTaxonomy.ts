/**
 * Value Group Taxonomy — Board review candidate set reconciliation
 * (PHILOS PRODUCT MASTER — VALUE GROUPS CONVERGENCE PASS).
 *
 * The 28 candidate families below are a REVIEW CANDIDATE SET, not
 * automatic canon — per the pass's own explicit rule: "Do NOT mark a
 * candidate CANONICAL_RUNTIME merely because it appears in this prompt."
 * `classifyValueTaxonomy` is a real, mechanical, keyword-match function
 * over data that already exists (`SOURCE_CONCEPTS` — the §41-50 corpus
 * extraction — and the live `valueRegistry.ts` runtime registry) — it
 * invents no new evidence and promotes nothing on the strength of being
 * named in this list alone.
 *
 * Status rule, in order (first match wins):
 *   CANONICAL_RUNTIME — a REAL, LIVE runtime Value (`ValueEntry.name`,
 *     i.e. an actual central_value of a real or DEMO Value Group today)
 *     matches one of the family's keywords. This is the only path to
 *     CANONICAL_RUNTIME: an already-live record, never the prompt text.
 *   REVIEW_REQUIRED — a `SOURCE_CONCEPTS` entry with `confidence: "high"`
 *     and `review_status: "reviewed"` matches — strong source evidence,
 *     genuinely awaiting a real promotion decision.
 *   REFERENCE_ONLY — any other `SOURCE_CONCEPTS` match (lower confidence,
 *     or `needs_review`, or a non-VALUE type like TENSION/PRINCIPLE that
 *     mentions the concept) — real, but weaker or indirect evidence.
 *   UNSUPPORTED — zero match anywhere in either real source.
 *
 * Merge discipline: this module does not merge synonyms automatically —
 * "merge synonyms rather than creating duplicate values" is a human
 * board-review judgment (multiple candidate families can legitimately
 * match the SAME source concept, e.g. family 03's "אחריות" and the
 * live runtime Value "אחריות" — shown as-is, not collapsed).
 */
import { SOURCE_CONCEPTS, type SourceConcept } from "./sourceValueModel";

export interface ValueTaxonomyCandidate {
  family_id: string;
  label_en: string;
  keywords_he: string[];
}

export const VALUE_TAXONOMY_CANDIDATES: ValueTaxonomyCandidate[] = [
  { family_id: "01", label_en: "LIFE & HUMAN DIGNITY", keywords_he: ["חיים", "כבוד האדם", "הגנה מפגיעה"] },
  { family_id: "02", label_en: "FREEDOM & AUTONOMY", keywords_he: ["חירות", "בחירה", "עצמאות", "אי-כפייה", "אי כפייה"] },
  { family_id: "03", label_en: "RESPONSIBILITY / RIGHTS / DUTIES", keywords_he: ["אחריות", "סמכות", "זכות", "חובה"] },
  { family_id: "04", label_en: "SECURITY & STABILITY", keywords_he: ["ביטחון", "יציבות", "הגנה", "רציפות"] },
  { family_id: "05", label_en: "JUSTICE / EQUALITY / FAIRNESS", keywords_he: ["צדק", "שוויון", "הוגנות", "ניצול"] },
  { family_id: "06", label_en: "TRUTH / REALITY / INTEGRITY", keywords_he: ["אמת", "בוחן מציאות", "כנות", "יושר"] },
  { family_id: "07", label_en: "TRUST & LOYALTY", keywords_he: ["אמון", "נאמנות", "אמינות", "מחויבות"] },
  { family_id: "08", label_en: "LOVE / CARE / EMPATHY", keywords_he: ["אהבה", "אכפתיות", "תמיכה", "אמפתיה"] },
  { family_id: "09", label_en: "CONNECTION / BELONGING / UNITY", keywords_he: ["חיבור", "שייכות", "קהילה", "אחדות"] },
  { family_id: "10", label_en: "GIVING & CONTRIBUTION", keywords_he: ["נתינה", "תרומה", "השלמת מחסור", "שירות"] },
  { family_id: "11", label_en: "KNOWLEDGE / UNDERSTANDING / ORIENTATION", keywords_he: ["ידע", "למידה", "הבנה", "חשיבה", "התמצאות"] },
  { family_id: "12", label_en: "DEVELOPMENT & IMPROVEMENT", keywords_he: ["גדילה", "התפתחות", "שינוי", "שיפור"] },
  { family_id: "13", label_en: "CREATION & EXPRESSION", keywords_he: ["יצירתיות", "אמנות", "ביטוי", "דמיון"] },
  { family_id: "14", label_en: "COURAGE & AGENCY", keywords_he: ["אומץ", "יוזמה", "פעולה"] },
  { family_id: "15", label_en: "DISCIPLINE / RESTRAINT / BALANCE", keywords_he: ["ויסות", "איפוק", "דחיית סיפוקים", "איזון"] },
  { family_id: "16", label_en: "PERSISTENCE & CONTINUITY", keywords_he: ["התמדה", "מומנטום", "עקביות"] },
  { family_id: "17", label_en: "COOPERATION & COORDINATION", keywords_he: ["שיתוף פעולה", "תיאום", "פעולה קולקטיבית"] },
  { family_id: "18", label_en: "RESOURCE STEWARDSHIP / ANTI-DEPLETION", keywords_he: ["שמירת משאבים", "עלות", "תועלת", "ריקון"] },
  { family_id: "19", label_en: "CAPABILITY & EMPOWERMENT", keywords_he: ["יכולת", "מיומנות", "הזדמנות"] },
  { family_id: "20", label_en: "PRIVACY / OWNERSHIP / BOUNDARIES", keywords_he: ["פרטיות", "בעלות", "גבולות"] },
  { family_id: "21", label_en: "ACCEPTANCE / DIFFERENCE / PLURALISM", keywords_he: ["קבלה", "שונות", "שיפוט"] },
  { family_id: "22", label_en: "TRANSPARENCY & ACCOUNTABILITY", keywords_he: ["שקיפות", "מקור", "אחריותיות"] },
  { family_id: "23", label_en: "WELL-BEING & QUALITY OF LIFE", keywords_he: ["רווחה", "אושר", "איכות חיים"] },
  { family_id: "24", label_en: "ACHIEVEMENT / EXCELLENCE / PRODUCTIVITY", keywords_he: ["הישג", "מצוינות", "פרודוקטיביות"] },
  { family_id: "25", label_en: "RESPECT & RECOGNITION", keywords_he: ["כבוד", "הערכה", "הכרה הדדית"] },
  { family_id: "26", label_en: "COMMUNICATION & MUTUAL UNDERSTANDING", keywords_he: ["שפה", "תקשורת", "הבנה הדדית"] },
  { family_id: "27", label_en: "ADAPTABILITY & RESILIENCE", keywords_he: ["הסתגלות", "חוסן", "התאוששות"] },
  { family_id: "28", label_en: "RECIPROCITY & EXCHANGE", keywords_he: ["הדדיות", "Matching", "Transfer"] },
];

export type ValueTaxonomyStatus = "CANONICAL_RUNTIME" | "REVIEW_REQUIRED" | "REFERENCE_ONLY" | "UNSUPPORTED";

export interface ValueTaxonomyClassification {
  family_id: string;
  label_en: string;
  status: ValueTaxonomyStatus;
  reason: string;
  matched_runtime_value_names: string[];
  matched_source_concept_ids: string[];
}

function keywordMatches(text: string, keyword: string): boolean {
  return text.toLowerCase().includes(keyword.toLowerCase());
}

/**
 * Pure, deterministic, no I/O. `runtimeValueNames` is the caller's
 * already-loaded `valueRegistry.ts::ValueEntry[]` names — never re-read
 * or re-derived here.
 */
export function classifyValueTaxonomy(
  runtimeValueNames: string[],
  sourceConcepts: SourceConcept[] = SOURCE_CONCEPTS,
): ValueTaxonomyClassification[] {
  return VALUE_TAXONOMY_CANDIDATES.map((candidate) => {
    const matchedRuntime = runtimeValueNames.filter((name) => candidate.keywords_he.some((kw) => keywordMatches(name, kw)));
    if (matchedRuntime.length > 0) {
      return {
        family_id: candidate.family_id,
        label_en: candidate.label_en,
        status: "CANONICAL_RUNTIME",
        reason: `matches ${matchedRuntime.length} real, live runtime Value(s)`,
        matched_runtime_value_names: matchedRuntime,
        matched_source_concept_ids: [],
      };
    }

    const matchedConcepts = sourceConcepts.filter((c) =>
      candidate.keywords_he.some((kw) => keywordMatches(c.source_wording, kw) || keywordMatches(c.normalized_label, kw)),
    );
    const strongMatch = matchedConcepts.find((c) => c.confidence === "high" && c.review_status === "reviewed");
    if (strongMatch) {
      return {
        family_id: candidate.family_id,
        label_en: candidate.label_en,
        status: "REVIEW_REQUIRED",
        reason: `${matchedConcepts.length} source concept(s) matched, strongest: ${strongMatch.canonical_id} (${strongMatch.type}, high confidence, reviewed) — awaiting real promotion decision`,
        matched_runtime_value_names: [],
        matched_source_concept_ids: matchedConcepts.map((c) => c.canonical_id),
      };
    }

    if (matchedConcepts.length > 0) {
      return {
        family_id: candidate.family_id,
        label_en: candidate.label_en,
        status: "REFERENCE_ONLY",
        reason: `${matchedConcepts.length} source concept(s) matched, none at high-confidence+reviewed strength`,
        matched_runtime_value_names: [],
        matched_source_concept_ids: matchedConcepts.map((c) => c.canonical_id),
      };
    }

    return {
      family_id: candidate.family_id,
      label_en: candidate.label_en,
      status: "UNSUPPORTED",
      reason: "0 match in runtime registry or source corpus",
      matched_runtime_value_names: [],
      matched_source_concept_ids: [],
    };
  });
}
