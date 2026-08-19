/**
 * /brain's data layer — Brain V2 (information-architecture rebuild, replacing
 * the flat "10-force ring with 4 unexplained `?` slots" composition).
 *
 * Three real, separate reference tables plus the live REALITY read:
 *   - `HUMAN_DOMAINS` — BODY/EMOTION/COGNITION, the human's functional
 *     domains. Each maps 1:1 to a real canon `Domain` (G/E/C) — backed by
 *     live Observations via `buildDomainOverview`/`buildRealityGraph` below.
 *   - `REGULATORY_LAYER` — ID/EGO/SUPEREGO, the interpretive/regulatory
 *     layer that acts ACROSS the three domains, not a fourth-through-sixth
 *     equivalent domain. No live data source exists for this layer anywhere
 *     in the codebase — genuinely UNKNOWN, never faked as measured.
 *   - `CONTEXTUAL_FIELDS` — exactly 3 (Personal/Identity, Interpersonal/
 *     Social, External/Material), a real ontology distinction from
 *     BUILDING/DOMAIN and from VECTOR (never flattened into "9 forces").
 *   - `PHILOS_PRINCIPLES` — the 10-principle / 20-expression interpretive
 *     lens (`PHILOS_INTERPRETIVE_LENS`, explicitly NOT `KABBALAH_CANON` —
 *     see `PHILOS_INTERPRETIVE_LENS_PROVENANCE`). A fixed reference table,
 *     never auto-attached to a real Action/Effect — no classification
 *     function exists anywhere in this codebase, so no UI may claim one did.
 *   - `VECTOR_DEFINITIONS` — the 6 named vector types (V0–V5), edges/flows
 *     never nodes. Whether a given vector is actually DRAWN for a real
 *     Action/Effect depends on whether real source/target/evidence data
 *     exists for it — decided by the caller (`BrainV2.tsx`), not here.
 *
 * The 6 proven forces + 10 contradiction categories remain real, corpus-cited
 * content (`PHILOS-CORPUS-EXTRACTION-SAMPLE.md`) — nothing here is invented;
 * the 4 previously-unresolved "force 7–10" placeholder slots are REMOVED
 * entirely (not hidden, not dashed — deleted), since canon's own real model
 * only ever proved 6, and carrying 4 nameless "?" nodes forward stated
 * nothing true. If a real 10th-force source is ever found, it is new,
 * separately-approved work — not implied by this file's absence of a
 * placeholder.
 */
import type { CanonDynamicsGraph } from "./canon/projectCanonDynamics";
import { isNormalModeSubject } from "./subjectRegistry";

export type NodeLayer = "knowledge" | "reality";

export interface KnowledgeNode {
  id: string;
  layer: "knowledge";
  kind: "model" | "taxonomy" | "category";
  label: string;
  parent?: string;
  detail?: string;
  source?: string;
  color: string;
}

export interface RealityNode {
  id: string;
  layer: "reality";
  label: string;
  subject: string;
  domain: "G" | "E" | "C";
  observed_at: string;
  level: number;
  canon_event_id: string;
}

// Real hex values, SOURCE_BACKED — `app/lib/philos.ts::FORCE_COLOR` /
// `app/lib/orientation.ts::CLASS_COLOR` (PHILOS-COLOR-SYSTEM-MASTER.md
// Appendix A.1), reused verbatim.
const FORCE_COLOR: Record<string, string> = {
  mind: "#38bdf8",
  heart: "#22d3ee",
  body: "#fb923c",
  id: "#ef4444",
  ego: "#fbbf24",
  superego: "#a78bfa",
};

export type HumanDomainKey = "body" | "emotion" | "cognition";
export interface HumanDomain {
  key: HumanDomainKey;
  label: string;
  /** The real canon `Domain` this functional domain is backed by. */
  canonDomain: "G" | "E" | "C";
  detail: string;
  source: string;
  color: string;
}

/** BODY / EMOTION / COGNITION — the human's functional domains, each a real
 *  1:1 mapping to canon's own `Domain` axis, never a UI-invented relabeling. */
export const HUMAN_DOMAINS: HumanDomain[] = [
  { key: "body", label: "גוף · BODY", canonDomain: "G", detail: "פעולה, הישרדות, קלט־חושים", source: "קורפוס PHILOS חיצוני · canon Domain=G", color: FORCE_COLOR.body },
  { key: "emotion", label: "רגש · EMOTION", canonDomain: "E", detail: "רגשות, חמלה, תחושת ערך וקשר", source: "קורפוס PHILOS חיצוני · canon Domain=E", color: FORCE_COLOR.heart },
  { key: "cognition", label: "שכל · COGNITION", canonDomain: "C", detail: "עיבוד לוגי, ניתוח, אסטרטגיה", source: "קורפוס PHILOS חיצוני · canon Domain=C", color: FORCE_COLOR.mind },
];

export type RegulatoryKey = "id" | "ego" | "superego";
export interface RegulatoryLayer {
  key: RegulatoryKey;
  label: string;
  detail: string;
  source: string;
  color: string;
  /** Real Section+Heading in the Human Config master workbook where this
   *  layer is elaborated in depth (verified against the real file this
   *  pass — PHILOS-PRODUCT-MASTER-LEDGER.md §23), linked via
   *  `/hub/human-config`. Structure only — no live state exists for any
   *  of these Canonical_IDs yet. */
  humanConfigSection?: string;
  humanConfigHeading?: string;
}

/** ID / EGO / SUPEREGO — a regulatory/interpretive layer acting ACROSS the
 *  three domains above, not a 4th–6th equivalent domain. No live data source
 *  exists for this layer in this codebase — every field below is real,
 *  cited corpus content, but has no canon measurement behind it. */
export const REGULATORY_LAYER: RegulatoryLayer[] = [
  { key: "id", label: "איד · ID", detail: "דחף גולמי, צרכים בסיסיים", source: "קורפוס PHILOS חיצוני — לא נמדד ב-canon", color: FORCE_COLOR.id, humanConfigSection: "התפתחות פסיכוסקסואלית", humanConfigHeading: "המערכת החיסונית הנרקיסיסטית — איד" },
  { key: "ego", label: "אגו · EGO", detail: "התאמה למציאות, תיווך", source: "קורפוס PHILOS חיצוני — לא נמדד ב-canon", color: FORCE_COLOR.ego, humanConfigSection: "התפתחות פסיכוסקסואלית", humanConfigHeading: "מערכת הבקרה, הוויסות והניתוב הרגשי — אגו" },
  { key: "superego", label: "סופר־אגו · SUPEREGO", detail: "ערכים, מוסר, מצפן", source: "קורפוס PHILOS חיצוני — לא נמדד ב-canon", color: FORCE_COLOR.superego, humanConfigSection: "התפתחות פסיכוסקסואלית", humanConfigHeading: "מערכת ההתקשרות ויחסי אובייקט חיצוני — סופר־אגו" },
];

export type ContextualFieldKey = "personal" | "interpersonal" | "external";
export interface ContextualField {
  key: ContextualFieldKey;
  label: string;
  detail: string;
  color: string;
}

/** Exactly 3 contextual fields — a real ontology distinction from
 *  BUILDING/DOMAIN and from VECTOR, never flattened into "9 forces". */
export const CONTEXTUAL_FIELDS: ContextualField[] = [
  { key: "personal", label: "אישי · זהות", detail: "מה שייך לזהות הפרטית — לא נמדד כיום כישות נפרדת מ-Domain/Frame.", color: "#b592e8" },
  { key: "interpersonal", label: "בין־אישי · חברתי", detail: "אנשים, קשרים, קבוצות, קהילה — Action קנוני אינו נושא group_id; אין קישור אמיתי לקבוצה כיום.", color: "#4fd1a5" },
  { key: "external", label: "חיצוני · חומרי", detail: "משאבים, מבנים, מערכת, עולם — אין נתון מיקום/מערכת אמיתי מקושר ב-canon כיום.", color: "#5b9cf6" },
];

export type VectorKey = "v0" | "v1" | "v2" | "v3" | "v4" | "v5";
export interface VectorDefinition {
  key: VectorKey;
  label: string;
  detail: string;
}

/** The 6 named vector TYPES — edges/flows, never nodes. Whether a given
 *  vector is actually drawn for real data is decided by the caller
 *  (`BrainV2.tsx`), based on whether real source/target/evidence exists;
 *  this table only names and defines them. */
export const VECTOR_DEFINITIONS: VectorDefinition[] = [
  { key: "v1", label: "V1 — תנועת אנרגיה פנימית", detail: "שינוי Level/Stability בתוך אותו cell — נגזר מ-CellState prior→current." },
  { key: "v2", label: "V2 — מתח/התנגדות פנימית", detail: "מתח בין Domain/Frame — אין פונקציית זיהוי אמיתית כיום." },
  { key: "v3", label: "V3 — השפעה בין־אישית", detail: "השפעה בין אנשים — אין קשת/edge אמיתית ב-canon כיום." },
  { key: "v4", label: "V4 — השפעה קולקטיבית/מערכתית", detail: "השפעה על קבוצה/מערכת — אין group_id ב-Action/Effect כיום." },
  { key: "v5", label: "V5 — תנועת טון/מצב", detail: "שינוי מצב לאורך זמן לאותו נושא — נגזר מ-Observation prior→current, כרונולוגיה בלבד." },
  { key: "v0", label: "V0 — תגובת זהות/ייצוב", detail: "תגובת ייצוב לאחר אירוע — אין מדד אמיתי כיום." },
];

export type ExpressionDirection = "constructive" | "constrained";
export interface Principle {
  /** Neutral, objective PHILOS key — the only identifier used in live
   *  product code/UI. Never a historical/mystical term. */
  key: string;
  /** Neutral, objective PHILOS label — what the live UI renders. */
  label: string;
  constructive: string;
  constrained: string;
  /** The term this principle's source document uses (e.g. a Kabbalistic
   *  name) — rendered ONLY inside an explicitly labeled EXTERNAL /
   *  INTERPRETIVE SOURCE LENS view, never as the live/primary label. Not
   *  deleted (source wording is preserved, per the terminology-correction
   *  rule), just demoted to provenance. */
  sourceLensTerm: string;
}

/**
 * 10 principles × 2 expression directions = 20 dynamic expressions
 * (`PHILOS_INTERPRETIVE_LENS`). Content (the constructive/constrained
 * wording) is verbatim from the real source document —
 * `PHILOS_10_Principles_20_Expressions_HE.docx`. The document's own §9
 * states its status plainly — quoted verbatim in
 * `PHILOS_INTERPRETIVE_LENS_PROVENANCE` below, not paraphrased. A pure
 * reference table: no function anywhere classifies a real Action/Effect
 * against it, because no such classification function exists — attaching
 * one to real data would be exactly the fabricated "principle
 * classification" this codebase's honesty rule forbids. Human/Music Config
 * (the person-specific instance data in the same source folder) remain
 * unread and deferred.
 *
 * **Terminology correction (objective PHILOS language pass):** the source
 * document's own historical/Kabbalistic names (Keter, Chochmah, Binah...)
 * were previously used as the primary `key`/`label` for each principle —
 * this promoted mystical terminology into the live product's identifiers
 * and on-screen labels. Corrected: `key`/`label` are now the neutral,
 * objective wording (which the source document itself already provides,
 * in the `constructive` column — no new interpretation was invented here,
 * only which existing column became the primary label). The historical
 * term moved to `sourceLensTerm`, rendered by `BrainV2.tsx` only inside a
 * section explicitly labeled "EXTERNAL / INTERPRETIVE SOURCE LENS" — never
 * deleted, never silently rewritten, just no longer the live label.
 */
export const PHILOS_PRINCIPLES: Principle[] = [
  { key: "potential_direction", label: "פוטנציאל / כיוון · POTENTIAL / DIRECTION", constructive: "פוטנציאל / כיוון", constrained: "אובדן כיוון / פוטנציאל לא ממומש · LOSS OF DIRECTION", sourceLensTerm: "כתר · KETER" },
  { key: "possibility_idea", label: "אפשרות / רעיון · POSSIBILITY / IDEA", constructive: "אפשרות / רעיון", constrained: "אימפולס ללא עיבוד · UNPROCESSED IMPULSE", sourceLensTerm: "חכמה · CHOCHMAH" },
  { key: "structure_distinction", label: "מבנה / הבחנה · STRUCTURE / DISTINCTION", constructive: "מבנה / הבחנה", constrained: "קיבעון / מבנה חונק · RIGIDITY", sourceLensTerm: "בינה · BINAH" },
  { key: "expansion_contribution", label: "התרחבות / נתינה · EXPANSION / CONTRIBUTION", constructive: "התרחבות / נתינה", constrained: "נתינה ללא גבול / דליפה · LEAKAGE / OVER-EXTENSION", sourceLensTerm: "חסד · CHESED" },
  { key: "boundary_limit", label: "גבול / צמצום · BOUNDARY / LIMIT", constructive: "גבול / צמצום", constrained: "דיכוי / חסימת־יתר · OVER-CONSTRAINT", sourceLensTerm: "גבורה · GEVURAH" },
  { key: "integration_balance", label: "אינטגרציה / איזון · INTEGRATION / BALANCE", constructive: "אינטגרציה / איזון", constrained: "איזון מדומה / פשרה מעוותת · FALSE BALANCE", sourceLensTerm: "תפארת · TIFERET" },
  { key: "persistence_continuity", label: "התמדה / המשכיות · PERSISTENCE / CONTINUITY", constructive: "התמדה / המשכיות", constrained: "אובססיה / התעקשות · OBSESSION / OVER-PERSISTENCE", sourceLensTerm: "נצח · NETZACH" },
  { key: "processing_response", label: "עיבוד / הכרה / תגובה · PROCESSING / RESPONSE", constructive: "עיבוד / הכרה / תגובה", constrained: "כניעה / פסיביות · PASSIVITY", sourceLensTerm: "הוד · HOD" },
  { key: "connection_transfer", label: "חיבור / תיווך / העברה · CONNECTION / TRANSFER", constructive: "חיבור / תיווך / העברה", constrained: "תלות / חיבור מזיק · DEPENDENCY / HARMFUL CONNECTION", sourceLensTerm: "יסוד · YESOD" },
  { key: "realization_implementation", label: "מימוש במציאות · REALIZATION / IMPLEMENTATION", constructive: "מימוש במציאות", constrained: "שליטה / מימוש הרסני · DESTRUCTIVE REALIZATION", sourceLensTerm: "מלכות · MALKHUT" },
];

/** Quoted verbatim, source document §9 ("סטטוס מתודולוגי"). */
export const PHILOS_INTERPRETIVE_LENS_PROVENANCE =
  "STATUS: PHILOS INTERPRETIVE / COMPARATIVE LENS. NOT a live classification of any real Action/Effect. " +
  "(מקור: PHILOS_10_Principles_20_Expressions_HE.docx §9) — אינה מוצמדת אוטומטית לאף Action/Effect אמיתי; " +
  "לא קיימת פונקציית סיווג — כל שיוך עקרון ל-Action אמיתי מוצג כ-UNKNOWN עד שתיבנה אחת. " +
  "המונחים ההיסטוריים של המקור (Kabbalistic) מוצגים רק תחת EXTERNAL / INTERPRETIVE SOURCE LENS למטה — אינם התווית החיה.";

/**
 * The real loop phrasing, source document §2 ("הלולאה של PHILOS"), quoted
 * verbatim — the same lifecycle `BrainV2.tsx`'s L4 already renders from real
 * Action/Effect/Learning data, now cited to its actual source rather than
 * stated as this codebase's own invention.
 */
export const PHILOS_LOOP_HE =
  "מציאות → אדם → מניע → Orientation → פעולה → ביטוי בונה/מפרק → Effect → Evidence → Learning → מצב חדש ↺";

/**
 * The real evaluation questions, source document §5 ("שאלות הבדיקה"),
 * quoted verbatim — genuine sourced content, distinct from an actual
 * classification (which still does not exist and is never fabricated here).
 */
export const PHILOS_EVALUATION_QUESTIONS_HE: readonly string[] = [
  "מה הפעולה בנתה?",
  "מה הפעולה פירקה או החלישה?",
  "מי או מה הושפע?",
  "איזה עיקרון התחזק ובאיזה כיוון?",
  "מה היה ה-Effect בפועל?",
  "מהי הראיה לכך?",
  "מה השתנה לאורך זמן?",
  "מה PHILOS למדה מהתוצאה?",
];

export function buildKnowledgeGraph(): KnowledgeNode[] {
  const nodes: KnowledgeNode[] = [
    {
      id: "model_six_buildings",
      layer: "knowledge",
      kind: "model",
      label: "מודל ששת הבניינים — פרט ↔ כלל",
      detail: "מבנה פרקטלי: אותו מבנה חוזר במיקרו (פרט), מזו (קבוצה), מקרו (חברה). ראה HUMAN_DOMAINS/REGULATORY_LAYER.",
      source: "קורפוס PHILOS חיצוני — 3 עותקים זהים (hash) · REVIEW_REQUIRED",
      color: "#c9d4ec",
    },
    {
      id: "taxonomy_contradictions",
      layer: "knowledge",
      kind: "taxonomy",
      label: "קטגוריות ניגודים — פילוס אוריאנטציה",
      detail: "10 קטגוריות מוצהרות, מקור אחד, נקי.",
      source: "קורפוס PHILOS חיצוני",
      color: "#c9d4ec",
    },
  ];

  const categories = [
    "אונטולוגיים", "גופניים־חושיים", "רגשיים־פנימיים", "שכליים־תפיסתיים", "בין־אישיים",
    "חברתיים־תרבותיים", "מבניים־מערכתיים", "ערכיים־מוסריים", "אקזיסטנציאליים־קיומיים", "מטא־תודעתיים",
  ];
  categories.forEach((label, i) => {
    nodes.push({
      id: `contra_${i}`,
      layer: "knowledge",
      kind: "category",
      parent: "taxonomy_contradictions",
      label,
      color: "#9fb0d0",
    });
  });

  return nodes;
}

/**
 * Ledger §33: normal product mode excludes TEST/PLACEHOLDER/SYSTEM
 * subjects from the "world events" backdrop too — not just from which
 * subject sits at the center. `.philos-canon-data/canon-events.jsonl`
 * currently contains ONLY such subjects (real, checked), so this filter
 * is what makes Brain's REALITY column honestly show "nothing yet" in
 * normal mode instead of test fixtures dressed up as world activity.
 */
export function buildRealityGraph(canon: CanonDynamicsGraph): RealityNode[] {
  return canon.nodes
    .filter((n) => isNormalModeSubject(n.subject))
    .map((n) => ({
      id: n.canon_event_id,
      layer: "reality",
      label: n.label,
      subject: n.subject,
      domain: n.domain,
      observed_at: n.observed_at,
      level: n.level,
      canon_event_id: n.canon_event_id,
    }));
}

/**
 * A real, system-wide (cross-subject) most-recent-per-domain reading — the
 * same "most recent wins" discipline `orientationCore.ts::buildMeasuredStateSpace`
 * applies for one subject, generalized here since `/brain`'s focal point is
 * "the system," not one selected person. `undefined` = genuinely zero real
 * Observations for that domain anywhere in the store.
 */
export function buildDomainOverview(canon: CanonDynamicsGraph): Record<"G" | "E" | "C", RealityNode | undefined> {
  const byDomain = (d: "G" | "E" | "C") =>
    canon.nodes.filter((n) => n.domain === d).sort((a, b) => b.observed_at.localeCompare(a.observed_at))[0];
  const toNode = (n: CanonDynamicsGraph["nodes"][number] | undefined): RealityNode | undefined =>
    n && { id: n.canon_event_id, layer: "reality", label: n.label, subject: n.subject, domain: n.domain, observed_at: n.observed_at, level: n.level, canon_event_id: n.canon_event_id };
  return { G: toNode(byDomain("G")), E: toNode(byDomain("E")), C: toNode(byDomain("C")) };
}
