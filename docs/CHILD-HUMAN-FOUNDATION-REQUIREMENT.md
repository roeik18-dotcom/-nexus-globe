# יסוד הילד/האדם — התמצאות בעולם פתוח

**סטטוס:** נרשם. לא מיושם. **נרשם:** 2026-08-21 · **מקור:** הנחיית רועי

המטרה אינה חינוך אידיאולוגי ואינה אופטימיזציה לעבר מערכת ערכים מועדפת:

```
BASIC KNOWLEDGE → EXPOSURE TO THE WORLD → NATURE → DEVELOPMENT → VALUES
→ DIFFERENCE → DIALOGUE → DISAGREEMENT → PRESSURE → ADAPTATION
→ INDEPENDENT ORIENTATION
```

לא מלמדים `THIS IS THE CORRECT VALUE`, אלא: `THIS VALUE EXISTS` · `THIS IS WHAT IT PROTECTS` · `THIS IS WHAT IT MAY COST` · `THIS IS WHAT CAN CONFLICT WITH IT`.

## תשובות הקבלה

```
CHILD_FOUNDATION_REQUIREMENT = RECORDED
FULL_VALUE_EXPOSURE_SUPPORTED = YES
OPPOSING_GROUP_MODEL_SUPPORTED = YES  (חלקית — ראה למטה)
USER_ONLY_SOCIAL_DIALOGUE     = SUPPORTED  (ארכיטקטונית; אין מנגנון דיאלוג)
PRESSURE_MODEL                = BLOCKED
DEVELOPMENT_OVER_TIME         = SUPPORTED
META_OBSERVER_LAYER           = BLOCKED
```

### `FULL_VALUE_EXPOSURE_SUPPORTED = YES`
`ValueGroupUniverse` כבר מחזיר את כל 28 המשפחות ו-223 תת-הערכים ללא סינון לפי הצופה — זה בדיוק ההפרדה שנבנתה בסבב הנוכחי: היקום גלובלי, הצופה הוא overlay. חשיפה רחבה היא ברירת המחדל של המבנה, לא תוספת. **אין צורך באונטולוגיית ערכים שנייה.**

### `OPPOSING_GROUP_MODEL_SUPPORTED = YES` — חלקית
קיים כבר `socialValueSpine.ts:41` — **4 יחסי ניגוד ערכיים אמיתיים ומגובי-מקור**: כבוד↔חופש · חברה↔פרט · מסורת↔קדמה · זהות↔אוניברסליות, עם `source_rule: "הערך המשותף שמתעורר דווקא מתוך הניגוד"`. זה הזרע הנכון.
`groupRelations.ts` כבר מגדיר `CONFLICT` כסוג קשר נתמך עם 0 מפיקים — בדיוק כי אין ראיה. **מה שחסר:** ייצוג של *מה כל צד חושש לאבד*, ושל היכן הראיות מסכימות מול היכן הפרשנות נחלקת. אלה שדות, לא ארכיטקטורה.

### `USER_ONLY_SOCIAL_DIALOGUE = SUPPORTED`
היומן הוא append-only ולכל אירוע יש `actor_id` — עמדה של משתמש היא רשומה עם בעלים. **האינוואריאנט `AI ANALYSIS ≠ USER POSITION` נשמר היום** בכך שאין ל-AI `actor_id`, ואסור שיהיה לו אחד. ניתוח AI חייב לחיות בשכבה נפרדת ולעולם לא כאירוע חברתי. אין עדיין מנגנון דיאלוג.

### `PRESSURE_MODEL = BLOCKED`
`app/lib/philos/events.ts:35` — `EntityType` הוא איחוד **סגור בן 5**: `person | value_group | allocation | transfer | impact`. לחץ הוא יחס person↔group שאינו אף אחד מהם, ו-`RESPONSE` (`ADAPT`/`RESIST`/`NEGOTIATE`/`EXIT`/`UNCERTAIN`) הוא אירוע ללא סוג. **חסימה מדודה, וההסרה היא הרחבת איחוד** — `payload` הוא כבר `Record<string, unknown>` והיומן append-only, כך שהוספת סוגים לא שוברת רשומה קיימת. אותה חסימה בדיוק חוסמת את הישויות הפרלמנטריות.

### `DEVELOPMENT_OVER_TIME = SUPPORTED`
היומן append-only הוא בדיוק המבנה שדורש "אל תדרוס התמצאות קודמת". תיקון הוא רשומה חדשה — הכלל כבר אכוף בכל חנויות הקנון.

### `META_OBSERVER_LAYER = BLOCKED` — ולא ממופה ל-OPM
**בדקתי את OPM לפני שמיפיתי, כפי שביקשת — והוא קיים גם כקוד.**

* `docs/philos-opm-spec.md` — *"Philos OPM — Verified Human Systems Causal Model"*, Normative draft v0.1, ממופה ב-README כ-**Candidate**. מחויבות מפתח: *"Causality is proven, not drawn"* — גרף סיבתי מאומת-מכונה; מודל שלא ניתן לאמת אינו נרנדר.
* `app/lib/opm.ts` (299 שורות) — מגדיר את עצמו במפורש כ-**"A VISUAL EXPLANATION LAYER over existing chain outputs — not a new engine"**. `buildOpm(chain)` מילולט תנועת עומס בין מחלקות: `created → concentrates → leaks → capacity drops → orientation destabilizes → redistributes → stabilizes`, על מקרה Noa.
* `app/lib/causalEngine.ts` (299 שורות) — המנוע עצמו.
* ב-`PHILOS-COLOR-SYSTEM-MASTER.md` רשומות OPM מסומנות `UNRESOLVED`.

לכן, מהגדרתו-שלו: OPM הוא **שכבת הסבר סיבתית על אדם יחיד תחת עומס והתאוששות** — לא שכבת תצפית על תצורת ערכים ברשת. השאלות שהמטא צריכה לשאול ("מי לא מדבר עם מי", "איפה נוצרים תאי הד") אינן בתחום שהוא מכסה. **אינני ממפה את Meta/Observer ל-OPM ואינני מגדיר את OPM מחדש.** האם להרחיב את OPM לסקאלת הרשת או לבנות שכבה שנייה לצדו — הכרעה שלך; אין לי ראיה שמכריעה אותה.

השכבה עצמה חסומה בנפרד: היא צריכה לשאול "אילו ערכים דומיננטיים · מי לא מדבר עם מי · איפה נוצרים תאי הד · מי נחשף רק לצד אחד", וכל אלה דורשות **חשיפה נמדדת** — מי ראה מה — שאף חנות לא רושמת היום.

## אינוואריאנטים ארכיטקטוניים שנרשמים כעת

```
VALUE ≠ FACT · GROUP POSITION ≠ TRUTH · POPULARITY ≠ CORRECTNESS
CONSENSUS ≠ EVIDENCE · ADAPTATION ≠ CONFORMITY
AI ANALYSIS ≠ USER POSITION · META OBSERVATION ≠ MORAL COMMAND
```

בשורה אחת עם `CHRONOLOGY ≠ CAUSALITY` · `SIMILARITY ≠ RELATION` · `UNKNOWN ≠ 0` · `DEMO ≠ REAL` · `CLAIMED ≠ VERIFIED` · `PERSONAL_VALUE ≠ GROUP_VALUE`.

`KNOWLEDGE ABOUT ≠ DIRECT EXPERIENCE OF` — נדרש שדה חדש; אין היום דרך להבחין ביניהם.

## `ARCHITECTURAL_GAPS`

1. **`EntityType` סגור בן 5** — חוסם לחץ, תגובה, עמדה, דיאלוג, וגם את הישויות הפרלמנטריות. חסימה אחת משותפת לשתי הדרישות.
2. **אין חשיפה נמדדת** — בלי "מי ראה מה", שכבת המטא לא יכולה לזהות תאי הד או חשיפה חד-צדדית.
3. **אין `feared_loss` / `evidence_agrees` / `interpretation_differs`** על יחס ניגוד — ארבעת הזוגות קיימים בלי השדות שהופכים אותם לניתנים ללימוד.
4. **אין הבחנת ידיעה/חוויה** — נדרש דגל על רשומת תצפית.
5. **OPM ↔ Meta/Observer** — לא מוכרע. פתוח להכרעתך.
