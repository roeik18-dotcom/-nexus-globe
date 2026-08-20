/**
 * SYSTEM ROLE RAIL — the seven canonical colour ROLES, and whether each is
 * currently carried by a real record.
 *
 * ── What this is grounded in ───────────────────────────────────────────
 *
 * Every role name, function and question below is copied verbatim from the
 * frozen Colour Source Lock (`canonical/data/color.master.json`,
 * `PHILOS_COLOR_MONSTER_SOURCE_LOCK_v1.0.xlsx`, 7 records). Nothing here is
 * a design opinion, and nothing is inferred from CSS.
 *
 * ── What it deliberately does NOT do ───────────────────────────────────
 *
 * **It draws no flow between colours.** The Source Lock's own
 * `EXPLICIT_SOURCE_RELATIONS` field contains only each colour's OWN
 * function text, and `SYMBOLIC_RELATIONS` only a body-position analogy.
 * There is no source-stated transition, cycle or ordering BETWEEN colours
 * anywhere in the lock. The one ordering the source does give —
 * `ORDER_INDEX` 1..7 — is an ENERGY ordering (RED "Maximum-energy layer"
 * → WHITE "Zero-energy layer"), not a process cycle. This rail therefore
 * renders the roles in that documented energy order and connects nothing.
 *
 * **It is not a score.** "Carried" means at least one real record exists
 * that the role's own canonical function describes. It never means the
 * role is going well, and the roles are never summed or compared.
 *
 * **Colour stays routing metadata** (`Cell_ID != Color_ID`, master §7). A
 * role being carried says nothing about any 3x3 cell, level or stability.
 */
import { COLOR, COLOR_ROLE, FS, RADIUS, SPACE, TYPE } from "./designTokens";

/** Verbatim from the Colour Source Lock, in its own ORDER_INDEX order. */
const ROLES = [
  { id: 6, key: "red",    glyph: "🔴", name: "RED",    fn: "Action / Maximum-energy layer",   q: "What acts now?",              hex: COLOR_ROLE.red },
  { id: 5, key: "orange", glyph: "🟠", name: "ORANGE", fn: "Drive / Momentum layer",          q: "What keeps it moving?",       hex: COLOR_ROLE.orange },
  { id: 4, key: "yellow", glyph: "🟡", name: "YELLOW", fn: "Transition / Transformation layer", q: "What changes state?",       hex: COLOR_ROLE.yellow },
  { id: 3, key: "green",  glyph: "🟢", name: "GREEN",  fn: "Human expression / Connection layer", q: "Who communicates or connects?", hex: COLOR_ROLE.green },
  { id: 2, key: "blue",   glyph: "🔵", name: "BLUE",   fn: "Structure / Logic layer",         q: "How is it organized?",        hex: COLOR_ROLE.blue },
  { id: 1, key: "purple", glyph: "🟣", name: "PURPLE", fn: "Meaning / Vision layer",          q: "What does this mean or become?", hex: COLOR_ROLE.purple },
  { id: 0, key: "white",  glyph: "⚪", name: "WHITE",  fn: "Reference / Zero-energy layer",   q: "What is known or fixed?",     hex: COLOR_ROLE.white },
] as const;

export type RoleKey = (typeof ROLES)[number]["key"];

/** What real records carry each role. Every value is a COUNT of real
 *  records the caller already resolved — this component reads nothing. */
export interface SystemRoleEvidence {
  /** RED — recorded Actions. */
  red: number;
  /** ORANGE — no record type in this system describes mobilization/
   *  momentum; honestly `null`, never 0-as-if-checked. */
  orange: null;
  /** YELLOW — persisted State transitions. Structurally 0 today: no
   *  canonical persistence/update contract for State' exists
   *  (`canon/STATE-TRANSITION-BOUNDARY.md`). */
  yellow: number;
  /** GREEN — verified group/relation records. */
  green: number;
  /** BLUE — classification results present (contradiction classes). */
  blue: number;
  /** PURPLE — explicit value claims / value-family matches. */
  purple: number;
  /** WHITE — evidence records (verified/claimed OutcomeVerifications). */
  white: number;
}

export default function SystemRoleRail({ evidence }: { evidence: SystemRoleEvidence }) {
  return (
    <section dir="rtl" style={S.band}>
      <div style={S.head}>
        <span style={S.eyebrow}>תפקידי מערכת · SYSTEM ROLES — Colour Source Lock, 7 רשומות</span>
        <span style={S.note}>נשא/לא נשא ברשומה אמיתית · אינו ציון</span>
      </div>

      <div dir="ltr" style={S.rail}>
        {ROLES.map((r) => {
          const v = evidence[r.key as RoleKey] as number | null;
          const carried = typeof v === "number" && v > 0;
          const unchecked = v === null;
          return (
            <div
              key={r.key}
              title={`${r.fn}\n${r.q}\nCOLOR_ID ${r.id} — verbatim from the Colour Source Lock`}
              style={{
                ...S.role,
                borderColor: carried ? `${r.hex}88` : COLOR.border,
                background: carried ? `${r.hex}12` : "transparent",
                opacity: carried ? 1 : 0.6,
              }}
            >
              <span style={{ fontSize: 13 }}>{r.glyph}</span>
              <span style={{ ...TYPE.micro, fontSize: FS.tag, color: carried ? r.hex : COLOR.textFaint }}>{r.name}</span>
              <span style={{ fontSize: FS.tag, color: COLOR.textFaint, textAlign: "center", lineHeight: 1.25 }}>
                {r.fn.replace(/ layer$/, "")}
              </span>
              <span style={{ fontSize: FS.tag, fontFamily: "ui-monospace, monospace", color: carried ? COLOR.text : "#8798b8" }}>
                {unchecked ? "UNKNOWN" : v}
              </span>
            </div>
          );
        })}
      </div>

      <div style={S.footer}>
        סדר התצוגה הוא <b>סדר האנרגיה</b> של ה-Source Lock (ORDER_INDEX 1→7, RED “Maximum-energy”
        → WHITE “Zero-energy”). <b>אין כאן זרימה בין צבעים</b> — ה-Source Lock אינו קובע שום
        יחס, מעבר או מחזור בין צבע לצבע; <code>EXPLICIT_SOURCE_RELATIONS</code> מכיל רק את
        תיאור התפקיד של כל צבע לעצמו. צבע הוא routing metadata (<code>Cell_ID ≠ Color_ID</code>),
        ואינו מצב, ערך או תא.
      </div>
      <div style={S.footerGaps}>
        🟠 ORANGE — <b>UNKNOWN</b>: אין בשיטה סוג רשומה שמתאר mobilization/momentum. לא 0, לא נבדק.
        {" · "}🟡 YELLOW — מעבר מצב: <b>0 מבנית</b>, כי אין חוזה קנוני לשמירת State′
        (<code>STATE-TRANSITION-BOUNDARY.md</code>).
      </div>
    </section>
  );
}

const S: Record<string, React.CSSProperties> = {
  band: { background: "rgba(90,120,180,0.05)", border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.md, padding: `${SPACE.sm}px ${SPACE.md}px`, marginBottom: SPACE.md },
  head: { display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 6 },
  eyebrow: { ...TYPE.micro, fontSize: FS.tag, color: COLOR.accent },
  note: { fontSize: FS.tag, color: COLOR.textFaint },
  rail: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(88px, 1fr))", gap: 5 },
  role: { display: "flex", flexDirection: "column", alignItems: "center", gap: 2, border: "1px solid", borderRadius: RADIUS.sm, padding: "6px 4px" },
  footer: { marginTop: SPACE.sm, paddingTop: 6, borderTop: `1px solid ${COLOR.border}`, fontSize: FS.tag, color: COLOR.textFaint, lineHeight: 1.6 },
  footerGaps: { marginTop: 4, fontSize: FS.tag, color: "#fbbf24", lineHeight: 1.6 },
};
