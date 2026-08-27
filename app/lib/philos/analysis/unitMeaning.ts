/**
 * WHAT EACH OF THE TEN UNITS MEANS, IN PLAIN HEBREW.
 *
 * The cards said "סווג במפורש על ידי המשתמש ב-1 תצפיות" — true, and useless
 * to anyone who does not already know what the unit IS. A person meeting the
 * model for the first time needs the definition before the status.
 *
 * NOTHING HERE INFERS WHY. A unit was marked because a person ticked a box;
 * the reason is not stored, so no reason is offered. The unmarked line says
 * why no conclusion follows — which is the part that is actually load-bearing.
 */
import type { AnalysisUnitId } from "./analysisUnit";

export interface UnitMeaning {
  /** What this unit is about. One sentence, no jargon. */
  means: string;
  /** What a mark does and does not establish. */
  whenMarked: string;
  /** Why silence is not zero. */
  whenNotMarked: string;
}

const NOT_MARKED_GENERIC =
  "לא סווג בתצפית. אין עדיין בסיס למסקנה — היעדר סימון אינו אומר שאין כאן משהו, רק שלא נבדק.";

export const UNIT_MEANING: Record<AnalysisUnitId, UnitMeaning> = {
  time:      { means: "תזמון, קצב, מה מוקדם ומה מאוחר, וכמה זמן דברים לוקחים.",
               whenMarked: "סומן בתצפית: הזמן נוגע למה שקרה. לא נרשם באיזה אופן.",
               whenNotMarked: NOT_MARKED_GENERIC },
  matter:    { means: "החומר הממשי — מה קיים בפועל, מה יש ומה אין.",
               whenMarked: "סומן בתצפית: יש כאן ממד חומרי ממשי.",
               whenNotMarked: NOT_MARKED_GENERIC },
  space_gap: { means: "המרווח — המרחק בין המצוי לרצוי, ובין מה שיש למה שנדרש.",
               whenMarked: "סומן בתצפית: קיים פער שרלוונטי למה שקרה.",
               whenNotMarked: NOT_MARKED_GENERIC },
  energy:    { means: "הכוח הזמין — כמה יש, לאן הוא זורם, ומה מכלה אותו.",
               whenMarked: "סומן בתצפית: האנרגיה נוגעת למה שקרה.",
               whenNotMarked: NOT_MARKED_GENERIC },
  emotional: { means: "מה נחווה רגשית — לא מה נכון, אלא מה מורגש.",
               whenMarked: "סומן בתצפית: יש כאן ממד רגשי.",
               whenNotMarked: NOT_MARKED_GENERIC },
  cognitive: { means: "מחשבה והבנה — איך הדברים נתפסים ומפורשים.",
               whenMarked: "סומן בתצפית: יש כאן ממד של הבנה או פרשנות.",
               whenNotMarked: NOT_MARKED_GENERIC },
  physical:  { means: "הגוף — תחושה גופנית, מאמץ, עייפות, מיקום פיזי.",
               whenMarked: "סומן בתצפית: יש כאן ממד גופני.",
               whenNotMarked: NOT_MARKED_GENERIC },
  personal:  { means: "מה שנוגע לאדם עצמו — לא לאחרים ולא למערכת.",
               whenMarked: "סומן בתצפית: זה נוגע אליך אישית.",
               whenNotMarked: NOT_MARKED_GENERIC },
  social:    { means: "יחסים עם אנשים אחרים — מי מעורב ומה עובר ביניכם.",
               whenMarked: "סומן בתצפית: יש כאן ממד בין-אישי.",
               whenNotMarked: NOT_MARKED_GENERIC },
  systemic:  { means: "המבנה הרחב — כללים, תהליכים ומערכות שמעבר לאדם היחיד.",
               whenMarked: "סומן בתצפית: יש כאן ממד מערכתי.",
               whenNotMarked: NOT_MARKED_GENERIC },
};

/** The model itself, in one paragraph a newcomer can actually use. */
export const MODEL_EXPLANATION =
  "PHILOS מסדרת כל תצפית לפי עשרה ממדים: ארבעה משתני יסוד (זמן, חומר, מרווח, אנרגיה) " +
  "ושש מחלקות ניגוד (רגשית, שכלית, גופנית, אישית, חברתית, מערכתית). " +
  "אתה מסמן אילו ממדים נוגעים למה שקרה. המערכת לא מנחשת ולא משלימה — " +
  "מה שלא סומן נשאר לא ידוע, וזה בכוונה.";
