// PHILOS ORIENTATION — Root Architecture
//
// ID is not a force. ID is the root state.
// All forces are expressions of ID energy at different levels of development.
//
// Hierarchy:
//   ROOT (ID)
//     ↓ Physical   — energy in the body
//     ↓ Emotional  — body becomes feeling
//     ↓ Rational   — feeling becomes thought
//     ↓ Social     — thought expressed in connection
//     ↓ Ego        — connection focused into self
//     ↓ Superego   — self transcended into values

import type { DominantForce } from "./philos";

// ─── Types ────────────────────────────────────────────────────────────

export interface EnergyPath {
  force:            DominantForce;
  layerDescription: string;          // what this layer IS
  expressions:      string[];        // how ID manifests here
  risk:             string;          // shadow / danger at this level
  opportunity:      string;          // gift / potential at this level
  balancingForce:   DominantForce | "id";
  balanceReason:    string;          // why this pairing balances
  nextForce:        DominantForce | null;  // next evolution up the hierarchy
  growthAction:     string;          // one concrete move toward growth
}

// ─── Root State (ID) ─────────────────────────────────────────────────

export const ROOT_EXPRESSIONS: string[] = [
  "חוסר", "פוטנציאל", "מתח", "משיכה", "צורך", "תנועה לפני צורה",
];

export const ROOT_DESCRIPTION =
  "אנרגיה גולמית — לפני שיש לה צורה. כל הכוחות מגיעים מכאן.";

export const ROOT_CHARACTERISTICS: string[] = [
  "אי-ודאות",
  "חוסר שליטה",
  "משיכה",
  "צורך",
  "אנרגיה שמחפשת צורה",
];

// ─── Development Paths (ID → each force) ─────────────────────────────

export const ENERGY_HIERARCHY: DominantForce[] = [
  "physical",
  "emotional",
  "rational",
  "social",
  "ego",
  "superego",
];

export const DEVELOPMENT_PATHS: Record<DominantForce, EnergyPath> = {
  id: {
    force: "id",
    layerDescription: "מצב השורש. האנרגיה מחפשת צורה.",
    expressions: ["חוסר", "פוטנציאל", "מתח", "משיכה", "צורך"],
    risk: "כאוס, ריק — אנרגיה ללא כיוון",
    opportunity: "כוח גולמי — יכול להפוך לכל דבר",
    balancingForce: "superego",
    balanceReason: "האיד צריך את הסופר-אגו כדי שהאנרגיה לא תישרף לשווא",
    nextForce: "physical",
    growthAction: "הגדר צורך אחד קונקרטי לפני שאתה פועל",
  },
  physical: {
    force: "physical",
    layerDescription: "האיד קיבל צורה גופנית. אנרגיה שמתבטאת בגוף.",
    expressions: ["רעב", "כאב", "תנועה", "מיניות", "הישרדות", "אנרגיה גופנית"],
    risk: "תלות גופנית — שכחה שיש ממד פנימי",
    opportunity: "עיגון, נוכחות ממשית, כוח",
    balancingForce: "emotional",
    balanceReason: "הגוף צריך את הרגש כדי לדעת מה הוא באמת חש",
    nextForce: "emotional",
    growthAction: "הקשב לגוף — הוא אומר משהו שהמחשבה לא יכולה לומר",
  },
  emotional: {
    force: "emotional",
    layerDescription: "האנרגיה הגופנית הפכה לרגש. הגוף חש, הנפש מפרשת.",
    expressions: ["געגוע", "קשר", "פחד", "אהבה", "בדידות", "שייכות"],
    risk: "הצפה רגשית — ניתוב שגוי של אנרגיה",
    opportunity: "עומק, חיבור אמיתי, אמפתיה",
    balancingForce: "rational",
    balanceReason: "הרגש צריך את השכל כדי לא להיסחף",
    nextForce: "rational",
    growthAction: "שתף אדם אחד את הרגש — הצאה מהכלוב הפנימי",
  },
  rational: {
    force: "rational",
    layerDescription: "הרגש הפך למחשבה. האנרגיה מחפשת הסבר.",
    expressions: ["סקרנות", "ניתוח", "הסבר", "למידה", "הבנה", "תכנון"],
    risk: "ניתוח ללא פעולה — ניתוק מהרגש",
    opportunity: "בהירות, סדר, ידע שמוביל לפעולה",
    balancingForce: "emotional",
    balanceReason: "השכל צריך את הרגש כדי לדעת מה חשוב",
    nextForce: "social",
    growthAction: "תרגם תובנה אחת לצעד קטן מחר",
  },
  social: {
    force: "social",
    layerDescription: "המחשבה מתבטאת בקשרים. האנרגיה זורמת בין אנשים.",
    expressions: ["שייכות", "מעמד", "שבט", "שיתוף פעולה", "קהילה", "תרומה"],
    risk: "ביטול עצמי — ציות עיוור לקבוצה",
    opportunity: "חיבור, השפעה, ערך קולקטיבי",
    balancingForce: "ego",
    balanceReason: "הקבוצה צריכה את הפרט הייחודי שלא יתמסמס",
    nextForce: "ego",
    growthAction: "תרום משהו ספציפי לאחד מהקבוצה — לא סתם נוכחות",
  },
  ego: {
    force: "ego",
    layerDescription: "הקשר החברתי מתמקד בזהות. האנרגיה בונה עצמי.",
    expressions: ["הישג", "הכרה", "תחרות", "שליטה", "ייחודיות", "מנהיגות"],
    risk: "אינפלציה — ניתוק מהאחר, גאוותנות",
    opportunity: "כוח עצמי, זהות ברורה, מנהיגות",
    balancingForce: "social",
    balanceReason: "האגו צריך את הקהילה כדי לא להתנפח",
    nextForce: "superego",
    growthAction: "השתמש בכוח שלך לטובת מישהו אחר — לא רק לטובת עצמך",
  },
  superego: {
    force: "superego",
    layerDescription: "האגו הפך לערכים. האנרגיה מכוונת לתכלית.",
    expressions: ["מוסר", "אחריות", "משמעות", "משמעת", "ערכים", "חזון"],
    risk: "ביקורת עצמית — שיתוק מוסרי, פרפקציוניזם",
    opportunity: "משמעות, אינטגרציה, תכלית עמוקה",
    balancingForce: "id",
    balanceReason: "הסופר-אגו צריך את האיד כדי לא להתאבן",
    nextForce: null,
    growthAction: "בחר ערך אחד ותפעל לפיו היום — בלי להמתין לתנאים מושלמים",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────

/** For a given force+state, return the path and where it sits in the hierarchy */
export function getEnergyPath(force: DominantForce): EnergyPath {
  return DEVELOPMENT_PATHS[force];
}

/** Hierarchy index — ID is -1 (root), forces are 0..5 */
export function hierarchyLevel(force: DominantForce): number {
  if (force === "id") return -1;
  return ENERGY_HIERARCHY.indexOf(force);
}

/** Human-readable hierarchy label */
export const HIERARCHY_LABEL: Partial<Record<DominantForce | "id", string>> = {
  id:        "שורש",
  physical:  "גופני (1)",
  emotional: "רגשי (2)",
  rational:  "רציונלי (3)",
  social:    "חברתי (4)",
  ego:       "אגו (5)",
  superego:  "סופר-אגו (6)",
};
