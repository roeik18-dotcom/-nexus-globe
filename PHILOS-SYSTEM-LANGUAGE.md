# PHILOS — שפת המערכת (SYSTEM LANGUAGE)
## OPM · כרונולוגיה · היררכיה · 7 מסופים · שכבת תרגום

- **LOCK_STATUS:** נעול — אוצר מילים וגבולות שכבה
- **מקור:** `PHILOS_SYSTEM_MASTER_OPM_LANGUAGE_7_TERMINALS_v1.docx` (Dropbox, קונפינג-אדם-מאגר-אב-שלד-היררכי)
- **אחים:** [`PHILOS-PERSON-CONTRACT.md`](./PHILOS-PERSON-CONTRACT.md) · [`PHILOS-MELTING-POT-CANON.md`](./PHILOS-MELTING-POT-CANON.md) · [`PHILOS-SYSTEM-BLUEPRINT.md`](./PHILOS-SYSTEM-BLUEPRINT.md)

> המסמך הזה מביא את המאסטר מ-Dropbox אל תוך ה-repo. הוא נועל **שפה**, לא מימוש.
> אין בו קוד, אין בו סמנטיקה חדשה, ואין בו הכרזת Canon על מה שהמקור עצמו מסמן SYNTHESIS.

---

## 0. מקרא סטטוסים

| סטטוס | משמעות |
|---|---|
| **CANON** | מוגדר במאסטר/חוזה PHILOS וראוי להישמר כגבול מערכת. |
| **IMPLEMENTED** | קיים בקוד/Store/Projection בפועל לפי Read-only audit. |
| **SOURCE / CONFIG** | תוכן מקור או קונפיג; אינו הופך אוטומטית למצב חי או לשפת מערכת. |
| **DERIVED** | נגזרת חישובית/פרשנית על נתונים קיימים. |
| **UI-ONLY** | שם/רכיב תצוגה שאינו מודל Domain בפני עצמו. |
| **SYNTHESIS** | ארגון רעיוני; שימושי לתכנון, אינו Canon בלי אישור. |
| **GAP / UNKNOWN** | הגדרה, Store, Join או write-path חסרים; אסור להשלים בניחוש. |

---

## 1. חוק האב — תוכן מקור ≠ שפת המערכת

PHILOS שומר את תוכן המקור, אך **אינו מחייב את שבעת המסופים לדבר בשפת המקור**.
פרויד, קבלה, עשרת הדיברות, מוזיקה, פסיכולוגיה — כולם נשמרים כ-**Source/Config/Reference**.
המערכת מפשיטה מהם: **מבנה · יחס · כיוון · ממד · פרמטר · מידה · מדיום · הקשר**.

```
SOURCE CONTEXT
      ↓ abstraction
SYSTEM CONCEPT
      ↓
CONTEXT → DIRECTION → DIMENSION → PARAMETER → MEASURE → MEDIUM
      ↓
DOMAIN INSTANCE   (Human / Music / Community / Marketplace / World / future)
```

שמונת המושגים האוניברסליים — **ורק הם** — חוצים תחומים:

```
Context · Direction · Dimension · Parameter · Measure · Medium · Provenance · Confidence
```

מילה מתחום מקור שלא ניתן לרדוקציה לאחד מהשמונה — **נשארת בקונפיג שלה**.

---

## 2. שפת המערכת — אוצר מילים נעול

| מושג | הגדרה מערכתית | סטטוס בקוד |
|---|---|---|
| **REALITY / מציאות** | המצב/העולם שקיים מחוץ לפרשנות המערכת. | GAP — אין entity |
| **SUBJECT / נושא** | האדם, הקבוצה, הקהילה או הישות שאליה הרשומה מתייחסת. | IMPLEMENTED (`subject: string`) |
| **PERSON / אדם** | ישות אנושית. **PERSON אינו Body/Emotion/Cognition** — אלה צירי מצב/סיווג. | GAP — אין entity מאוחד |
| **CONTEXT / הקשר** | הזמן, התחום, הסביבה והנסיבות שבהם הרשומה תקפה. | GAP — אין PersonContext |
| **DOMAIN / תחום** | מימוש תחומי: Human, Music, Community. **Domain Config אינו Live State.** | IMPLEMENTED (חלקית) |
| **CONFIG / קונפיג** | ידע, פרופיל, פרמטרים, העדפות, יכולות. **אינו Observation ואינו Current State.** | IMPLEMENTED (refs בלבד) |
| **OBSERVATION / תצפית** | רשומה אמיתית אחת של מה שנצפה. **נשמרת פעם אחת עם מזהה אחד.** | IMPLEMENTED + persisted |
| **PROVENANCE / מקור** | מאיפה הגיע המידע. | IMPLEMENTED |
| **CONFIDENCE / ביטחון** | רמת הביטחון ברשומה/הסקה. **מטא-דאטה של מדידה, לעולם לא ערכו של אדם.** | IMPLEMENTED |
| **STATE / מצב** | מצב בנקודת זמן. **State אינו Value ואינו Config.** | IMPLEMENTED (3 מודלים — ראה §19 באודיט) |
| **ORIENTATION / אוריינטציה** | הבנת המצב, משמעותו והכיוון הנובע ממנו. | DERIVED |
| **TENSION / מתח** | פער שמחייב תשומת לב. **אינו אוטומטית Need.** | DERIVED — סטייה ידועה, ראה `PHILOS-PERSON-CONTRACT.md` §7 |
| **NEED / צורך** | חסר תפעולי הדורש פתרון/משאב/פעולה. **Need אינו Value.** | IMPLEMENTED + persisted |
| **CAPABILITY / יכולת** | יכולת אמיתית לבצע/לספק. | IMPLEMENTED (3 אוצרות מילים!) |
| **RESOURCE / משאב** | דבר זמין שניתן להשתמש בו. | IMPLEMENTED |
| **OFFER / הצעה** | משאב/יכולת שגורם מוכן להעמיד. | IMPLEMENTED + persisted |
| **MATCH / התאמה** | קשר **מותר ומאומת** בין Need לבין Offer/Resource. | IMPLEMENTED (6 שערים) |
| **ACTION / פעולה** | מה שנעשה בפועל. | IMPLEMENTED + persisted |
| **EFFECT / השפעה** | מה קרה בעקבות פעולה. | IMPLEMENTED + persisted |
| **EVIDENCE / ראיה** | מה תומך/מאמת טענה או Effect. | GAP בסכמה (6 notions) · **אוצר מילים נעול** → `EvidenceRef` |
| **LEARNING / למידה** | מה ניתן להסיק מ-Effect+Evidence כדי לעדכן State/Orientation. | TYPE_ONLY — אין write path |
| **UNKNOWN** | אין ידע מספיק. | נעול |
| **UNRESOLVED** | יש רכיבים אך הקשר ביניהם לא הוכרע. | נעול |
| **NOT_APPLICABLE** | המסוף/התהליך אינו חל על המקרה. | נעול |

**כלל:** אותו מושג = אותו שם, בכל המערכת. אין שמות חלופיים שמטשטשים גבולות entity.

---

## 3. שני צירים נפרדים — כרונולוגיה ≠ היררכיה

זה הלב של הבלבול שנצבר. **חייבים להחזיק את שני הצירים בנפרד.**

```
CHRONOLOGY  (מה קורה קודם ואחר כך)
Reality → Observation → Interpretation → State(t0) → Need/Decision
        → Action → Effect → Evidence → Learning → State(t1) ↺

HIERARCHY   (מאיזה סוג/רמה כל מושג)
Source/Config → Entity/Context → Observation → Classification
              → Contradiction/Meaning → State/Orientation
              → Need/Capability/Resource → Action Lifecycle
              → Social/System Projection → Evidence/Learning
```

מסוף מציג חתך על **אחד** מהצירים. Dynamics = כרונולוגיה. Brain = היררכיה. Hub = חתך רוחב של שניהם ברגע נתון.

---

## 4. OPM — המפה המחוברת

```
                         REALITY
                            │
        HUMAN CONFIG ───────┼─────── DOMAIN CONFIG
                            │
                         CONTEXT
                            │
                      OBSERVATION          ← מזהה אחד, פעם אחת
                            │
                          BRAIN            "מה זה אומר ולמה?"
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
     6 CLASSES        CONTRADICTIONS       VALUES
          │                                   │
          │                            Base Value(s)
          │                                   ↓
          │                             Value Family
          │                                   ↓
          │                             General Value
          │                                   ↓
          │                      Value Group / UNRESOLVED
          └─────────────────┬─────────────────┘
                            ▼
                   STATE / ORIENTATION
                    ↙               ↘
                 HUB              DYNAMICS
            "מה עכשיו?"          "מה השתנה?"
                    ↘               ↙
                   TENSION / NEED
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
    COMMUNITY          MARKETPLACE            WORLD
   people/groups      need↔resource       external/system
        └───────────────┬───┴───────┬───────────┘
                        ▼           ▼
                      MATCH       GLOBE
                        │    network/spatial
                        ▼
                     ACTION → EFFECT → EVIDENCE → LEARNING → STATE(t+1) ↺
```

---

## 5. שש המחלקות — מנגנון סיווג Observation, לא "כל האדם"

3 Domains × 2 Orientations = 6 Classes.

| Domain | Internal / פנימי | External / חיצוני |
|---|---|---|
| **PHYSICAL / גופני** | תחושה, רתיעה, דחף, תגובה גופנית | פעולה פיזית בעולם |
| **EMOTIONAL / רגשי** | פחד, גועל, דחייה, חמלה, קבלה | יחס וביטוי רגשי |
| **COGNITIVE / שכלי** | תפיסה, פרשנות, שיפוט, הבנה | החלטה, הסבר ויישום |

**חוק:** `CLASS ≠ CONTRADICTION ≠ VALUE ≠ GENERAL VALUE ≠ VALUE GROUP`.
שש המחלקות הן **שכבת analysis**. אסור להפוך אותן למודל Person שלם.

⚠ **הגבול מול ה-3×3 הקנוני נשאר UNRESOLVED** — ראה [`PHILOS-PERSON-CONTRACT.md`](./PHILOS-PERSON-CONTRACT.md) §6.
אסור למפות `INTERNAL/EXTERNAL` ל-`Frame I/R/S`.

---

## 6. מערכת הערכים — גבולות

```
Observation
   ↓
Base Value(s)          (65, NORMALIZATION_BASE / REVIEW_REQUIRED)
   ↓
Value Family           (28 · F01–F28 · CANDIDATE / REVIEW_REQUIRED)
   ↓
General Value          (כאשר רלוונטי)
   ↓
Actual Value Group?  ── לא → UNRESOLVED
```

```
Need ≠ Value            Resource ≠ Value        State/Emotion ≠ Value
Human trait ≠ Value Group                       Value Family ≠ Value Group
Quality Group ≠ Value Group
```

**300 פרשנויות מקור דתיות/אמוניות** נכנסות כ-`SOURCE_VALUE_INTERPRETATION` — לא כ-300 קבוצות Canon.
**דת היא provenance, לא הערך עצמו.**
אסור ליצור קבוצה בשם ערך רק משום שהערך זוהה.

---

## 7. Color Monster — שפת routing, לא מצב אדם

| Color | ID | Function |
|---|---|---|
| ⚪ WHITE | 0 | REFERENCE / EVIDENCE |
| 🟣 PURPLE | 1 | MEANING / VISION |
| 🔵 BLUE | 2 | STRUCTURE / LOGIC |
| 🟢 GREEN | 3 | EXPRESSION / CONNECTION |
| 🟡 YELLOW | 4 | TRANSITION / CHANGE |
| 🟠 ORANGE | 5 | DRIVE / MOMENTUM / MOBILIZATION |
| 🔴 RED | 6 | ACTION / EXECUTION |

**`Cell_ID ≠ Color_ID`.** Color אינו State ואינו Value — הוא semantic routing metadata.
White = 0, `CONFLICT_STATUS: OPEN` (נשאר פתוח).

---

## 8. שבעת המסופים — שפה, תפקיד, צבע

| # | דף | Route | צבע | שאלת משתמש | שפת מסוף |
|---|---|---|---|---|---|
| 1 | **HUB** | `/hub` | 🟣+🔵 | מה חשוב עכשיו ולאן ממשיכים? | Person Now · Values · General Values · relevant Value Groups · Contradictions · Priorities · Next Action · Evidence |
| 2 | **BRAIN** | `/brain` | 🔵+🟣+⚪ | מה זה אומר ולמה? | Observation · 6 Classes · Contradictions · Evidence · Hypotheses · Unknown · General Value · Learning · Next Action |
| 3 | **DYNAMICS** | `/dynamics` | 🟡 | מה השתנה, מתי ומה גרם למה? | State(t0)→Observation→Contradiction→Action→Effect→Evidence→Learning→State(t1) |
| 4 | **COMMUNITY** | `/hub/community` | 🟢 | מי מחובר סביב איזה ערך ומה הקבוצה עושה? | Person→Value Family→Value Group · members · quality · needs · capabilities · resources · actions · effects · evidence · trend |
| 5 | **MARKETPLACE** | `/marketplace` | 🟠+🔴 | מה חסר, מה זמין ומה ניתן לבצע? | Need→Resource/Capability/Offer→Match→Action→Effect→Evidence |
| 6 | **GLOBE** | `/planet` | 🟢+🟣 | איך הישויות והקשרים פרוסים ברשת/מרחב? | Value Groups · relations · activity · deep links · **verified geography only** |
| 7 | **WORLD** | `/world` | ⚪+🟣 | מה קורה במערכת הרחבה ומה רלוונטי? | General Values · systemic relevance · competing values · verified external events · affected Person/Value/Community · possible Action |

> **SYNTHESIS (לא מהמאסטר הזה):** ההבחנה מסוף/aspect אינה מופיעה ב-OPM master. היא נוסחה
> ב-`PHILOS-SYSTEM-BLUEPRINT.md` §4a בסבב נפרד: **מסוף = route (שבעה) · aspect = חתך בתוך מסוף (שישה).**

---

## 9. שפת UI אחידה — כלל לכל שבעת הדפים

| כלל | נוסח |
|---|---|
| **Hebrew-first** | עברית היא שפת המוצר. אנגלית = secondary/technical label בלבד. |
| **Same concept = same name** | State תמיד "מצב"; Observation תמיד "תצפית"; Evidence תמיד "ראיה". |
| **Technical below product** | IDs, TOKEN_ONLY, raw enums, provenance codes, CANON flags, debug → יורדים ל-Details/Audit. |
| **UNKNOWN ≠ UNRESOLVED ≠ NOT_APPLICABLE** | שלושה מצבים שונים; לא מחליפים ביניהם. |
| **One event, seven projections** | אותו `OBSERVATION_ID`; אין העתקה ידנית לשבעה components. |
| **Config ≠ State** | קונפיג מסביר ומספק reference; אינו הופך מצב חי. |

---

## 10. שכבת תרגום — Source Language → PHILOS

| Source-specific | PHILOS abstraction | הערה |
|---|---|---|
| Id / Ego / Superego | **דחף / ויסות-תיווך / נורמה-אילוץ** (candidate) | לא מקודם אוטומטית ל-Canon. המקור הפרוידיאני נשאר Config/Reference. |
| עשרת הדיברות / חוק דתי | גבול / חובה / איסור / יחס / פעולה / השפעה / ערך | שומרים provenance; לא הופכים "דת" לציר runtime. |
| מושג מוזיקלי | Dimension/Parameter/Measure/Medium בתחום Music | אותו מבנה מופשט, מימוש Human/Music — בלי לומר שמוזיקה "מרגישה". |
| 10 ספירות | **10 עקרונות × 2 כיווני ביטוי = 20 מצבי ביטוי** | `PHILOS_INTERPRETIVE_LENS` — במפורש **NOT Kabbalah Canon**. כבר קיים בקוד כטבלת reference. |

**העיקרון:** PHILOS משמר מבנה, יחס, כיוון, ממד ופרמטרים מדידים.
מינוח ספציפי-למקור נשאר במקור, ומשמש **רק** כשהתחום הנבחר עצמו דורש אותו.

---

## 11. עשרת העקרונות — עדשה פרשנית (SOURCE / LENS)

10 עקרונות, לכל אחד ביטוי **בונה** וביטוי **מפרק** = 20 מצבי ביטוי.
זו שכבת **הערכה מעל Action/Effect** — לא 20 כוחות חדשים, לא 20 ספירות.

| עיקרון | ביטוי בונה | ביטוי מפרק |
|---|---|---|
| כתר | פוטנציאל / כיוון | אובדן כיוון / פוטנציאל לא ממומש |
| חכמה | אפשרות / רעיון | אימפולס ללא עיבוד |
| בינה | מבנה / הבחנה | קיבעון / מבנה חונק |
| חסד | התרחבות / נתינה | נתינה ללא גבול / דליפה |
| גבורה | גבול / צמצום | דיכוי / חסימת־יתר |
| תפארת | אינטגרציה / איזון | איזון מדומה / פשרה מעוותת |
| נצח | התמדה / המשכיות | אובססיה / התעקשות |
| הוד | עיבוד / הכרה / תגובה | כניעה / פסיביות |
| יסוד | חיבור / תיווך / העברה | תלות / חיבור מזיק |
| מלכות | מימוש במציאות | שליטה / מימוש הרסני |

**משפט העוגן:** כל פעולה משאירה עקבה. כל עקבה מזינה מבנה. הצטברות הפעולות מראה לאיזה סוג מציאות האדם והקבוצה מזינים את המערכת.

**STATUS:** `PHILOS INTERPRETIVE / COMPARATIVE LENS` · **NOT Kabbalah Canon** · פעולה אחת יכולה להזין יותר מעיקרון אחד — ההערכה רב-ממדית, לא תווית בינארית.
בקוד: `app/lib/philos/brainGraph.ts::PHILOS_PRINCIPLES` + `PHILOS_INTERPRETIVE_LENS_PROVENANCE` — טבלת reference בלבד, **אין פונקציית סיווג** ולכן שום UI אינו רשאי לטעון שסיווג התרחש.

---

## 12. מודל השכבות והמשקלים — SOURCE / SYNTHESIS

⚠ **הסטטוס: SOURCE/SYNTHESIS. לא Canon. לא ממומש. ראה §13 — יש סתירה פתוחה.**

```
Li = wi × di × ii              (משקל × כיוון × עוצמה)
S  = Σ(L1..L6)                 (מצב כולל)
נגזרות מוצעות: capacityScore · execution gap · readiness to act
```

| שכבה | משתנים | נוסחה / משמעות |
|---|---|---|
| **L1 — מצב פנימי** | בהירות · ויסות · פחד(−) · עייפות(−) | `L1 = (Clarity + Regulation − Fear − Fatigue) / 4`<br>**L1 שלילי = בלימה פנימית · L1 חיובי = דחיפה פנימית** |
| **L2 — שכבת ההתנהגות** | כוונה · ביצוע · הימנעות · עקביות | `L2 = (Execution + Consistency + Intention − Avoidance) / 4`<br>`Execution Gap = Intention − Execution`<br>**L2 גבוה = התנהגות אפקטיבית · L2 נמוך = פער ביצוע / הימנעות** |
| **L3 — שכבת הקשרים הקרובים** | תמיכה · שייכות · לחץ בין־אישי(−) · קונפליקט קרוב(−) | `L3 = (Support + Belonging − Pressure − Conflict) / 4`<br>**L3 חיובי = קשרים שמאפשרים פעולה · L3 שלילי = קשרים שמגבילים פעולה** |
| **L4 — שכבת המבנה החברתי** | לחץ כלכלי · מגבלת תפקיד · סיכון לסנקציה · מרחב חופש | `L4 = (Freedom − EconomicPressure − RoleConstraint − SanctionRisk) / 4`<br>**L4 חיובי = מבנה מאפשר · L4 שלילי = מבנה חוסם** |
| **L5 — שכבת המערכת הרחבה** | לחץ נורמטיבי · קונפליקט אידיאולוגי · השפעת שיח חיצוני · ציות / עיוורון חברתי | `L5 = - (NormPressure + IdeologyConflict + MediaInfluence + SocialBlindness) / 4`<br>**L5 שלילי = שליטה חברתית גבוהה · L5 קרוב לאפס = עצמאות תודעתית** |
| **L6** | — | **GAP** — לא סופק. לא מומצא. |

> **עדכון מול המאסטר:** המאסטר (§8) רשם `L4-L6 = GAP`. **L4 ו-L5 כן סופקו** ב-textClippings
> (`L4 — שכבת המבנה החברתי`, `L5 — שכבת המערכת הרחבה`) ומועתקים לעיל מילה במילה.
> **נותר חסר רק L6.**

---

## 13. כלל אי-קידום — `S` נשאר מקור

`S = Σ(L1..L6)`, `capacityScore`, `execution gap`, `readiness to act` — **נשמרים כמקור, ואינם מקודמים.**

```
STATUS = SOURCE / SYNTHESIS
· נשמר verbatim כפי שסופק
· אינו מקודם ל-Person Now, ל-Canon State או לאף projection ב-runtime
· אינו נדרש להכרעה קנונית כדי להישמר
```

**תיקון של גרסה קודמת של מסמך זה:** סעיף זה הציג בעבר "סתירה פתוחה הדורשת החלטה" מול Canon §21
(`NO_GLOBAL_PERSON_SCORE`, `NO_CROSS_FRAME_AGGREGATION`), והציע לפתוח את §21 ב-Change Control.
**זו הייתה הסלמה שגויה.** Canon §21 מגביל מה שהמערכת **מחשבת ומציגה** על אדם — לא מה שמסמך מקור מכיל.
שמירת המודל כמקור אינה מתנגשת בכלום ואינה דורשת שום החלטה.

שאלה קנונית תיווצר **רק אם** מישהו יציע לחשב ולהציג את `S` על אדם. עד אז — אין שאלה.

---

## 14. מבנה ה-Brain — בניינים / שדות / וקטורים (SOURCE, מסמך עבודה)

**מקור:** `עותק של PHILOS_9_STRUCTURE_RECONSTRUCTION_HE.docx` — המסמך מגדיר את עצמו
`מסמך עבודה מבוסס על החומר שסופק — לא הכרזת Canon`. הסטטוס כאן זהה.

**חוק המקור (§4):** `אסור לאחד את שלוש המשפחות תחת המילה 'כוחות' ללא הבחנה.`

```
בניינים = מה מרכיב את המערכת האנושית
שדות    = מאיפה מגיע ההקשר או ההשפעה
וקטורים = איך ההשפעה נעה בין חלקים וקני מידה
```

**INNER HUMAN — שישה בניינים**
| # | בניין | תפקיד |
|---|---|---|
| 1 | מוח | עיבוד, ניתוח, הבחנה וכיוון מחשבתי |
| 2 | לב | רגש, קשר, חמלה ותחושת ערך |
| 3 | גוף | פעולה, חוויה, הישרדות וקלט חושים |
| 4 | איד | דחף גולמי, צורך, משיכה ואינטרס |
| 5 | אגו | תיווך, התאמה למציאות, איזון וזהות |
| 6 | סופר־אגו | ערכים, מוסר, חובה ומצפן |

**CONTEXTUAL FIELDS — שלושה שדות**
7. אישי / זהותי · 8. חברתי / בין־אישי · 9. חיצוני / חומרי

**REALITY FRAME** — `חומר ⇄ מרווח ⇄ זמן`. אינה שלושה "כוחות אנושיים" נוספים אלא המסגרת
שבתוכה מתקיימות מערכות ושינויים. (תואם Canon §2: `Matter + Gap + Time`.)

**וקטורים** — V₁ אנרגיה פנימי · V₂ ניגוד פסיכי · V₃ בין־אישי · V₄ קולקטיבי ·
V₅ תזוזת תונוס · V₀ ייצוב זהות.

**מה המקור מפורשות אינו טוען (§8):** אינו טוען שה-9 הם Canon סופי · **אינו טוען שקיימים 10 כוחות** ·
אינו ממלא ארבעה כוחות חסרים באמצעות קבלה או מקור חיצוני.

**החלטת UI מהמקור (§9):** `ב-Brain לא להציג 10 חריצים עם ארבעה סימני שאלה.`

**סטטוס בקוד — תואם:** `app/lib/philos/brainGraph.ts` מממש בדיוק את זה —
`HUMAN_DOMAINS` (3) + `REGULATORY_LAYER` (3) = ששת הבניינים · `CONTEXTUAL_FIELDS` (3) ·
`VECTOR_DEFINITIONS` (V0–V5). ה-header שלו מתעד שארבעת חריצי "force 7–10" **הוסרו**.
`REGULATORY_LAYER` נושא הצהרה שאין לו live data source ושדותיו "לא נמדדו ב-canon".

> **הבהרה מול §10:** איד/אגו/סופר־אגו כאן אינם ייבוא פרוידיאני לשפת המערכת —
> הם שלושה מששת הבניינים של מסמך העבודה הזה. שכבת התרגום (§10) חלה כאשר מבקשים
> abstraction אוניברסלי; היא אינה מבטלת את מעמדם כבניינים במקור.

---

## 15. מה חסר — GAP LIST (אסור להמציא)

| חסר | מצב | מה יסגור אותו |
|---|---|---|
| **L6** | לא סופק | הגדרת השכבה + משתנים + נוסחה |
| **10 כוחות** | **UNRESOLVED** | אף מקור שסופק אינו מגדיר עשרה כוחות. `10_Principles` שולל מפורשות (`NOT: 20 new PHILOS forces`); `9_STRUCTURE` §8: "המסמך אינו טוען שקיימים 10 כוחות"; `Brain_Human_Explanation` §3: "נמצאו שישה כוחות מאומתים; יעד של עשרה הוגדר, אך ארבעה נוספים אינם מאומתים — אסור להמציא אותם". ראה §14. |
| **PERCEPTION** | אין concept בקוד | הגדרה, או החלטה שאין כזה |
| **PERSON entity** | אין entity מאוחד | נעול ב-Person Contract; טרם מיושם |
| **PERSON_CONTEXT / reference_group** | GAP | אין אובייקט; כל Level מוצג ללא reference group |
| **REALITY** | אין entity | שני graphs בשם הזה, לא מאוחדים |
| **EVIDENCE** | 5 notions | אוצר מילים משותף — הגייט של המאסטר §23 סעיף (3) |
| **NEXT ACTION** | כמה rules מתחרות | אוצר מילים משותף — אותו גייט |
| **Target → Tension** | type בלי write path | Canon §7/§8 דורש `(CellState, Target)` |
| **Learning → State(t+1)** | אין write path חי | הלולאה לא נסגרת |
| **DomainState** | store ריק | ACTIVE DOMAIN לא ניתן לפתרון בלעדיו |
| **PROJECT** | אין store | UNKNOWN קבוע ב-Hub |
| **Action → Group** | אין `group_id` | Community/Brain/Globe לא יכולים להראות קשר אמיתי |
| **stability scale** | לא מוגדר | Canon עצמו לא מגדיר |

---

## 16. הגייט של המאסטר (§23) — איפה אנחנו עומדים

> "אין לשנות UI או semantics לפני שנועלים שלושה דברים."

| # | מה | סטטוס |
|---|---|---|
| 1 | Person entity / Person Now contract | ✅ **נעול** — `PHILOS-PERSON-CONTRACT.md` |
| 2 | היחס המדויק בין Domain×Frame 3×3 לבין 6-Class | ✅ **נעול כ-UNRESOLVED** — Person Contract §6 |
| 3 | shared **Next Action / Evidence** vocabulary | ✅ **נעול** — [`PHILOS-EVIDENCE-NEXTACTION-CONTRACT.md`](./PHILOS-EVIDENCE-NEXTACTION-CONTRACT.md) |

**מבחן סיום (מהמאסטר):** Observation אחד נכנס פעם אחת · כל מסוף מציג רק את ה-projection שלו · אין fabrication · Config אינו Live State · UNKNOWN/UNRESOLVED/NOT_APPLICABLE נשמרים · אותו concept נקרא באותו שם בכל המערכת.

---

**נעול.** שפה וגבולות שכבה נעולים. §12 ו-§13 פתוחים ומחכים להחלטה.
