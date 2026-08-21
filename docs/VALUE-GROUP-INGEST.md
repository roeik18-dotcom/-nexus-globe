# פורמט ייבוא קבוצות ערך — `value-groups.jsonl`

הקובץ שדרכו נכנס דאטהסט קבוצות ל-PHILOS **בלי שינוי קוד**.

* **מיקום:** `.philos-canon-data/value-groups.jsonl`
* **קידוד:** UTF-8, אובייקט JSON אחד לכל שורה (JSONL), append-only
* **קובץ חסר = 0 קבוצות.** לא נופל, לא ממציא, לא חוזר לקבוצת ברירת מחדל.
* שורה פגומה **מדווחת** (מספר שורה + סיבה) ולא מפילה את הייבוא.

## שדות

### חובה — שלושה בלבד
| שדה | טיפוס | הערה |
|---|---|---|
| `group_id` | string | ייחודי ויציב, למשל `vg_hesed_haifa`. מזהה כפול **נדחה, לא ממוזג** |
| `name` | string | שם הקבוצה |
| `provenance` | `"REAL"` \| `"DEMO"` | הצהרה מפורשת. לא נגזר מהקובץ |

### אופציונלי — שדה חסר נשאר חסר
| שדה | טיפוס |
|---|---|
| `description` | string — מטרה/תיאור |
| `status` | `"active"` \| `"forming"` \| `"archived"` |
| `geography` | string |
| `central_value_label` | string — הערך כפי שהקבוצה מנסחת אותו. **טקסט חופשי, לא מזהה טקסונומיה** |
| `primary_subvalue_id` | `SV001`–`SV223` — רק אם כבר הוכרע |
| `secondary_subvalue_ids` | `string[]` |
| `members` | `[{ person_id, display_name?, role?, joined_at? }]` |
| `budget` | `{ received, spent, committed, available, currency }` |
| `money_flow_count` | number |
| `needs` / `offers` / `actions` | `string[]` |
| `effect_count` / `evidence_count` / `event_count` | number |
| `source` | string — מאיפה השורה. מוצג על המסך ליד הקבוצה |

## כללים

1. **שדה נעדר נשאר נעדר.** לעולם לא `0`, לא `""`, לא `"member"` כברירת מחדל.
2. **`central_value_label` אינו מזהה קנוני.** הוא עובר דרך `valueMapping.ts` בדיוק כמו הקבוצה המקורית, ונשאר `UNRESOLVED_REVIEW_REQUIRED` עד להכרעה מתועדת. התאמה מטושטשת אינה ראיה.
3. **`provenance: "REAL"` היא הצהרה של השולח**, ולא נגזרת מהיות השורה בקובץ.

## דוגמה

```jsonl
{"group_id":"vg_hesed_haifa","name":"חסד חיפה","provenance":"REAL","description":"חלוקת מזון שבועית","status":"active","geography":"חיפה","central_value_label":"נתינה","members":[{"person_id":"p_avi","role":"מוביל"},{"person_id":"p_dina"}],"budget":{"received":4200,"spent":1800,"committed":0,"available":2400,"currency":"ILS"},"source":"גיליון קבוצות 2026-08"}
```

> השורה לעיל היא **דוגמה בתיעוד בלבד**. אין קובץ ייבוא במאגר, ולא נוצרו קבוצות REAL מפוברקות.

## הכרעות מיפוי ערך — `value-group-mappings.jsonl`

באותה תיקייה. הכרעה היא **דאטה, לא שינוי קוד**:

```jsonl
{"group_id":"vg_ahrayut_kehilatit","primary_subvalue_id":"SV017","decided_by":"רועי","evidence":"הכרעת בורד 2026-08-21","recorded_at":"2026-08-21"}
```

בלי רשומה כזאת המיפוי נשאר פתוח, והמסך מציג את המועמדים ואת המילה "נדרשת הכרעה".
