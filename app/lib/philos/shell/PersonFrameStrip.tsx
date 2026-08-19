/**
 * PERSON FRAME STRIP — the shared projection of `PersonInContext`, rendered
 * identically on every surface that shows it.
 *
 * The rule this component exists to enforce: **a surface may project LESS,
 * but it may not redefine the MEANING.** Hub, Brain and Dynamics each ask a
 * different question of the same person, and each may show a subset of the
 * frame — but "HUMAN BASE", "ACTIVE DOMAIN" and "VALUE / DIRECTION" have to
 * mean the same thing on all three. One component, one vocabulary.
 *
 * Everything here is REFERENCE, and the strip says so in its own header.
 * There is no cell, no level, no coverage number and no next action — the
 * frame is the left edge of the chain, and those belong to the systems
 * downstream of it. `PersonInContext` has no field for them, so this
 * component could not render one even by mistake.
 *
 * The three axes stay visually separate for the same reason they are
 * structurally separate: a human base is not a domain, and neither is a
 * value relation. Collapsing them into one "profile" block is precisely
 * the contamination the architecture forbids.
 */
import type { PersonInContext } from "../person/personInContext";
import { COLOR, RADIUS, SPACE, TYPE } from "./designTokens";
import { ProvenanceBadge } from "./provenance";

export default function PersonFrameStrip({
  frame, compact = false,
}: { frame: PersonInContext; compact?: boolean }) {
  const base = frame.human_base;
  const sel = frame.domain_resolution;

  return (
    <section dir="rtl" style={S.band}>
      <div style={S.head}>
        <span style={S.eyebrow}>מסגרת ייחוס · PERSON-IN-CONTEXT REFERENCE FRAME</span>
        <span style={S.note}>ייחוס בלבד — מה ניתן לשאול/למדוד. אינו מצב מדוד.</span>
      </div>

      <div style={S.grid}>
        {/* AXIS 1 — the cross-domain human base */}
        <Axis
          label="HUMAN BASE"
          gloss="בסיס חוצה-דומיינים"
          provenance="CANON"
          lines={[
            `${base.parameter.length} פרמטרים מדידים · ${base.dimension.length} מימדים`,
            `${base.provenance.active_refs} refs פעילים מתוך ${base.provenance.total_in_lock}`,
          ]}
          foot={`${base.unresolved.length} תפקידים ללא מקור — מוצהרים`}
        />

        {/* AXIS 2 — value / direction, structurally its own axis */}
        <Axis
          label="VALUE / DIRECTION"
          gloss="ערך וכיוון"
          provenance={frame.value_direction.verified_group_relations.length > 0 ? "CANON" : "UNKNOWN"}
          lines={
            frame.value_direction.verified_group_relations.length > 0
              ? frame.value_direction.verified_group_relations.slice(0, 2).map((g) => `${g.name} · ${g.central_value}`)
              : ["UNKNOWN"]
          }
          foot={frame.value_direction.basis}
        />

        {/* AXIS 3 — the swappable domain slot */}
        <Axis
          label="ACTIVE / AVAILABLE DOMAIN"
          gloss="סלוט דומיין"
          provenance={sel.selected ? "CANON" : "UNKNOWN"}
          lines={
            sel.selected
              ? [`נבחר: ${sel.slot.label_he}`, sel.basis]
              : [
                  "ACTIVE DOMAIN — UNKNOWN",
                  `זמינים: ${frame.available_domains.map((d) => d.label_he).join(" · ") || "אין"}`,
                ]
          }
          foot={sel.selected ? "" : sel.reason}
        />
      </div>

      {compact ? null : (
        <div style={S.possible}>
          <span style={S.eyebrow}>מה המסגרת מאפשרת · WHAT THIS FRAME LICENSES</span>
          <div style={S.possibleRow}>
            <Chip k="פרמטרים שניתן למדוד" v={frame.possible.measurable_parameters.length} />
            <Chip k="שאלות שניתן לשאול" v={frame.possible.questions.length} />
            <Chip k="יכולות שהקונפיג מגדיר" v={frame.possible.defined_capabilities.length} />
          </div>
          <div style={S.rule}>
            אפשרות אינה מדידה: פרמטר שניתן למדוד אינו מדוד, שאלה שניתן לשאול אינה
            תשובה, ויכולת שהקונפיג מגדיר אינה יכולת שהאדם מחזיק. כל אחת מהן דורשת
            רשומה אמיתית משלה.
          </div>
        </div>
      )}
    </section>
  );
}

function Axis({ label, gloss, provenance, lines, foot }: {
  label: string; gloss: string; provenance: "CANON" | "UNKNOWN"; lines: string[]; foot?: string;
}) {
  return (
    <div style={S.axis}>
      <div style={S.axisHead}>
        <span style={{ ...TYPE.micro, fontSize: 8.5, color: provenance === "CANON" ? COLOR.accent : COLOR.textFaint }}>{label}</span>
        <ProvenanceBadge p={provenance} />
      </div>
      <div style={{ fontSize: 9, color: COLOR.textFaint, marginBottom: 3 }}>{gloss}</div>
      {lines.map((l, i) => (
        <div key={i} style={{ fontSize: 11, color: COLOR.textDim, lineHeight: 1.45 }}>{l}</div>
      ))}
      {foot ? <div style={S.axisFoot}>{foot}</div> : null}
    </div>
  );
}

function Chip({ k, v }: { k: string; v: number }) {
  return (
    <span style={S.chip}>
      <b style={{ color: COLOR.text }}>{v}</b> {k}
    </span>
  );
}

const S: Record<string, React.CSSProperties> = {
  band: { background: "rgba(90,120,180,0.05)", border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.md, padding: `${SPACE.sm}px ${SPACE.md}px`, marginBottom: SPACE.md },
  head: { display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 6 },
  eyebrow: { ...TYPE.micro, fontSize: 8.5, color: COLOR.accent },
  note: { fontSize: 9.5, color: COLOR.textFaint },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 8 },
  axis: { background: "rgba(20,28,48,0.5)", border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.sm, padding: "7px 9px" },
  axisHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 },
  axisFoot: { fontSize: 9, color: COLOR.textFaint, marginTop: 4, lineHeight: 1.4 },
  possible: { marginTop: SPACE.sm, paddingTop: SPACE.sm, borderTop: `1px solid ${COLOR.border}` },
  possibleRow: { display: "flex", flexWrap: "wrap", gap: 6, margin: "5px 0" },
  chip: { fontSize: 10, color: COLOR.textDim, border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.pill, padding: "2px 9px" },
  rule: { fontSize: 9.5, color: COLOR.textFaint, lineHeight: 1.55, background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: RADIUS.sm, padding: "5px 8px" },
};
