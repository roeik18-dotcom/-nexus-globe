/**
 * WHAT EACH PAGE SAYS TO A PERSON WHO HAS NEVER READ THE THEORY.
 *
 * Seven terminals were explaining one Observation with one panel, so six of
 * them added nothing. Each page now answers the same seven questions with
 * materially different content: what this page examines, what real material
 * exists, what it connects to on either side, what is known, what is not, and
 * the single next step — if one honestly exists.
 *
 * PLAIN HEBREW ONLY ABOVE THE FOLD. No enum names, no ids, no gate names, no
 * OBSERVED/UNKNOWN. Those are real and are kept, at the bottom, behind
 * "פרטי ביקורת טכניים".
 */
export type MeaningTerminal =
  | "hub" | "brain" | "dynamics" | "marketplace" | "community"
  | "planet" | "world" | "human-config" | "evidence";

/** The day's real chain, as far as it has actually been recorded. */
export interface DayChain {
  hasObservation: boolean;
  hasStateT0: boolean;
  hasAction: boolean;
  hasEffect: boolean;
  /** An Effect that is merely reported is NOT evidence. */
  hasVerifiedEvidence: boolean;
  hasLearning: boolean;
  markedCount: number;
  unmarkedCount: number;
}

export interface TerminalMeaning {
  title: string;
  /** 2. what this terminal examines — its job, in one sentence. */
  examines: string;
  /** 3. the real material, in words. */
  material: string[];
  /** 4. where this sits in the chain. */
  chain: { before: string; after: string };
  /** 5a. what is established. */
  known: string[];
  /** 5b. what is not — never empty. */
  unknown: string[];
  /** 6. exactly one, or null when nothing honest can be offered. */
  nextAction: { label: string; href: string } | null;
  /** Hub alone carries the full model explanation. */
  full: boolean;
}

const NOT_YET = "טרם נרשם";

/**
 * EVIDENCE AND LEARNING ARE SAID ON EVERY TERMINAL, IN BOTH STATES.
 *
 * Not only where absence happens to be interesting. A reader who lands on one
 * page must be able to tell, from that page, whether anything here was
 * checked by anyone other than the person who reported it — and a page that
 * simply omits the question reads as though the question does not apply.
 *
 * Written for a person, not for the schema: no `verifier_type`, no
 * `EvidencePresent`, no field names. What a reader needs to know is who
 * checked, and whether a conclusion was allowed to rest on it.
 */
function evidenceSentence(c: DayChain): string {
  if (c.hasVerifiedEvidence) {
    return "התוצאה אומתה בידי אדם אחר — לא מי שביצע את הפעולה, ולא מי שהתוצאה נוגעת אליו. זו ראיה.";
  }
  if (c.hasEffect) {
    return "אין ראיה: התוצאה דווחה, אך איש מלבד המדווח לא בדק אותה. דיווח עצמי אינו אימות.";
  }
  return "אין ראיה, מפני שטרם נרשמה תוצאה שאפשר לאמת.";
}

function learningSentence(c: DayChain): string {
  if (c.hasLearning) return "נרשמה מסקנה, והיא נשענת על אותה ראיה עצמאית.";
  if (c.hasVerifiedEvidence) return "טרם נרשמה מסקנה, אף שקיימת ראיה שאפשר להסיק ממנה.";
  return "לא נרשמה מסקנה. מסקנה נרשמת רק אחרי שאדם אחר אימת את התוצאה.";
}

/**
 * The public reading. Each terminal states its own material, and then BOTH
 * facts are appended here rather than inside the nine cases — so a new
 * terminal cannot be added that quietly says nothing about either.
 */
export function terminalMeaning(t: MeaningTerminal, c: DayChain): TerminalMeaning {
  const m = terminalMeaningBody(t, c);
  const evidence = evidenceSentence(c);
  const learning = learningSentence(c);
  return {
    ...m,
    known: [...m.known, ...(c.hasVerifiedEvidence ? [evidence] : []), ...(c.hasLearning ? [learning] : [])],
    unknown: [...m.unknown, ...(c.hasVerifiedEvidence ? [] : [evidence]), ...(c.hasLearning ? [] : [learning])],
  };
}

function terminalMeaningBody(
  t: MeaningTerminal, c: DayChain,
): TerminalMeaning {
  const chainWord = c.hasEffect
    ? "תצפית → מצב פתיחה → פעולה → תוצאה"
    : c.hasAction ? "תצפית → מצב פתיחה → פעולה" : "תצפית → מצב פתיחה";

  switch (t) {
    case "hub": return {
      full: true,
      title: "מה קרה היום",
      examines: "המסוף הזה מרכז את היום שלך: מה נרשם, באיזה סדר, ומה עוד חסר כדי לסגור אותו.",
      material: [
        `נרשמה תצפית אחת, ולצידה מצב פתיחה אחד.`,
        `מתוך עשרה ממדים סימנת ${c.markedCount}, ו-${c.unmarkedCount} נשארו לא מסווגים.`,
        c.hasAction ? "נרשמה פעולה אחת, המשויכת ליום הזה." : `פעולה — ${NOT_YET}.`,
        c.hasEffect ? "נרשמה תוצאה אחת, המקושרת לאותה פעולה." : `תוצאה — ${NOT_YET}.`,
      ],
      chain: { before: "היום מתחיל בתצפית שרשמת ובמצב הפתיחה שציטטת בפתיחה.",
               after: "מכאן החומר נקרא בכל שאר המסופים — כל אחד שואל עליו שאלה אחרת." },
      known: [`הרצף שנרשם: ${chainWord}.`, "הפעולה נרשמה בהסכמה מפורשת שלך."],
      unknown: [
        "לא נרשם מצב סיום ליום.",
      ],
      /* THE HONEST NEXT STEP, not the most convenient one. While an outcome
         is reported but unchecked, the thing actually missing is a second
         person — so that is what this offers, ahead of closing the day. */
      nextAction: c.hasEffect && !c.hasVerifiedEvidence
        ? { label: "אימות התוצאה בידי אדם אחר", href: "/marketplace#verify-effect" }
        : c.hasEffect
          ? { label: "רשום מצב סיום וסגור את היום", href: "/hub#day-closing-record" }
          : { label: "רשום פעולה ליום הזה", href: "/marketplace#action" },
    };

    case "brain": return {
      full: false,
      title: "מה משמעות התצפית",
      examines: "המסוף הזה עוסק בפרשנות בלבד: מה התצפית אומרת, ולא מה קרה ביומן.",
      material: [
        `סימנת ${c.markedCount} ממדים מתוך עשרה. הם מופיעים למטה עם ההסבר של כל אחד.`,
        `${c.unmarkedCount} ממדים לא נבדקו כלל.`,
      ],
      chain: { before: "התצפית הגיעה מהיום שנפתח במרכז.",
               after: "מה שסומן כאן הוא הרקע לפעולה שנבחנת בשוק ובדינמיקה." },
      known: ["מה שסומן — סומן על ידך במפורש, בטופס."],
      unknown: [
        "לא ניתן להסיק כוונה, מחשבה או רגש שלא נרשמו.",
        "ממד שלא סומן אינו אפס ואינו שלילה — הוא פשוט לא נבדק.",
        "אין דירוג, אין ציון ואין ממוצע. סימון אינו מדידה.",
      ],
      nextAction: null,
    };

    case "dynamics": return {
      full: false,
      title: "מה השתנה, ומה נשאר במתח",
      examines: "המסוף הזה בוחן מעבר: ממצב פתיחה, דרך פעולה, אל תוצאה — ומה בין לבין.",
      material: [
        "מצב הפתיחה נרשם בתחילת היום.",
        c.hasAction ? "הפעולה נרשמה אחריו." : `פעולה — ${NOT_YET}.`,
        c.hasEffect ? "התוצאה דווחה אחרי הפעולה ומקושרת אליה." : `תוצאה — ${NOT_YET}.`,
        `${c.markedCount} ממדים סומנו מול ${c.unmarkedCount} שלא — זהו הפער שקיים כרגע, לא הסבר לו.`,
      ],
      chain: { before: "מצב הפתיחה והתצפית נקבעו בפתיחת היום.",
               after: "כדי לדעת אם באמת השתנה משהו, צריך מצב סיום — והוא טרם נרשם." },
      known: ["הפעולה והתוצאה קשורות זו לזו בקישור מתועד."],
      unknown: [
        "קישור מתועד אינו הוכחת סיבתיות. אין ראיה שהפעולה גרמה לתוצאה.",
        "בלי מצב סיום אי אפשר להשוות לפני ואחרי — אין עדיין בסיס למסקנה על שינוי.",
      ],
      nextAction: null,
    };

    case "marketplace": return {
      full: false,
      title: "מה אפשר לעשות עם זה",
      examines: "המסוף הזה מחבר בין מה שנצפה לבין מה שניתן לעשות: צורך, הצעה, פעולה ותוצאה.",
      material: [
        "רשומים צורך אחד והצעה אחת.",
        c.hasAction ? "נרשמה פעולה אחת, בהסכמה מפורשת שלך." : `פעולה — ${NOT_YET}.`,
        c.hasEffect ? "נרשמה תוצאה אחת המקושרת לאותה פעולה." : `תוצאה — ${NOT_YET}.`,
      ],
      chain: { before: "התצפית של היום היא הרקע לפעולה.",
               after: "התוצאה שנרשמה כאן נבחנת כראיה במסך מקור וראיות." },
      known: ["הפעולה נרשמה בהסכמה מפורשת שלך, והתוצאה מקושרת אליה."],
      unknown: [
        "אין אישור התאמה בין הצורך להצעה. כל עוד אין אישור כזה, פעולה שתטען למלא את שניהם תידחה.",
        "ההרשאה כאן היא שלך בלבד — לא של קבוצה ולא של גורם חיצוני.",
      ],
      nextAction: null,
    };

    case "community": return {
      full: false,
      title: "מה אישי ומה של הקבוצה",
      examines: "המסוף הזה מפריד בין מה שאתה רשמת לבין מה ששייך לקבוצה — ובין נתונים אמיתיים לחומר ייחוס.",
      material: [
        "הקבוצה: אחריות קהילתית.",
        "חבר REAL אחד — אתה. שאר החברים והתקציב המוצגים מגיעים מחבילת ייחוס מהודרת, לא מנתונים שנרשמו.",
        "צורך אחד והצעה אחת נרשמו על ידך.",
        c.hasAction ? "הפעולה והתוצאה שלך נראות כאן — כפעולה אישית." : `פעולה — ${NOT_YET}.`,
      ],
      chain: { before: "הפעולה והתוצאה נרשמו בשוק.",
               after: "כדי שהן ייחשבו פעולה קבוצתית, נדרש קישור מוסמך בין הפעולה לקבוצה." },
      known: ["הפעולה שלך נראית כאן, ואינה מוסתרת."],
      unknown: [
        "אין קישור בר-ביצוע בין הפעולה לקבוצה, ולכן היא אינה נספרת כפעולה קבוצתית.",
        "אין כותב חברות במוצר, ולכן אי אפשר לרשום חברות חדשה.",
      ],
      nextAction: null,
    };

    case "planet": return {
      full: false,
      title: "מה עבר ברשת",
      examines: "המסוף הזה בודק אם מה שקרה אצלך עבר הלאה — לאנשים, לקבוצות או ליחסים ביניהם.",
      material: [
        "הרשומות של היום קיימות וניתנות לבדיקה.",
        `יחסים מתועדים בין אנשים או קבוצות — ${NOT_YET}.`,
      ],
      chain: { before: "החומר מגיע מהקבוצה ומהפעולה האישית.",
               after: "בלי יחסים רשומים, שום דבר לא ממשיך מכאן לרמה המערכתית." },
      known: ["מה שנרשם היום נשאר אצלך, וזה מצב תקין ולא תקלה."],
      unknown: [
        "לא נרשם אף יחס בין אנשים או קבוצות, ולכן אי אפשר לטעון שהתוצאה התפשטה.",
        "כדי שתהיה התפשטות צריך להירשם יחס מוסמך בין שני צדדים — וכותב כזה עדיין לא קיים.",
      ],
      nextAction: null,
    };

    case "world": return {
      full: false,
      title: "מה המשמעות המערכתית",
      examines: "המסוף הזה מלמד את ההבדל בין השפעה אישית, קבוצתית, רשתית ומערכתית.",
      material: [
        "אדם — תצפית אחת ומצב פתיחה אחד.",
        c.hasAction ? "פעולה — פעולה אישית אחת." : `פעולה — ${NOT_YET}.`,
        "קבוצה — אין קישור מוסמך בין הפעולה לקבוצה.",
        `רשת — ${NOT_YET}.`,
        `מערכת — ${NOT_YET}.`,
      ],
      chain: { before: "כל רמה נשענת על זו שמתחתיה: אדם, פעולה, קבוצה, רשת.",
               after: "כל עוד רמה אחת חסרה, הרמה שמעליה נשארת ריקה." },
      known: ["הרמה האישית מלאה: יש תצפית, מצב, פעולה ותוצאה."],
      unknown: [
        "תוצאה אישית אחת אינה מסקנה מערכתית. אין עדיין בסיס לטענה על המבנה הרחב.",
        "שלוש הרמות העליונות ריקות מפני שלא נרשם בהן דבר, לא מפני שנבדקו ונמצאו ריקות.",
      ],
      nextAction: null,
    };

    case "human-config": return {
      full: false,
      title: "מאילו הגדרות האדם נבנה",
      examines: "המסוף הזה מציג את מבנה המקור — אילו פרמטרים קיימים בכלל — ולא את מה שקורה היום.",
      material: [
        "מבנה מקור: רשימת הפרמטרים שניתן למדוד. הוא קבוע ואינו משתנה מיום ליום.",
        "מצב חי: ערך שנרשם לפרמטר אחד בזמן מסוים. זה מה שהופך הגדרה למדידה.",
        c.hasStateT0
          ? "נרשם מצב פתיחה אחד היום: עוצמת התגובה. הוא צוטט בפתיחת היום."
          : `מצב פתיחה — ${NOT_YET}.`,
      ],
      chain: { before: "מבנה המקור מגדיר מה בכלל אפשר לרשום.",
               after: "מצב שנרשם כאן הוא מה שפתיחת היום מצטטת כמצב פתיחה." },
      known: ["הפרמטרים קיימים ומוגדרים מראש — אינם מומצאים בכל רישום."],
      unknown: [
        "רוב הפרמטרים מעולם לא נמדדו. אין להם ערך, וזה לא אומר שהם אפס.",
        "לא נרשם מצב סיום, ולכן אי אפשר להשוות תחילת יום לסופו.",
      ],
      nextAction: { label: "רשום מצב אנושי נוסף", href: "/hub/human-config" },
    };

    case "evidence": return {
      full: false,
      title: "מה נטען ומה באמת הוכח",
      examines: "המסוף הזה מפריד בין תוצאה שדווחה לבין ראיה שאומתה. אלה שני דברים שונים.",
      material: [
        c.hasEffect ? "דווחה תוצאה אחת, בידי מי שביצע את הפעולה." : `תוצאה — ${NOT_YET}.`,
        c.hasVerifiedEvidence
          ? "נרשם אימות נפרד, בידי אדם אחר — ולכן התוצאה נחשבת ראיה."
          : `ראיה מאומתת — ${NOT_YET}.`,
        c.hasLearning ? "נרשמה מסקנה הנשענת על אותה ראיה." : `למידה — ${NOT_YET}.`,
      ],
      chain: { before: "התוצאה נרשמה בשוק, מקושרת לפעולה.",
               after: c.hasVerifiedEvidence
                 ? "מכאן אפשר לרשום מסקנה — היא דורשת תוצאה וראיה יחד, ושתיהן קיימות."
                 : "בלי ראיה קבילה, לא ניתן לרשום למידה — היא דורשת תוצאה וראיה יחד." },
      known: c.hasVerifiedEvidence
        ? ["התוצאה נרשמה, ואדם נפרד אישר אותה. הדיווח והבדיקה הם שתי רשומות של שני אנשים."]
        : ["התוצאה נרשמה ומקושרת לפעולה. זה קישור מתועד, לא הוכחה."],
      unknown: c.hasVerifiedEvidence
        ? ["אימות מאשר שהתוצאה התרחשה. הוא אינו מוכיח שהפעולה היא שגרמה לה."]
        : [
            "אין מאמת עצמאי. אישור עצמי אינו אימות — כשאותו אדם גם מבצע וגם מאשר, לא נוסף מידע חדש.",
            "לכן התוצאה אינה נחשבת ראיה, והלמידה נשארת חסומה.",
          ],
      nextAction: c.hasEffect && !c.hasVerifiedEvidence
        ? { label: "אימות התוצאה בידי אדם אחר", href: "/marketplace#verify-effect" }
        : null,
    };
  }
}
