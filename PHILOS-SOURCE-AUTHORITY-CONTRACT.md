# PHILOS — HUMAN CONFIG SOURCE AUTHORITY (LOCKED)

- **LOCK_STATUS:** נעול — מודל דו-סמכותי (dual authority)
- **תאריך הכרעה:** 2026-08-19
- **אחים:** [`PHILOS-PERSON-CONTRACT.md`](./PHILOS-PERSON-CONTRACT.md) ·
  [`PHILOS-EVIDENCE-NEXTACTION-CONTRACT.md`](./PHILOS-EVIDENCE-NEXTACTION-CONTRACT.md) ·
  [`app/lib/philos/canon/STATE-TRANSITION-BOUNDARY.md`](./app/lib/philos/canon/STATE-TRANSITION-BOUNDARY.md)
- **מימוש:** [`app/lib/philos/humanConfig/crosswalk.ts`](./app/lib/philos/humanConfig/crosswalk.ts)

> מסמך זה נועל **מי קובע מה**. הוא אינו מאחד סכמות, אינו יוצר store, ואינו
> משנה derivation קיים. הוא קובע במפורש ששתי סמכויות פועלות במקביל — ושאין
> להכריע ביניהן.

---

## §1 — הרקע: שתי סמכויות רצו במקביל בלי גשר

שני מקורות Human Config פעלו בו-זמנית, כל אחד עם טקסונומיה משלו, בלי שום
התאמה מוצהרת ביניהם. זו לא הייתה תקלה — כל אחד מהם נבנה למטרה אחרת. אבל
היעדר הגשר אִפשר לקרוא כל אחד מהם כאילו הוא "האמיתי".

---

## §2 — ההכרעה (LOCKED)

### 2.1 · `HUMAN_CONFIG_MASTER_SOURCE_LOCK_v1.0.xlsx` — 189 שורות
**סמכות: RUNTIME GOVERNANCE / ELIGIBILITY.**

קובעת מה מותר ל-runtime להפעיל. מסווגת כל שורה לפי `TYPE` × `RUNTIME_STATUS`.
זו הסמכות שכל שבעת המסופים צורכים בפועל היום.
מימוש ההפעלה: `canonical/activeConfig.ts` — 19 refs פעילים מתוך 189.

### 2.2 · `קונפינג-אדם-MASTER-PRODUCTION-2.1-TAXONOMY-AUDITED-PROGRESS.xlsx` — ~1492 יחידות
**סמכות: SEMANTIC / SOURCE CORPUS.**

הידע עצמו: הטקסט, ההיררכיה, הפרובננס, והסיווג הרטורי
(אקסיומה/אפוריזם, טענה/עיקרון, מנגנון, שלב/תהליך …).
מימוש הקריאה: `humanConfig/masterUnitsSource.ts` (קריאה בלבד, מ-Dropbox).

### 2.3 · הגשר — 189↔1492
**סמכות: PERMANENT BRIDGE.**

לא מיזוג. `humanConfig/crosswalk.ts` — הקרנה טהורה, קריאה בלבד, מצטרפת
לפי כותרת מנורמלת.

---

## §3 — הכללים הנעולים

1. **הקורפוס (1492) אינו גובר על ה-Source Lock (189).**
2. **ה-Source Lock (189) אינו מחליף את הקורפוס הסמנטי.**
3. **שום יחידת Production אינה הופכת ל-runtime-active רק משום שהיא קיימת.**
4. **הפעלה נשארת בשליטת ה-Source Lock בלבד** — `activeConfig.ts` הוא המקום
   היחיד שמפעיל, ו-`crosswalk.ts` אינו יכול להרחיב אותו.
5. הערך החזק ביותר שיחידת 2.1 יכולה לקבל הוא `RUNTIME_CANDIDATE` — והוא
   מתאר את הזכאות של **הכותרת**, לעולם לא של היחידה.

---

## §4 — הפערים: מוצהרים, לא מגושרים

נמדדו מול הנתונים האמיתיים. **אין לפברק ביניהם התאמה.**

| ממצא | כמות | משמעות |
|---|---:|---|
| כיסוי כותרות | **67.8%** | 124 מתוך 183 כותרות Lock נמצאות גם ב-2.1 |
| `MISSING_IN_2_1` | **59** | כותרות Lock ללא מקבילה בקורפוס כלל |
| `SOURCE_ONLY` | **543** | יחידות קורפוס ללא שום ממשל runtime |
| `REVIEW_REQUIRED` | **70** | היחידה עצמה מסומנת לבדיקה בחוברת |
| `RUNTIME_CANDIDATE` | **55** | מועמדות בלבד — לא הופעלו ולא יופעלו אוטומטית |
| **runtime-active ללא מקבילה** | **2** | מתוך 19 השורות הפעילות — פער ממשל אמיתי |

התפלגות צד ה-Lock: `SPLIT 51 · SEMANTIC_MATCH 43 · EXPANDED 24 · MERGED 12 · MISSING_IN_2_1 59`.

**אפס `EXACT_MATCH`** — כל צירוף יחיד נופל ל-`SEMANTIC_MATCH`, כי שתי
הסמכויות משתמשות באוצר מילים שונה לגמרי עבור `Section`. זה ממצא, לא באג.

---

## §5 — מה נדרש כדי לפתוח מחדש

ההכרעה הזו נעולה. אין לפתוח אותה מחדש **אלא אם ראיית מקור חדשה מוכיחה
סתירה** — למשל שורת Source Lock שהקורפוס סותר במפורש, או מסמך מקור שקובע
סמכות אחרת. שינוי בכמויות בלבד אינו סתירה.

---

## §6 — מיקום בשרשרת

```
HUMAN SOURCE
  ↓
Production 2.1 · 1492      ← קורפוס סמנטי/אטומי
  ↓
CROSSWALK                  ← גשר קבוע (מסמך זה)
  ↑
Source Lock · 189          ← זכאות/ממשל runtime
  ↓
HUMAN USER BASE  +  VALUE/DIRECTION  +  SELECTED DOMAIN CONFIG
  ↓
PERSON IN CONTEXT          ← מסגרת ייחוס. לא מצב.
  ↓
OBSERVATION → MEASUREMENT → INTERPRETATION
  ↓
VALUE CHARACTER → VALUE FAMILY → VALUE GROUP RELEVANCE
  ↓
NEED / CAPABILITY / RESOURCE → ACTION → EFFECT → EVIDENCE / LEARNING
  ↺
```

הקו החוצה: כל מה שמעל `PERSON IN CONTEXT` הוא **ייחוס** — מה ניתן לשאול,
למדוד או להתארגן סביבו. כל מה שמתחתיו דורש **רשומה אמיתית**. הגבול הזה
נאכף מבנית ב-`person/humanUserBase.ts` (אין בטיפוס שדה למדידה/מצב/ציון)
ונבדק ב-`person/__tests__/`.

הקצה הפתוח של השרשרת — `LEARNING → STATE(t+1)` — מתועד בנפרד ולא נפתר:
[`STATE-TRANSITION-BOUNDARY.md`](./app/lib/philos/canon/STATE-TRANSITION-BOUNDARY.md).
