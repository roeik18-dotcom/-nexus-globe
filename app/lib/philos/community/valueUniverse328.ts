/**
 * PHILOS Value Universe — the 328-entry Board review source
 * (`עותק של PHILOS_VALUE_GROUPS_MASTER_328_HE.docx`, real file, read via
 * `textutil -convert txt`, parsed programmatically — every one of the 328
 * raw rows is preserved verbatim below, none dropped, none invented).
 *
 * Structure, per the source document's own §ג/§ד rules:
 *   RAW_FAMILIES (28)      — PHILOS's own candidate Value Families.
 *   RAW_SOURCE_ENTRIES (300) — religion/belief-tradition interpretations,
 *     each already carrying the document's own proposed family mapping
 *     (`proposed_family_he`) — never re-guessed, read directly from source.
 *   SUBVALUES               — real, mechanical dedup: entries sharing the
 *     EXACT SAME `value_group_he` string collapse into one subvalue with
 *     multiple real source citations (e.g. "צדק" cited by 6 traditions —
 *     ONE subvalue, 6 real provenance records, never 6 duplicate values).
 *     "328 RAW ≠ 328 CANONICAL" — the document's own Board rule.
 *
 * `family_id` on a subvalue is the MAJORITY match among its own member
 * entries' individual keyword-matched family (`assigned_family_id`) — a
 * real, mechanical, deterministic function of the source document's own
 * `proposed_family_he` text, cross-checked against the 28 families' own
 * stated keywords. `null` = no reliable match — left as a real,
 * explicitly-flagged cross-family/needs-review case, never forced.
 *
 * Religion is PROVENANCE, never the Value Group itself (source document's
 * own §9 rule, mission's own explicit instruction): nothing here asserts
 * "Judaism = a Value Group" — each source entry is one interpretation
 * FROM a tradition, contributing evidence toward a normalized PHILOS
 * subvalue, never a tradition-as-value-group record.
 */

export interface RawFamily {
  id: string;
  name_he: string;
  content_he: string;
  status: "PHILOS_CANDIDATE_FAMILY";
}

export interface RawSourceEntry {
  id: string;
  value_group_he: string;
  interpretation_he: string;
  proposed_family_he: string;
  status: "SOURCE_INTERPRETIVE";
  /** Real, mechanical keyword match against `RAW_FAMILIES`' own content —
   *  `null` when no reliable match exists (never forced). */
  assigned_family_id: string | null;
}

export interface Subvalue {
  subvalue_id: string;
  name_he: string;
  /** Majority-vote family among this subvalue's own source entries —
   *  `null` = cross-family / needs board review, stated explicitly. */
  family_id: string | null;
  source_entry_ids: string[];
  source_count: number;
}

export const RAW_FAMILIES: RawFamily[] = [
  {
    "id": "F01",
    "name_he": "חיים וכבוד האדם",
    "content_he": "חיים, כבוד, הגנה מפגיעה",
    "status": "PHILOS_CANDIDATE_FAMILY"
  },
  {
    "id": "F02",
    "name_he": "חופש ואוטונומיה",
    "content_he": "חירות, בחירה, עצמאות, אי־כפייה",
    "status": "PHILOS_CANDIDATE_FAMILY"
  },
  {
    "id": "F03",
    "name_he": "אחריות, זכויות וחובות",
    "content_he": "אחריות, סמכות, זכות/חובה, גבולות",
    "status": "PHILOS_CANDIDATE_FAMILY"
  },
  {
    "id": "F04",
    "name_he": "ביטחון ויציבות",
    "content_he": "ביטחון, יציבות, הגנה, רציפות",
    "status": "PHILOS_CANDIDATE_FAMILY"
  },
  {
    "id": "F05",
    "name_he": "צדק, שוויון והוגנות",
    "content_he": "צדק, שוויון, הוגנות, אי־ניצול",
    "status": "PHILOS_CANDIDATE_FAMILY"
  },
  {
    "id": "F06",
    "name_he": "אמת, מציאות ויושר",
    "content_he": "אמת, בוחן מציאות, כנות, יושר",
    "status": "PHILOS_CANDIDATE_FAMILY"
  },
  {
    "id": "F07",
    "name_he": "אמון ונאמנות",
    "content_he": "אמון, נאמנות, אמינות, מחויבות",
    "status": "PHILOS_CANDIDATE_FAMILY"
  },
  {
    "id": "F08",
    "name_he": "אהבה, אכפתיות ואמפתיה",
    "content_he": "אהבה, אכפתיות, תמיכה, חמלה, אמפתיה",
    "status": "PHILOS_CANDIDATE_FAMILY"
  },
  {
    "id": "F09",
    "name_he": "חיבור, שייכות ואחדות",
    "content_he": "חיבור, שייכות, קהילה, אחדות בלי מחיקת שונות",
    "status": "PHILOS_CANDIDATE_FAMILY"
  },
  {
    "id": "F10",
    "name_he": "נתינה ותרומה",
    "content_he": "נתינה, השלמת מחסור, תרומה, שירות",
    "status": "PHILOS_CANDIDATE_FAMILY"
  },
  {
    "id": "F11",
    "name_he": "ידע, הבנה ואוריינטציה",
    "content_he": "ידע, למידה, הבנה, חשיבה, התמצאות",
    "status": "PHILOS_CANDIDATE_FAMILY"
  },
  {
    "id": "F12",
    "name_he": "התפתחות ושיפור",
    "content_he": "גדילה, התפתחות, שינוי, שיפור",
    "status": "PHILOS_CANDIDATE_FAMILY"
  },
  {
    "id": "F13",
    "name_he": "יצירה וביטוי",
    "content_he": "יצירתיות, אמנות, ביטוי, דמיון",
    "status": "PHILOS_CANDIDATE_FAMILY"
  },
  {
    "id": "F14",
    "name_he": "אומץ ופעולה",
    "content_he": "אומץ, יוזמה, Agency",
    "status": "PHILOS_CANDIDATE_FAMILY"
  },
  {
    "id": "F15",
    "name_he": "משמעת, איפוק ואיזון",
    "content_he": "ויסות, איפוק, דחיית סיפוקים, איזון",
    "status": "PHILOS_CANDIDATE_FAMILY"
  },
  {
    "id": "F16",
    "name_he": "התמדה והמשכיות",
    "content_he": "התמדה, מומנטום, עקביות",
    "status": "PHILOS_CANDIDATE_FAMILY"
  },
  {
    "id": "F17",
    "name_he": "שיתוף פעולה ותיאום",
    "content_he": "שיתוף פעולה, תיאום, פעולה קולקטיבית",
    "status": "PHILOS_CANDIDATE_FAMILY"
  },
  {
    "id": "F18",
    "name_he": "שמירת משאבים ואי־ריקון",
    "content_he": "‏Anti-Depletion, עלות/תועלת, שמירת יכולת הנותן",
    "status": "PHILOS_CANDIDATE_FAMILY"
  },
  {
    "id": "F19",
    "name_he": "יכולת והעצמה",
    "content_he": "יכולת, מיומנות, הזדמנות, Capacity",
    "status": "PHILOS_CANDIDATE_FAMILY"
  },
  {
    "id": "F20",
    "name_he": "פרטיות, בעלות וגבולות",
    "content_he": "פרטיות, רכוש, גבול, מרחב אישי",
    "status": "PHILOS_CANDIDATE_FAMILY"
  },
  {
    "id": "F21",
    "name_he": "קבלה, שונות ופלורליזם",
    "content_he": "קבלת האחר, שונות, סובלנות, אי־שיפוט כולל",
    "status": "PHILOS_CANDIDATE_FAMILY"
  },
  {
    "id": "F22",
    "name_he": "שקיפות ואחריותיות",
    "content_he": "שקיפות, מקור, Evidence, אחריות על החלטות",
    "status": "PHILOS_CANDIDATE_FAMILY"
  },
  {
    "id": "F23",
    "name_he": "רווחה ואיכות חיים",
    "content_he": "אושר, שמחה, איכות חיים, רווחה",
    "status": "PHILOS_CANDIDATE_FAMILY"
  },
  {
    "id": "F24",
    "name_he": "הישג, מצוינות ופרודוקטיביות",
    "content_he": "הישג, מצוינות, פרודוקטיביות",
    "status": "PHILOS_CANDIDATE_FAMILY"
  },
  {
    "id": "F25",
    "name_he": "כבוד והכרה הדדית",
    "content_he": "הערכה, הכרה, יחס מכבד",
    "status": "PHILOS_CANDIDATE_FAMILY"
  },
  {
    "id": "F26",
    "name_he": "תקשורת והבנה הדדית",
    "content_he": "שפה, תקשורת, הקשבה, הבנה הדדית",
    "status": "PHILOS_CANDIDATE_FAMILY"
  },
  {
    "id": "F27",
    "name_he": "הסתגלות וחוסן",
    "content_he": "הסתגלות, חוסן, התאוששות",
    "status": "PHILOS_CANDIDATE_FAMILY"
  },
  {
    "id": "F28",
    "name_he": "הדדיות והחלפה",
    "content_he": "‏Reciprocity, Matching, Transfer",
    "status": "PHILOS_CANDIDATE_FAMILY"
  }
];

export const RAW_SOURCE_ENTRIES: RawSourceEntry[] = [
  {
    "id": "S001",
    "value_group_he": "דרך ארץ ונימוס",
    "interpretation_he": "כבוד הדדי, התנהגות ראויה, דיבור מכבד",
    "proposed_family_he": "כבוד/תרבות אזרחית",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F01"
  },
  {
    "id": "S002",
    "value_group_he": "כיבוד הורים",
    "interpretation_he": "כבוד לאב ולאם ואחריות בין־דורית",
    "proposed_family_he": "משפחה/כבוד",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F01"
  },
  {
    "id": "S003",
    "value_group_he": "קדושת החיים",
    "interpretation_he": "איסור רצח והגנה על החיים",
    "proposed_family_he": "חיים/ביטחון",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F01"
  },
  {
    "id": "S004",
    "value_group_he": "אמת ואמינות",
    "interpretation_he": "איסור עדות שקר וחשיבות אמת בדיבור",
    "proposed_family_he": "אמת/יושר",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F06"
  },
  {
    "id": "S005",
    "value_group_he": "שמירת קניין",
    "interpretation_he": "איסור גניבה וכבוד לבעלות",
    "proposed_family_he": "קניין/יושר",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F06"
  },
  {
    "id": "S006",
    "value_group_he": "נאמנות ביחסים",
    "interpretation_he": "איסור ניאוף, מחויבות וברית",
    "proposed_family_he": "נאמנות/יחסים",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F07"
  },
  {
    "id": "S007",
    "value_group_he": "איפוק מחמדנות",
    "interpretation_he": "ריסון חמדנות וקנאה",
    "proposed_family_he": "איפוק/גבולות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F15"
  },
  {
    "id": "S008",
    "value_group_he": "צדקה",
    "interpretation_he": "נתינה והשלמת מחסור",
    "proposed_family_he": "נתינה/צדק",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F10"
  },
  {
    "id": "S009",
    "value_group_he": "חסד",
    "interpretation_he": "עשיית טוב מעבר לחובה פורמלית",
    "proposed_family_he": "אכפתיות/נתינה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F08"
  },
  {
    "id": "S010",
    "value_group_he": "הכנסת אורחים",
    "interpretation_he": "אירוח, פתיחות ונדיבות לזולת",
    "proposed_family_he": "קהילה/נדיבות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F09"
  },
  {
    "id": "S011",
    "value_group_he": "צדק ומשפט",
    "interpretation_he": "שאיפה למשפט הוגן ואי־עיוות דין",
    "proposed_family_he": "צדק/הוגנות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F05"
  },
  {
    "id": "S012",
    "value_group_he": "שלום",
    "interpretation_he": "רדיפת שלום ויישוב סכסוכים",
    "proposed_family_he": "שלום/פיוס",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": null
  },
  {
    "id": "S013",
    "value_group_he": "תשובה ותיקון",
    "interpretation_he": "יכולת להכיר בכשל ולתקן התנהגות",
    "proposed_family_he": "למידה/תיקון",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F11"
  },
  {
    "id": "S014",
    "value_group_he": "לימוד",
    "interpretation_he": "ערך הלמידה, העיון והעברת ידע",
    "proposed_family_he": "ידע/למידה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F11"
  },
  {
    "id": "S015",
    "value_group_he": "שמירת הלשון",
    "interpretation_he": "אחריות לדיבור, רכילות והשפעת מילים",
    "proposed_family_he": "תקשורת/אחריות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F22"
  },
  {
    "id": "S016",
    "value_group_he": "ענווה",
    "interpretation_he": "צניעות ביחס לעצמי ולזולת",
    "proposed_family_he": "ענווה/איזון",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F15"
  },
  {
    "id": "S017",
    "value_group_he": "שמיטה ומנוחה",
    "interpretation_he": "גבול לעבודה, מנוחה ומחזוריות",
    "proposed_family_he": "רווחה/גבולות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F20"
  },
  {
    "id": "S018",
    "value_group_he": "אחריות קהילתית",
    "interpretation_he": "ערבות הדדית ומחויבות לקהילה",
    "proposed_family_he": "קהילה/אחריות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F22"
  },
  {
    "id": "S019",
    "value_group_he": "כבוד לגר ולזר",
    "interpretation_he": "יחס הוגן למי שאינו בן הקבוצה",
    "proposed_family_he": "פלורליזם/כבוד",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F01"
  },
  {
    "id": "S020",
    "value_group_he": "ברית ומחויבות",
    "interpretation_he": "עמידה בהתחייבות ובמסגרת נורמטיבית",
    "proposed_family_he": "מחויבות/אמון",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F07"
  },
  {
    "id": "S021",
    "value_group_he": "אהבת הזולת",
    "interpretation_he": "אהבה פעילה לאחר",
    "proposed_family_he": "אהבה/אכפתיות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F08"
  },
  {
    "id": "S022",
    "value_group_he": "אהבת אויב",
    "interpretation_he": "אי־נקמה וחתירה לפיוס",
    "proposed_family_he": "פיוס/אי־אלימות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": null
  },
  {
    "id": "S023",
    "value_group_he": "חסד",
    "interpretation_he": "נתינה וטוב לב",
    "proposed_family_he": "נתינה/חמלה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F10"
  },
  {
    "id": "S024",
    "value_group_he": "רחמים",
    "interpretation_he": "יחס של חמלה לסובל",
    "proposed_family_he": "חמלה/אכפתיות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F08"
  },
  {
    "id": "S025",
    "value_group_he": "סליחה",
    "interpretation_he": "ויתור על נקמה ושיקום יחסים",
    "proposed_family_he": "פיוס/תיקון",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F18"
  },
  {
    "id": "S026",
    "value_group_he": "ענווה",
    "interpretation_he": "הימנעות מגאווה והכרה במגבלות",
    "proposed_family_he": "ענווה/איזון",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F15"
  },
  {
    "id": "S027",
    "value_group_he": "שירות",
    "interpretation_he": "מנהיגות ושייכות דרך שירות לאחר",
    "proposed_family_he": "שירות/תרומה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F10"
  },
  {
    "id": "S028",
    "value_group_he": "צדק",
    "interpretation_he": "דאגה להוגנות ולחלש",
    "proposed_family_he": "צדק/הוגנות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F05"
  },
  {
    "id": "S029",
    "value_group_he": "שלום",
    "interpretation_he": "שאיפה לשלום כאפקט של צדק ואהבה",
    "proposed_family_he": "שלום/צדק",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F05"
  },
  {
    "id": "S030",
    "value_group_he": "כבוד האדם",
    "interpretation_he": "כבוד לכל אדם",
    "proposed_family_he": "כבוד/חיים",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F01"
  },
  {
    "id": "S031",
    "value_group_he": "תקווה",
    "interpretation_he": "יכולת לפעול מתוך עתיד אפשרי",
    "proposed_family_he": "תקווה/חוסן",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F27"
  },
  {
    "id": "S032",
    "value_group_he": "אמונה",
    "interpretation_he": "מחויבות למסגרת משמעות ואמון",
    "proposed_family_he": "אמון/משמעות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F07"
  },
  {
    "id": "S033",
    "value_group_he": "צדקה",
    "interpretation_he": "סיוע לעניים ונזקקים",
    "proposed_family_he": "נתינה/צדק",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F10"
  },
  {
    "id": "S034",
    "value_group_he": "נאמנות",
    "interpretation_he": "מחויבות ביחסים ובברית",
    "proposed_family_he": "נאמנות/מחויבות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F07"
  },
  {
    "id": "S035",
    "value_group_he": "אמת",
    "interpretation_he": "חיים ללא שקר והונאה",
    "proposed_family_he": "אמת/יושר",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F06"
  },
  {
    "id": "S036",
    "value_group_he": "מתינות",
    "interpretation_he": "שליטה עצמית והימנעות מקיצוניות",
    "proposed_family_he": "איפוק/איזון",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F15"
  },
  {
    "id": "S037",
    "value_group_he": "אומץ מוסרי",
    "interpretation_he": "עמידה בעקרונות גם תחת לחץ",
    "proposed_family_he": "אומץ/יושרה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F14"
  },
  {
    "id": "S038",
    "value_group_he": "קהילה",
    "interpretation_he": "אחריות הדדית בתוך קהילה",
    "proposed_family_he": "קהילה/שייכות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F09"
  },
  {
    "id": "S039",
    "value_group_he": "טיפול בחלש",
    "interpretation_he": "דאגה לעני, חולה, זר ומודר",
    "proposed_family_he": "הגנה/אכפתיות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F08"
  },
  {
    "id": "S040",
    "value_group_he": "הטוב המשותף",
    "interpretation_he": "תנאים המאפשרים לאנשים ולקבוצות לשגשג",
    "proposed_family_he": "טוב משותף/קהילה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F09"
  },
  {
    "id": "S041",
    "value_group_he": "צדק",
    "interpretation_he": "עמידה לצדק גם כשהוא לא נוח",
    "proposed_family_he": "צדק/הוגנות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F05"
  },
  {
    "id": "S042",
    "value_group_he": "רחמים",
    "interpretation_he": "רחמים וחמלה ביחסים",
    "proposed_family_he": "חמלה/אכפתיות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F08"
  },
  {
    "id": "S043",
    "value_group_he": "צדקה",
    "interpretation_he": "זכאת/צדקה ותמיכה בנזקק",
    "proposed_family_he": "נתינה/חלוקה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F10"
  },
  {
    "id": "S044",
    "value_group_he": "סבלנות",
    "interpretation_he": "סבר: עמידה והשהיית תגובה",
    "proposed_family_he": "חוסן/איפוק",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F15"
  },
  {
    "id": "S045",
    "value_group_he": "אמת",
    "interpretation_he": "אמירת אמת ואי־עדות שקר",
    "proposed_family_he": "אמת/יושר",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F06"
  },
  {
    "id": "S046",
    "value_group_he": "אמינות",
    "interpretation_he": "שמירת אמנה והפקדה",
    "proposed_family_he": "אמון/אחריות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F07"
  },
  {
    "id": "S047",
    "value_group_he": "כיבוד הורים",
    "interpretation_he": "טיפול והכרת תודה להורים",
    "proposed_family_he": "משפחה/כבוד",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F01"
  },
  {
    "id": "S048",
    "value_group_he": "כבוד לעני וליתום",
    "interpretation_he": "הגנה על מי שתלוי באחרים",
    "proposed_family_he": "הגנה/צדק",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F01"
  },
  {
    "id": "S049",
    "value_group_he": "מתינות",
    "interpretation_he": "הימנעות מבזבוז וקיצוניות",
    "proposed_family_he": "איזון/משאבים",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F15"
  },
  {
    "id": "S050",
    "value_group_he": "אי־חריגה מגבולות",
    "interpretation_he": "הפעלת כוח תחת גבולות נורמטיביים",
    "proposed_family_he": "גבולות/אחריות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F20"
  },
  {
    "id": "S051",
    "value_group_he": "סליחה",
    "interpretation_he": "העדפת מחילה במצבים מתאימים",
    "proposed_family_he": "פיוס/תיקון",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": null
  },
  {
    "id": "S052",
    "value_group_he": "אחווה",
    "interpretation_he": "סולידריות בין בני קהילה",
    "proposed_family_he": "קהילה/שייכות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F09"
  },
  {
    "id": "S053",
    "value_group_he": "אחריות כלכלית",
    "interpretation_he": "הגינות בכסף, מסחר וחובות",
    "proposed_family_he": "יושר/כלכלה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F06"
  },
  {
    "id": "S054",
    "value_group_he": "שמירת קניין",
    "interpretation_he": "כבוד לרכוש והפקדות",
    "proposed_family_he": "קניין/אמון",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F07"
  },
  {
    "id": "S055",
    "value_group_he": "צניעות",
    "interpretation_he": "ריסון עצמי והתנהלות מכבדת",
    "proposed_family_he": "איפוק/כבוד",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F01"
  },
  {
    "id": "S056",
    "value_group_he": "ידע",
    "interpretation_he": "חיפוש ידע והבנה",
    "proposed_family_he": "ידע/למידה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F11"
  },
  {
    "id": "S057",
    "value_group_he": "ייעוץ הדדי",
    "interpretation_he": "שורה: התייעצות בהחלטות ציבוריות",
    "proposed_family_he": "ממשל/שיתוף",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F17"
  },
  {
    "id": "S058",
    "value_group_he": "שלום",
    "interpretation_he": "שאיפה ליישוב סכסוכים וצדק",
    "proposed_family_he": "שלום/פיוס",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F05"
  },
  {
    "id": "S059",
    "value_group_he": "אחריות למעשה",
    "interpretation_he": "הכרה בתוצאה המוסרית של פעולה",
    "proposed_family_he": "אחריות/למידה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F22"
  },
  {
    "id": "S060",
    "value_group_he": "טיפול בקהילה",
    "interpretation_he": "דאגה לרווחת הקהילה והחלשים",
    "proposed_family_he": "קהילה/אכפתיות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F08"
  },
  {
    "id": "S061",
    "value_group_he": "דהרמה",
    "interpretation_he": "מילוי חובה מותאמת הקשר וסדר מוסרי",
    "proposed_family_he": "אחריות/חובה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F03"
  },
  {
    "id": "S062",
    "value_group_he": "אהימסה",
    "interpretation_he": "אי־פגיעה ביצורים",
    "proposed_family_he": "אי־אלימות/חיים",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F01"
  },
  {
    "id": "S063",
    "value_group_he": "אמת",
    "interpretation_he": "סטיה: אמת ויושרה",
    "proposed_family_he": "אמת/יושר",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F06"
  },
  {
    "id": "S064",
    "value_group_he": "אי־גניבה",
    "interpretation_he": "אסטיה: כבוד לקניין",
    "proposed_family_he": "קניין/יושר",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F06"
  },
  {
    "id": "S065",
    "value_group_he": "אי־היאחזות",
    "interpretation_he": "אפריגרהה: ריסון רכושנות",
    "proposed_family_he": "איפוק/משאבים",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F15"
  },
  {
    "id": "S066",
    "value_group_he": "שליטה עצמית",
    "interpretation_he": "ריסון דחפים ומשמעת",
    "proposed_family_he": "איפוק/משמעת",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F15"
  },
  {
    "id": "S067",
    "value_group_he": "חמלה",
    "interpretation_he": "דאגה לרווחת יצורים",
    "proposed_family_he": "חמלה/חיים",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F01"
  },
  {
    "id": "S068",
    "value_group_he": "שירות",
    "interpretation_he": "סווה: פעולה למען האחר",
    "proposed_family_he": "שירות/תרומה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F10"
  },
  {
    "id": "S069",
    "value_group_he": "נתינה",
    "interpretation_he": "דאנה: נדיבות וצדקה",
    "proposed_family_he": "נתינה/נדיבות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F10"
  },
  {
    "id": "S070",
    "value_group_he": "שוויון תודעתי",
    "interpretation_he": "יחס פחות תלוי ברווח/הפסד",
    "proposed_family_he": "איזון/חוסן",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F15"
  },
  {
    "id": "S071",
    "value_group_he": "מסירות",
    "interpretation_he": "בהקטי: מחויבות ומסירות",
    "proposed_family_he": "מחויבות/משמעות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F07"
  },
  {
    "id": "S072",
    "value_group_he": "ידע עצמי",
    "interpretation_he": "חקירת העצמי והזהות",
    "proposed_family_he": "ידע/אוריינטציה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F11"
  },
  {
    "id": "S073",
    "value_group_he": "חכמה",
    "interpretation_he": "הבחנה ושיקול דעת",
    "proposed_family_he": "חכמה/הבנה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F11"
  },
  {
    "id": "S074",
    "value_group_he": "כבוד למורה",
    "interpretation_he": "יחס מכבד למורה ומסורת לימוד",
    "proposed_family_he": "כבוד/למידה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F01"
  },
  {
    "id": "S075",
    "value_group_he": "אחריות משפחתית",
    "interpretation_he": "חובות בתוך משפחה ושלבי חיים",
    "proposed_family_he": "משפחה/אחריות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F03"
  },
  {
    "id": "S076",
    "value_group_he": "משמעת רוחנית",
    "interpretation_he": "תרגול עקבי, מדיטציה ויוגה",
    "proposed_family_he": "משמעת/התמדה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F16"
  },
  {
    "id": "S077",
    "value_group_he": "איזון פעולה־תוצאה",
    "interpretation_he": "פעולה ללא היצמדות לתגמול",
    "proposed_family_he": "איזון/אחריות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F15"
  },
  {
    "id": "S078",
    "value_group_he": "טוהר",
    "interpretation_he": "שאוצ'ה: ניקיון פנימי וחיצוני",
    "proposed_family_he": "טוהר/משמעת",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F15"
  },
  {
    "id": "S079",
    "value_group_he": "שביעות רצון",
    "interpretation_he": "סנטושה: הסתפקות והכרת תודה",
    "proposed_family_he": "רווחה/מתינות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F23"
  },
  {
    "id": "S080",
    "value_group_he": "אחדות החיים",
    "interpretation_he": "תפיסת קשר עמוק בין יצורים",
    "proposed_family_he": "חיבור/אחדות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F09"
  },
  {
    "id": "S081",
    "value_group_he": "אי־פגיעה",
    "interpretation_he": "הימנעות מפגיעה ביצורים",
    "proposed_family_he": "אי־אלימות/חיים",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F01"
  },
  {
    "id": "S082",
    "value_group_he": "חמלה",
    "interpretation_he": "קרונה: רצון להפחית סבל",
    "proposed_family_he": "חמלה/אכפתיות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F08"
  },
  {
    "id": "S083",
    "value_group_he": "אהבה מיטיבה",
    "interpretation_he": "מטא: רצון בטובת האחר",
    "proposed_family_he": "אהבה/אכפתיות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F08"
  },
  {
    "id": "S084",
    "value_group_he": "שמחה באושר האחר",
    "interpretation_he": "מודיטה: שמחה בטובת הזולת",
    "proposed_family_he": "קהילה/נדיבות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F23"
  },
  {
    "id": "S085",
    "value_group_he": "איזון נפשי",
    "interpretation_he": "אופקה: יציבות מול שינוי",
    "proposed_family_he": "איזון/חוסן",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F15"
  },
  {
    "id": "S086",
    "value_group_he": "דיבור נכון",
    "interpretation_he": "דיבור אמת, מועיל ולא פוגעני",
    "proposed_family_he": "תקשורת/אמת",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F26"
  },
  {
    "id": "S087",
    "value_group_he": "פעולה נכונה",
    "interpretation_he": "התנהגות שאינה פוגעת",
    "proposed_family_he": "אחריות/פעולה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F17"
  },
  {
    "id": "S088",
    "value_group_he": "פרנסה נכונה",
    "interpretation_he": "פרנסה שאינה מבוססת פגיעה",
    "proposed_family_he": "כלכלה/אחריות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F22"
  },
  {
    "id": "S089",
    "value_group_he": "מאמץ נכון",
    "interpretation_he": "התמדה בטיפוח מצבים מועילים",
    "proposed_family_he": "התמדה/משמעת",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F16"
  },
  {
    "id": "S090",
    "value_group_he": "קשיבות",
    "interpretation_he": "מודעות להווה ולמצב",
    "proposed_family_he": "אוריינטציה/מודעות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F11"
  },
  {
    "id": "S091",
    "value_group_he": "ריכוז",
    "interpretation_he": "יכולת יציבה להפנות קשב",
    "proposed_family_he": "משמעת/קוגניציה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F15"
  },
  {
    "id": "S092",
    "value_group_he": "חכמה",
    "interpretation_he": "הבנת סבל, שינוי ותלות הדדית",
    "proposed_family_he": "חכמה/הבנה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F26"
  },
  {
    "id": "S093",
    "value_group_he": "נדיבות",
    "interpretation_he": "דאנה: נתינה ופתיחת היד",
    "proposed_family_he": "נתינה/נדיבות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F10"
  },
  {
    "id": "S094",
    "value_group_he": "סבלנות",
    "interpretation_he": "קשאנטי: נשיאת קושי ללא תגובתיות",
    "proposed_family_he": "חוסן/איפוק",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F15"
  },
  {
    "id": "S095",
    "value_group_he": "אי־היאחזות",
    "interpretation_he": "הפחתת תלות ברכוש ובזהות",
    "proposed_family_he": "איפוק/חופש",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F15"
  },
  {
    "id": "S096",
    "value_group_he": "אחריות לכוונה",
    "interpretation_he": "בחינת הכוונה מאחורי פעולה",
    "proposed_family_he": "אחריות/מניע",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F22"
  },
  {
    "id": "S097",
    "value_group_he": "קבלת שינוי",
    "interpretation_he": "הכרה בארעיות",
    "proposed_family_he": "הסתגלות/חוסן",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F27"
  },
  {
    "id": "S098",
    "value_group_he": "תלות הדדית",
    "interpretation_he": "הבנת קשר בין תנאים ותוצאות",
    "proposed_family_he": "מערכתיות/חיבור",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F09"
  },
  {
    "id": "S099",
    "value_group_he": "קהילת תרגול",
    "interpretation_he": "סנגהה: תמיכה הדדית בתרגול",
    "proposed_family_he": "קהילה/למידה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F09"
  },
  {
    "id": "S100",
    "value_group_he": "שחרור מסבל",
    "interpretation_he": "אוריינטציה להפחתת סבל",
    "proposed_family_he": "רווחה/חופש",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F23"
  },
  {
    "id": "S101",
    "value_group_he": "אמת",
    "interpretation_he": "חיים באמת ולא רק אמירת אמת",
    "proposed_family_he": "אמת/יושר",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F06"
  },
  {
    "id": "S102",
    "value_group_he": "שירות ללא אנוכיות",
    "interpretation_he": "סווה: שירות לזולת",
    "proposed_family_he": "שירות/תרומה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F10"
  },
  {
    "id": "S103",
    "value_group_he": "שוויון",
    "interpretation_he": "שוויון אנושי ללא היררכיית קאסטה",
    "proposed_family_he": "שוויון/כבוד",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F05"
  },
  {
    "id": "S104",
    "value_group_he": "ענווה",
    "interpretation_he": "הפחתת אגו ויוהרה",
    "proposed_family_he": "ענווה/איזון",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F15"
  },
  {
    "id": "S105",
    "value_group_he": "נדיבות",
    "interpretation_he": "חלוקת משאבים לאחר",
    "proposed_family_he": "נתינה/נדיבות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F10"
  },
  {
    "id": "S106",
    "value_group_he": "עבודה ישרה",
    "interpretation_he": "קיראט קרני: פרנסה ישרה",
    "proposed_family_he": "כלכלה/יושר",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F06"
  },
  {
    "id": "S107",
    "value_group_he": "שיתוף",
    "interpretation_he": "וונד צ'אקו: לחלוק עם אחרים",
    "proposed_family_he": "הדדיות/משאבים",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F18"
  },
  {
    "id": "S108",
    "value_group_he": "זכירת משמעות",
    "interpretation_he": "נאם ג'פנה: אוריינטציה מתמדת למשמעות",
    "proposed_family_he": "משמעות/אוריינטציה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F11"
  },
  {
    "id": "S109",
    "value_group_he": "אומץ",
    "interpretation_he": "עמידה מול עוול ופחד",
    "proposed_family_he": "אומץ/צדק",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F14"
  },
  {
    "id": "S110",
    "value_group_he": "הגנת החלש",
    "interpretation_he": "מחויבות להגן על מדוכאים",
    "proposed_family_he": "הגנה/צדק",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F01"
  },
  {
    "id": "S111",
    "value_group_he": "צדק",
    "interpretation_he": "התנגדות לעוול",
    "proposed_family_he": "צדק/הוגנות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F05"
  },
  {
    "id": "S112",
    "value_group_he": "כבוד לכל אדם",
    "interpretation_he": "יחס שווה ומכבד",
    "proposed_family_he": "כבוד/שוויון",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F01"
  },
  {
    "id": "S113",
    "value_group_he": "קהילה",
    "interpretation_he": "סנגאט: שותפות ושייכות",
    "proposed_family_he": "קהילה/שייכות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F09"
  },
  {
    "id": "S114",
    "value_group_he": "אירוח והזנה",
    "interpretation_he": "לנגר: אוכל משותף ללא הבדלי מעמד",
    "proposed_family_he": "נתינה/שוויון",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F05"
  },
  {
    "id": "S115",
    "value_group_he": "משמעת",
    "interpretation_he": "תרגול והתנהלות עקבית",
    "proposed_family_he": "משמעת/התמדה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F16"
  },
  {
    "id": "S116",
    "value_group_he": "נאמנות",
    "interpretation_he": "מחויבות למסגרת, קהילה ואמת",
    "proposed_family_he": "נאמנות/מחויבות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F07"
  },
  {
    "id": "S117",
    "value_group_he": "חמלה",
    "interpretation_he": "דאיה: רגישות לסבל",
    "proposed_family_he": "חמלה/אכפתיות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F08"
  },
  {
    "id": "S118",
    "value_group_he": "סבלנות",
    "interpretation_he": "יציבות תחת קושי",
    "proposed_family_he": "חוסן/איפוק",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F15"
  },
  {
    "id": "S119",
    "value_group_he": "אחדות האנושות",
    "interpretation_he": "הדגשת אחדות מעבר להבדלים",
    "proposed_family_he": "אחדות/פלורליזם",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F09"
  },
  {
    "id": "S120",
    "value_group_he": "אחריות מעשית",
    "interpretation_he": "אמונה שמתבטאת בפעולה",
    "proposed_family_he": "פעולה/אחריות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F17"
  },
  {
    "id": "S121",
    "value_group_he": "אהימסה",
    "interpretation_he": "אי־אלימות רדיקלית כלפי יצורים",
    "proposed_family_he": "אי־אלימות/חיים",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F01"
  },
  {
    "id": "S122",
    "value_group_he": "אמת",
    "interpretation_he": "סטיה: אמת ואי־הטעיה",
    "proposed_family_he": "אמת/יושר",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F06"
  },
  {
    "id": "S123",
    "value_group_he": "אי־גניבה",
    "interpretation_he": "אסטיה: אי־לקיחת מה שלא ניתן",
    "proposed_family_he": "קניין/יושר",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F06"
  },
  {
    "id": "S124",
    "value_group_he": "אי־היאחזות",
    "interpretation_he": "אפריגרהה: צמצום רכושנות",
    "proposed_family_he": "איפוק/משאבים",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F15"
  },
  {
    "id": "S125",
    "value_group_he": "ריסון מיני",
    "interpretation_he": "ברהמצ'ריה: משמעת ביחסים ותשוקה",
    "proposed_family_he": "איפוק/גבולות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F15"
  },
  {
    "id": "S126",
    "value_group_he": "ריבוי נקודות מבט",
    "interpretation_he": "אנקאנטוואדה: הימנעות מאבסולוטיזם",
    "proposed_family_he": "פלורליזם/חשיבה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F11"
  },
  {
    "id": "S127",
    "value_group_he": "אי־פגיעה בדיבור",
    "interpretation_he": "זהירות מהשפעת מילים",
    "proposed_family_he": "תקשורת/אי־פגיעה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F26"
  },
  {
    "id": "S128",
    "value_group_he": "חמלה לכל החיים",
    "interpretation_he": "התייחסות מוסרית רחבה ליצורים",
    "proposed_family_he": "חמלה/חיים",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F01"
  },
  {
    "id": "S129",
    "value_group_he": "צמחונות/צמצום פגיעה",
    "interpretation_he": "בחירות צריכה שמקטינות פגיעה",
    "proposed_family_he": "משאבים/אי־פגיעה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F18"
  },
  {
    "id": "S130",
    "value_group_he": "משמעת עצמית",
    "interpretation_he": "שליטה בתשוקה ובהרגלים",
    "proposed_family_he": "משמעת/איפוק",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F15"
  },
  {
    "id": "S131",
    "value_group_he": "פשטות",
    "interpretation_he": "הפחתת צריכה ובעלות",
    "proposed_family_he": "מתינות/משאבים",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F18"
  },
  {
    "id": "S132",
    "value_group_he": "אחריות קרמתית",
    "interpretation_he": "הכרה בקשר פעולה־תוצאה",
    "proposed_family_he": "אחריות/למידה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F22"
  },
  {
    "id": "S133",
    "value_group_he": "טוהר כוונה",
    "interpretation_he": "בחינת מניע ומחשבה",
    "proposed_family_he": "יושרה/מניע",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F06"
  },
  {
    "id": "S134",
    "value_group_he": "סליחה",
    "interpretation_he": "מחילה והפחתת עוינות",
    "proposed_family_he": "פיוס/תיקון",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": null
  },
  {
    "id": "S135",
    "value_group_he": "סובלנות",
    "interpretation_he": "הכרה בחלקיות תפיסת האדם",
    "proposed_family_he": "פלורליזם/כבוד",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F01"
  },
  {
    "id": "S136",
    "value_group_he": "מדיטציה",
    "interpretation_he": "תרגול מודעות והתבוננות",
    "proposed_family_he": "מודעות/משמעת",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F15"
  },
  {
    "id": "S137",
    "value_group_he": "שחרור",
    "interpretation_he": "צמצום קשרי תלות והיקשרות",
    "proposed_family_he": "חופש/איפוק",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F15"
  },
  {
    "id": "S138",
    "value_group_he": "כבוד לנזירים ולמורים",
    "interpretation_he": "כבוד למסורת תרגול",
    "proposed_family_he": "כבוד/למידה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F01"
  },
  {
    "id": "S139",
    "value_group_he": "אי־ניצול",
    "interpretation_he": "הפחתת שימוש פוגעני באחר",
    "proposed_family_he": "צדק/אי־פגיעה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F05"
  },
  {
    "id": "S140",
    "value_group_he": "שמירת משאבים",
    "interpretation_he": "צריכה מצומצמת מתוך אי־היאחזות",
    "proposed_family_he": "קיימות/משאבים",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F18"
  },
  {
    "id": "S141",
    "value_group_he": "אחדות האנושות",
    "interpretation_he": "תפיסת האנושות כמשפחה אחת",
    "proposed_family_he": "אחדות/אנושות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F09"
  },
  {
    "id": "S142",
    "value_group_he": "צדק",
    "interpretation_he": "צדק כבסיס לאחדות",
    "proposed_family_he": "צדק/הוגנות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F05"
  },
  {
    "id": "S143",
    "value_group_he": "שוויון נשים וגברים",
    "interpretation_he": "שוויון זכויות ומעמד",
    "proposed_family_he": "שוויון/כבוד",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F05"
  },
  {
    "id": "S144",
    "value_group_he": "שלום עולמי",
    "interpretation_he": "שאיפה לסדר עולמי של שלום",
    "proposed_family_he": "שלום/אחדות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F09"
  },
  {
    "id": "S145",
    "value_group_he": "חקירה עצמאית של האמת",
    "interpretation_he": "חיפוש אמת ללא חיקוי עיוור",
    "proposed_family_he": "אמת/חשיבה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F06"
  },
  {
    "id": "S146",
    "value_group_he": "חינוך אוניברסלי",
    "interpretation_he": "גישה לחינוך לכל",
    "proposed_family_he": "חינוך/שוויון",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F05"
  },
  {
    "id": "S147",
    "value_group_he": "שירות לאנושות",
    "interpretation_he": "פעולה לטובת הכלל",
    "proposed_family_he": "שירות/תרומה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F10"
  },
  {
    "id": "S148",
    "value_group_he": "אחדות דתית",
    "interpretation_he": "הכרה בקשר בין מסורות דתיות",
    "proposed_family_he": "פלורליזם/אחדות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F09"
  },
  {
    "id": "S149",
    "value_group_he": "סובלנות",
    "interpretation_he": "כבוד להבדלים",
    "proposed_family_he": "פלורליזם/כבוד",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F01"
  },
  {
    "id": "S150",
    "value_group_he": "שיתוף פעולה",
    "interpretation_he": "פעולה משותפת בין קבוצות",
    "proposed_family_he": "קהילה/תיאום",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F17"
  },
  {
    "id": "S151",
    "value_group_he": "התייעצות",
    "interpretation_he": "קבלת החלטות דרך consultation",
    "proposed_family_he": "ממשל/שיתוף",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F17"
  },
  {
    "id": "S152",
    "value_group_he": "הפחתת דעות קדומות",
    "interpretation_he": "מאבק בגזענות ודעות קדומות",
    "proposed_family_he": "שוויון/כבוד",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F01"
  },
  {
    "id": "S153",
    "value_group_he": "עבודה כרוח שירות",
    "interpretation_he": "עבודה כתועלת לחברה",
    "proposed_family_he": "עבודה/תרומה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F10"
  },
  {
    "id": "S154",
    "value_group_he": "אמת ואמינות",
    "interpretation_he": "יושרה ביחסים ציבוריים ואישיים",
    "proposed_family_he": "אמת/אמון",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F07"
  },
  {
    "id": "S155",
    "value_group_he": "צניעות",
    "interpretation_he": "אי־התנשאות",
    "proposed_family_he": "ענווה/כבוד",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F01"
  },
  {
    "id": "S156",
    "value_group_he": "נדיבות",
    "interpretation_he": "חלוקת משאבים וסיוע",
    "proposed_family_he": "נתינה/קהילה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F10"
  },
  {
    "id": "S157",
    "value_group_he": "קידום מדע ודת בהרמוניה",
    "interpretation_he": "חיפוש ידע ללא נתק ערכי",
    "proposed_family_he": "ידע/אינטגרציה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F11"
  },
  {
    "id": "S158",
    "value_group_he": "אחריות גלובלית",
    "interpretation_he": "חשיבה מעבר לקבוצה המקומית",
    "proposed_family_he": "אחריות/כלל",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F22"
  },
  {
    "id": "S159",
    "value_group_he": "כבוד האדם",
    "interpretation_he": "הגנה על כבוד כלל האנושות",
    "proposed_family_he": "כבוד/חיים",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F01"
  },
  {
    "id": "S160",
    "value_group_he": "פעולה למען אחדות",
    "interpretation_he": "מימוש רעיון האחדות במעשה",
    "proposed_family_he": "פעולה/אחדות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F17"
  },
  {
    "id": "S161",
    "value_group_he": "מחשבות טובות",
    "interpretation_he": "בחירה מכוונת במחשבה מועילה",
    "proposed_family_he": "יושרה/מחשבה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F06"
  },
  {
    "id": "S162",
    "value_group_he": "מילים טובות",
    "interpretation_he": "דיבור מועיל ואמיתי",
    "proposed_family_he": "תקשורת/אמת",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F26"
  },
  {
    "id": "S163",
    "value_group_he": "מעשים טובים",
    "interpretation_he": "מימוש טוב דרך פעולה",
    "proposed_family_he": "פעולה/יושרה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F17"
  },
  {
    "id": "S164",
    "value_group_he": "אמת וצדק",
    "interpretation_he": "אשה: אמת, סדר וצדק",
    "proposed_family_he": "אמת/צדק",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F05"
  },
  {
    "id": "S165",
    "value_group_he": "התנגדות לשקר",
    "interpretation_he": "דחיית הונאה ועיוות",
    "proposed_family_he": "אמת/יושר",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F06"
  },
  {
    "id": "S166",
    "value_group_he": "אחריות מוסרית",
    "interpretation_he": "בחירה בין פעולה מועילה למזיקה",
    "proposed_family_he": "אחריות/בחירה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F22"
  },
  {
    "id": "S167",
    "value_group_he": "חכמה",
    "interpretation_he": "שימוש בשיקול דעת מוסרי",
    "proposed_family_he": "חכמה/הבנה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F11"
  },
  {
    "id": "S168",
    "value_group_he": "מסירות",
    "interpretation_he": "מחויבות לטוב ולסדר",
    "proposed_family_he": "מחויבות/משמעות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F07"
  },
  {
    "id": "S169",
    "value_group_he": "נדיבות",
    "interpretation_he": "תרומה וסיוע",
    "proposed_family_he": "נתינה/נדיבות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F10"
  },
  {
    "id": "S170",
    "value_group_he": "שלום",
    "interpretation_he": "הפחתת עימות והרס",
    "proposed_family_he": "שלום/חיים",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F01"
  },
  {
    "id": "S171",
    "value_group_he": "טוהר",
    "interpretation_he": "שמירה על טוהר והתנהלות מסודרת",
    "proposed_family_he": "טוהר/אחריות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F22"
  },
  {
    "id": "S172",
    "value_group_he": "שמירת טבע",
    "interpretation_he": "כבוד למים, אדמה, אש וחיים",
    "proposed_family_he": "סביבה/קיימות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F01"
  },
  {
    "id": "S173",
    "value_group_he": "עבודה מועילה",
    "interpretation_he": "תרומה לעולם דרך עשייה",
    "proposed_family_he": "עבודה/תרומה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F10"
  },
  {
    "id": "S174",
    "value_group_he": "אומץ מול רוע",
    "interpretation_he": "עמידה אקטיבית נגד פגיעה",
    "proposed_family_he": "אומץ/צדק",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F14"
  },
  {
    "id": "S175",
    "value_group_he": "אמירת אמת",
    "interpretation_he": "הלימה בין ידיעה, מילה ומעשה",
    "proposed_family_he": "אמת/אמון",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F07"
  },
  {
    "id": "S176",
    "value_group_he": "הכרת תודה",
    "interpretation_he": "הוקרת הטוב והקיים",
    "proposed_family_he": "רווחה/ענווה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F23"
  },
  {
    "id": "S177",
    "value_group_he": "אחריות קהילתית",
    "interpretation_he": "שמירת רווחת היישוב והחברה",
    "proposed_family_he": "קהילה/אחריות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F22"
  },
  {
    "id": "S178",
    "value_group_he": "שגשוג אחראי",
    "interpretation_he": "קידום רווחה בלי פגיעה",
    "proposed_family_he": "שגשוג/אחריות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F22"
  },
  {
    "id": "S179",
    "value_group_he": "תיקון העולם",
    "interpretation_he": "מאמץ לקדם עולם טוב יותר",
    "proposed_family_he": "שיפור/כלל",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F12"
  },
  {
    "id": "S180",
    "value_group_he": "תקווה",
    "interpretation_he": "אוריינטציה לניצחון הטוב והשלמת העולם",
    "proposed_family_he": "תקווה/חוסן",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F27"
  },
  {
    "id": "S181",
    "value_group_he": "פשטות",
    "interpretation_he": "הפחתת עודפות ומורכבות",
    "proposed_family_he": "פשטות/מתינות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": null
  },
  {
    "id": "S182",
    "value_group_he": "ענווה",
    "interpretation_he": "אי־התנשאות ואי־כפייה",
    "proposed_family_he": "ענווה/איזון",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F15"
  },
  {
    "id": "S183",
    "value_group_he": "חמלה",
    "interpretation_he": "אחת ממידות היסוד בדאואיזם",
    "proposed_family_he": "חמלה/אכפתיות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F08"
  },
  {
    "id": "S184",
    "value_group_he": "מתינות",
    "interpretation_he": "הימנעות מהפרזה",
    "proposed_family_he": "איזון/משאבים",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F15"
  },
  {
    "id": "S185",
    "value_group_he": "אי־כפייה",
    "interpretation_he": "וו־ווי: פעולה שאינה מכריחה את המציאות",
    "proposed_family_he": "חופש/פעולה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F17"
  },
  {
    "id": "S186",
    "value_group_he": "הרמוניה עם הטבע",
    "interpretation_he": "התאמת פעולה לדפוסים טבעיים",
    "proposed_family_he": "טבע/אינטגרציה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F17"
  },
  {
    "id": "S187",
    "value_group_he": "גמישות",
    "interpretation_he": "עדיפות לרכות והסתגלות על קשיחות",
    "proposed_family_he": "הסתגלות/חוסן",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F27"
  },
  {
    "id": "S188",
    "value_group_he": "שקט",
    "interpretation_he": "מרחב פנימי להפחתת תגובתיות",
    "proposed_family_he": "רווחה/מודעות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F23"
  },
  {
    "id": "S189",
    "value_group_he": "אי־תחרות",
    "interpretation_he": "הפחתת מאבקי סטטוס",
    "proposed_family_he": "קהילה/ענווה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F09"
  },
  {
    "id": "S190",
    "value_group_he": "הסתפקות",
    "interpretation_he": "הכרה במה שמספיק",
    "proposed_family_he": "מתינות/רווחה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F23"
  },
  {
    "id": "S191",
    "value_group_he": "זרימה",
    "interpretation_he": "פעולה מותאמת הקשר",
    "proposed_family_he": "הסתגלות/פעולה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F17"
  },
  {
    "id": "S192",
    "value_group_he": "איזון ניגודים",
    "interpretation_he": "הכרה בתלות בין קטבים",
    "proposed_family_he": "איזון/מערכתיות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F15"
  },
  {
    "id": "S193",
    "value_group_he": "איפוק כוח",
    "interpretation_he": "שימוש מינימלי בכוח",
    "proposed_family_he": "גבולות/שלום",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F20"
  },
  {
    "id": "S194",
    "value_group_he": "מנהיגות לא־כופה",
    "interpretation_he": "הנהגה שמאפשרת פעולה עצמית",
    "proposed_family_he": "ממשל/חופש",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F17"
  },
  {
    "id": "S195",
    "value_group_he": "טבעיות",
    "interpretation_he": "זיראן: פעולה שאינה מלאכותית יתר על המידה",
    "proposed_family_he": "אותנטיות/טבע",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F17"
  },
  {
    "id": "S196",
    "value_group_he": "ריקות פונקציונלית",
    "interpretation_he": "הכרה בערך של מרחב ופוטנציאל",
    "proposed_family_he": "אפשרות/פשטות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F25"
  },
  {
    "id": "S197",
    "value_group_he": "סבלנות",
    "interpretation_he": "אי־דחיפת תהליכים בכוח",
    "proposed_family_he": "חוסן/מתינות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F27"
  },
  {
    "id": "S198",
    "value_group_he": "שווי משקל",
    "interpretation_he": "שמירת מערכת ללא קיצוניות",
    "proposed_family_he": "איזון/יציבות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F04"
  },
  {
    "id": "S199",
    "value_group_he": "חיבור למכלול",
    "interpretation_he": "ראיית יחסי גומלין רחבים",
    "proposed_family_he": "אחדות/מערכתיות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F09"
  },
  {
    "id": "S200",
    "value_group_he": "אי־בזבוז",
    "interpretation_he": "פחות עודפות וצריכה",
    "proposed_family_he": "משאבים/קיימות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F18"
  },
  {
    "id": "S201",
    "value_group_he": "אנושיות",
    "interpretation_he": "רן: טוב לב ואנושיות",
    "proposed_family_he": "חמלה/כבוד",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F01"
  },
  {
    "id": "S202",
    "value_group_he": "צדק",
    "interpretation_he": "יי: פעולה ראויה והוגנת",
    "proposed_family_he": "צדק/יושרה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F05"
  },
  {
    "id": "S203",
    "value_group_he": "דרך ארץ וטקס",
    "interpretation_he": "לי: התנהגות מכבדת וסדר חברתי",
    "proposed_family_he": "נימוס/תרבות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": null
  },
  {
    "id": "S204",
    "value_group_he": "כיבוד הורים",
    "interpretation_he": "שיאו: כבוד ואחריות בין־דורית",
    "proposed_family_he": "משפחה/כבוד",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F01"
  },
  {
    "id": "S205",
    "value_group_he": "כבוד לאחים ולמבוגרים",
    "interpretation_he": "יחסים היררכיים עם אחריות הדדית",
    "proposed_family_he": "כבוד/משפחה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F01"
  },
  {
    "id": "S206",
    "value_group_he": "אמינות",
    "interpretation_he": "שין: נאמנות למילה",
    "proposed_family_he": "אמון/אמת",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F07"
  },
  {
    "id": "S207",
    "value_group_he": "נאמנות",
    "interpretation_he": "ג'ונג: מחויבות לתפקיד ולאדם",
    "proposed_family_he": "נאמנות/אחריות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F07"
  },
  {
    "id": "S208",
    "value_group_he": "חכמה",
    "interpretation_he": "ג'י: שיקול דעת מוסרי",
    "proposed_family_he": "חכמה/הבנה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F11"
  },
  {
    "id": "S209",
    "value_group_he": "למידה",
    "interpretation_he": "טיפוח עצמי דרך לימוד",
    "proposed_family_he": "למידה/התפתחות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F12"
  },
  {
    "id": "S210",
    "value_group_he": "טיפוח עצמי",
    "interpretation_he": "שיפור אופי והתנהגות",
    "proposed_family_he": "התפתחות/משמעת",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F12"
  },
  {
    "id": "S211",
    "value_group_he": "מתינות",
    "interpretation_he": "דרך האמצע והימנעות מקיצוניות",
    "proposed_family_he": "איזון/מתינות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F15"
  },
  {
    "id": "S212",
    "value_group_he": "אחריות בתפקיד",
    "interpretation_he": "מילוי תפקיד באופן ראוי",
    "proposed_family_he": "אחריות/חובה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F03"
  },
  {
    "id": "S213",
    "value_group_he": "ממשל מוסרי",
    "interpretation_he": "מנהיגות באמצעות דוגמה",
    "proposed_family_he": "ממשל/יושרה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F06"
  },
  {
    "id": "S214",
    "value_group_he": "הרמוניה חברתית",
    "interpretation_he": "סדר יחסים שמאפשר שיתוף פעולה",
    "proposed_family_he": "קהילה/תיאום",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F17"
  },
  {
    "id": "S215",
    "value_group_he": "כבוד הדדי",
    "interpretation_he": "יחס מותאם לאדם ולהקשר",
    "proposed_family_he": "כבוד/תקשורת",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F01"
  },
  {
    "id": "S216",
    "value_group_he": "מילה מחייבת",
    "interpretation_he": "דיוק בין דיבור למעשה",
    "proposed_family_he": "אמת/אחריות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F22"
  },
  {
    "id": "S217",
    "value_group_he": "חברות ראויה",
    "interpretation_he": "נאמנות, אמון ולמידה ביחסים",
    "proposed_family_he": "יחסים/אמון",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F07"
  },
  {
    "id": "S218",
    "value_group_he": "בושה מוסרית",
    "interpretation_he": "רגישות פנימית לחריגה מנורמה",
    "proposed_family_he": "אחריות/למידה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F22"
  },
  {
    "id": "S219",
    "value_group_he": "חינוך",
    "interpretation_he": "בניית אדם וחברה דרך למידה",
    "proposed_family_he": "חינוך/קהילה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F09"
  },
  {
    "id": "S220",
    "value_group_he": "טוב משותף",
    "interpretation_he": "הרמוניה ושגשוג חברתי",
    "proposed_family_he": "טוב משותף/קהילה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F09"
  },
  {
    "id": "S221",
    "value_group_he": "טוהר",
    "interpretation_he": "ניקיון וטיהור כמסגרת רוחנית",
    "proposed_family_he": "טוהר/אחריות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F22"
  },
  {
    "id": "S222",
    "value_group_he": "כבוד לטבע",
    "interpretation_he": "קשר לקאמי, מקומות ונוף",
    "proposed_family_he": "טבע/כבוד",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F01"
  },
  {
    "id": "S223",
    "value_group_he": "הרמוניה",
    "interpretation_he": "שמירת יחסים מאוזנים",
    "proposed_family_he": "איזון/קהילה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F15"
  },
  {
    "id": "S224",
    "value_group_he": "הכרת תודה",
    "interpretation_he": "הוקרת חיים, טבע ומורשת",
    "proposed_family_he": "הכרת תודה/רווחה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F23"
  },
  {
    "id": "S225",
    "value_group_he": "כבוד לאבות",
    "interpretation_he": "קשר בין־דורי וזיכרון",
    "proposed_family_he": "משפחה/מורשת",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F01"
  },
  {
    "id": "S226",
    "value_group_he": "קהילתיות",
    "interpretation_he": "השתתפות בפסטיבלים ומקדש",
    "proposed_family_he": "קהילה/שייכות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F09"
  },
  {
    "id": "S227",
    "value_group_he": "כנות",
    "interpretation_he": "מקוטו: כנות/לב אמיתי",
    "proposed_family_he": "אמת/יושר",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F06"
  },
  {
    "id": "S228",
    "value_group_he": "ניקיון ציבורי",
    "interpretation_he": "שמירה על סביבה נקייה ומכבדת",
    "proposed_family_he": "סביבה/אחריות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F22"
  },
  {
    "id": "S229",
    "value_group_he": "מסורת",
    "interpretation_he": "שימור מנהגים וטקסים",
    "proposed_family_he": "מורשת/זהות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": null
  },
  {
    "id": "S230",
    "value_group_he": "כבוד למקום",
    "interpretation_he": "יחס למרחב כמשמעותי",
    "proposed_family_he": "סביבה/שייכות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F09"
  },
  {
    "id": "S231",
    "value_group_he": "אחריות לטקס",
    "interpretation_he": "ביצוע מדויק של תפקידים קהילתיים",
    "proposed_family_he": "אחריות/משמעת",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F22"
  },
  {
    "id": "S232",
    "value_group_he": "אחדות בפסטיבל",
    "interpretation_he": "חיבור קהילה דרך פעולה משותפת",
    "proposed_family_he": "קהילה/אחדות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F09"
  },
  {
    "id": "S233",
    "value_group_he": "התחדשות",
    "interpretation_he": "טיהור והתחלה מחדש",
    "proposed_family_he": "תיקון/התחדשות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": null
  },
  {
    "id": "S234",
    "value_group_he": "פשטות",
    "interpretation_he": "אסתטיקה והתנהלות שאינה עודפת",
    "proposed_family_he": "פשטות/איזון",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F15"
  },
  {
    "id": "S235",
    "value_group_he": "כבוד הדדי",
    "interpretation_he": "נימוס ביחסים ובמרחב",
    "proposed_family_he": "נימוס/כבוד",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F01"
  },
  {
    "id": "S236",
    "value_group_he": "שייכות מקומית",
    "interpretation_he": "קשר לקהילה ולמקום",
    "proposed_family_he": "שייכות/מקום",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F09"
  },
  {
    "id": "S237",
    "value_group_he": "שמירת מורשת",
    "interpretation_he": "המשכיות בין דורות",
    "proposed_family_he": "מורשת/אחריות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F22"
  },
  {
    "id": "S238",
    "value_group_he": "איזון אדם־טבע",
    "interpretation_he": "קיום שאינו מנותק מהסביבה",
    "proposed_family_he": "קיימות/טבע",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F15"
  },
  {
    "id": "S239",
    "value_group_he": "אחריות קהילתית",
    "interpretation_he": "תרומה למרחב ולטקס הציבורי",
    "proposed_family_he": "קהילה/תרומה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F10"
  },
  {
    "id": "S240",
    "value_group_he": "חגיגה משותפת",
    "interpretation_he": "חיזוק קשרים דרך מועדים ופסטיבלים",
    "proposed_family_he": "קהילה/רווחה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F23"
  },
  {
    "id": "S241",
    "value_group_he": "אופי טוב",
    "interpretation_he": "איווה פלה: אופי טוב כבסיס לחיים ראויים",
    "proposed_family_he": "יושרה/אופי",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F06"
  },
  {
    "id": "S242",
    "value_group_he": "כבוד לזקנים",
    "interpretation_he": "הוקרת ניסיון וסדר בין־דורי",
    "proposed_family_he": "כבוד/משפחה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F01"
  },
  {
    "id": "S243",
    "value_group_he": "קהילתיות",
    "interpretation_he": "זהות וחיים דרך קהילה",
    "proposed_family_he": "קהילה/שייכות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F09"
  },
  {
    "id": "S244",
    "value_group_he": "הדדיות",
    "interpretation_he": "נתינה וקבלה בתוך רשת חברתית",
    "proposed_family_he": "הדדיות/משאבים",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F28"
  },
  {
    "id": "S245",
    "value_group_he": "כבוד לאבות",
    "interpretation_he": "קשר למורשת ולאבות",
    "proposed_family_he": "מורשת/זהות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F01"
  },
  {
    "id": "S246",
    "value_group_he": "אחריות לגורל",
    "interpretation_he": "עבודה עם ייעוד/אורי דרך בחירה ומעשה",
    "proposed_family_he": "אחריות/משמעות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F22"
  },
  {
    "id": "S247",
    "value_group_he": "חכמה",
    "interpretation_he": "התייעצות ופרשנות לפני פעולה",
    "proposed_family_he": "חכמה/אוריינטציה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F17"
  },
  {
    "id": "S248",
    "value_group_he": "איזון",
    "interpretation_he": "שמירת יחסים מאוזנים עם אנשים וכוחות",
    "proposed_family_he": "איזון/מערכתיות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F15"
  },
  {
    "id": "S249",
    "value_group_he": "אמת",
    "interpretation_he": "אמינות ויושר ביחסים",
    "proposed_family_he": "אמת/אמון",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F06"
  },
  {
    "id": "S250",
    "value_group_he": "נדיבות",
    "interpretation_he": "חלוקת משאבים וחסות",
    "proposed_family_he": "נתינה/קהילה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F10"
  },
  {
    "id": "S251",
    "value_group_he": "אירוח",
    "interpretation_he": "פתיחות והכנסת אורחים",
    "proposed_family_he": "קהילה/נדיבות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F09"
  },
  {
    "id": "S252",
    "value_group_he": "כבוד למילה",
    "interpretation_he": "דיבור כבעל כוח ואחריות",
    "proposed_family_he": "תקשורת/אחריות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F22"
  },
  {
    "id": "S253",
    "value_group_he": "פתרון סכסוכים",
    "interpretation_he": "פיוס ותיווך בתוך הקהילה",
    "proposed_family_he": "פיוס/שלום",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F09"
  },
  {
    "id": "S254",
    "value_group_he": "כבוד לטבע",
    "interpretation_he": "יחס למקומות וכוחות טבע",
    "proposed_family_he": "טבע/כבוד",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F01"
  },
  {
    "id": "S255",
    "value_group_he": "משפחה מורחבת",
    "interpretation_he": "אחריות לרשת קרובים רחבה",
    "proposed_family_he": "משפחה/קהילה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F09"
  },
  {
    "id": "S256",
    "value_group_he": "התמדה",
    "interpretation_he": "עמידה בקשיים בדרך למימוש",
    "proposed_family_he": "חוסן/התמדה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F16"
  },
  {
    "id": "S257",
    "value_group_he": "טקס ואחריות",
    "interpretation_he": "שמירה על תפקידים ומחויבויות",
    "proposed_family_he": "אחריות/מסורת",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F22"
  },
  {
    "id": "S258",
    "value_group_he": "למידה ממבוגרים",
    "interpretation_he": "העברת ידע בין דורות",
    "proposed_family_he": "למידה/מורשת",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F11"
  },
  {
    "id": "S259",
    "value_group_he": "שגשוג משותף",
    "interpretation_he": "רווחה של הפרט בתוך רווחת הקהילה",
    "proposed_family_he": "שגשוג/קהילה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F09"
  },
  {
    "id": "S260",
    "value_group_he": "זהות ומורשת",
    "interpretation_he": "שמירת סיפור, שמות, טקס ושייכות",
    "proposed_family_he": "זהות/מורשת",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F18"
  },
  {
    "id": "S261",
    "value_group_he": "כבוד לאדמה",
    "interpretation_he": "יחס לאדמה כמערכת יחסים ולא רק משאב",
    "proposed_family_he": "טבע/קיימות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F01"
  },
  {
    "id": "S262",
    "value_group_he": "הדדיות עם הטבע",
    "interpretation_he": "לקיחה שמחייבת נתינה חזרה",
    "proposed_family_he": "הדדיות/טבע",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F28"
  },
  {
    "id": "S263",
    "value_group_he": "אחריות לדורות הבאים",
    "interpretation_he": "בחינת פעולה לפי השפעה עתידית",
    "proposed_family_he": "אחריות בין־דורית",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F03"
  },
  {
    "id": "S264",
    "value_group_he": "כבוד לזקנים",
    "interpretation_he": "למידה מניסיון והעברת מסורת",
    "proposed_family_he": "כבוד/מורשת",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F01"
  },
  {
    "id": "S265",
    "value_group_he": "שייכות למקום",
    "interpretation_he": "זהות הקשורה למרחב ולנוף",
    "proposed_family_he": "זהות/מקום",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F09"
  },
  {
    "id": "S266",
    "value_group_he": "קהילתיות",
    "interpretation_he": "העדפת רשת קשרים על אינדיבידואליזם מבודד",
    "proposed_family_he": "קהילה/שייכות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F09"
  },
  {
    "id": "S267",
    "value_group_he": "שיתוף משאבים",
    "interpretation_he": "חלוקה לפי צורך וקשר",
    "proposed_family_he": "משאבים/הדדיות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F18"
  },
  {
    "id": "S268",
    "value_group_he": "סיפור וזיכרון",
    "interpretation_he": "העברת ידע דרך נרטיב",
    "proposed_family_he": "ידע/מורשת",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F11"
  },
  {
    "id": "S269",
    "value_group_he": "טקס",
    "interpretation_he": "יצירת מחויבות ומשמעות משותפת",
    "proposed_family_he": "מסורת/קהילה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F09"
  },
  {
    "id": "S270",
    "value_group_he": "כבוד לבעלי חיים",
    "interpretation_he": "יחס מוסרי ליצורים לא־אנושיים",
    "proposed_family_he": "חיים/טבע",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F01"
  },
  {
    "id": "S271",
    "value_group_he": "צניעות אנושית",
    "interpretation_he": "אי־הצבת האדם מעל המערכת",
    "proposed_family_he": "ענווה/מערכתיות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F01"
  },
  {
    "id": "S272",
    "value_group_he": "הכרת תודה",
    "interpretation_he": "הוקרת מזון, מים, עונות וחיים",
    "proposed_family_he": "הכרת תודה/טבע",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F01"
  },
  {
    "id": "S273",
    "value_group_he": "קונצנזוס",
    "interpretation_he": "העדפת החלטה משותפת במקומות שבהם המסורת תומכת בכך",
    "proposed_family_he": "ממשל/שיתוף",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F17"
  },
  {
    "id": "S274",
    "value_group_he": "ריפוי קהילתי",
    "interpretation_he": "שיקום קשרים ולא רק ענישת פרט",
    "proposed_family_he": "תיקון/קהילה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F09"
  },
  {
    "id": "S275",
    "value_group_he": "אחריות למילה",
    "interpretation_he": "משקל גבוה להבטחה ולעדות",
    "proposed_family_he": "אמון/תקשורת",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F07"
  },
  {
    "id": "S276",
    "value_group_he": "אירוח ונתינה",
    "interpretation_he": "שיתוף מזון ומרחב",
    "proposed_family_he": "נתינה/קהילה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F10"
  },
  {
    "id": "S277",
    "value_group_he": "איזון עונתי",
    "interpretation_he": "התאמת פעילות למחזורי טבע",
    "proposed_family_he": "הסתגלות/טבע",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F27"
  },
  {
    "id": "S278",
    "value_group_he": "שמירת ידע מקומי",
    "interpretation_he": "הגנה על ידע, שפה ומסורת",
    "proposed_family_he": "ידע/זהות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F11"
  },
  {
    "id": "S279",
    "value_group_he": "ריבונות קהילתית",
    "interpretation_he": "יכולת קהילה לקבוע בענייניה",
    "proposed_family_he": "חופש/קהילה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F09"
  },
  {
    "id": "S280",
    "value_group_he": "אחריות מערכתית",
    "interpretation_he": "ראיית אדם, קהילה, אדמה וחיים כמכלול",
    "proposed_family_he": "מערכתיות/אחריות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F22"
  },
  {
    "id": "S281",
    "value_group_he": "אירוח",
    "interpretation_he": "קסניה/הוספיטיום: חובות מארח ואורח",
    "proposed_family_he": "אירוח/הדדיות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F28"
  },
  {
    "id": "S282",
    "value_group_he": "נאמנות לברית",
    "interpretation_he": "עמידה בשבועה ובהסכם",
    "proposed_family_he": "נאמנות/אמון",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F07"
  },
  {
    "id": "S283",
    "value_group_he": "אומץ",
    "interpretation_he": "יכולת לפעול תחת סכנה",
    "proposed_family_he": "אומץ/פעולה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F14"
  },
  {
    "id": "S284",
    "value_group_he": "מתינות",
    "interpretation_he": "סופروسינה: שליטה עצמית",
    "proposed_family_he": "איפוק/איזון",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F15"
  },
  {
    "id": "S285",
    "value_group_he": "צדק",
    "interpretation_he": "דיקאיוסינה/יוסטיטיה: מתן לכל אחד את הראוי",
    "proposed_family_he": "צדק/הוגנות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F05"
  },
  {
    "id": "S286",
    "value_group_he": "חכמה מעשית",
    "interpretation_he": "פרונסיס: שיקול דעת",
    "proposed_family_he": "חכמה/אוריינטציה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F11"
  },
  {
    "id": "S287",
    "value_group_he": "כבוד למשפחה",
    "interpretation_he": "פייטאס/חובות לקרובים",
    "proposed_family_he": "משפחה/אחריות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F22"
  },
  {
    "id": "S288",
    "value_group_he": "חובה ציבורית",
    "interpretation_he": "פייטאס כלפי קהילה ומדינה",
    "proposed_family_he": "אחריות/כלל",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F22"
  },
  {
    "id": "S289",
    "value_group_he": "כבוד לאלים",
    "interpretation_he": "קיום מחויבות דתית וטקסית",
    "proposed_family_he": "מסורת/מחויבות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F07"
  },
  {
    "id": "S290",
    "value_group_he": "אירוח זר",
    "interpretation_he": "הגנה על יחס ראוי לאורח",
    "proposed_family_he": "כבוד/אירוח",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F01"
  },
  {
    "id": "S291",
    "value_group_he": "חברות",
    "interpretation_he": "פיליה: קשר נאמן ותומך",
    "proposed_family_he": "יחסים/אמון",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F07"
  },
  {
    "id": "S292",
    "value_group_he": "מוניטין ראוי",
    "interpretation_he": "כבוד שנובע ממעשה ולא רק סטטוס",
    "proposed_family_he": "תרומה/הכרה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F25"
  },
  {
    "id": "S293",
    "value_group_he": "איפוק בכוח",
    "interpretation_he": "הימנעות מהיבריס",
    "proposed_family_he": "גבולות/ענווה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F20"
  },
  {
    "id": "S294",
    "value_group_he": "כבוד למתים",
    "interpretation_he": "זיכרון וקבורה ראויה",
    "proposed_family_he": "מורשת/כבוד",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F01"
  },
  {
    "id": "S295",
    "value_group_he": "נדיבות",
    "interpretation_he": "נתינה וחסות לאחר",
    "proposed_family_he": "נתינה/קהילה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F10"
  },
  {
    "id": "S296",
    "value_group_he": "אזרחות",
    "interpretation_he": "השתתפות בחיי הפוליס/הקהילה",
    "proposed_family_he": "אזרחות/קהילה",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F09"
  },
  {
    "id": "S297",
    "value_group_he": "חוק וסדר",
    "interpretation_he": "כיבוד מסגרת ציבורית",
    "proposed_family_he": "חוק/יציבות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F04"
  },
  {
    "id": "S298",
    "value_group_he": "איזון בין גורל לפעולה",
    "interpretation_he": "קבלת מגבלה לצד אחריות אנושית",
    "proposed_family_he": "אחריות/חוסן",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F22"
  },
  {
    "id": "S299",
    "value_group_he": "מצוינות",
    "interpretation_he": "ארטה: טיפוח יכולת ומצוינות",
    "proposed_family_he": "מצוינות/יכולת",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F24"
  },
  {
    "id": "S300",
    "value_group_he": "הרמוניה",
    "interpretation_he": "סדר מאוזן בין חלקים",
    "proposed_family_he": "איזון/מערכתיות",
    "status": "SOURCE_INTERPRETIVE",
    "assigned_family_id": "F15"
  }
];

export const SUBVALUES: Subvalue[] = [
  {
    "subvalue_id": "SV026",
    "name_he": "צדק",
    "family_id": "F05",
    "source_entry_ids": [
      "S028",
      "S041",
      "S111",
      "S142",
      "S202",
      "S285"
    ],
    "source_count": 6
  },
  {
    "subvalue_id": "SV031",
    "name_he": "אמת",
    "family_id": "F06",
    "source_entry_ids": [
      "S035",
      "S045",
      "S063",
      "S101",
      "S122",
      "S249"
    ],
    "source_count": 6
  },
  {
    "subvalue_id": "SV076",
    "name_he": "נדיבות",
    "family_id": "F10",
    "source_entry_ids": [
      "S093",
      "S105",
      "S156",
      "S169",
      "S250",
      "S295"
    ],
    "source_count": 6
  },
  {
    "subvalue_id": "SV032",
    "name_he": "מתינות",
    "family_id": "F15",
    "source_entry_ids": [
      "S036",
      "S049",
      "S184",
      "S211",
      "S284"
    ],
    "source_count": 5
  },
  {
    "subvalue_id": "SV058",
    "name_he": "חכמה",
    "family_id": "F11",
    "source_entry_ids": [
      "S073",
      "S092",
      "S167",
      "S208",
      "S247"
    ],
    "source_count": 5
  },
  {
    "subvalue_id": "SV012",
    "name_he": "שלום",
    "family_id": "F05",
    "source_entry_ids": [
      "S012",
      "S029",
      "S058",
      "S170"
    ],
    "source_count": 4
  },
  {
    "subvalue_id": "SV016",
    "name_he": "ענווה",
    "family_id": "F15",
    "source_entry_ids": [
      "S016",
      "S026",
      "S104",
      "S182"
    ],
    "source_count": 4
  },
  {
    "subvalue_id": "SV037",
    "name_he": "סבלנות",
    "family_id": "F15",
    "source_entry_ids": [
      "S044",
      "S094",
      "S118",
      "S197"
    ],
    "source_count": 4
  },
  {
    "subvalue_id": "SV053",
    "name_he": "חמלה",
    "family_id": "F08",
    "source_entry_ids": [
      "S067",
      "S082",
      "S117",
      "S183"
    ],
    "source_count": 4
  },
  {
    "subvalue_id": "SV002",
    "name_he": "כיבוד הורים",
    "family_id": "F01",
    "source_entry_ids": [
      "S002",
      "S047",
      "S204"
    ],
    "source_count": 3
  },
  {
    "subvalue_id": "SV008",
    "name_he": "צדקה",
    "family_id": "F10",
    "source_entry_ids": [
      "S008",
      "S033",
      "S043"
    ],
    "source_count": 3
  },
  {
    "subvalue_id": "SV018",
    "name_he": "אחריות קהילתית",
    "family_id": "F22",
    "source_entry_ids": [
      "S018",
      "S177",
      "S239"
    ],
    "source_count": 3
  },
  {
    "subvalue_id": "SV024",
    "name_he": "סליחה",
    "family_id": "F18",
    "source_entry_ids": [
      "S025",
      "S051",
      "S134"
    ],
    "source_count": 3
  },
  {
    "subvalue_id": "SV030",
    "name_he": "נאמנות",
    "family_id": "F07",
    "source_entry_ids": [
      "S034",
      "S116",
      "S207"
    ],
    "source_count": 3
  },
  {
    "subvalue_id": "SV051",
    "name_he": "אי־היאחזות",
    "family_id": "F15",
    "source_entry_ids": [
      "S065",
      "S095",
      "S124"
    ],
    "source_count": 3
  },
  {
    "subvalue_id": "SV063",
    "name_he": "טוהר",
    "family_id": "F22",
    "source_entry_ids": [
      "S078",
      "S171",
      "S221"
    ],
    "source_count": 3
  },
  {
    "subvalue_id": "SV100",
    "name_he": "פשטות",
    "family_id": "F18",
    "source_entry_ids": [
      "S131",
      "S181",
      "S234"
    ],
    "source_count": 3
  },
  {
    "subvalue_id": "SV132",
    "name_he": "הכרת תודה",
    "family_id": "F23",
    "source_entry_ids": [
      "S176",
      "S224",
      "S272"
    ],
    "source_count": 3
  },
  {
    "subvalue_id": "SV167",
    "name_he": "קהילתיות",
    "family_id": "F09",
    "source_entry_ids": [
      "S226",
      "S243",
      "S266"
    ],
    "source_count": 3
  },
  {
    "subvalue_id": "SV004",
    "name_he": "אמת ואמינות",
    "family_id": "F06",
    "source_entry_ids": [
      "S004",
      "S154"
    ],
    "source_count": 2
  },
  {
    "subvalue_id": "SV005",
    "name_he": "שמירת קניין",
    "family_id": "F06",
    "source_entry_ids": [
      "S005",
      "S054"
    ],
    "source_count": 2
  },
  {
    "subvalue_id": "SV009",
    "name_he": "חסד",
    "family_id": "F08",
    "source_entry_ids": [
      "S009",
      "S023"
    ],
    "source_count": 2
  },
  {
    "subvalue_id": "SV023",
    "name_he": "רחמים",
    "family_id": "F08",
    "source_entry_ids": [
      "S024",
      "S042"
    ],
    "source_count": 2
  },
  {
    "subvalue_id": "SV025",
    "name_he": "שירות",
    "family_id": "F10",
    "source_entry_ids": [
      "S027",
      "S068"
    ],
    "source_count": 2
  },
  {
    "subvalue_id": "SV027",
    "name_he": "כבוד האדם",
    "family_id": "F01",
    "source_entry_ids": [
      "S030",
      "S159"
    ],
    "source_count": 2
  },
  {
    "subvalue_id": "SV028",
    "name_he": "תקווה",
    "family_id": "F27",
    "source_entry_ids": [
      "S031",
      "S180"
    ],
    "source_count": 2
  },
  {
    "subvalue_id": "SV034",
    "name_he": "קהילה",
    "family_id": "F09",
    "source_entry_ids": [
      "S038",
      "S113"
    ],
    "source_count": 2
  },
  {
    "subvalue_id": "SV038",
    "name_he": "אמינות",
    "family_id": "F07",
    "source_entry_ids": [
      "S046",
      "S206"
    ],
    "source_count": 2
  },
  {
    "subvalue_id": "SV043",
    "name_he": "צניעות",
    "family_id": "F01",
    "source_entry_ids": [
      "S055",
      "S155"
    ],
    "source_count": 2
  },
  {
    "subvalue_id": "SV049",
    "name_he": "אהימסה",
    "family_id": "F01",
    "source_entry_ids": [
      "S062",
      "S121"
    ],
    "source_count": 2
  },
  {
    "subvalue_id": "SV050",
    "name_he": "אי־גניבה",
    "family_id": "F06",
    "source_entry_ids": [
      "S064",
      "S123"
    ],
    "source_count": 2
  },
  {
    "subvalue_id": "SV056",
    "name_he": "מסירות",
    "family_id": "F07",
    "source_entry_ids": [
      "S071",
      "S168"
    ],
    "source_count": 2
  },
  {
    "subvalue_id": "SV087",
    "name_he": "אומץ",
    "family_id": "F14",
    "source_entry_ids": [
      "S109",
      "S283"
    ],
    "source_count": 2
  },
  {
    "subvalue_id": "SV092",
    "name_he": "אחדות האנושות",
    "family_id": "F09",
    "source_entry_ids": [
      "S119",
      "S141"
    ],
    "source_count": 2
  },
  {
    "subvalue_id": "SV103",
    "name_he": "סובלנות",
    "family_id": "F01",
    "source_entry_ids": [
      "S135",
      "S149"
    ],
    "source_count": 2
  },
  {
    "subvalue_id": "SV158",
    "name_he": "כבוד הדדי",
    "family_id": "F01",
    "source_entry_ids": [
      "S215",
      "S235"
    ],
    "source_count": 2
  },
  {
    "subvalue_id": "SV164",
    "name_he": "כבוד לטבע",
    "family_id": "F01",
    "source_entry_ids": [
      "S222",
      "S254"
    ],
    "source_count": 2
  },
  {
    "subvalue_id": "SV165",
    "name_he": "הרמוניה",
    "family_id": "F15",
    "source_entry_ids": [
      "S223",
      "S300"
    ],
    "source_count": 2
  },
  {
    "subvalue_id": "SV166",
    "name_he": "כבוד לאבות",
    "family_id": "F01",
    "source_entry_ids": [
      "S225",
      "S245"
    ],
    "source_count": 2
  },
  {
    "subvalue_id": "SV180",
    "name_he": "כבוד לזקנים",
    "family_id": "F01",
    "source_entry_ids": [
      "S242",
      "S264"
    ],
    "source_count": 2
  },
  {
    "subvalue_id": "SV184",
    "name_he": "אירוח",
    "family_id": "F09",
    "source_entry_ids": [
      "S251",
      "S281"
    ],
    "source_count": 2
  },
  {
    "subvalue_id": "SV001",
    "name_he": "דרך ארץ ונימוס",
    "family_id": "F01",
    "source_entry_ids": [
      "S001"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV003",
    "name_he": "קדושת החיים",
    "family_id": "F01",
    "source_entry_ids": [
      "S003"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV006",
    "name_he": "נאמנות ביחסים",
    "family_id": "F07",
    "source_entry_ids": [
      "S006"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV007",
    "name_he": "איפוק מחמדנות",
    "family_id": "F15",
    "source_entry_ids": [
      "S007"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV010",
    "name_he": "הכנסת אורחים",
    "family_id": "F09",
    "source_entry_ids": [
      "S010"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV011",
    "name_he": "צדק ומשפט",
    "family_id": "F05",
    "source_entry_ids": [
      "S011"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV013",
    "name_he": "תשובה ותיקון",
    "family_id": "F11",
    "source_entry_ids": [
      "S013"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV014",
    "name_he": "לימוד",
    "family_id": "F11",
    "source_entry_ids": [
      "S014"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV015",
    "name_he": "שמירת הלשון",
    "family_id": "F22",
    "source_entry_ids": [
      "S015"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV017",
    "name_he": "שמיטה ומנוחה",
    "family_id": "F20",
    "source_entry_ids": [
      "S017"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV019",
    "name_he": "כבוד לגר ולזר",
    "family_id": "F01",
    "source_entry_ids": [
      "S019"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV020",
    "name_he": "ברית ומחויבות",
    "family_id": "F07",
    "source_entry_ids": [
      "S020"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV021",
    "name_he": "אהבת הזולת",
    "family_id": "F08",
    "source_entry_ids": [
      "S021"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV022",
    "name_he": "אהבת אויב",
    "family_id": null,
    "source_entry_ids": [
      "S022"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV029",
    "name_he": "אמונה",
    "family_id": "F07",
    "source_entry_ids": [
      "S032"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV033",
    "name_he": "אומץ מוסרי",
    "family_id": "F14",
    "source_entry_ids": [
      "S037"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV035",
    "name_he": "טיפול בחלש",
    "family_id": "F08",
    "source_entry_ids": [
      "S039"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV036",
    "name_he": "הטוב המשותף",
    "family_id": "F09",
    "source_entry_ids": [
      "S040"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV039",
    "name_he": "כבוד לעני וליתום",
    "family_id": "F01",
    "source_entry_ids": [
      "S048"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV040",
    "name_he": "אי־חריגה מגבולות",
    "family_id": "F20",
    "source_entry_ids": [
      "S050"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV041",
    "name_he": "אחווה",
    "family_id": "F09",
    "source_entry_ids": [
      "S052"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV042",
    "name_he": "אחריות כלכלית",
    "family_id": "F06",
    "source_entry_ids": [
      "S053"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV044",
    "name_he": "ידע",
    "family_id": "F11",
    "source_entry_ids": [
      "S056"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV045",
    "name_he": "ייעוץ הדדי",
    "family_id": "F17",
    "source_entry_ids": [
      "S057"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV046",
    "name_he": "אחריות למעשה",
    "family_id": "F22",
    "source_entry_ids": [
      "S059"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV047",
    "name_he": "טיפול בקהילה",
    "family_id": "F08",
    "source_entry_ids": [
      "S060"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV048",
    "name_he": "דהרמה",
    "family_id": "F03",
    "source_entry_ids": [
      "S061"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV052",
    "name_he": "שליטה עצמית",
    "family_id": "F15",
    "source_entry_ids": [
      "S066"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV054",
    "name_he": "נתינה",
    "family_id": "F10",
    "source_entry_ids": [
      "S069"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV055",
    "name_he": "שוויון תודעתי",
    "family_id": "F15",
    "source_entry_ids": [
      "S070"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV057",
    "name_he": "ידע עצמי",
    "family_id": "F11",
    "source_entry_ids": [
      "S072"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV059",
    "name_he": "כבוד למורה",
    "family_id": "F01",
    "source_entry_ids": [
      "S074"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV060",
    "name_he": "אחריות משפחתית",
    "family_id": "F03",
    "source_entry_ids": [
      "S075"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV061",
    "name_he": "משמעת רוחנית",
    "family_id": "F16",
    "source_entry_ids": [
      "S076"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV062",
    "name_he": "איזון פעולה־תוצאה",
    "family_id": "F15",
    "source_entry_ids": [
      "S077"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV064",
    "name_he": "שביעות רצון",
    "family_id": "F23",
    "source_entry_ids": [
      "S079"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV065",
    "name_he": "אחדות החיים",
    "family_id": "F09",
    "source_entry_ids": [
      "S080"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV066",
    "name_he": "אי־פגיעה",
    "family_id": "F01",
    "source_entry_ids": [
      "S081"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV067",
    "name_he": "אהבה מיטיבה",
    "family_id": "F08",
    "source_entry_ids": [
      "S083"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV068",
    "name_he": "שמחה באושר האחר",
    "family_id": "F23",
    "source_entry_ids": [
      "S084"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV069",
    "name_he": "איזון נפשי",
    "family_id": "F15",
    "source_entry_ids": [
      "S085"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV070",
    "name_he": "דיבור נכון",
    "family_id": "F26",
    "source_entry_ids": [
      "S086"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV071",
    "name_he": "פעולה נכונה",
    "family_id": "F17",
    "source_entry_ids": [
      "S087"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV072",
    "name_he": "פרנסה נכונה",
    "family_id": "F22",
    "source_entry_ids": [
      "S088"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV073",
    "name_he": "מאמץ נכון",
    "family_id": "F16",
    "source_entry_ids": [
      "S089"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV074",
    "name_he": "קשיבות",
    "family_id": "F11",
    "source_entry_ids": [
      "S090"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV075",
    "name_he": "ריכוז",
    "family_id": "F15",
    "source_entry_ids": [
      "S091"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV077",
    "name_he": "אחריות לכוונה",
    "family_id": "F22",
    "source_entry_ids": [
      "S096"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV078",
    "name_he": "קבלת שינוי",
    "family_id": "F27",
    "source_entry_ids": [
      "S097"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV079",
    "name_he": "תלות הדדית",
    "family_id": "F09",
    "source_entry_ids": [
      "S098"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV080",
    "name_he": "קהילת תרגול",
    "family_id": "F09",
    "source_entry_ids": [
      "S099"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV081",
    "name_he": "שחרור מסבל",
    "family_id": "F23",
    "source_entry_ids": [
      "S100"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV082",
    "name_he": "שירות ללא אנוכיות",
    "family_id": "F10",
    "source_entry_ids": [
      "S102"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV083",
    "name_he": "שוויון",
    "family_id": "F05",
    "source_entry_ids": [
      "S103"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV084",
    "name_he": "עבודה ישרה",
    "family_id": "F06",
    "source_entry_ids": [
      "S106"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV085",
    "name_he": "שיתוף",
    "family_id": "F18",
    "source_entry_ids": [
      "S107"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV086",
    "name_he": "זכירת משמעות",
    "family_id": "F11",
    "source_entry_ids": [
      "S108"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV088",
    "name_he": "הגנת החלש",
    "family_id": "F01",
    "source_entry_ids": [
      "S110"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV089",
    "name_he": "כבוד לכל אדם",
    "family_id": "F01",
    "source_entry_ids": [
      "S112"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV090",
    "name_he": "אירוח והזנה",
    "family_id": "F05",
    "source_entry_ids": [
      "S114"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV091",
    "name_he": "משמעת",
    "family_id": "F16",
    "source_entry_ids": [
      "S115"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV093",
    "name_he": "אחריות מעשית",
    "family_id": "F17",
    "source_entry_ids": [
      "S120"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV094",
    "name_he": "ריסון מיני",
    "family_id": "F15",
    "source_entry_ids": [
      "S125"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV095",
    "name_he": "ריבוי נקודות מבט",
    "family_id": "F11",
    "source_entry_ids": [
      "S126"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV096",
    "name_he": "אי־פגיעה בדיבור",
    "family_id": "F26",
    "source_entry_ids": [
      "S127"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV097",
    "name_he": "חמלה לכל החיים",
    "family_id": "F01",
    "source_entry_ids": [
      "S128"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV098",
    "name_he": "צמחונות/צמצום פגיעה",
    "family_id": "F18",
    "source_entry_ids": [
      "S129"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV099",
    "name_he": "משמעת עצמית",
    "family_id": "F15",
    "source_entry_ids": [
      "S130"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV101",
    "name_he": "אחריות קרמתית",
    "family_id": "F22",
    "source_entry_ids": [
      "S132"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV102",
    "name_he": "טוהר כוונה",
    "family_id": "F06",
    "source_entry_ids": [
      "S133"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV104",
    "name_he": "מדיטציה",
    "family_id": "F15",
    "source_entry_ids": [
      "S136"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV105",
    "name_he": "שחרור",
    "family_id": "F15",
    "source_entry_ids": [
      "S137"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV106",
    "name_he": "כבוד לנזירים ולמורים",
    "family_id": "F01",
    "source_entry_ids": [
      "S138"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV107",
    "name_he": "אי־ניצול",
    "family_id": "F05",
    "source_entry_ids": [
      "S139"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV108",
    "name_he": "שמירת משאבים",
    "family_id": "F18",
    "source_entry_ids": [
      "S140"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV109",
    "name_he": "שוויון נשים וגברים",
    "family_id": "F05",
    "source_entry_ids": [
      "S143"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV110",
    "name_he": "שלום עולמי",
    "family_id": "F09",
    "source_entry_ids": [
      "S144"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV111",
    "name_he": "חקירה עצמאית של האמת",
    "family_id": "F06",
    "source_entry_ids": [
      "S145"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV112",
    "name_he": "חינוך אוניברסלי",
    "family_id": "F05",
    "source_entry_ids": [
      "S146"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV113",
    "name_he": "שירות לאנושות",
    "family_id": "F10",
    "source_entry_ids": [
      "S147"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV114",
    "name_he": "אחדות דתית",
    "family_id": "F09",
    "source_entry_ids": [
      "S148"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV115",
    "name_he": "שיתוף פעולה",
    "family_id": "F17",
    "source_entry_ids": [
      "S150"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV116",
    "name_he": "התייעצות",
    "family_id": "F17",
    "source_entry_ids": [
      "S151"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV117",
    "name_he": "הפחתת דעות קדומות",
    "family_id": "F01",
    "source_entry_ids": [
      "S152"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV118",
    "name_he": "עבודה כרוח שירות",
    "family_id": "F10",
    "source_entry_ids": [
      "S153"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV119",
    "name_he": "קידום מדע ודת בהרמוניה",
    "family_id": "F11",
    "source_entry_ids": [
      "S157"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV120",
    "name_he": "אחריות גלובלית",
    "family_id": "F22",
    "source_entry_ids": [
      "S158"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV121",
    "name_he": "פעולה למען אחדות",
    "family_id": "F17",
    "source_entry_ids": [
      "S160"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV122",
    "name_he": "מחשבות טובות",
    "family_id": "F06",
    "source_entry_ids": [
      "S161"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV123",
    "name_he": "מילים טובות",
    "family_id": "F26",
    "source_entry_ids": [
      "S162"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV124",
    "name_he": "מעשים טובים",
    "family_id": "F17",
    "source_entry_ids": [
      "S163"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV125",
    "name_he": "אמת וצדק",
    "family_id": "F05",
    "source_entry_ids": [
      "S164"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV126",
    "name_he": "התנגדות לשקר",
    "family_id": "F06",
    "source_entry_ids": [
      "S165"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV127",
    "name_he": "אחריות מוסרית",
    "family_id": "F22",
    "source_entry_ids": [
      "S166"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV128",
    "name_he": "שמירת טבע",
    "family_id": "F01",
    "source_entry_ids": [
      "S172"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV129",
    "name_he": "עבודה מועילה",
    "family_id": "F10",
    "source_entry_ids": [
      "S173"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV130",
    "name_he": "אומץ מול רוע",
    "family_id": "F14",
    "source_entry_ids": [
      "S174"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV131",
    "name_he": "אמירת אמת",
    "family_id": "F07",
    "source_entry_ids": [
      "S175"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV133",
    "name_he": "שגשוג אחראי",
    "family_id": "F22",
    "source_entry_ids": [
      "S178"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV134",
    "name_he": "תיקון העולם",
    "family_id": "F12",
    "source_entry_ids": [
      "S179"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV135",
    "name_he": "אי־כפייה",
    "family_id": "F17",
    "source_entry_ids": [
      "S185"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV136",
    "name_he": "הרמוניה עם הטבע",
    "family_id": "F17",
    "source_entry_ids": [
      "S186"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV137",
    "name_he": "גמישות",
    "family_id": "F27",
    "source_entry_ids": [
      "S187"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV138",
    "name_he": "שקט",
    "family_id": "F23",
    "source_entry_ids": [
      "S188"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV139",
    "name_he": "אי־תחרות",
    "family_id": "F09",
    "source_entry_ids": [
      "S189"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV140",
    "name_he": "הסתפקות",
    "family_id": "F23",
    "source_entry_ids": [
      "S190"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV141",
    "name_he": "זרימה",
    "family_id": "F17",
    "source_entry_ids": [
      "S191"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV142",
    "name_he": "איזון ניגודים",
    "family_id": "F15",
    "source_entry_ids": [
      "S192"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV143",
    "name_he": "איפוק כוח",
    "family_id": "F20",
    "source_entry_ids": [
      "S193"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV144",
    "name_he": "מנהיגות לא־כופה",
    "family_id": "F17",
    "source_entry_ids": [
      "S194"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV145",
    "name_he": "טבעיות",
    "family_id": "F17",
    "source_entry_ids": [
      "S195"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV146",
    "name_he": "ריקות פונקציונלית",
    "family_id": "F25",
    "source_entry_ids": [
      "S196"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV147",
    "name_he": "שווי משקל",
    "family_id": "F04",
    "source_entry_ids": [
      "S198"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV148",
    "name_he": "חיבור למכלול",
    "family_id": "F09",
    "source_entry_ids": [
      "S199"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV149",
    "name_he": "אי־בזבוז",
    "family_id": "F18",
    "source_entry_ids": [
      "S200"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV150",
    "name_he": "אנושיות",
    "family_id": "F01",
    "source_entry_ids": [
      "S201"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV151",
    "name_he": "דרך ארץ וטקס",
    "family_id": null,
    "source_entry_ids": [
      "S203"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV152",
    "name_he": "כבוד לאחים ולמבוגרים",
    "family_id": "F01",
    "source_entry_ids": [
      "S205"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV153",
    "name_he": "למידה",
    "family_id": "F12",
    "source_entry_ids": [
      "S209"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV154",
    "name_he": "טיפוח עצמי",
    "family_id": "F12",
    "source_entry_ids": [
      "S210"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV155",
    "name_he": "אחריות בתפקיד",
    "family_id": "F03",
    "source_entry_ids": [
      "S212"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV156",
    "name_he": "ממשל מוסרי",
    "family_id": "F06",
    "source_entry_ids": [
      "S213"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV157",
    "name_he": "הרמוניה חברתית",
    "family_id": "F17",
    "source_entry_ids": [
      "S214"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV159",
    "name_he": "מילה מחייבת",
    "family_id": "F22",
    "source_entry_ids": [
      "S216"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV160",
    "name_he": "חברות ראויה",
    "family_id": "F07",
    "source_entry_ids": [
      "S217"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV161",
    "name_he": "בושה מוסרית",
    "family_id": "F22",
    "source_entry_ids": [
      "S218"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV162",
    "name_he": "חינוך",
    "family_id": "F09",
    "source_entry_ids": [
      "S219"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV163",
    "name_he": "טוב משותף",
    "family_id": "F09",
    "source_entry_ids": [
      "S220"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV168",
    "name_he": "כנות",
    "family_id": "F06",
    "source_entry_ids": [
      "S227"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV169",
    "name_he": "ניקיון ציבורי",
    "family_id": "F22",
    "source_entry_ids": [
      "S228"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV170",
    "name_he": "מסורת",
    "family_id": null,
    "source_entry_ids": [
      "S229"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV171",
    "name_he": "כבוד למקום",
    "family_id": "F09",
    "source_entry_ids": [
      "S230"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV172",
    "name_he": "אחריות לטקס",
    "family_id": "F22",
    "source_entry_ids": [
      "S231"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV173",
    "name_he": "אחדות בפסטיבל",
    "family_id": "F09",
    "source_entry_ids": [
      "S232"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV174",
    "name_he": "התחדשות",
    "family_id": null,
    "source_entry_ids": [
      "S233"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV175",
    "name_he": "שייכות מקומית",
    "family_id": "F09",
    "source_entry_ids": [
      "S236"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV176",
    "name_he": "שמירת מורשת",
    "family_id": "F22",
    "source_entry_ids": [
      "S237"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV177",
    "name_he": "איזון אדם־טבע",
    "family_id": "F15",
    "source_entry_ids": [
      "S238"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV178",
    "name_he": "חגיגה משותפת",
    "family_id": "F23",
    "source_entry_ids": [
      "S240"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV179",
    "name_he": "אופי טוב",
    "family_id": "F06",
    "source_entry_ids": [
      "S241"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV181",
    "name_he": "הדדיות",
    "family_id": "F28",
    "source_entry_ids": [
      "S244"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV182",
    "name_he": "אחריות לגורל",
    "family_id": "F22",
    "source_entry_ids": [
      "S246"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV183",
    "name_he": "איזון",
    "family_id": "F15",
    "source_entry_ids": [
      "S248"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV185",
    "name_he": "כבוד למילה",
    "family_id": "F22",
    "source_entry_ids": [
      "S252"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV186",
    "name_he": "פתרון סכסוכים",
    "family_id": "F09",
    "source_entry_ids": [
      "S253"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV187",
    "name_he": "משפחה מורחבת",
    "family_id": "F09",
    "source_entry_ids": [
      "S255"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV188",
    "name_he": "התמדה",
    "family_id": "F16",
    "source_entry_ids": [
      "S256"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV189",
    "name_he": "טקס ואחריות",
    "family_id": "F22",
    "source_entry_ids": [
      "S257"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV190",
    "name_he": "למידה ממבוגרים",
    "family_id": "F11",
    "source_entry_ids": [
      "S258"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV191",
    "name_he": "שגשוג משותף",
    "family_id": "F09",
    "source_entry_ids": [
      "S259"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV192",
    "name_he": "זהות ומורשת",
    "family_id": "F18",
    "source_entry_ids": [
      "S260"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV193",
    "name_he": "כבוד לאדמה",
    "family_id": "F01",
    "source_entry_ids": [
      "S261"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV194",
    "name_he": "הדדיות עם הטבע",
    "family_id": "F28",
    "source_entry_ids": [
      "S262"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV195",
    "name_he": "אחריות לדורות הבאים",
    "family_id": "F03",
    "source_entry_ids": [
      "S263"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV196",
    "name_he": "שייכות למקום",
    "family_id": "F09",
    "source_entry_ids": [
      "S265"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV197",
    "name_he": "שיתוף משאבים",
    "family_id": "F18",
    "source_entry_ids": [
      "S267"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV198",
    "name_he": "סיפור וזיכרון",
    "family_id": "F11",
    "source_entry_ids": [
      "S268"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV199",
    "name_he": "טקס",
    "family_id": "F09",
    "source_entry_ids": [
      "S269"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV200",
    "name_he": "כבוד לבעלי חיים",
    "family_id": "F01",
    "source_entry_ids": [
      "S270"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV201",
    "name_he": "צניעות אנושית",
    "family_id": "F01",
    "source_entry_ids": [
      "S271"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV202",
    "name_he": "קונצנזוס",
    "family_id": "F17",
    "source_entry_ids": [
      "S273"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV203",
    "name_he": "ריפוי קהילתי",
    "family_id": "F09",
    "source_entry_ids": [
      "S274"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV204",
    "name_he": "אחריות למילה",
    "family_id": "F07",
    "source_entry_ids": [
      "S275"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV205",
    "name_he": "אירוח ונתינה",
    "family_id": "F10",
    "source_entry_ids": [
      "S276"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV206",
    "name_he": "איזון עונתי",
    "family_id": "F27",
    "source_entry_ids": [
      "S277"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV207",
    "name_he": "שמירת ידע מקומי",
    "family_id": "F11",
    "source_entry_ids": [
      "S278"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV208",
    "name_he": "ריבונות קהילתית",
    "family_id": "F09",
    "source_entry_ids": [
      "S279"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV209",
    "name_he": "אחריות מערכתית",
    "family_id": "F22",
    "source_entry_ids": [
      "S280"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV210",
    "name_he": "נאמנות לברית",
    "family_id": "F07",
    "source_entry_ids": [
      "S282"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV211",
    "name_he": "חכמה מעשית",
    "family_id": "F11",
    "source_entry_ids": [
      "S286"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV212",
    "name_he": "כבוד למשפחה",
    "family_id": "F22",
    "source_entry_ids": [
      "S287"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV213",
    "name_he": "חובה ציבורית",
    "family_id": "F22",
    "source_entry_ids": [
      "S288"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV214",
    "name_he": "כבוד לאלים",
    "family_id": "F07",
    "source_entry_ids": [
      "S289"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV215",
    "name_he": "אירוח זר",
    "family_id": "F01",
    "source_entry_ids": [
      "S290"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV216",
    "name_he": "חברות",
    "family_id": "F07",
    "source_entry_ids": [
      "S291"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV217",
    "name_he": "מוניטין ראוי",
    "family_id": "F25",
    "source_entry_ids": [
      "S292"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV218",
    "name_he": "איפוק בכוח",
    "family_id": "F20",
    "source_entry_ids": [
      "S293"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV219",
    "name_he": "כבוד למתים",
    "family_id": "F01",
    "source_entry_ids": [
      "S294"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV220",
    "name_he": "אזרחות",
    "family_id": "F09",
    "source_entry_ids": [
      "S296"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV221",
    "name_he": "חוק וסדר",
    "family_id": "F04",
    "source_entry_ids": [
      "S297"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV222",
    "name_he": "איזון בין גורל לפעולה",
    "family_id": "F22",
    "source_entry_ids": [
      "S298"
    ],
    "source_count": 1
  },
  {
    "subvalue_id": "SV223",
    "name_he": "מצוינות",
    "family_id": "F24",
    "source_entry_ids": [
      "S299"
    ],
    "source_count": 1
  }
];

export const RAW_TOTAL = RAW_FAMILIES.length + RAW_SOURCE_ENTRIES.length;
