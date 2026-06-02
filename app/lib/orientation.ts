// PHILOS ORIENTATION — 6 × 3 Matrix Architecture
//
// 6 Classes × 3 Levels = 18 base cells
//
// Classes:  ID | EGO | SUPEREGO | EMOTIONAL | RATIONAL | PHYSICAL
// Levels:   Physical | Emotional | Rational
//
// Every cell = one specific expression of energy in the world.

import type { DominantForce } from "./philos";

// ─── Types ────────────────────────────────────────────────────────────

export type ClassKey = "id" | "ego" | "superego" | "emotional" | "rational" | "physical";
export type LevelKey = "physical" | "emotional" | "rational";

export interface MatrixCell {
  expressions:     string[];
  description:     string;
  risk:            string;
  opportunity:     string;
  balancingClass:  ClassKey;
  suggestedAction: string;
}

export type OrientationMatrix = Record<ClassKey, Record<LevelKey, MatrixCell>>;

// ─── Display maps ─────────────────────────────────────────────────────

export const CLASS_ORDER: ClassKey[] = [
  "id", "ego", "superego", "emotional", "rational", "physical",
];

export const LEVEL_ORDER: LevelKey[] = ["physical", "emotional", "rational"];

export const CLASS_LABEL: Record<ClassKey, string> = {
  id:        "איד",
  ego:       "אגו",
  superego:  "סופר-אגו",
  emotional: "רגשי",
  rational:  "רציונלי",
  physical:  "גופני",
};

export const CLASS_ICON: Record<ClassKey, string> = {
  id:        "🌊",
  ego:       "🏆",
  superego:  "⚖️",
  emotional: "❤️",
  rational:  "🧠",
  physical:  "⚡",
};

export const CLASS_COLOR: Record<ClassKey, string> = {
  id:        "#fbbf24",
  ego:       "#a78bfa",
  superego:  "#818cf8",
  emotional: "#38bdf8",
  rational:  "#22c55e",
  physical:  "#ef4444",
};

export const LEVEL_LABEL: Record<LevelKey, string> = {
  physical:  "גופני",
  emotional: "רגשי",
  rational:  "רציונלי",
};

export const LEVEL_ICON: Record<LevelKey, string> = {
  physical:  "⚡",
  emotional: "❤️",
  rational:  "🧠",
};

export const LEVEL_COLOR: Record<LevelKey, string> = {
  physical:  "#ef4444",
  emotional: "#38bdf8",
  rational:  "#22c55e",
};

// ─── ClassKey → DominantForce (for UserNode storage) ─────────────────

export function classToDominantForce(c: ClassKey): DominantForce {
  return c as DominantForce; // all 6 classes exist in DominantForce
}

// ─── The 6 × 3 Matrix ─────────────────────────────────────────────────

export const MATRIX: OrientationMatrix = {

  // ── ID (root) ────────────────────────────────────────────────────────
  id: {
    physical: {
      expressions:     ["רעב", "כאב", "מיניות", "הישרדות", "דחף גופני"],
      description:     "האיד מתבטא בגוף — צורך גולמי לפני שיש לו שם",
      risk:            "פעולה ללא מחשבה, תגובה רפלקסיבית",
      opportunity:     "אנרגיה עצומה, נוכחות מלאה",
      balancingClass:  "superego",
      suggestedAction: "הגדר גבול אחד לפני שאתה פועל על הדחף",
    },
    emotional: {
      expressions:     ["תשוקה", "כמיהה", "פחד", "קנאה", "דחף לחיבור"],
      description:     "האיד מתבטא ברגש — רצון שמחפש צורה",
      risk:            "הצפה, תלות, ניתוב שגוי של אנרגיה",
      opportunity:     "עומק, ספונטניות, חיבור אמיתי",
      balancingClass:  "rational",
      suggestedAction: "תן שם לרגש לפני שאתה פועל לפיו",
    },
    rational: {
      expressions:     ["סקרנות", "חיפוש", "אובססיה", "אי-ודאות", "שאלות"],
      description:     "האיד מתבטא בחשיבה — שאלות שמחפשות תשובות",
      risk:            "חשיבה כפייתית, מעגלים ללא פתרון",
      opportunity:     "חיפוש עמוק, תובנות גולמיות",
      balancingClass:  "physical",
      suggestedAction: "בחר שאלה אחת ומצא תשובה אחת — עכשיו",
    },
  },

  // ── EGO ──────────────────────────────────────────────────────────────
  ego: {
    physical: {
      expressions:     ["מראה", "כוח", "ביצועים", "תחרות", "שליטה גופנית"],
      description:     "האגו מתבטא בגוף — זהות דרך כוח ומראה",
      risk:            "תחרותיות קיצונית, קריסה כשהגוף נחלש",
      opportunity:     "הישגים ממשיים, אנרגיה ממוקדת",
      balancingClass:  "superego",
      suggestedAction: "השתמש בכוח הגופני לשירות מישהו אחר",
    },
    emotional: {
      expressions:     ["גאווה", "בושה", "הכרה", "השפלה", "פחד מכישלון"],
      description:     "האגו מתבטא ברגש — כבוד עצמי וצורך בהכרה",
      risk:            "אינפלציה, ניפוץ קשה כשאין הכרה",
      opportunity:     "זהות רגשית, מנהיגות, ביטחון עצמי",
      balancingClass:  "id",
      suggestedAction: "הגדר הישג שמשמח אותך — גם אם אף אחד לא יראה",
    },
    rational: {
      expressions:     ["אסטרטגיה", "תכנון עצמי", "הצדקה עצמית", "מיתוג"],
      description:     "האגו מתבטא בחשיבה — בניית זהות ותדמית",
      risk:            "רציונליזציה, הגנה על האגו בכל מחיר",
      opportunity:     "תכנון אסטרטגי, בניית שם",
      balancingClass:  "superego",
      suggestedAction: "שאל: האם ההחלטה הזו מקדמת מטרה או מגנה על האגו?",
    },
  },

  // ── SUPEREGO ──────────────────────────────────────────────────────────
  superego: {
    physical: {
      expressions:     ["משמעת", "סגפנות", "ריסון", "שגרה", "פרישה"],
      description:     "הסופר-אגו מתבטא בגוף — שליטה גופנית מתוך ערכים",
      risk:            "דיכוי, פרפקציוניזם גופני, עונש עצמי",
      opportunity:     "משמעת עמוקה, כיבוד הגוף",
      balancingClass:  "id",
      suggestedAction: "בדוק: המשמעת הזו — מאהבה עצמית או מעונש עצמי?",
    },
    emotional: {
      expressions:     ["אשמה", "חובה", "חמלה", "מוסר רגשי", "אחריות"],
      description:     "הסופר-אגו מתבטא ברגש — מצפון ורגש מוסרי",
      risk:            "אשמה כרונית, שיתוק מוסרי",
      opportunity:     "אמפתיה עמוקה, חמלה אמיתית",
      balancingClass:  "ego",
      suggestedAction: "הפרד: אחריות אמיתית שלי לעומת אשמה שאינה שלי",
    },
    rational: {
      expressions:     ["משמעות", "מוסר", "אחריות", "חזון", "אתיקה"],
      description:     "הסופר-אגו מתבטא בחשיבה — ערכים ותכלית",
      risk:            "שיתוק מוסרי, פרפקציוניזם מחשבתי",
      opportunity:     "חזון עמוק, מנהיגות ערכית",
      balancingClass:  "id",
      suggestedAction: "בחר ערך אחד ופעל לפיו — ללא תנאים מושלמים",
    },
  },

  // ── EMOTIONAL ────────────────────────────────────────────────────────
  emotional: {
    physical: {
      expressions:     ["בכי", "כאב מרגש", "תחושה סומטית", "פרפרים", "חנק"],
      description:     "הרגש מתבטא בגוף — רגשות עם כתובת גופנית",
      risk:            "פסיכוסומטיקה, רגשות שנספגים לגוף",
      opportunity:     "אינטגרציה גוף-נפש, תחושה מלאה",
      balancingClass:  "rational",
      suggestedAction: "גלה היכן בגוף אתה מרגיש את זה — שם יש מידע",
    },
    emotional: {
      expressions:     ["אהבה", "עצב", "שמחה", "כאב רגשי", "בדידות", "כעס"],
      description:     "הרגש בכוחו המלא — חוויה רגשית ישירה",
      risk:            "הצפה, תגובתיות, מניפולציה",
      opportunity:     "חיבור עמוק, אמפתיה, חיים מלאים",
      balancingClass:  "rational",
      suggestedAction: "שב עם הרגש 10 דקות — לפני שאתה מחליט מה לעשות",
    },
    rational: {
      expressions:     ["אמפתיה", "הבנה רגשית", "פירוש תחושות", "אינטואיציה"],
      description:     "הרגש מנותח — הבנה אינטלקטואלית של חוויה פנימית",
      risk:            "ניתוח כבריחה מחוויה ישירה",
      opportunity:     "אינטליגנציה רגשית, הבנה עמוקה",
      balancingClass:  "physical",
      suggestedAction: "חזור מהניתוח לחוויה — תרגיש לפני שתסביר",
    },
  },

  // ── RATIONAL ──────────────────────────────────────────────────────────
  rational: {
    physical: {
      expressions:     ["תכנון פעולה", "כישורים", "ביצוע מעשי", "טכניקה"],
      description:     "ההיגיון מתבטא בגוף — מחשבה שהופכת לפעולה",
      risk:            "אוטומציה, ביצוע ללא יצירתיות",
      opportunity:     "יעילות, מיומנות, הגשמה",
      balancingClass:  "emotional",
      suggestedAction: "בצע את הצעד הקטן ביותר — ללא שלמות",
    },
    emotional: {
      expressions:     ["הגיון רגשי", "אינטואיציה", "הבנה מרגישה", "חכמת לב"],
      description:     "ההיגיון מוביל ע\"י רגש — חשיבה שמכוונת ע\"י חוויה",
      risk:            "עירוב שגוי בין עובדות לרצונות",
      opportunity:     "חוכמה שלמה, החלטות עמוקות",
      balancingClass:  "superego",
      suggestedAction: "הפרד: מה אני חושב לעומת מה אני רוצה — שניהם חשובים",
    },
    rational: {
      expressions:     ["ניתוח", "לוגיקה", "אסטרטגיה", "פתרון בעיות", "למידה"],
      description:     "ההיגיון בכוחו המלא — חשיבה טהורה",
      risk:            "ניתוח עודף, ניתוק מהרגש",
      opportunity:     "בהירות, סדר, ידע שמוביל לפעולה",
      balancingClass:  "emotional",
      suggestedAction: "אחרי הניתוח — פעל על המסקנה",
    },
  },

  // ── PHYSICAL ──────────────────────────────────────────────────────────
  physical: {
    physical: {
      expressions:     ["תנועה", "אנרגיה", "כאב", "כוח", "חיוניות", "מחלה"],
      description:     "הגוף בכוחו המלא — אנרגיה פיזית ישירה",
      risk:            "שחיקה, התעלמות מגבולות",
      opportunity:     "כוח, נוכחות, עיגון",
      balancingClass:  "rational",
      suggestedAction: "הקשב לאות הראשון שהגוף שלח — לפני שהמחשבה הגיעה",
    },
    emotional: {
      expressions:     ["כמיהה גופנית", "בדידות פיזית", "צורך במגע", "קשר", "חיבוק"],
      description:     "הגוף מחפש חיבור — צורך גופני-רגשי",
      risk:            "תלות גופנית, ריקנות ללא קשר",
      opportunity:     "חמימות, שייכות, ביטחון",
      balancingClass:  "rational",
      suggestedAction: "בקש קשר אנושי אחד היום — ישיר וממשי",
    },
    rational: {
      expressions:     ["מודעות גופנית", "תכנון בריאות", "הבנת הגוף", "ביופידבק"],
      description:     "הגוף מנותח — הבנה קוגניטיבית של הצרכים הפיזיים",
      risk:            "לחשוב על הגוף ולא לחיות בו",
      opportunity:     "בריאות מושכלת, שימוש אופטימלי",
      balancingClass:  "emotional",
      suggestedAction: "תכנן פעולה גופנית אחת קטנה להיום",
    },
  },
};
