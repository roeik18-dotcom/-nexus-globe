/**
 * SOCIAL-VALUE SPINE — the shared read-only projection behind
 * Community -> Globe -> World.
 *
 *   Contradiction -> Emergent Value -> Personal Value -> Group Value
 *   -> Value Group relation -> Community -> Globe -> World
 *
 * Every link states what the SOURCE actually supports, and refuses the rest.
 *
 * ── The four boundaries this file exists to hold ───────────────────────
 *
 * 1. `Contradiction -> Value` exists ONLY for the four pairs the source
 *    directly gives. It is NOT generalized to the other 106 identities.
 * 2. `Group Value != Value Group`. A group value is a shared value; a Value
 *    Group is a real entity with real members. Nothing here converts one
 *    into the other.
 * 3. Membership needs a real membership record. Sharing a contradiction, a
 *    value, a family or a taxonomy is NOT a relation.
 * 4. There is NO `Contradiction -> Value Group` shortcut. The source
 *    licenses only the full path through Value.
 */
import { CONTRADICTION_MASTER, type ContradictionMasterEntry } from "./contradictionMaster";

export type SourceStatus =
  | "SOURCE_SUPPORTED_CONCEPTUAL"
  | "SOURCE_SUPPORTED_CONCEPTUAL_AGGREGATION"
  | "NOT_SOURCE_SUPPORTED"
  | "UNRESOLVED";

/**
 * The four DIRECT contradiction -> value relations, quoted from file 21.
 *
 * The source rule, verbatim: **"היא מחפשת את הערך המשותף שמתעורר דווקא מתוך
 * הניגוד"** — the shared value EMERGES FROM the contradiction.
 *
 * These four are the complete set the source gives. Cardinality is
 * deliberately UNDEFINED: the source never says one contradiction yields
 * exactly one value, nor that a value comes from exactly one contradiction.
 * Four examples are four examples, not a rule.
 */
export const DIRECT_CONTRADICTION_VALUE_RELATIONS = [
  { pole_a: "כבוד", pole_b: "חופש" },
  { pole_a: "חברה", pole_b: "פרט" },
  { pole_a: "מסורת", pole_b: "קדמה" },
  { pole_a: "זהות", pole_b: "אוניברסליות" },
].map((p) => ({
  ...p,
  relation: "EMERGENT_SHARED_VALUE" as const,
  source_rule: "הערך המשותף שמתעורר דווקא מתוך הניגוד",
  source_file: 21,
  status: "SOURCE_SUPPORTED_CONCEPTUAL" as SourceStatus,
  /** The source names the relation but never the resulting value. */
  emergent_value: null as string | null,
  cardinality: "UNDEFINED" as const,
}));

/**
 * PERSONAL -> GROUP -> GENERAL values.
 *
 * Source wording, verbatim: the private allocations **"מתכנסות"** (converge)
 * into each person's values, and then **"מתאגדות"** (aggregate) into a wider
 * system — "ערכי הפרט → ערכי קבוצה → ערכי הכלל".
 *
 * The source names the movement and never defines the operation. No sum, no
 * average, no vote, no weight, no threshold, no majority, no score. Anything
 * mechanical here would be invented, so `aggregation_operation` is UNDEFINED
 * and stays that way until a source defines it.
 */
export const VALUE_SCALE = {
  levels: ["PERSONAL_VALUES", "GROUP_VALUES", "GENERAL_VALUES"] as const,
  source_wording: ["מתכנסות", "מתאגדות", "ערכי הפרט → ערכי קבוצה → ערכי הכלל"],
  source_file: 21,
  status: "SOURCE_SUPPORTED_CONCEPTUAL_AGGREGATION" as SourceStatus,
  aggregation_operation: "UNDEFINED" as const,
  refused: ["sum", "average", "vote", "weight", "threshold", "majority", "score"],
};

export interface SpineLink {
  key: string;
  label: string;
  gloss: string;
  status: SourceStatus;
  /** Real count when the link has real records; `null` when the link is
   *  conceptual and counting it would imply mechanics it does not have. */
  count: number | null;
  basis: string;
  not_implied: string;
}

/**
 * Build the spine. Pure. Counts come from the caller's REAL records; the
 * conceptual links carry `null` rather than a number, because counting a
 * conceptual relation is the first step toward pretending it is mechanical.
 */
export function buildSocialValueSpine(params: {
  /** Real verified Value Group memberships for this subject. */
  verifiedGroupRelations?: number;
  /** Real value-group entities visible on this surface. */
  valueGroups?: number;
}): { links: SpineLink[]; master_count: number } {
  const { verifiedGroupRelations = 0, valueGroups = 0 } = params;

  const links: SpineLink[] = [
    {
      key: "contradiction", label: "BASE CONTRADICTIONS", gloss: "ניגודי בסיס",
      status: "SOURCE_SUPPORTED_CONCEPTUAL", count: CONTRADICTION_MASTER.length,
      basis: "מרשם מאוחד מ-21 קבצי מקור — זהות אחת לכל ניגוד, חברויות מרובות",
      not_implied: "אף טקסונומיה אינה מחייבת; ניגוד אינו תא 3×3 ואינו מדידה",
    },
    {
      key: "emergent_value", label: "EMERGENT VALUES", gloss: "ערכים שצומחים מהניגוד",
      status: "SOURCE_SUPPORTED_CONCEPTUAL", count: DIRECT_CONTRADICTION_VALUE_RELATIONS.length,
      basis: "4 יחסים ישירים בלבד, מצוטטים מהמקור: \"הערך המשותף שמתעורר דווקא מתוך הניגוד\"",
      not_implied: "לא מוכלל ל-106 הניגודים האחרים. הקרדינליות אינה מוגדרת — לא 1:1 ולא 1:רבים",
    },
    {
      key: "personal_value", label: "PERSONAL VALUES", gloss: "ערכי הפרט",
      status: "SOURCE_SUPPORTED_CONCEPTUAL_AGGREGATION", count: null,
      basis: "המקור: \"מתכנסות\" — התכנסות לערכי האדם",
      not_implied: "פעולת ההתכנסות אינה מוגדרת. אין סכום, ממוצע, הצבעה, משקל או סף",
    },
    {
      key: "group_value", label: "GROUP VALUES", gloss: "ערכי קבוצה",
      status: "SOURCE_SUPPORTED_CONCEPTUAL_AGGREGATION", count: null,
      basis: "המקור: \"מתאגדות\" — ערכי הפרט → ערכי קבוצה → ערכי הכלל",
      not_implied: "ערך-קבוצה אינו קבוצת-ערך. זהו ערך משותף, לא ישות עם חברים",
    },
    {
      key: "value_group", label: "VALUE GROUPS", gloss: "קבוצות ערך",
      status: valueGroups > 0 ? "SOURCE_SUPPORTED_CONCEPTUAL" : "UNRESOLVED", count: valueGroups,
      basis: "ישות אמיתית עם רשומות משלה — לא נגזרת מערך משותף",
      not_implied: "שיתוף ניגוד/ערך/משפחה אינו יוצר קבוצה ואינו יוצר קשר",
    },
    {
      key: "membership", label: "MEMBERSHIP", gloss: "חברות מאומתת",
      status: verifiedGroupRelations > 0 ? "SOURCE_SUPPORTED_CONCEPTUAL" : "UNRESOLVED",
      count: verifiedGroupRelations,
      basis: "רשומת חברות אמיתית בלבד",
      not_implied: "דמיון ערכי אינו חברות. אין קפיצה ישירה מניגוד לקבוצת ערך",
    },
  ];

  return { links, master_count: CONTRADICTION_MASTER.length };
}

/** Entries carrying the source's own multi-layer annotation. */
export function multiLayerContradictions(): ContradictionMasterEntry[] {
  return CONTRADICTION_MASTER.filter((c) => c.layer_tags.length > 0);
}
