"use client";
/**
 * DATA QUALITY — the analyst layer, deliberately collapsed.
 *
 * Everything here is true and none of it is what a person opening Community
 * came for. It sits behind a `<details>` so the discovery experience stays the
 * surface and the audit stays reachable in one keystroke — the same
 * progressive-disclosure rule the rest of the social layer uses, rather than a
 * second dashboard competing with the map.
 *
 * The two coverages are stated as separate rows on purpose. A single
 * "completeness" percentage would average a nearly-complete ontology with a
 * nearly-empty population and report a healthy middle that describes neither.
 */
import { COLOR, FS, RADIUS, SPACE } from "@/app/lib/philos/shell/designTokens";

export interface QualityInput {
  families: number; subvalues: number;
  populatedFamilies: number; populatedSubvalues: number;
  groups: number; real: number; demo: number; derived: number;
  unresolvedMappings: number; relations: number;
  withBudget: number; withNeeds: number; withOffers: number; withActions: number;
  withEffects: number; withEvidence: number; withRoles: number;
  packageFiles: { file: string; records: number; present: boolean }[];
  ingestRejected: number;
  groupEvents: number;
  candidateMatches: number;
  eventRelations: number;
}

function Row({ label, value, of, note }: { label: string; value: number; of?: number; note?: string }) {
  const pct = of && of > 0 ? (value / of) * 100 : null;
  return (
    <div style={{ display: "flex", gap: SPACE.md, alignItems: "center", padding: "5px 0", borderTop: `1px solid ${COLOR.border}` }}>
      <span style={{ fontSize: FS.meta, color: COLOR.textDim, minWidth: 176 }}>{label}</span>
      <span style={{ fontSize: FS.base, color: COLOR.text, fontVariantNumeric: "tabular-nums", minWidth: 74 }}>
        {value}{of !== undefined ? <span style={{ color: COLOR.textFaint }}> / {of}</span> : null}
      </span>
      {pct !== null ? (
        <span style={{ flex: 1, maxWidth: 200, height: 6, background: "#141c30", borderRadius: 3, overflow: "hidden" }}>
          <span style={{ display: "block", width: `${Math.max(pct, pct > 0 ? 1.5 : 0)}%`, height: "100%",
            background: pct === 0 ? "#f0b45c" : "#2f7fd6" }} />
        </span>
      ) : <span style={{ flex: 1 }} />}
      {note ? <span style={{ fontSize: FS.tag, color: COLOR.textFaint }}>{note}</span> : null}
    </div>
  );
}

export default function DataQualityPanel({ input: q }: { input: QualityInput }) {
  const present = q.packageFiles.filter((f) => f.present);
  const records = present.reduce((a, f) => a + f.records, 0);
  return (
    <details style={{ background: COLOR.bgRaised, border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.md }}>
      <summary style={{ minBlockSize: 32, display: "flex", alignItems: "center", gap: SPACE.md,
        padding: `${SPACE.sm}px ${SPACE.md}px`, cursor: "pointer", fontSize: FS.section, color: COLOR.text }}>
        איכות דאטה · ביקורת אנליסט
        <span style={{ fontSize: FS.meta, color: COLOR.textFaint }}>
          {present.length} קבצי חבילה · {records} רשומות · {q.unresolvedMappings} מיפויים פתוחים
        </span>
      </summary>
      <div style={{ padding: `0 ${SPACE.md}px ${SPACE.md}px` }}>
        <div style={{ fontSize: FS.tag, letterSpacing: ".06em", color: COLOR.textFaint, marginTop: SPACE.md }}>כיסוי</div>
        <Row label="כיסוי טקסונומי — משפחות" value={q.families} of={28} note="מתוארות" />
        <Row label="כיסוי טקסונומי — תת-ערכים" value={q.subvalues} of={223} note="מתוארים" />
        <Row label="כיסוי אוכלוסייה — משפחות" value={q.populatedFamilies} of={q.families} note="עם קבוצה" />
        <Row label="כיסוי אוכלוסייה — תת-ערכים" value={q.populatedSubvalues} of={q.subvalues} note="עם קבוצה" />

        <div style={{ fontSize: FS.tag, letterSpacing: ".06em", color: COLOR.textFaint, marginTop: SPACE.md }}>מקור וסטטוס</div>
        <Row label="REAL" value={q.real} of={q.groups} />
        <Row label="DERIVED" value={q.derived} of={q.groups} />
        <Row label="DEMO" value={q.demo} of={q.groups} />
        <Row label="מיפויי ערך פתוחים" value={q.unresolvedMappings} of={q.groups} note="REVIEW_REQUIRED" />
        <Row label="כיסוי קשרים" value={q.relations} note={q.relations === 0 ? "אין ראיה לקשר" : ""} />

        <div style={{ fontSize: FS.tag, letterSpacing: ".06em", color: COLOR.textFaint, marginTop: SPACE.md }}>
          השדרה התפעולית
        </div>
        <Row label="אירועי קבוצה" value={q.groupEvents} note={q.groupEvents === 0 ? "הערוץ קיים — אין עדיין אף אירוע" : ""} />
        <Row label="התאמות מועמדות" value={q.candidateMatches} note="DERIVED — מועמדת ≠ מאושרת" />
        <Row label="קשרים מהיסטוריה" value={q.eventRelations} note="כל קשת נושאת את מזהי האירועים שלה" />

        <div style={{ fontSize: FS.tag, letterSpacing: ".06em", color: COLOR.textFaint, marginTop: SPACE.md }}>
          שדות תפעוליים חסרים — כמה קבוצות מחזיקות כל שדה
        </div>
        <Row label="תקציב" value={q.withBudget} of={q.groups} />
        <Row label="תפקידים" value={q.withRoles} of={q.groups} />
        <Row label="השפעות" value={q.withEffects} of={q.groups} />
        <Row label="ראיות" value={q.withEvidence} of={q.groups} />
        <Row label="צרכים" value={q.withNeeds} of={q.groups} note={q.withNeeds === 0 ? "אין ערוץ קליטה" : ""} />
        <Row label="משאבים" value={q.withOffers} of={q.groups} note={q.withOffers === 0 ? "אין ערוץ קליטה" : ""} />
        <Row label="פעולות" value={q.withActions} of={q.groups} note={q.withActions === 0 ? "אין ערוץ קליטה" : ""} />

        <div style={{ fontSize: FS.tag, letterSpacing: ".06em", color: COLOR.textFaint, marginTop: SPACE.md }}>
          חבילת הדאטה — .philos-canon-data/
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 2, marginTop: 4 }}>
          {q.packageFiles.map((f) => (
            <div key={f.file} style={{ display: "flex", gap: SPACE.sm, fontSize: FS.meta,
              color: f.present ? COLOR.textDim : COLOR.textFaint }}>
              <span style={{ flex: 1 }}>{f.file.replace(".jsonl", "")}</span>
              <span style={{ fontVariantNumeric: "tabular-nums", color: f.present && f.records > 0 ? COLOR.text : COLOR.textFaint }}>
                {f.present ? f.records : "—"}
              </span>
            </div>
          ))}
        </div>
        {q.ingestRejected > 0 ? (
          <div style={{ marginTop: SPACE.sm, fontSize: FS.meta, color: "#f0b45c" }}>
            {q.ingestRejected} שורות ייבוא נדחו — ראה יומן שרת
          </div>
        ) : null}
      </div>
    </details>
  );
}
