/**
 * CONTRADICTION MASTER — one identity per contradiction, many memberships.
 *
 * Built from a complete read of all 21 contradiction/value source files.
 * READ-ONLY: no store, no runtime detection, no promotion to canon.
 *
 * ── The ruling this encodes ────────────────────────────────────────────
 *
 * Seven taxonomies exist in the source and NONE is authoritative. Two of
 * them each declare a CLOSED set of different size (core-10 and
 * extended-30). Rather than pick a winner, identity and classification are
 * separated:
 *
 *   CONTRADICTION_IDENTITY != TAXONOMY MEMBERSHIP
 *                          != LAYER TAG
 *                          != 3x3 CELL
 *
 * A contradiction appears ONCE as an identity and may carry any number of
 * memberships. `core_10` vs `extended_30` precedence is deliberately
 * UNRESOLVED — 7 of core-10's 10 appear inside extended-30, but both claim
 * closure and no source states which supersedes.
 *
 * ── Deliberately absent ────────────────────────────────────────────────
 *
 * No score, no magnitude, no weight, no threshold, no 3x3 coordinate. The
 * source supplies none of these, and `layer_tags` proves a contradiction is
 * explicitly MULTI-layer ("רוצה↔נמנע" is tagged both שכלי and גופני), so it
 * cannot be a single (domain, frame) cell even in principle.
 *
 * Counts: 125 raw parsed rows -> 18 were layer-tag ANNOTATIONS, not
 * identities (15 attached to an existing identity, 3 became identities of
 * their own) -> 110 true contradiction identities.
 */

export type TaxonomyKey =
  | "core_10"
  | "extended_30"
  | "repo_24"
  | "six_class_v1"
  | "six_class_v2"
  | "grouping_4"
  | "value_relation";

export interface TaxonomyMembership {
  taxonomy: TaxonomyKey;
  /** The class this taxonomy files it under, when that taxonomy has classes. */
  in_class?: string;
}

export interface ContradictionMasterEntry {
  contradiction_id: string;
  pole_a: string;
  pole_b: string;
  /** Source file numbers this identity was seen in. */
  source_files: number[];
  taxonomy_memberships: TaxonomyMembership[];
  /** The source's own "חציה לשכבות" annotations — a contradiction may sit in
   *  several layers at once. Evidence AGAINST any single-cell mapping. */
  layer_tags: string[];
}

/** 110 identities. Order is alphabetical by pole_a — not a ranking. */
export const CONTRADICTION_MASTER: ContradictionMasterEntry[] = [
  { contradiction_id: "CX-001", pole_a: "אהבה", pole_b: "דחייה",
    source_files: [15, 20], taxonomy_memberships: [{ taxonomy: "grouping_4", in_class: "רגשיים" }, { taxonomy: "six_class_v1", in_class: "רגשיים" }],
    layer_tags: [] },
  { contradiction_id: "CX-002", pole_a: "איד", pole_b: "סופראגו",
    source_files: [3, 14], taxonomy_memberships: [{ taxonomy: "core_10" }, { taxonomy: "extended_30" }],
    layer_tags: [] },
  { contradiction_id: "CX-003", pole_a: "אמון", pole_b: "חשד",
    source_files: [14, 16], taxonomy_memberships: [{ taxonomy: "extended_30" }, { taxonomy: "six_class_v2", in_class: "רגשית" }],
    layer_tags: ["חברתי"] },
  { contradiction_id: "CX-004", pole_a: "אנרגיה", pole_b: "מרווח",
    source_files: [3, 14], taxonomy_memberships: [{ taxonomy: "core_10" }, { taxonomy: "extended_30" }],
    layer_tags: [] },
  { contradiction_id: "CX-005", pole_a: "אנרגיה גבוהה", pole_b: "עייפות",
    source_files: [20], taxonomy_memberships: [{ taxonomy: "grouping_4", in_class: "גופניים" }],
    layer_tags: [] },
  { contradiction_id: "CX-006", pole_a: "בדידות", pole_b: "שייכות",
    source_files: [15], taxonomy_memberships: [{ taxonomy: "six_class_v1", in_class: "רגשיים" }],
    layer_tags: [] },
  { contradiction_id: "CX-007", pole_a: "בהירות", pole_b: "בלבול",
    source_files: [16], taxonomy_memberships: [{ taxonomy: "six_class_v2", in_class: "שכלית" }],
    layer_tags: ["חברתי (הבנת סיטואציות)"] },
  { contradiction_id: "CX-008", pole_a: "ביטחון", pole_b: "איום",
    source_files: [14], taxonomy_memberships: [{ taxonomy: "extended_30" }, { taxonomy: "repo_24", in_class: "cn_security_threat" }],
    layer_tags: [] },
  { contradiction_id: "CX-009", pole_a: "דחף", pole_b: "ריסון",
    source_files: [3, 14], taxonomy_memberships: [{ taxonomy: "core_10" }, { taxonomy: "extended_30" }],
    layer_tags: [] },
  { contradiction_id: "CX-010", pole_a: "דיוק", pole_b: "רעש",
    source_files: [14], taxonomy_memberships: [{ taxonomy: "extended_30" }, { taxonomy: "repo_24", in_class: "cn_precision_noise" }],
    layer_tags: [] },
  { contradiction_id: "CX-011", pole_a: "דרגתחום גבוהה", pole_b: "נמוכה (נפרד מהחם/קר)",
    source_files: [16], taxonomy_memberships: [{ taxonomy: "six_class_v2", in_class: "גופנית" }],
    layer_tags: [] },
  { contradiction_id: "CX-012", pole_a: "דרוך", pole_b: "רגוע",
    source_files: [16], taxonomy_memberships: [{ taxonomy: "six_class_v2", in_class: "גופנית" }],
    layer_tags: ["שכלי"] },
  { contradiction_id: "CX-013", pole_a: "דתיות", pole_b: "להט\"ב",
    source_files: [15], taxonomy_memberships: [{ taxonomy: "six_class_v1", in_class: "חברתיים–קהילתיים" }],
    layer_tags: [] },
  { contradiction_id: "CX-014", pole_a: "הגיון", pole_b: "דמיון",
    source_files: [15], taxonomy_memberships: [{ taxonomy: "six_class_v1", in_class: "שכליים" }],
    layer_tags: [] },
  { contradiction_id: "CX-015", pole_a: "השפעה", pole_b: "הובלות",
    source_files: [20], taxonomy_memberships: [{ taxonomy: "grouping_4", in_class: "חברתיים" }],
    layer_tags: [] },
  { contradiction_id: "CX-016", pole_a: "השפעה", pole_b: "תלות",
    source_files: [14], taxonomy_memberships: [{ taxonomy: "extended_30" }],
    layer_tags: [] },
  { contradiction_id: "CX-017", pole_a: "התהוות", pole_b: "דעיכה",
    source_files: [3, 14], taxonomy_memberships: [{ taxonomy: "core_10" }, { taxonomy: "extended_30" }],
    layer_tags: [] },
  { contradiction_id: "CX-018", pole_a: "התרחבות", pole_b: "כיווץ",
    source_files: [16], taxonomy_memberships: [{ taxonomy: "six_class_v2", in_class: "קוסמית־פיזיקלית" }],
    layer_tags: [] },
  { contradiction_id: "CX-019", pole_a: "ודאות", pole_b: "ספק",
    source_files: [15], taxonomy_memberships: [{ taxonomy: "repo_24", in_class: "cn_certainty_doubt" }, { taxonomy: "six_class_v1", in_class: "שכליים" }],
    layer_tags: [] },
  { contradiction_id: "CX-020", pole_a: "זהות", pole_b: "אוניברסליות",
    source_files: [21], taxonomy_memberships: [{ taxonomy: "value_relation" }],
    layer_tags: [] },
  { contradiction_id: "CX-021", pole_a: "זהות", pole_b: "הסתגלות",
    source_files: [14], taxonomy_memberships: [{ taxonomy: "extended_30" }],
    layer_tags: [] },
  { contradiction_id: "CX-022", pole_a: "זורם", pole_b: "חוסם",
    source_files: [16], taxonomy_memberships: [{ taxonomy: "six_class_v2", in_class: "גופנית" }],
    layer_tags: [] },
  { contradiction_id: "CX-023", pole_a: "זרימה", pole_b: "קיפאון",
    source_files: [16], taxonomy_memberships: [{ taxonomy: "six_class_v2", in_class: "קוסמית־פיזיקלית" }],
    layer_tags: ["גופני", "מחשבתי"] },
  { contradiction_id: "CX-024", pole_a: "חברה", pole_b: "פרט",
    source_files: [21], taxonomy_memberships: [{ taxonomy: "value_relation" }],
    layer_tags: [] },
  { contradiction_id: "CX-025", pole_a: "חום", pole_b: "קור",
    source_files: [14], taxonomy_memberships: [{ taxonomy: "extended_30" }],
    layer_tags: [] },
  { contradiction_id: "CX-026", pole_a: "חומר", pole_b: "מרווח",
    source_files: [3, 14], taxonomy_memberships: [{ taxonomy: "core_10" }, { taxonomy: "extended_30" }],
    layer_tags: [] },
  { contradiction_id: "CX-027", pole_a: "חופש", pole_b: "שליטה",
    source_files: [15], taxonomy_memberships: [{ taxonomy: "six_class_v1", in_class: "גלובליים–מערכתיים" }],
    layer_tags: [] },
  { contradiction_id: "CX-028", pole_a: "חוק", pole_b: "חופש",
    source_files: [3, 14], taxonomy_memberships: [{ taxonomy: "core_10" }, { taxonomy: "extended_30" }],
    layer_tags: [] },
  { contradiction_id: "CX-029", pole_a: "חזק", pole_b: "שביר",
    source_files: [16], taxonomy_memberships: [{ taxonomy: "six_class_v2", in_class: "אישית־ערכית" }],
    layer_tags: ["גופני"] },
  { contradiction_id: "CX-030", pole_a: "חזרתיות", pole_b: "פריצה",
    source_files: [14], taxonomy_memberships: [{ taxonomy: "extended_30" }, { taxonomy: "repo_24", in_class: "cn_repetition_breakthrough" }],
    layer_tags: [] },
  { contradiction_id: "CX-031", pole_a: "חמלה", pole_b: "אדישות",
    source_files: [20], taxonomy_memberships: [{ taxonomy: "grouping_4", in_class: "רגשיים" }],
    layer_tags: [] },
  { contradiction_id: "CX-032", pole_a: "יישור", pole_b: "חיכוך",
    source_files: [14], taxonomy_memberships: [{ taxonomy: "extended_30" }],
    layer_tags: [] },
  { contradiction_id: "CX-033", pole_a: "יציבות", pole_b: "שינוי",
    source_files: [14], taxonomy_memberships: [{ taxonomy: "extended_30" }, { taxonomy: "repo_24", in_class: "cn_stability_change" }],
    layer_tags: [] },
  { contradiction_id: "CX-034", pole_a: "כאב", pole_b: "נוחות",
    source_files: [15, 20], taxonomy_memberships: [{ taxonomy: "grouping_4", in_class: "גופניים" }, { taxonomy: "six_class_v1", in_class: "גופניים–סנסוריים" }],
    layer_tags: [] },
  { contradiction_id: "CX-035", pole_a: "כאב", pole_b: "נחמה",
    source_files: [15], taxonomy_memberships: [{ taxonomy: "six_class_v1", in_class: "רגשיים" }],
    layer_tags: [] },
  { contradiction_id: "CX-036", pole_a: "כבוד", pole_b: "חופש",
    source_files: [21], taxonomy_memberships: [{ taxonomy: "value_relation" }],
    layer_tags: [] },
  { contradiction_id: "CX-037", pole_a: "כוח", pole_b: "הוגנות",
    source_files: [15], taxonomy_memberships: [{ taxonomy: "six_class_v1", in_class: "חברתיים–קהילתיים" }],
    layer_tags: [] },
  { contradiction_id: "CX-038", pole_a: "כיוון", pole_b: "זווית",
    source_files: [3, 14], taxonomy_memberships: [{ taxonomy: "core_10" }, { taxonomy: "extended_30" }],
    layer_tags: [] },
  { contradiction_id: "CX-039", pole_a: "כלכלה חברתית", pole_b: "קפיטליזם פראי",
    source_files: [15], taxonomy_memberships: [{ taxonomy: "six_class_v1", in_class: "גלובליים–מערכתיים" }],
    layer_tags: [] },
  { contradiction_id: "CX-040", pole_a: "לוגיקה", pole_b: "אינטואיציה",
    source_files: [20], taxonomy_memberships: [{ taxonomy: "grouping_4", in_class: "שכליים" }],
    layer_tags: [] },
  { contradiction_id: "CX-041", pole_a: "לחץ", pole_b: "שחרור",
    source_files: [14], taxonomy_memberships: [{ taxonomy: "extended_30" }, { taxonomy: "repo_24", in_class: "cn_pressure_release" }],
    layer_tags: [] },
  { contradiction_id: "CX-042", pole_a: "מאמץ", pole_b: "שחיקה",
    source_files: [14], taxonomy_memberships: [{ taxonomy: "extended_30" }, { taxonomy: "repo_24", in_class: "cn_effort_erosion" }],
    layer_tags: [] },
  { contradiction_id: "CX-043", pole_a: "מאמץ", pole_b: "שחרור",
    source_files: [20], taxonomy_memberships: [{ taxonomy: "grouping_4", in_class: "גופניים" }],
    layer_tags: [] },
  { contradiction_id: "CX-044", pole_a: "מדולדל", pole_b: "מרוכז",
    source_files: [16], taxonomy_memberships: [{ taxonomy: "six_class_v2", in_class: "גופנית" }],
    layer_tags: ["ערכי (יכולת פעולה)"] },
  { contradiction_id: "CX-045", pole_a: "מוביל", pole_b: "מובל",
    source_files: [16], taxonomy_memberships: [{ taxonomy: "six_class_v2", in_class: "אישית־ערכית" }],
    layer_tags: ["חברתי"] },
  { contradiction_id: "CX-046", pole_a: "מודע", pole_b: "אוטומטי",
    source_files: [16], taxonomy_memberships: [{ taxonomy: "six_class_v2", in_class: "שכלית" }],
    layer_tags: ["רגש"] },
  { contradiction_id: "CX-047", pole_a: "מודע", pole_b: "לאמודע",
    source_files: [14], taxonomy_memberships: [{ taxonomy: "extended_30" }],
    layer_tags: [] },
  { contradiction_id: "CX-048", pole_a: "מוקפץ", pole_b: "יציב מחשבתית",
    source_files: [16], taxonomy_memberships: [{ taxonomy: "six_class_v2", in_class: "שכלית" }],
    layer_tags: [] },
  { contradiction_id: "CX-049", pole_a: "מחבר", pole_b: "מפריד",
    source_files: [16], taxonomy_memberships: [{ taxonomy: "six_class_v2", in_class: "חברתית" }],
    layer_tags: ["קוסמי (תנועה ↔ פירוק)"] },
  { contradiction_id: "CX-050", pole_a: "מחובר", pole_b: "כרות",
    source_files: [16], taxonomy_memberships: [{ taxonomy: "six_class_v2", in_class: "רגשית" }],
    layer_tags: [] },
  { contradiction_id: "CX-051", pole_a: "מחשבה איטית", pole_b: "החלטה מהירה",
    source_files: [20], taxonomy_memberships: [{ taxonomy: "grouping_4", in_class: "שכליים" }],
    layer_tags: [] },
  { contradiction_id: "CX-052", pole_a: "מיושר", pole_b: "מפורק",
    source_files: [16], taxonomy_memberships: [{ taxonomy: "six_class_v2", in_class: "אישית־ערכית" }],
    layer_tags: ["רגשי"] },
  { contradiction_id: "CX-053", pole_a: "מכבד", pole_b: "מבטל",
    source_files: [16], taxonomy_memberships: [{ taxonomy: "six_class_v2", in_class: "חברתית" }],
    layer_tags: ["ערכי (מעמד חברתי)"] },
  { contradiction_id: "CX-054", pole_a: "מכוון", pole_b: "אבוד",
    source_files: [16], taxonomy_memberships: [{ taxonomy: "six_class_v2", in_class: "אישית־ערכית" }],
    layer_tags: [] },
  { contradiction_id: "CX-055", pole_a: "ממוסגר", pole_b: "חסרמסגור",
    source_files: [16], taxonomy_memberships: [{ taxonomy: "six_class_v2", in_class: "שכלית" }],
    layer_tags: [] },
  { contradiction_id: "CX-056", pole_a: "מסורת", pole_b: "קדמה",
    source_files: [21], taxonomy_memberships: [{ taxonomy: "value_relation" }],
    layer_tags: [] },
  { contradiction_id: "CX-057", pole_a: "מסורת", pole_b: "קידמה",
    source_files: [15], taxonomy_memberships: [{ taxonomy: "six_class_v1", in_class: "חברתיים–קהילתיים" }],
    layer_tags: [] },
  { contradiction_id: "CX-058", pole_a: "מרוכזאנרגטית", pole_b: "מדולדל",
    source_files: [16], taxonomy_memberships: [{ taxonomy: "six_class_v2", in_class: "גופנית" }],
    layer_tags: [] },
  { contradiction_id: "CX-059", pole_a: "מרים", pole_b: "מוריד",
    source_files: [16], taxonomy_memberships: [{ taxonomy: "six_class_v2", in_class: "חברתית" }],
    layer_tags: [] },
  { contradiction_id: "CX-060", pole_a: "מרכז", pole_b: "שוליים",
    source_files: [15], taxonomy_memberships: [{ taxonomy: "six_class_v1", in_class: "חברתיים–קהילתיים" }],
    layer_tags: [] },
  { contradiction_id: "CX-061", pole_a: "משיכה", pole_b: "דחייה",
    source_files: [16], taxonomy_memberships: [{ taxonomy: "six_class_v2", in_class: "קוסמית־פיזיקלית" }],
    layer_tags: ["רגשי וחברתי"] },
  { contradiction_id: "CX-062", pole_a: "משמעות", pole_b: "ריק",
    source_files: [14], taxonomy_memberships: [{ taxonomy: "extended_30" }],
    layer_tags: [] },
  { contradiction_id: "CX-063", pole_a: "משמעות", pole_b: "ריקנות",
    source_files: [15], taxonomy_memberships: [{ taxonomy: "six_class_v1", in_class: "אישיים" }],
    layer_tags: [] },
  { contradiction_id: "CX-064", pole_a: "מתח", pole_b: "רפיון",
    source_files: [15], taxonomy_memberships: [{ taxonomy: "six_class_v1", in_class: "גופניים–סנסוריים" }],
    layer_tags: [] },
  { contradiction_id: "CX-065", pole_a: "נוכח", pole_b: "נעלם",
    source_files: [16], taxonomy_memberships: [{ taxonomy: "six_class_v2", in_class: "רגשית" }],
    layer_tags: ["אישי"] },
  { contradiction_id: "CX-066", pole_a: "נוכח", pole_b: "נעלם רגשית",
    source_files: [16], taxonomy_memberships: [{ taxonomy: "six_class_v2", in_class: "רגשית" }],
    layer_tags: [] },
  { contradiction_id: "CX-067", pole_a: "נתינה", pole_b: "לקיחה",
    source_files: [14], taxonomy_memberships: [{ taxonomy: "extended_30" }],
    layer_tags: [] },
  { contradiction_id: "CX-068", pole_a: "סדר", pole_b: "כאוס",
    source_files: [14, 15], taxonomy_memberships: [{ taxonomy: "extended_30" }, { taxonomy: "six_class_v1", in_class: "שכליים" }],
    layer_tags: [] },
  { contradiction_id: "CX-069", pole_a: "סף", pole_b: "קריסה",
    source_files: [3], taxonomy_memberships: [{ taxonomy: "core_10" }],
    layer_tags: [] },
  { contradiction_id: "CX-070", pole_a: "ספקנות", pole_b: "ודאות",
    source_files: [20], taxonomy_memberships: [{ taxonomy: "grouping_4", in_class: "שכליים" }],
    layer_tags: [] },
  { contradiction_id: "CX-071", pole_a: "סתירה", pole_b: "התאמה",
    source_files: [16], taxonomy_memberships: [{ taxonomy: "six_class_v2", in_class: "קוסמית־פיזיקלית" }],
    layer_tags: [] },
  { contradiction_id: "CX-072", pole_a: "עדין", pole_b: "קההלב",
    source_files: [16], taxonomy_memberships: [{ taxonomy: "six_class_v2", in_class: "רגשית" }],
    layer_tags: [] },
  { contradiction_id: "CX-073", pole_a: "עומס", pole_b: "מרווח",
    source_files: [16], taxonomy_memberships: [{ taxonomy: "six_class_v2", in_class: "קוסמית־פיזיקלית" }],
    layer_tags: ["כימי (חומר/מרווח/זמן — הקלאסטר)"] },
  { contradiction_id: "CX-074", pole_a: "עומק", pole_b: "שטח",
    source_files: [14], taxonomy_memberships: [{ taxonomy: "extended_30" }, { taxonomy: "repo_24", in_class: "cn_depth_shallowness" }],
    layer_tags: [] },
  { contradiction_id: "CX-075", pole_a: "עומק", pole_b: "שטחיות",
    source_files: [15], taxonomy_memberships: [{ taxonomy: "six_class_v1", in_class: "שכליים" }],
    layer_tags: [] },
  { contradiction_id: "CX-076", pole_a: "עייפות", pole_b: "אנרגיה",
    source_files: [15], taxonomy_memberships: [{ taxonomy: "six_class_v1", in_class: "גופניים–סנסוריים" }],
    layer_tags: [] },
  { contradiction_id: "CX-077", pole_a: "עצמאות", pole_b: "תלות",
    source_files: [15], taxonomy_memberships: [{ taxonomy: "six_class_v1", in_class: "אישיים" }],
    layer_tags: [] },
  { contradiction_id: "CX-078", pole_a: "ערך עצמי", pole_b: "חוסר ערך",
    source_files: [15], taxonomy_memberships: [{ taxonomy: "six_class_v1", in_class: "אישיים" }],
    layer_tags: [] },
  { contradiction_id: "CX-079", pole_a: "פוטנציאל", pole_b: "מימוש",
    source_files: [14], taxonomy_memberships: [{ taxonomy: "extended_30" }, { taxonomy: "repo_24", in_class: "cn_potential_realization" }],
    layer_tags: [] },
  { contradiction_id: "CX-080", pole_a: "פוטנציאל", pole_b: "תנועה",
    source_files: [3], taxonomy_memberships: [{ taxonomy: "core_10" }],
    layer_tags: [] },
  { contradiction_id: "CX-081", pole_a: "פחד", pole_b: "ביטחון",
    source_files: [15, 20], taxonomy_memberships: [{ taxonomy: "grouping_4", in_class: "רגשיים" }, { taxonomy: "six_class_v1", in_class: "רגשיים" }],
    layer_tags: [] },
  { contradiction_id: "CX-082", pole_a: "פעולה", pole_b: "מנוחה",
    source_files: [20], taxonomy_memberships: [{ taxonomy: "grouping_4", in_class: "גופניים" }],
    layer_tags: [] },
  { contradiction_id: "CX-083", pole_a: "פרט", pole_b: "כלל",
    source_files: [14, 20], taxonomy_memberships: [{ taxonomy: "extended_30" }, { taxonomy: "grouping_4", in_class: "חברתיים" }],
    layer_tags: [] },
  { contradiction_id: "CX-084", pole_a: "פתוחלאנשים", pole_b: "סגורלאנשים",
    source_files: [16], taxonomy_memberships: [{ taxonomy: "six_class_v2", in_class: "חברתית" }],
    layer_tags: [] },
  { contradiction_id: "CX-085", pole_a: "פתרון", pole_b: "תקיעות רגשית",
    source_files: [16], taxonomy_memberships: [{ taxonomy: "six_class_v2", in_class: "רגשית" }],
    layer_tags: [] },
  { contradiction_id: "CX-086", pole_a: "קהילה", pole_b: "אינדיבידואל",
    source_files: [15], taxonomy_memberships: [{ taxonomy: "six_class_v1", in_class: "חברתיים–קהילתיים" }],
    layer_tags: [] },
  { contradiction_id: "CX-087", pole_a: "קונפורמיות", pole_b: "מרד",
    source_files: [20], taxonomy_memberships: [{ taxonomy: "grouping_4", in_class: "חברתיים" }],
    layer_tags: [] },
  { contradiction_id: "CX-088", pole_a: "קנאי לערכים", pole_b: "אדיש לערכים",
    source_files: [16], taxonomy_memberships: [{ taxonomy: "six_class_v2", in_class: "אישית־ערכית" }],
    layer_tags: [] },
  { contradiction_id: "CX-089", pole_a: "קפוץ", pole_b: "פתוח",
    source_files: [16], taxonomy_memberships: [{ taxonomy: "six_class_v2", in_class: "גופנית" }],
    layer_tags: ["רגשי"] },
  { contradiction_id: "CX-090", pole_a: "ראייה מערכתית", pole_b: "פירוק לפרטים",
    source_files: [20], taxonomy_memberships: [{ taxonomy: "grouping_4", in_class: "שכליים" }],
    layer_tags: [] },
  { contradiction_id: "CX-091", pole_a: "רואה", pole_b: "מתעלם",
    source_files: [16], taxonomy_memberships: [{ taxonomy: "six_class_v2", in_class: "חברתית" }],
    layer_tags: ["רגשי"] },
  { contradiction_id: "CX-092", pole_a: "רוגע", pole_b: "סערה",
    source_files: [20], taxonomy_memberships: [{ taxonomy: "grouping_4", in_class: "רגשיים" }],
    layer_tags: [] },
  { contradiction_id: "CX-093", pole_a: "רוצה", pole_b: "נמנע",
    source_files: [16], taxonomy_memberships: [{ taxonomy: "six_class_v2", in_class: "רגשית" }],
    layer_tags: ["גופני (תנועה/עיכוב)", "שכלי (בחירה)"] },
  { contradiction_id: "CX-094", pole_a: "רחב", pole_b: "צר",
    source_files: [16], taxonomy_memberships: [{ taxonomy: "six_class_v2", in_class: "שכלית" }],
    layer_tags: ["קוסמי (תפיסת עולם)"] },
  { contradiction_id: "CX-095", pole_a: "רחב", pole_b: "צר תודעתית",
    source_files: [16], taxonomy_memberships: [{ taxonomy: "six_class_v2", in_class: "שכלית" }],
    layer_tags: [] },
  { contradiction_id: "CX-096", pole_a: "ריכוז", pole_b: "פיזור",
    source_files: [14], taxonomy_memberships: [{ taxonomy: "extended_30" }, { taxonomy: "repo_24", in_class: "cn_concentration_dispersion" }],
    layer_tags: [] },
  { contradiction_id: "CX-097", pole_a: "ריק", pole_b: "עומס",
    source_files: [3], taxonomy_memberships: [{ taxonomy: "core_10" }],
    layer_tags: [] },
  { contradiction_id: "CX-098", pole_a: "רעב", pole_b: "שובע",
    source_files: [15], taxonomy_memberships: [{ taxonomy: "six_class_v1", in_class: "גופניים–סנסוריים" }],
    layer_tags: [] },
  { contradiction_id: "CX-099", pole_a: "רצון", pole_b: "פחד",
    source_files: [14], taxonomy_memberships: [{ taxonomy: "extended_30" }, { taxonomy: "repo_24", in_class: "cn_will_fear" }],
    layer_tags: [] },
  { contradiction_id: "CX-100", pole_a: "שייכות", pole_b: "נבדלות",
    source_files: [20], taxonomy_memberships: [{ taxonomy: "grouping_4", in_class: "חברתיים" }],
    layer_tags: [] },
  { contradiction_id: "CX-101", pole_a: "שייכות", pole_b: "ניתוק",
    source_files: [14], taxonomy_memberships: [{ taxonomy: "extended_30" }],
    layer_tags: [] },
  { contradiction_id: "CX-102", pole_a: "שיתוף פעולה", pole_b: "תחרות",
    source_files: [20], taxonomy_memberships: [{ taxonomy: "grouping_4", in_class: "חברתיים" }],
    layer_tags: [] },
  { contradiction_id: "CX-103", pole_a: "שלום", pole_b: "כוח",
    source_files: [15], taxonomy_memberships: [{ taxonomy: "six_class_v1", in_class: "גלובליים–מערכתיים" }],
    layer_tags: [] },
  { contradiction_id: "CX-104", pole_a: "שליטה", pole_b: "אובדןשליטה",
    source_files: [14], taxonomy_memberships: [{ taxonomy: "extended_30" }, { taxonomy: "repo_24", in_class: "cn_control_loss" }],
    layer_tags: [] },
  { contradiction_id: "CX-105", pole_a: "שליטה", pole_b: "כניעה",
    source_files: [15], taxonomy_memberships: [{ taxonomy: "six_class_v1", in_class: "אישיים" }],
    layer_tags: [] },
  { contradiction_id: "CX-106", pole_a: "שקיפות", pole_b: "מניפולציה",
    source_files: [15], taxonomy_memberships: [{ taxonomy: "six_class_v1", in_class: "גלובליים–מערכתיים" }],
    layer_tags: [] },
  { contradiction_id: "CX-107", pole_a: "תכנון", pole_b: "ספונטניות",
    source_files: [20], taxonomy_memberships: [{ taxonomy: "grouping_4", in_class: "שכליים" }],
    layer_tags: [] },
  { contradiction_id: "CX-108", pole_a: "תנועה", pole_b: "סטטיות",
    source_files: [14], taxonomy_memberships: [{ taxonomy: "extended_30" }],
    layer_tags: [] },
  { contradiction_id: "CX-109", pole_a: "תנועה", pole_b: "קיפאון",
    source_files: [20], taxonomy_memberships: [{ taxonomy: "grouping_4", in_class: "גופניים" }],
    layer_tags: [] },
  { contradiction_id: "CX-110", pole_a: "תקווה", pole_b: "ייאוש",
    source_files: [20], taxonomy_memberships: [{ taxonomy: "grouping_4", in_class: "רגשיים" }, { taxonomy: "repo_24", in_class: "cn_hope_despair" }],
    layer_tags: [] },];

/** Every taxonomy that claims to be closed, and the measured conflict. */
export const TAXONOMY_CONFLICTS = [
  {
    conflict_id: "CLOSED_SET_CARDINALITY",
    statement:
      "Two source documents each declare a CLOSED base set of different size: " +
      "core_10 (\"סט סגור\", \"ננעלו בליבת פילוס אוריאנטציה\") and extended_30 " +
      "(\"רשימה סגורה, נקייה, היררכית\"). 7 of core_10's 10 appear inside " +
      "extended_30, but no source states which supersedes.",
    status: "UNRESOLVED" as const,
  },
  {
    conflict_id: "REPO_24_PROVENANCE_FALSE",
    previously_claimed:
      "sourceValueModel.ts records source_document: \"להלן 30 ניגודי־בסיס\" for its " +
      "contradiction entries, implying they derive from extended_30.",
    measured:
      "repo ∩ extended_30 = 11 · extended_30 not in repo = 19 · repo not in extended_30 = 11. " +
      "The repo set is NOT a subset of extended_30 and was not derived from it alone.",
    status: "SOURCE_CONFLICT" as const,
  },
  {
    conflict_id: "SIX_CLASS_TWO_VERSIONS",
    statement:
      "Two documents present \"6 classes\" with a different sixth class " +
      "(גלובלי־מערכתי vs קוסמית־פיזיקלית). Neither is marked superseding.",
    status: "UNRESOLVED" as const,
  },
];

export function findContradiction(id: string): ContradictionMasterEntry | null {
  return CONTRADICTION_MASTER.find((c) => c.contradiction_id === id) ?? null;
}

export function contradictionsInTaxonomy(t: TaxonomyKey): ContradictionMasterEntry[] {
  return CONTRADICTION_MASTER.filter((c) => c.taxonomy_memberships.some((m) => m.taxonomy === t));
}
