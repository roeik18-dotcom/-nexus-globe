# יועץ פרלמנטרי — Parliamentary Advisor

**סטטוס:** נרשם כיכולת עתידית של שכבת **World/System**. לא מיושם. אין UI פרלמנטרי. אין דאטה פרלמנטרי.
**נרשם:** 2026-08-21 · **מקור:** הנחיית רועי
**תיקון:** לא "Planetary". יועץ פרלמנטרי הוא תפקיד מוסדי — חקיקה, ועדות, פיקוח, תקציב — לא מונח ויזואלי ולא פרסונת צ'אט.

## הצינור

```
PUBLIC ISSUE / WORLD EVENT → PUBLIC NEED → POLICY → BILL / GOVERNMENT DECISION
→ PARLIAMENT → COMMITTEE → DEBATE → AMENDMENTS → VOTE → IMPLEMENTATION
→ BUDGET → AFFECTED POPULATIONS → EFFECT → EVIDENCE
```

מתחבר אנכית: `SYSTEM/WORLD ↕ NETWORK ↕ VALUE GROUPS/COMMUNITY ↕ PERSON`

## מה שמבדל את PHILOS ממאגר פרלמנטרי רגיל

```
POLICY → VALUES INVOLVED → VALUE TENSIONS → AFFECTED GROUPS → NEEDS
→ RESOURCES → BUDGET → EXPECTED EFFECTS → OBSERVED EFFECTS → EVIDENCE
```

דרך הטקסונומיה הקנונית — 28 משפחות → 223 תת-ערכים. **מיפוי לא נכפה.** מיפוי לא נתמך נשאר `UNKNOWN` / `REVIEW_REQUIRED`, בדיוק כמו הכלל שכבר אוכף `valueMapping.ts` על שלוש הקבוצות הקיימות.

## פלט מובנה

`WHAT IS HAPPENING` · `LEGISLATIVE STATUS` · `WHO IS INVOLVED` · `WHAT CHANGED` · `UPCOMING DECISIONS` · `VALUE TENSIONS` · `AFFECTED GROUPS` · `BUDGET/RESOURCE CONSEQUENCES` · `SUPPORT/OPPOSITION` · `EVIDENCE` · `CONTRADICTIONS` · `OPEN QUESTIONS` · `RISKS` · `POSSIBLE ACTIONS` · `PUBLIC INQUIRIES REQUIRING RESPONSE` · `WHAT TO PREPARE NEXT`

הפרדה מפורשת: `FACT` / `CLAIM` / `POSITION` / `INFERENCE` / `RECOMMENDATION`. אין מסקנות פוליטיות לא נתמכות.

## חסימות סכמה שנמדדו היום

**`app/lib/philos/events.ts:35`**

```ts
export type EntityType = "person" | "value_group" | "allocation" | "transfer" | "impact";
```

איחוד **סגור בן 5**. `EventType` (שורה 37) סגור באותה מידה. אף אחת מהישויות הפרלמנטריות — `institution`, `committee`, `bill`, `amendment`, `vote`, `ministry`, `mp`, `meeting`, `inquiry` — לא יכולה להיות נושא של אירוע בלי הרחבת האיחוד. **זו החסימה היחידה שנמדדה, והיא הרחבה, לא כתיבה מחדש:** היומן הוא append-only ו-`payload` הוא `Record<string, unknown>`, כך שהוספת סוגים אינה שוברת רשומה קיימת.

## מה כבר תואם

| נדרש | קיים |
|---|---|
| `SOURCE` `TIME` `PROVENANCE` `EVIDENCE` `STATUS` `CONFIDENCE` | אוצר המילים האפיסטמי כבר אוכף MEASURED/INTERPRETED/CANDIDATE/VERIFIED/UNRESOLVED |
| `Action → Effect → Evidence → Learning` לפיקוח ממשלתי | הקנון כבר מגדיר את השרשרת (Learning עדיין 0 רשומות) |
| מיפוי לטקסונומיית ערכים | `valueMapping.ts` — הכרעה היא דאטה, לא קוד |
| מזהה קנוני ששורד ניווט בין טרמינלים | `SelectedGroupContext` — הגנרליזציה שלו ל-`SelectedObjectContext` היא הרחבה, לא שינוי |
| מוסדות כצמתים ברשת | `groupRelations.ts` — 10 סוגי קשר, מונחה-ראיות |

## מה בעבודת ה-Community הנוכחית עלול היה לחסום — ונמנע

1. **מזהה קבוצה יחיד hard-coded** — הוסר. ישות פרלמנטרית לא הייתה יכולה להיכנס למוצר שמקומפל סביב אובייקט אחד.
2. **בחירה = חברות** — הופרד. צופה חייב יוכל *לבדוק* ועדה בלי להיות חבר בה.
3. **מיפוי ערך במחרוזת** — נאסר. חקיקה מופה לערך לפי הכרעה מתועדת בלבד.
4. **טקסונומיה בתוך TypeScript** — הוצאה לחבילת דאטה. מדיניות וחקיקה נכנסות כדאטה.

**מה שעדיין לא נבנה ולא ייבנה בסבב הזה:** מודל הישויות הפרלמנטרי, כל UI, וכל דאטה. `PARLIAMENTARY_ADVISOR_REQUIREMENT = RECORDED`.
