# ייבוא אירועי קבוצה — `group-events.jsonl`

`.philos-canon-data/group-events.jsonl` · JSONL · append-only · קובץ ריק = אפס אירועים (לא שגיאה).

## שדות חובה בכל אירוע

```
event_id · group_id · event_type · occurred_at · recorded_at
object_id · source · provenance · status
```

`actor_id` — **רק כשמדובר באדם.** `payload` — טיפוסי לפי הסוג.

## הכלל שאי אפשר לעקוף

`provenance: "DERIVED"` **פסול אם הוא נושא `actor_id`.** מסקנה של המערכת אינה שחקן חברתי. `validateGroupEvent()` דוחה אירוע כזה, ולא רק ב-lint — בקליטה.

`occurred_at` ≠ `recorded_at`: מתי זה קרה בעולם, ומתי PHILOS למד. ייבוא בדיעבד לא כותב מחדש היסטוריה.

## 24 סוגי אירוע

```
NEED_DECLARED · NEED_UPDATED · NEED_RESOLVED
RESOURCE_OFFERED · RESOURCE_UPDATED · RESOURCE_WITHDRAWN
MATCH_PROPOSED · MATCH_ACCEPTED · MATCH_REJECTED
ACTION_PROPOSED · ACTION_STARTED · ACTION_COMPLETED · ACTION_CANCELLED
EFFECT_OBSERVED · EVIDENCE_ATTACHED
MEMBER_JOINED · MEMBER_LEFT · ROLE_CHANGED
BUDGET_RECEIVED · BUDGET_SPENT · BUDGET_COMMITTED
TENSION_OBSERVED · VALUE_MAPPING_PROPOSED · VALUE_MAPPING_CONFIRMED
```

סוג שהבילד לא מכיר **נשמר ונספר** כ-`unrecognised`, לא נמחק. מפיק חדש מול קורא ישן לא מאבד דאטה.

## דוגמה — שרשרת מלאה

```jsonl
{"event_id":"ge_001","group_id":"vg_x","event_type":"NEED_DECLARED","object_id":"need_001","occurred_at":"2026-08-10T09:00:00Z","recorded_at":"2026-08-10T09:05:00Z","actor_id":"p_avi","source":"טופס הצהרת צורך","provenance":"REAL","status":"OPEN","payload":{"description":"מתנדבים לחלוקה","quantity":6,"unit":"שעות","geography":"חיפה","urgency":"HIGH","subvalue_id":"SV026"}}
{"event_id":"ge_002","group_id":"vg_y","event_type":"RESOURCE_OFFERED","object_id":"res_001","occurred_at":"2026-08-11T09:00:00Z","recorded_at":"2026-08-11T09:00:00Z","actor_id":"p_dina","source":"טופס הצעת משאב","provenance":"REAL","status":"RECORDED","payload":{"quantity":10,"unit":"שעות","geography":"חיפה","provider_kind":"GROUP","provider_id":"vg_y","subvalue_id":"SV026"}}
{"event_id":"ge_003","group_id":"vg_x","event_type":"MATCH_ACCEPTED","object_id":"match_001","occurred_at":"2026-08-12T09:00:00Z","recorded_at":"2026-08-12T09:00:00Z","actor_id":"p_avi","source":"החלטת רכז","provenance":"REAL","status":"CONFIRMED","payload":{"need_ref":"need_001","resource_ref":"res_001"}}
{"event_id":"ge_004","group_id":"vg_x","event_type":"ACTION_COMPLETED","object_id":"act_001","occurred_at":"2026-08-14T18:00:00Z","recorded_at":"2026-08-14T18:30:00Z","actor_id":"p_avi","source":"דיווח ביצוע","provenance":"REAL","status":"RECORDED","payload":{"match_ref":"match_001","inputs":["need_001","res_001"]}}
{"event_id":"ge_005","group_id":"vg_x","event_type":"EFFECT_OBSERVED","object_id":"eff_001","occurred_at":"2026-08-15T09:00:00Z","recorded_at":"2026-08-15T09:00:00Z","actor_id":"p_avi","source":"מדידה","provenance":"REAL","status":"CLAIMED","payload":{"action_ref":"act_001","metric":"שעות","value":6}}
{"event_id":"ge_006","group_id":"vg_x","event_type":"EVIDENCE_ATTACHED","object_id":"evi_001","occurred_at":"2026-08-16T09:00:00Z","recorded_at":"2026-08-16T09:00:00Z","actor_id":"p_rina","source":"אימות עמית","provenance":"REAL","status":"VERIFIED","evidence":"צילום + חתימת מקבל","payload":{"effect_ref":"eff_001","verified_by":"p_rina","level":"community_verified"}}
```

השרשרת היא **מזהים** לכל אורכה: `need_001 → match_001 → act_001 → eff_001 → evi_001`. אף מסוף לא משחזר אותה בעצמו.

## מה נדחה

`event_id` כפול · JSON פגום · תאריך שאינו ISO · `provenance` לא מוכר · שדה חובה חסר · `DERIVED` עם `actor_id`. כל דחייה מדווחת עם מספר שורה וסיבה; שורה פגומה לא מפילה את הקובץ.
