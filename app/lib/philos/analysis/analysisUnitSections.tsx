/**
 * THE 4+6 ANALYSIS-UNIT SECTIONS — ONE IMPLEMENTATION, TWO PRESENTATIONS.
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
 *
 * TWO VARIANTS, NOT TWO COMPONENTS. The demo header needs the TECHNICAL card —
 * status enums, evidence counts, an Audit line with `sourceRefs` — because its
 * reader is auditing a fixture. A person reading their own day needs the PLAIN
 * row: what the unit MEANS, then whether they marked it, in words. Writing a
 * second component for that produced two drawings of the same ten units that
 * could drift apart. `variant` keeps them one function with one status source;
 * only the wording and the density differ.
 */
import {
  type AnalysisUnitMeta, type AnalysisUnitReading,
} from "./analysisUnit";
import { unitGap } from "./acceptanceScenario";
import { UNIT_MEANING } from "./unitMeaning";
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

export type UnitVariant = "technical" | "plain";

export function UnitCard({ meta, reading, gap, variant = "technical", full = true }: {
  meta: AnalysisUnitMeta; reading: AnalysisUnitReading;
  gap: { evidenceCount: number; missingReason: string; collectionAction: string };
  variant?: UnitVariant;
  /** PLAIN only: whether to add the "what a mark does not establish" line. */
  full?: boolean;
}) {
  /* PLAIN — the definition first, because a status is meaningless to someone
     who does not yet know what the unit is. No enum, no id, no source path. */
  if (variant === "plain") {
    const marked = reading.status !== "unknown";
    const meaning = UNIT_MEANING[meta.id];
    return (
      <div data-unit={meta.id} data-marked={marked} style={P.unit}>
        <div style={P.head}>
          <b style={{ ...P.name, color: marked ? COLOR.text : COLOR.textDim }}>{meta.label}</b>
          <span style={{ ...P.status, color: marked ? "#8fd7ff" : "#fbbf24" }}>
            {marked ? "סומן בתצפית" : "לא סווג בתצפית"}
          </span>
        </div>
        <div style={P.means}>{meaning.means}</div>
        {full ? (
          <div style={P.note}>{marked ? meaning.whenMarked : meaning.whenNotMarked}</div>
        ) : null}
      </div>
    );
  }

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
      {/* `display: block` IS THE WHOLE CARD.
          A <summary> with `list-style: none` computes to `inline-flex` here,
          which laid the title row and the explanation SIDE BY SIDE on one
          line. In Hebrew the result read "זמן ידועסווג במפורש" — the status
          word fused to the first word of the sentence after it. The text was
          not merely ugly, it was unreadable, and it shipped because the words
          are all present in `innerText` (separated by newlines) so every DOM
          assertion passed while the screen said nothing. */}
      <summary style={{ cursor: "pointer", listStyle: "none", display: "block" }}>
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

export function UnitRow({ group, title, note, units, readings, variant = "technical", full = true }: {
  group: "FOUNDATION" | "DEPARTMENTS";
  title: string; note: string; units: readonly AnalysisUnitMeta[];
  readings: Record<string, AnalysisUnitReading>;
  variant?: UnitVariant;
  full?: boolean;
}) {
  if (variant === "plain") {
    return (
      <div data-analysis-group={group} style={P.group}>
        <div style={P.groupHead}>
          <b style={P.groupTitle}>{title}</b>
          <span style={P.groupNote}>{note}</span>
        </div>
        {units.map((u) => (
          <UnitCard key={u.id} meta={u} reading={readings[u.id]!} gap={unitGap(u.id)}
                    variant="plain" full={full} />
        ))}
      </div>
    );
  }

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

/** PLAIN-variant styles. Separate object so the technical card is untouched. */
const P: Record<string, React.CSSProperties> = {
  group: { display: "grid", gap: 6, gridTemplateColumns: "minmax(0, 1fr)" },
  groupHead: { display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" },
  groupTitle: { fontSize: 17, color: COLOR.text, fontWeight: 800 },
  groupNote: { fontSize: 13, color: COLOR.textFaint },
  unit: { display: "grid", gap: 2, paddingBlock: 7,
    borderTop: `1px solid ${COLOR.border}`, gridTemplateColumns: "minmax(0, 1fr)" },
  head: { display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" },
  name: { fontSize: 15, fontWeight: 700 },
  status: { fontSize: 13, fontWeight: 600 },
  means: { fontSize: 14, lineHeight: 1.55, color: COLOR.textDim },
  note: { fontSize: 13, lineHeight: 1.55, color: COLOR.textFaint },
};
