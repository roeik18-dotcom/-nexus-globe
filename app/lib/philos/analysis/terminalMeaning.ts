/**
 * THE FIVE QUESTIONS, ANSWERED DIFFERENTLY BY EACH TERMINAL.
 *
 * The same anchored Observation was being explained with the same panel seven
 * times, so six of the seven terminals added nothing a person could use. Each
 * one now answers: what happened · how PHILOS files it · what it means HERE ·
 * what is still unknown · what can be done now.
 *
 * PLAIN HEBREW ONLY. No `C/I`, no `record_origin`, no enum names, no ids, no
 * OBSERVED/UNKNOWN. Those are real and they are kept — at the bottom, behind
 * "פרטי ביקורת טכניים", where an auditor can find them and a reader is not
 * asked to decode them first.
 */
export type MeaningTerminal =
  | "hub" | "brain" | "dynamics" | "marketplace" | "community" | "planet" | "world";

export interface TerminalMeaning {
  title: string;
  /** 3. מה זה אומר במסוף הזה — the only line that differs materially. */
  hereMeans: string;
  /** 4. מה עדיין לא ידוע — this terminal's specific blind spot. */
  stillUnknown: string;
  /** 5. מה אפשר לעשות עכשיו — exactly one action, or `null` when the honest
   *  answer is that nothing can be done here yet. A fabricated call to action
   *  is worse than none: it sends a person to a screen that cannot help. */
  nextAction: { label: string; href: string } | null;
  /** Hub alone carries the full model explanation; the rest stay compact. */
  full: boolean;
}

export function terminalMeaning(
  terminal: MeaningTerminal,
  marked: string[],
  unmarked: string[],
): TerminalMeaning {
  const m = marked.length, u = unmarked.length;

  switch (terminal) {
    case "hub": return { full: true,
      title: "מה קרה היום",
      hereMeans:
        `פתחת את היום עם תצפית אחת ומצב פתיחה אחד. מתוך עשרה ממדים סימנת ${m} ` +
        `כנוגעים למה שקרה, ו-${u} נשארו לא מסווגים.`,
      stillUnknown:
        "טרם נרשמה פעולה ליום הזה, ולכן אין עדיין תוצאה ואין ראיה.",
      nextAction: { label: "רשום פעולה ליום הזה", href: "/marketplace#action" } };

    case "brain": return { full: false,
      title: "מה זה אומר על החשיבה והרגש",
      hereMeans:
        marked.includes("שכלית") || marked.includes("רגשית")
          ? `סימנת ממדים שנוגעים להבנה או לרגש. זה מה שנרשם — לא מה שהתכוונת אליו.`
          : `לא סימנת את הממד השכלי ולא את הרגשי. המערכת לא מסיקה מה חשבת או הרגשת.`,
      stillUnknown:
        "כוונה, תובנה ולמידה אינן נגזרות מתצפית. אם לא נרשמו — הן לא ידועות.",
      nextAction: null };

    case "dynamics": return { full: false,
      title: "מה השתנה, ומה במתח",
      hereMeans:
        `${m} ממדים סומנו ו-${u} לא. ההפרש הזה הוא מה שיש — הוא מראה איפה יש ` +
        `מידע ואיפה אין, ולא מה גרם למה.`,
      stillUnknown:
        "קישור בין רשומות אינו הוכחת סיבתיות. אין כאן ראיה עצמאית שמשהו גרם למשהו.",
      nextAction: null };

    case "marketplace": return { full: false,
      title: "מה אפשר לעשות עם זה",
      hereMeans:
        "התצפית של היום זמינה כרקע לפעולה. פעולה נרשמת בהסכמה מפורשת שלך בלבד.",
      stillUnknown:
        "אין אישור התאמה בין צורך להצעה, ואין אישור של גורם חיצוני. " +
        "ההרשאה כאן היא שלך, ולא של אף אחד אחר.",
      nextAction: { label: "רשום פעולה", href: "/marketplace#action" } };

    case "community": return { full: false,
      title: "מה אישי ומה של הקבוצה",
      hereMeans:
        "כל מה שנרשם היום הוא אישי שלך. הוא אינו משויך לקבוצה, כי אין קישור " +
        "בר-ביצוע בין הפעולה לקבוצה.",
      stillUnknown:
        "רוב מה שמוצג על הקבוצה מגיע מחבילת ייחוס מהודרת ולא מנתונים שנרשמו " +
        "בפועל. אין עדיין בסיס לטענה על השפעה קהילתית.",
      nextAction: null };

    case "planet": return { full: false,
      title: "מה עובר הלאה, ומה לא",
      hereMeans:
        "הרשומות של היום קיימות וניתנות לבדיקה, אבל הן נשארות אצלך.",
      stillUnknown:
        "לא נרשמו יחסים בין אנשים או קבוצות שנושאים את מה שקרה היום הלאה. " +
        "טרם נרשם — ולכן אין התפשטות להראות.",
      nextAction: null };

    case "world": return { full: false,
      title: "מה זה אומר במבנה הרחב",
      hereMeans:
        "תצפית אישית אחת ביום אחד. זה מה שיש.",
      stillUnknown:
        "אין עדיין בסיס למסקנה מערכתית. דבר אחד שקרה לאדם אחד אינו אומר משהו " +
        "על המבנה הרחב.",
      nextAction: null };
  }
}
