/**
 * PHILOS — EPISTEMIC PRIMITIVES: the one shared way every surface states
 * *what kind of claim* a value is.
 *
 * Contract: `PHILOS-EVIDENCE-NEXTACTION-CONTRACT.md` (A5, B4) and
 * `PHILOS-SYSTEM-LANGUAGE.md` §9. Those documents locked the vocabulary;
 * this file is the single implementation of it, so seven surfaces cannot
 * drift into seven dialects.
 *
 * Four primitives, each closing one locked rule:
 *
 *   `<Stance>`      CLAIMED ≠ VERIFIED ≠ UNVERIFIABLE  (canon §17)
 *   `<Measurement>` MEASURED ≠ MENTIONED               (Person Contract §6)
 *   `<Epistemic>`   UNKNOWN ≠ UNRESOLVED ≠ NOT_APPLICABLE
 *   `<ScopedNextAction>` a next action without `scope` may not render (B4)
 *
 * Plus two DISPLAY primitives that state the same distinctions visually
 * rather than only in words — `EPISTEMIC_WEIGHT` (below) and
 * `<OpenBoundaryMark>`. Both are display hierarchy ONLY: no weight is a
 * score, no weight is ever compared, summed, sorted on, or persisted.
 *
 * Nothing here reads data, derives anything, or changes a value. Every
 * component takes a status its caller already resolved and renders it in the
 * one agreed treatment.
 */
import { COLOR, RADIUS, TYPE } from "./designTokens";
import { ProvenanceBadge, type Provenance } from "./provenance";

// ── A. STANCE — canon §17: a claimed outcome must never render as verified ──

/**
 * `UNVERIFIABLE` is not "not yet verified". It means the schema behind this
 * value **has no verification axis at all** (e.g. `DomainState.evidence`,
 * PUDM `EvidenceGrade`). Without this third value those rows would render as
 * claims when they claim nothing.
 */
export type EvidenceStance = "CLAIMED" | "VERIFIED" | "UNVERIFIABLE";

const STANCE_STYLE: Record<EvidenceStance, { bg: string; border: string; text: string; he: string }> = {
  VERIFIED:     { bg: "rgba(52,211,153,0.16)", border: "rgba(52,211,153,0.5)",  text: "#34d399", he: "מאומת" },
  CLAIMED:      { bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.42)", text: "#fbbf24", he: "נטען" },
  UNVERIFIABLE: { bg: "rgba(90,111,150,0.12)", border: "rgba(90,111,150,0.38)", text: "#8798b8", he: "ללא ציר אימות" },
};

export function Stance({ stance, title }: { stance: EvidenceStance; title?: string }) {
  const s = STANCE_STYLE[stance];
  return (
    <span
      title={title ?? (stance === "UNVERIFIABLE"
        ? "לסכמה שמאחורי הערך הזה אין ציר אימות כלל — לא נטען ולא אומת"
        : undefined)}
      style={{
        fontSize: 8.5, fontWeight: 800, letterSpacing: 0.6, padding: "1px 6px",
        borderRadius: RADIUS.pill, background: s.bg, border: `1px solid ${s.border}`,
        color: s.text, fontFamily: "ui-monospace, monospace", whiteSpace: "nowrap",
      }}
    >
      {stance} · {s.he}
    </span>
  );
}

/**
 * One evidence row, in the one agreed treatment. `stance` and `origin` are
 * BOTH required — the locked rule is that an evidence row without them is
 * not rendered at all.
 */
export function EvidenceRow({ statement, stance, origin, verifierType, confidence, time, sourceId }: {
  statement: string;
  stance: EvidenceStance;
  origin: Provenance;
  verifierType?: string;
  confidence?: number;
  time?: string;
  sourceId?: string;
}) {
  return (
    <div style={{ padding: "3px 0", borderBottom: "1px solid rgba(120,150,220,0.08)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 2 }}>
        <Stance stance={stance} />
        <ProvenanceBadge p={origin} />
        <span style={{ ...TYPE.micro, color: COLOR.textFaint }}>
          {verifierType ?? "VERIFIER UNKNOWN"} · conf {confidence ?? "UNKNOWN"}
        </span>
      </div>
      <div style={{ fontSize: 11.5, color: COLOR.text, lineHeight: 1.5 }}>{statement}</div>
      {sourceId || time ? (
        <div style={{ fontSize: 9, color: COLOR.textFaint, fontFamily: "ui-monospace, monospace", direction: "ltr", textAlign: "right" }}>
          {sourceId ?? ""}{sourceId && time ? " · " : ""}{time ?? ""}
        </div>
      ) : null}
    </div>
  );
}

// ── B. MEASURED ≠ MENTIONED — Person Contract §6 ────────────────────────────

/**
 * A canon cell reading is a MEASUREMENT. A 6-Class token hit is a MENTION.
 * A mention may cite a cell; it may never create, update or select one.
 */
export function Measurement({ kind }: { kind: "MEASURED" | "MENTIONED" }) {
  const measured = kind === "MEASURED";
  return (
    <span
      title={measured
        ? "מדידה קנונית — Observation על תא (Domain × Frame), נושאת Level ו-Stability"
        : "אזכור טקסטואלי בלבד — זיהוי טוקן בטקסט התצפית. אינו מדידה ואינו קובע מצב תא."}
      style={{
        fontSize: 8.5, fontWeight: 800, letterSpacing: 0.6, padding: "1px 6px",
        borderRadius: RADIUS.pill, fontFamily: "ui-monospace, monospace", whiteSpace: "nowrap",
        background: measured ? "rgba(52,211,153,0.14)" : "rgba(167,139,250,0.12)",
        border: `1px solid ${measured ? "rgba(52,211,153,0.45)" : "rgba(167,139,250,0.4)"}`,
        color: measured ? "#34d399" : "#a78bfa",
      }}
    >
      {kind}
    </span>
  );
}

// ── C. UNKNOWN ≠ UNRESOLVED ≠ NOT_APPLICABLE ────────────────────────────────

export type EpistemicState = "UNKNOWN" | "UNRESOLVED" | "NOT_APPLICABLE";

const EPISTEMIC_HE: Record<EpistemicState, string> = {
  UNKNOWN: "אין רשומה",
  UNRESOLVED: "קיימים שני צדדים — הקשר לא הוכרע",
  NOT_APPLICABLE: "לא חל כאן",
};

/**
 * The three are different states and must never substitute for one another.
 * `reason` is required: the locked rule is that each of the three names WHY
 * — which record type is missing, which join failed, or why it does not
 * apply. An empty panel, a `—`, or a bare `0` is never acceptable.
 */
export function Epistemic({ state, reason }: { state: EpistemicState; reason: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
      <span style={{
        fontSize: 10, fontWeight: 800, letterSpacing: 0.7, color: "#8798b8",
        fontFamily: "ui-monospace, monospace",
      }}>
        {state}
      </span>
      <span style={{ fontSize: 10, color: COLOR.textFaint, fontStyle: "italic" }}>
        {EPISTEMIC_HE[state]} — {reason}
      </span>
    </span>
  );
}

// ── D. NEXT ACTION — scope is mandatory (contract B4) ───────────────────────

/**
 * `SUBJECT` = for you, now. `ENTITY` = for the selected record. `GROUP` = for
 * a value group. Two next-actions may share a screen if and only if their
 * scopes differ AND both are displayed — that is what turns a collision into
 * information.
 *
 * NEXT ACTION is a PRODUCT concept, not a canon entity (verified: it appears
 * in no canon section and in no row of the master's own system-language
 * table). Its provenance is therefore always STATIC — a rule over real
 * records — and never CANON.
 */
export type NextActionScope = "SUBJECT" | "ENTITY" | "GROUP";

const SCOPE_HE: Record<NextActionScope, string> = {
  SUBJECT: "עבורך, עכשיו",
  ENTITY: "עבור הרשומה שנבחרה",
  GROUP: "עבור הקבוצה",
};

export function ScopedNextAction({ label, reason, scope, basis, accent }: {
  label: string;
  /** Required — "do X" without "because Y" is not rendered. */
  reason: string;
  scope: NextActionScope;
  /** The real record this was derived from. Required. */
  basis?: string;
  accent?: string;
}) {
  const c = accent ?? COLOR.accent;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{
          fontSize: 8.5, fontWeight: 800, letterSpacing: 0.6, padding: "1px 7px",
          borderRadius: RADIUS.pill, background: `${c}18`, border: `1px solid ${c}55`,
          color: c, fontFamily: "ui-monospace, monospace",
        }}>
          {scope}
        </span>
        <span style={{ ...TYPE.micro, color: COLOR.textFaint }}>{SCOPE_HE[scope]}</span>
        <ProvenanceBadge p="STATIC" title="כלל מעל רשומות אמיתיות — NEXT ACTION אינו ישות קנונית" />
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: c, lineHeight: 1.5 }}>{label}</div>
      <div style={{ fontSize: 10, color: COLOR.textFaint, lineHeight: 1.45 }}>{reason}</div>
      {basis ? (
        <div style={{ fontSize: 9, color: COLOR.textFaint, fontFamily: "ui-monospace, monospace", direction: "ltr", textAlign: "right" }}>
          {basis}
        </div>
      ) : null}
    </div>
  );
}

// ── E. SECTION HEADER — every top-level section names its source kind ───────

/**
 * `PHILOS-SYSTEM-LANGUAGE.md` §9: "Technical below product" and one
 * provenance per section. Three data worlds (canon / legacy / PUDM) plus
 * config and demo share one shell; without a stamp at section level a reader
 * cannot tell which world a block came from.
 */

// ── E. EPISTEMIC WEIGHT — display hierarchy, never a score ──────────────────

/**
 * How much visual weight a value has EARNED, in three bands. This exists
 * because the surfaces had exactly one lever — present or absent — so a
 * real, verified, self-reported Observation and a card that says "we never
 * looked" arrived on screen with identical typographic authority, and the
 * reader had to parse a badge to tell them apart.
 *
 *   A  OBSERVED / REAL / VERIFIED   — a persisted record, highest weight
 *   B  DERIVED / STATIC / CLAIMED / REFERENCE / DEMO — real inputs, but the
 *      phrasing, ordering, or acceptance is ours; intermediate weight,
 *      still separated from A by provenance
 *   C  UNKNOWN / UNRESOLVED / NOT_APPLICABLE — visibly lower certainty
 *
 * **This is a DISPLAY hierarchy and nothing else.** It is not an epistemic
 * score: A/B/C are never numbers, never averaged, never ranked against each
 * other, never stored, and never used to decide what data to show — only
 * how loudly to show it. Everything at weight C stays fully present and
 * fully readable, with its own reason; lower weight must never become
 * hidden, truncated, or greyed past legibility.
 */
export type EpistemicWeight = "A" | "B" | "C";

export const EPISTEMIC_WEIGHT: Record<EpistemicWeight, {
  /** Applied to the value/statement itself. */
  text: React.CSSProperties;
  /** Applied to the container (card/row) holding it. */
  surface: React.CSSProperties;
  he: string;
}> = {
  A: {
    text: { color: COLOR.text, fontWeight: 700, fontSize: 13, lineHeight: 1.35 },
    surface: { opacity: 1, background: "linear-gradient(180deg, rgba(20,28,48,0.95), rgba(14,19,33,0.95))" },
    he: "רשומה אמיתית",
  },
  B: {
    text: { color: COLOR.textDim, fontWeight: 600, fontSize: 12, lineHeight: 1.4 },
    surface: { opacity: 0.94, background: "rgba(20,28,48,0.55)" },
    he: "נגזר / נטען / הפניה",
  },
  C: {
    text: { color: "#8798b8", fontWeight: 500, fontSize: 11, fontStyle: "italic", lineHeight: 1.45 },
    surface: { opacity: 0.82, background: "rgba(90,111,150,0.05)" },
    he: "לא ידוע / לא הוכרע",
  },
};

/**
 * The one mapping from the shared PROVENANCE vocabulary to display weight.
 * Kept here (not in `provenance.tsx`) so provenance stays a pure statement
 * of origin with no styling opinion attached to it.
 */
export function weightOfProvenance(p: Provenance): EpistemicWeight {
  if (p === "CANON" || p === "REAL") return "A";
  if (p === "UNKNOWN") return "C";
  return "B"; // LEGACY / DEMO / STATIC — real rows, our framing
}

// ── F. OPEN SYSTEM BOUNDARY — "unresolved contract", not "zero happened" ────

/**
 * An INTENDED stage whose data/persistence contract is genuinely
 * unresolved. Visually distinct from an ordinary empty card on purpose:
 * an empty card says "nothing has happened here yet, and it could", which
 * is a different — and false — statement about a stage that no code path
 * can currently populate at all.
 *
 * The live instance is Dynamics' `LEARNING` → `STATE(t1)` tail: a VERIFIED
 * Effect is not Learning and is not State(t+1), and no canonical
 * persistence/update contract for State′ exists
 * (`app/lib/philos/canon/STATE-TRANSITION-BOUNDARY.md`). The stage stays in
 * the chronology — removing it would hide the model — and says why it
 * cannot be filled.
 */
export function OpenBoundaryMark({ note }: { note?: string }) {
  return (
    <span
      title={note ?? "שלב מכוון שחוזה הנתונים/ההתמדה שלו אינו פתור — לא 'לא קרה כלום'"}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontSize: 8.5, fontWeight: 800, letterSpacing: 0.6,
        padding: "1px 6px", borderRadius: RADIUS.pill,
        background: "rgba(251,191,36,0.10)", border: "1px dashed rgba(251,191,36,0.55)",
        color: "#fbbf24", fontFamily: "ui-monospace, monospace", whiteSpace: "nowrap",
      }}
    >
      OPEN BOUNDARY
    </span>
  );
}

/** The card/row treatment that goes with `<OpenBoundaryMark>`. */
export const OPEN_BOUNDARY_SURFACE: React.CSSProperties = {
  background: "rgba(251,191,36,0.045)",
  border: "1px dashed rgba(251,191,36,0.42)",
  borderTop: "3px dashed rgba(251,191,36,0.7)",
};

// ── G. Section/audit helpers ────────────────────────────────────────────────

export function SectionHeader({ title, origin, count, accent, note }: {
  title: string;
  origin: Provenance;
  count?: number;
  accent?: string;
  note?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ ...TYPE.micro, color: accent ?? COLOR.textDim }}>
          {title}{count !== undefined ? ` (${count})` : ""}
        </span>
        <ProvenanceBadge p={origin} />
      </div>
      {note ? <div style={{ fontSize: 9.5, color: COLOR.textFaint, lineHeight: 1.4 }}>{note}</div> : null}
    </div>
  );
}

// ── F. AUDIT SECTION — one collapsed treatment for all seven terminals ──────

/**
 * `PHILOS-SYSTEM-LANGUAGE.md` §9: "Technical below product — IDs,
 * TOKEN_ONLY, raw enums, provenance codes, CANON flags and debug go down to
 * Details/Audit."
 *
 * Hub already applies this. This component is the same treatment as a shared
 * primitive so the other six terminals collapse identically rather than each
 * inventing its own `<details>` styling — which is how "seven pages, one
 * product" degrades into seven dialects.
 *
 * **Collapsed, never deleted.** Every field inside stays reachable in one
 * click, keeps its provenance stamp, and keeps its own epistemic state.
 */
export function AuditSection({ title, note, children, open }: {
  title: string;
  /** What is actually inside — so the material stays findable, not merely hidden. */
  note?: string;
  children: React.ReactNode;
  open?: boolean;
}) {
  return (
    <details open={open} style={{ margin: 0, borderBottom: "1px solid rgba(120,150,220,0.10)" }}>
      <summary style={{ cursor: "pointer", fontSize: 11, letterSpacing: 0.6, color: "#7d90b4", padding: "7px 0" }}>
        {title}
        {note ? <span style={{ color: "#4a5f85" }}> — {note}</span> : null}
      </summary>
      <div style={{ marginTop: 10, marginBottom: 12 }}>{children}</div>
    </details>
  );
}

/** The one header that opens an audit region on any terminal. */
export function AuditHeading({ accent }: { accent?: string }) {
  return (
    <div
      style={{
        fontSize: 9.5, fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase",
        color: accent ?? "#4a5f85", margin: "18px 0 2px",
        borderTop: "1px solid rgba(120,150,220,0.16)", paddingTop: 12,
      }}
    >
      פירוט · מערכת · ביקורת — DETAILS / SYSTEM / AUDIT
    </div>
  );
}
