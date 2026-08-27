/**
 * THE 4+6 ANALYSIS-UNIT SECTIONS — ONE IMPLEMENTATION, TWO CALLERS.
 *
 * `PersonEventOrientationHeader` renders the four fundamentals and the six
 * opposition classes, and it is bound to `loadAcceptanceScenario()` — a
 * fixture keyed `scenario_person_sim_user`. Quarantining that header behind
 * the DEMO boundary was right, but it was the only component in the product
 * that drew these ten cards, so REAL screens lost the material entirely.
 *
 * The presentation is EXTRACTED, not copied. `UnitCard` and `UnitRow` are the
 * original bodies moved here verbatim; the header imports them back, so the
 * demo surface and the REAL surface cannot drift into two different drawings
 * of the same ten units. Neither function ever knew where its readings came
 * from — they take an `AnalysisUnitReading` — which is exactly why one
 * implementation can serve a fixture and a real record without either being
 * able to impersonate the other.
 */
import {
  type AnalysisUnitMeta, type AnalysisUnitReading,
} from "./analysisUnit";
import { unitGap } from "./acceptanceScenario";
import { COLOR, COLOR_ROLE, RADIUS } from "../shell/designTokens";

/** The type scale these cards were designed at. Shared so both agree. */
export const T = {
  section: 22,   // section titles
  hero: 30,      // the one number a card exists to show
  card: 17,      // card titles
  body: 16,      // the thing a person came to read
  meta: 14,      // supporting detail
  micro: 13,     // provenance notes, never a sentence
  lh: 1.5,
} as const;

/** Status word, in Hebrew. `unknown` is an absence, never a zero. */
export const STATUS_HE: Record<string, string> = {
  unknown: "חסר מידע", observed: "ידוע", measured: "נמדד",
  inferred: "הוסק", contradictory: "סותר", not_applicable: "לא רלוונטי",
};

export function UnitCard({ meta, reading, gap }: {
  meta: AnalysisUnitMeta; reading: AnalysisUnitReading;
  gap: { evidenceCount: number; missingReason: string; collectionAction: string };
}) {
  const known = reading.status !== "unknown";
  const he = STATUS_HE[reading.status] ?? "חסר מידע";
  const tone = reading.status === "contradictory" ? "#fc8a84"
    : known ? "#8fd7ff" : COLOR.textDim;
  /* Closed line: the reading if there is one, else why there is not. */
  const lead = reading.explanation ?? gap.missingReason;

  return (
    <details data-unit={meta.id} data-unit-detail={meta.id} data-status={reading.status}
      style={{ flex: "1 1 320px", minInlineSize: 300, padding: "10px 14px",
        borderRadius: RADIUS.md, background: "rgba(255,255,255,0.025)",
        borderInlineStart: `4px solid ${COLOR_ROLE[meta.colorRole]}` }}>
      <summary style={{ cursor: "pointer", listStyle: "none" }}>
        {/* Title and status on one line that cannot break: "חסר מידע"
            wrapping to "חסר / מידע" made the status unreadable. */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: T.card, color: COLOR.text, fontWeight: 700,
            whiteSpace: "nowrap" }}>{meta.label}</span>
          <span style={{ fontSize: T.meta, color: tone, whiteSpace: "nowrap" }}>{he}</span>
        </div>
        <div style={{ fontSize: T.body, color: COLOR.textDim, marginTop: 5, lineHeight: T.lh }}>
          {lead}
        </div>
      </summary>

      <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${COLOR.border}` }}>
        <div style={{ fontSize: T.body, color: COLOR.textDim, lineHeight: T.lh }}>
          {reading.sourceRefs.length > 0
            ? `מקור: ${reading.sourceRefs.length} רשומות · ראיות ${gap.evidenceCount}`
            : "אין מקור"}
        </div>
        {!known ? (
          <div data-missing-reason style={{ fontSize: T.body, color: COLOR.textDim,
            marginTop: 6, lineHeight: T.lh }}>
            {/* UNKNOWN is an absence, and the card says so in words. */}
            אין קריאה — לא אפס. {gap.missingReason}
          </div>
        ) : (
          <div data-missing-reason style={{ fontSize: T.meta, color: COLOR.textFaint,
            marginTop: 6, lineHeight: T.lh }}>
            {gap.missingReason}
          </div>
        )}
        <div data-collection-action style={{ fontSize: T.body, color: COLOR_ROLE.green,
          marginTop: 6, lineHeight: T.lh }}>
          השלמה נדרשת: {gap.collectionAction}
        </div>
        {reading.sourceRefs.length > 0 ? (
          <details style={{ marginTop: 8 }}>
            <summary style={{ cursor: "pointer", listStyle: "none", fontSize: T.micro,
              color: COLOR.textFaint }}>▾ Audit</summary>
            <div dir="ltr" style={{ fontSize: T.micro, color: "#9fd0ff", textAlign: "left",
              wordBreak: "break-all", marginTop: 3 }}>
              {meta.id} · {reading.status} · {reading.sourceRefs.join(" · ")}
            </div>
          </details>
        ) : null}
      </div>
    </details>
  );
}

/** One labelled group. Two of these, never a flat ten. */

export function UnitRow({ group, title, note, units, readings }: {
  group: "FOUNDATION" | "DEPARTMENTS";
  title: string; note: string; units: readonly AnalysisUnitMeta[];
  readings: Record<string, AnalysisUnitReading>;
}) {
  return (
    <div data-analysis-group={group} style={{ marginTop: 18 }}>
      <div style={{ fontSize: T.section, color: COLOR.text, fontWeight: 700, marginBottom: 8 }}>
        {title} <span style={{ fontSize: T.meta, color: COLOR.textDim, fontWeight: 400 }}>· {note}</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {units.map((u) => (
          <UnitCard key={u.id} meta={u} reading={readings[u.id]!} gap={unitGap(u.id)} />
        ))}
      </div>
    </div>
  );
}
