# PHILOS — EVIDENCE + NEXT ACTION (LOCKED)
## STEP 0 — הגייט של המאסטר §23 סעיף 3

- **LOCK_STATUS:** נעול — אוצר מילים משותף
- **מקור:** `PHILOS_SYSTEM_MASTER_OPM_LANGUAGE_7_TERMINALS_v1.docx` §23 · `PHILOS-MELTING-POT-CANON.md` §17
- **אחים:** [`PHILOS-PERSON-CONTRACT.md`](./PHILOS-PERSON-CONTRACT.md) · [`PHILOS-SYSTEM-LANGUAGE.md`](./PHILOS-SYSTEM-LANGUAGE.md)
- **למה עכשיו:** שני השדות האלה הם PRIMARY בכל שבעת המסופים ואין להם הגדרה אחת. זה החסם היחיד
  שנותר לפני ש-Hub יכול לשמש reference implementation.

> מסמך זה נועל **אוצר מילים ותצוגה**. הוא אינו מאחד סכמות, אינו יוצר store,
> אינו משנה אף derivation קיים, ואינו מכריע איזו רשומה "נכונה".

---

# חלק א — EVIDENCE

## A1. הבעיה, מדודה

חמש notions בלתי-תואמות של "ראיה" חיות במקביל, ואף אחת אינה entity משותף:

| # | מקור בקוד | צורה | תחום |
|---|---|---|---|
| 1 | `canon/outcomeVerification.ts::OutcomeVerification` | `{statement, provenance, verifier_type, confidence, time, method, subject_consent?}` | Canon — Effect |
| 2 | `canonical/brainDerivation.ts::BrainDerivation.evidence` | `string[]` | נגזרת — Brain/Hub |
| 3 | `valueDomain/valueDomainConfig.ts::DomainState.evidence?` | `string` | קריאת DomainState |
| 4 | `app/lib/{value,capability,provider,gap,mission}/schema.ts` | `EvidenceGrade` + `{signal, source, observedAt, note}` | PUDM legacy |
| 5 | `humanConfig/parameterAcquisition.ts::EvidenceType` | `SELF_DECLARED \| DIRECT_OBSERVATION \| SYSTEM_EVENT \| DERIVED \| HYPOTHESIS` | Human Config |
| 6 | `philos/events.ts::VERIFICATION_LEVELS` | `claim \| self_report \| evidence \| community_verified \| external_verified \| system_inference` + 6 methods | Legacy event log |

**שש, לא חמש** — סעיף 6 (legacy `VERIFICATION_LEVELS` + `VERIFICATION_METHODS` + `statusForMethod`)
נספר כאן במפורש; באודיט הקודם הוא נבלע בתוך "PUDM".

## A2. העוגן הקנוני

Canon §17 היא ההגדרה היחידה שיש לה מעמד קנוני:

> `OutcomeVerification`: `claimed_outcome` ו-`verified_outcome` נושאים כל אחד
> `{provenance, verifier_type ∈ {self, counterparty, third_party, observed_measured}, confidence, time, method}`.
> **טענה שנטענה לעולם אינה מעדכנת `State'` כאילו אומתה.**
> אימות מצב פנימי של נושא דורש ראיית נושא/עצמי או אימות בהסכמת הנושא.

**כלל היסוד הנעול:** `CLAIMED ≠ VERIFIED`. זה הגבול היחיד שכל שש הנotions חייבות לכבד.

## A3. `EvidenceRef` — צורת התצוגה המשותפת

**זו צורת תצוגה, לא סכמה חדשה ולא store.** כל notion ממופה אליה בגבול הרינדור בלבד.

```
EvidenceRef {
  statement        מה נטען/אומת — התוכן
  stance           CLAIMED | VERIFIED | UNVERIFIABLE      ← הגבול הקנוני
  verifier_type    self | counterparty | third_party | observed_measured | UNKNOWN
  confidence       number | UNKNOWN                        ← מטא-דאטה, לעולם לא ערך אדם
  time             ISO | UNKNOWN
  method           string | UNKNOWN
  source_id        המזהה האמיתי (effect_id / canon_event_id / state_id / …)
  origin           CANON | LEGACY | PUDM | CONFIG | DERIVED
}
```

## A4. טבלת המיפוי — מה כל notion יודעת, ומה לא

| notion | stance | verifier_type | confidence | method | source_id | origin |
|---|---|---|---|---|---|---|
| 1 `OutcomeVerification` | `verified_outcome` קיים → **VERIFIED**, אחרת **CLAIMED** | ✔ ישיר | ✔ | ✔ | `effect_id` | CANON |
| 2 `BrainDerivation.evidence` | נגזר מהתחילית `[VERIFIED]`/`[CLAIMED]` שהמחרוזת כבר נושאת | UNKNOWN | UNKNOWN | UNKNOWN | `action_id` | DERIVED |
| 3 `DomainState.evidence` | **UNVERIFIABLE** — אין ציר אימות בסכמה | UNKNOWN | ✔ (של הקריאה) | UNKNOWN | `state_id` | CANON |
| 4 PUDM `EvidenceRecord` | **UNVERIFIABLE** — `EvidenceGrade` הוא דירוג מקור, לא אימות | UNKNOWN | UNKNOWN | `signal` | entity id | PUDM |
| 5 `EvidenceType` | `SELF_DECLARED`→CLAIMED · `DIRECT_OBSERVATION`/`SYSTEM_EVENT`→VERIFIED · `DERIVED`/`HYPOTHESIS`→**UNVERIFIABLE** | ✔ נגזר | UNKNOWN | ✔ | `Canonical_ID` | CONFIG |
| 6 legacy `VerificationStatus` | `claim`/`self_report`→CLAIMED · `community_verified`/`external_verified`→VERIFIED · `evidence`/`system_inference`→**UNVERIFIABLE** | UNKNOWN | UNKNOWN | ✔ (6 methods) | `event_id` | LEGACY |

**`UNVERIFIABLE` אינו "לא אומת".** משמעותו: **לסכמה הזו אין בכלל ציר אימות** — אסור להציג אותה
לא כ-CLAIMED ולא כ-VERIFIED. זו הבחנה שלישית הכרחית, אחרת notions 3/4 היו מוצגות כטענות
כשהן בכלל לא טוענות.

## A5. כללי תצוגה — מחייבים בכל שבעת המסופים

1. **כל שורת ראיה נושאת `stance` + `origin`.** ראיה בלי שניהם — לא מוצגת.
2. **`CLAIMED` לעולם לא נראית כמו `VERIFIED`** — לא באותו צבע, לא באותו badge, לא בלי תווית.
3. **`confidence` תמיד ליד ה-statement, לעולם לא לבד** — מספר בלי טענה חסר משמעות (canon §6).
4. **אסור לספור ראיות ממקורות שונים לסכום אחד.** "3 ראיות" שמערב CANON+PUDM+CONFIG — אסור.
   ספירה מותרת רק בתוך אותו `origin`.
5. **`UNKNOWN` בשדה = המילה, לא השמטה.** שדה ריק אסור.
6. **אין ראיה** → `אין ראיה עדיין` + שם סוג הרשומה החסרה. לא פאנל ריק, לא `—`, לא `0`.

---

# חלק ב — NEXT ACTION

## B1. ממצא מכריע — NEXT ACTION אינו ישות קנונית

**נבדק:** `PHILOS-MELTING-POT-CANON.md` — אין `NextAction` באף אחד מ-27 הסעיפים.
`PHILOS_SYSTEM_MASTER_OPM_LANGUAGE_7_TERMINALS_v1.docx` §2 (טבלת שפת המערכת) — **אין שורת
NEXT ACTION**; יש `ACTION`, `EFFECT`, `EVIDENCE`, `LEARNING`. "Next Action" מופיע רק ב-§9,
בעמודת **שפת מסוף** של Hub ו-Brain.

```
NEXT ACTION = מושג מוצר (product concept), לא entity.
              הוא הצעה מדורגת מעל רשומות אמיתיות — לעולם לא רשומה בעצמו.
              provenance = STATIC (כלל מעל רשומות), לעולם לא CANON.
```

זה מסלק את השאלה "איזו derivation נכונה" — **אף אחת אינה קנונית, ולכן אף אחת לא "מנצחת".**
מה שנדרש הוא **scope**, לא הכרעה.

## B2. ארבעת ה-derivations הקיימים

| # | מקור | Scope | כלל העדיפות |
|---|---|---|---|
| 1 | `canonical/brainDerivation.ts::buildNextAction` | **SUBJECT** — האדם, היום | pending Need → Action ללא Effect → Effect claimed-only → תצפית ראשונה (מגודר ב-`hasRealObservation`) → Action ראשון → `null` |
| 2 | `lib/systemContext.ts::SelectedContext.nextAction` | **ENTITY** — הרשומה שנבחרה | Action בלי Effect → רשום Effect · Effect לא מאומת → אמת · אחרת `null` |
| 3 | `hub/HubCommandCenter.tsx::primaryCTA` | **SUBJECT** — CTA ראשי | pendingNeeds תחילה (מסמך עצמו: "Priority order only reflects…") |
| 4 | `hub/PersonNowPanel.tsx::buildPriorities` | **SUBJECT** — רשימה מדורגת | Need פתוח → לולאה פתוחה → Tension לפי severity |

1, 3 ו-4 חולקים את אותו סדר עדיפויות (**Need ראשון**) על אותם נתונים. 2 הוא ציר אחר לגמרי.

## B3. `NextActionRef` — צורת התצוגה המשותפת

```
NextActionRef {
  label      מה לעשות
  reason     למה זה הצעד — חובה, לעולם לא ריק
  scope      SUBJECT | ENTITY | GROUP            ← השדה שמסלק את ההתנגשות
  basis      הרשומה האמיתית שממנה נגזר (need_id / action_id / effect_id / tension_id)
  provenance STATIC                              ← תמיד; זהו כלל, לא רשומה
  rank       number | UNKNOWN                     ← מיקום ברשימה, לא ציון
}
```

## B4. כללי תצוגה — מחייבים

1. **`scope` חובה.** Next Action בלי scope — **אסור להצגה**. זה הכלל שפותר את ההתנגשות:
   שני next-actions על מסך אחד מותרים אם ורק אם ה-scope שלהם שונה ומוצג.
2. **`reason` חובה.** "עשה X" בלי "כי Y" — לא מוצג.
3. **`basis` חובה.** הצעה שאינה מצביעה על רשומה אמיתית — לא מוצגת.
4. **`provenance: STATIC` תמיד.** אסור לתייג next action כ-CANON.
5. **`null` הוא תשובה לגיטימית** — `אין פעולה דחופה מזוהה`. אסור למחזר הצעה לצעד שכבר קרה
   (`brainDerivation` כבר אוכף את זה דרך `hasRealObservation`).
6. **אין ציון.** `rank` הוא מיקום ברשימה, לא מדד על האדם (canon §21).

## B5. מה המסמך הזה **אינו** מכריע

- אינו מאחד את ארבעת ה-derivations לאחד.
- אינו משנה שום כלל עדיפות קיים.
- אינו קובע איזה scope מוצג ראשון ב-Hub — זו החלטת מוצר נפרדת.
- אינו נוגע ב-Target/Tension (משימה קנונית נפרדת).

**מה שהוא כן עושה:** הופך שני next-actions על מסך אחד מ**באג** ל**מידע**, על ידי חיוב `scope`.

---

## C. קריטריון קבלה ל-STEP 0

```
1. כל ראיה בכל מסוף נושאת stance + origin           → CLAIMED לא נראית כמו VERIFIED
2. אין ספירת ראיות חוצת-origin                       → "3 ראיות" מעורבב = הפרה
3. UNVERIFIABLE קיים כערך שלישי                      → סכמות בלי ציר אימות לא מתחזות לטענות
4. כל next action נושא scope + reason + basis        → אחרת לא מוצג
5. שני next-actions על מסך אחד → רק עם scope שונה ומוצג
6. אף next action אינו מתויג CANON                   → תמיד STATIC
7. UNKNOWN/UNRESOLVED/NOT_APPLICABLE — המילה, לא השמטה
```

**הגייט של המאסטר §23 — סטטוס אחרי מסמך זה:**

| # | מה | סטטוס |
|---|---|---|
| 1 | Person entity / Person Now contract | ✅ נעול |
| 2 | היחס 3×3 מול 6-Class | ✅ נעול כ-UNRESOLVED |
| 3 | shared Evidence / Next Action vocabulary | ✅ **נעול — מסמך זה** |

**הגייט סגור. שינוי UI מותר מכאן והלאה, לפי סדר התלויות ב-`HUB_INPUT_CONTRACT`.**

---

**נעול.** אוצר מילים ותצוגה נעולים. אפס סכמות חדשות, אפס stores, אפס שינוי derivation.
