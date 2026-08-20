/**
 * THE ORIENTATION BAND — one implementation, seven terminals.
 *
 * It answers five questions in the order a person actually asks them:
 *
 *   1. Who am I?                    PERSON, at title size
 *   2. What layer am I reading?     PERSON / GROUP / NETWORK / SYSTEM
 *   3. What is actually known?      resolved fields, at body size
 *   4. What is not known?           unknown fields, quiet but present
 *   5. What is NEARBY evidence?     group values — adjacent, never promoted
 *
 * ── WHY IT TAKES ONLY A CONTEXT ────────────────────────────────────────
 * The old strip was handed four separately decided props and produced three
 * different answers for one session. This takes `ResolvedViewerContext` and a
 * `scale`, and nothing else. There is no prop through which a terminal could
 * pass a semantic override, so "one answer everywhere" is enforced by the
 * signature rather than by everyone remembering.
 *
 * `scale` is the exception, and it is deliberate: it is NAVIGATION state —
 * which layer this screen reads — not a claim about the user's model. It is
 * derived from the surface, never from evidence, and it never touches
 * `active_domain`.
 *
 * ── HIERARCHY, NOT SIX EQUAL PILLS ─────────────────────────────────────
 * The measured failure was that every field rendered at the same 10px weight,
 * so six mostly-UNKNOWN metadata slots competed with the one or two facts
 * that were real. Here: person and scale are primary; resolved context is
 * secondary at body size; unknowns are tertiary and quiet; adjacent evidence
 * is separated by a rule so it can never read as the person's own.
 *
 * Absence stays visible — UNKNOWN is a real answer in PHILOS and hiding it
 * would be worse than shouting it — but it stops competing.
 */
import { COLOR, FS, RADIUS, SPACE, STATUS, TYPE } from "./designTokens";
import type { ContextField, ResolvedViewerContext } from "../context/resolvedViewerContext";

/** The layer this screen reads. Navigation state, stated as such. */
export type ViewScale = "PERSON" | "GROUP" | "NETWORK" | "SYSTEM";

/** Epistemic status → its one visual treatment. No decorative colour. */
const STATUS_TONE: Record<ContextField["status"], { fg: string; bg: string; label: string }> = {
  RESOLVED:    { fg: STATUS.real.text,     bg: STATUS.real.bg,     label: "REAL" },
  DERIVED:     { fg: "#8fa3c9",            bg: "rgba(143,163,201,0.12)", label: "DERIVED" },
  CANDIDATE:   { fg: STATUS.claimed.text,  bg: STATUS.claimed.bg,  label: "CANDIDATE" },
  UNKNOWN:     { fg: COLOR.textFaint,      bg: "transparent",      label: "UNKNOWN" },
  CONFLICTING: { fg: STATUS.blocked.text,  bg: STATUS.blocked.bg,  label: "CONFLICTING" },
};

const SCALE_GLOSS: Record<ViewScale, string> = {
  PERSON:  "האדם עצמו",
  GROUP:   "קבוצת ערך",
  NETWORK: "הרשת",
  SYSTEM:  "המערכת הרחבה",
};

export default function OrientationBand({
  ctx, scale, surfaceTitle, accent,
}: {
  /** The ONE canonical context. Never reinterpreted here. */
  ctx: ResolvedViewerContext;
  /** Which layer this screen reads. Navigation state, not evidence. */
  scale: ViewScale;
  /** This terminal's own name — the primary visual anchor of the screen. */
  surfaceTitle: string;
  accent: string;
}) {
  const fields: { label: string; field: ContextField }[] = [
    { label: "ערך אישי · VALUE", field: ctx.personal_value },
    { label: "דומיין פעיל · ACTIVE DOMAIN", field: ctx.active_domain },
    { label: "מסגרת יחוס · REFERENCE", field: ctx.reference },
    { label: "קבוצת יחוס · REFERENCE GROUP", field: ctx.reference_group },
    { label: "פרויקט · PROJECT", field: ctx.project },
  ];
  const resolved = fields.filter((f) => f.field.value !== null);
  const unresolved = fields.filter((f) => f.field.value === null);

  return (
    <section dir="rtl" style={S.band} aria-label="אוריינטציה">
      {/* ── 1 + 2 · WHO, and WHICH LAYER ───────────────────────────────── */}
      <div style={S.head}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ ...S.title, color: COLOR.text }}>{surfaceTitle}</h1>
          <div style={S.person}>
            <span style={S.personLabel}>PERSON</span>
            <span style={S.personId}>{ctx.subject_id}</span>
          </div>
        </div>

        {/* The layer, as a mark rather than a small uppercase label — the
            audit's finding was that scale was legible only by reading. */}
        <div style={{ ...S.scale, borderColor: `${accent}66`, background: `${accent}14` }}>
          <span style={{ ...S.scaleName, color: accent }}>{scale}</span>
          <span style={S.scaleGloss}>{SCALE_GLOSS[scale]}</span>
        </div>
      </div>

      {/* ── 3 · WHAT IS KNOWN — body size, full strength ────────────────── */}
      {resolved.length > 0 ? (
        <div style={S.known}>
          {resolved.map(({ label, field }) => (
            <div key={label} style={S.knownItem} title={field.because}>
              <span style={S.fieldLabel}>{label}</span>
              <span style={S.knownValue}>{field.value}</span>
              <span style={{ ...S.statusTag, color: STATUS_TONE[field.status].fg, background: STATUS_TONE[field.status].bg }}>
                {STATUS_TONE[field.status].label}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {/* ── 4 · WHAT IS NOT KNOWN — present, quiet, never competing ─────── */}
      {unresolved.length > 0 ? (
        <div style={S.unknown}>
          <span style={S.unknownLead}>לא ידוע</span>
          {unresolved.map(({ label, field }) => (
            <span key={label} style={S.unknownItem} title={field.because}>
              {label.split(" · ")[0]}
              <span style={S.unknownMark}>—</span>
            </span>
          ))}
        </div>
      ) : null}

      {/* ── 5 · ADJACENT EVIDENCE — separated by a rule, on purpose ─────── */}
      {ctx.group_values.length > 0 ? (
        <div style={S.adjacent}>
          <span style={S.adjacentLead}>ראיה סמוכה</span>
          {ctx.group_values.map((g) => (
            <span key={g.group_id} style={S.adjacentItem}
                  title={`ערך שהקבוצה מחזיקה · הוצהר על ידי ${g.declared_by} · ${g.declaration_status}`}>
              <span style={S.fieldLabel}>ערך הקבוצה · GROUP VALUE</span>
              <span style={S.adjacentValue}>{g.label}</span>
            </span>
          ))}
          <span style={S.adjacentNote}>
            ערך שקבוצה מחזיקה אינו הערך האישי של הצופה — שתי עובדות נפרדות.
          </span>
        </div>
      ) : null}
    </section>
  );
}

const S: Record<string, React.CSSProperties> = {
  band: {
    display: "flex", flexDirection: "column", gap: SPACE.md,
    padding: `${SPACE.md}px 0 ${SPACE.md}px`,
  },

  head: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: SPACE.lg, flexWrap: "wrap" },

  /* THE primary visual anchor. Every surface's largest text is now its own
     name — the audit found it was a bare number or a middot on all seven. */
  title: { ...TYPE.display, fontSize: FS.title, margin: 0 },

  person: { display: "flex", alignItems: "baseline", gap: SPACE.sm, marginTop: 6 },
  personLabel: { ...TYPE.micro, fontSize: FS.tag, color: COLOR.textFaint },
  personId: {
    fontSize: FS.read, fontWeight: 700, color: COLOR.textDim,
    fontFamily: "ui-monospace, monospace", direction: "ltr", unicodeBidi: "isolate",
  },

  scale: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
    border: "1px solid", borderRadius: RADIUS.md, padding: `${SPACE.sm}px ${SPACE.md}px`,
    flexShrink: 0,
  },
  scaleName: { fontSize: FS.head, fontWeight: 800, letterSpacing: 1.6, lineHeight: 1.1 },
  scaleGloss: { ...TYPE.micro, fontSize: FS.tag, color: COLOR.textFaint, textTransform: "none" },

  known: { display: "flex", gap: SPACE.lg, flexWrap: "wrap", alignItems: "baseline" },
  knownItem: { display: "flex", alignItems: "baseline", gap: SPACE.sm },
  fieldLabel: { ...TYPE.micro, fontSize: FS.tag, color: COLOR.textFaint },
  knownValue: {
    fontSize: FS.read, fontWeight: 700, color: COLOR.text,
    fontFamily: "ui-monospace, monospace", direction: "ltr", unicodeBidi: "isolate",
  },
  statusTag: {
    ...TYPE.micro, fontSize: FS.tag, fontWeight: 800,
    padding: "2px 7px", borderRadius: RADIUS.pill,
  },

  unknown: { display: "flex", gap: SPACE.md, flexWrap: "wrap", alignItems: "baseline", opacity: 0.72 },
  unknownLead: { ...TYPE.micro, fontSize: FS.tag, color: COLOR.textFaint },
  unknownItem: { display: "inline-flex", alignItems: "baseline", gap: 5, fontSize: FS.meta, color: COLOR.textFaint },
  unknownMark: { color: COLOR.textFaint, fontWeight: 700 },

  adjacent: {
    display: "flex", gap: SPACE.md, flexWrap: "wrap", alignItems: "baseline",
    borderTop: `1px solid ${COLOR.border}`, paddingTop: SPACE.sm,
  },
  adjacentLead: { ...TYPE.micro, fontSize: FS.tag, color: COLOR.textFaint },
  adjacentItem: { display: "inline-flex", alignItems: "baseline", gap: SPACE.sm },
  adjacentValue: { fontSize: FS.read, fontWeight: 600, color: COLOR.textDim },
  adjacentNote: { fontSize: FS.tag, color: COLOR.textFaint, marginInlineStart: "auto" },
};
