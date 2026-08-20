/**
 * SOCIAL CHRONOLOGY — the same real history, shown at this surface's zoom.
 *
 * All three social surfaces render THIS component with the SAME entries and a
 * different `surface`. That is what makes them read as one system: the
 * timeline is identical, only the scope filter differs (GROUP / NETWORK /
 * SYSTEM). Counts for the other two scopes stay visible, so the reader can
 * see what this zoom is NOT showing rather than mistaking a filter for an
 * absence.
 *
 * CHRONOLOGY IS NOT CAUSALITY — stated on the panel, not just in code. Order
 * comes from the records' own timestamps. Two adjacent rows are two things
 * that happened, not a cause and its effect. Only a real recorded reference
 * (`Action.inputs`, `Effect.action_ref`, the log's `caused_by`) renders as a
 * link, and it renders as a record id the reader can go check.
 */
import { atScope, SCOPE_OF_SURFACE, type ChronoEntry, type ChronoScope } from "../social/socialChronology";
import { COLOR, COLOR_ROLE, FS, RADIUS, SPACE, TYPE } from "./designTokens";

const SCOPE_LABEL: Record<ChronoScope, string> = {
  GROUP: "GROUP · קבוצה",
  NETWORK: "NETWORK · רשת",
  SYSTEM: "SYSTEM · מערכת",
};

const KIND_COLOR: Record<string, string> = {
  action: COLOR_ROLE.red,
  effect: COLOR_ROLE.red,
  observation: COLOR_ROLE.white,
  need: COLOR_ROLE.orange,
  offer: COLOR_ROLE.orange,
  "member.joined": COLOR_ROLE.green,
  "leader.appointed": COLOR_ROLE.green,
  "group.opened": COLOR_ROLE.green,
  "transfer.completed": COLOR_ROLE.yellow,
};

export default function SocialChronologyPanel({
  entries, surface, limit = 8,
}: { entries: ChronoEntry[]; surface: "community" | "globe" | "world"; limit?: number }) {
  const scope = SCOPE_OF_SURFACE[surface];
  const here = atScope(entries, scope);
  const counts: Record<ChronoScope, number> = {
    GROUP: atScope(entries, "GROUP").length,
    NETWORK: atScope(entries, "NETWORK").length,
    SYSTEM: atScope(entries, "SYSTEM").length,
  };
  // Most recent first — the reader's question is "what happened lately", and
  // the full ordered history stays one click away.
  const shown = [...here].reverse().slice(0, limit);
  const span = entries.length > 0
    ? `${entries[0].at.slice(0, 10)} → ${entries[entries.length - 1].at.slice(0, 10)}`
    : "—";

  return (
    <section dir="rtl" style={S.band}>
      <div style={S.head}>
        <span style={S.eyebrow}>ציר זמן חברתי · SOCIAL CHRONOLOGY — {SCOPE_LABEL[scope]}</span>
        <span style={S.span}>{span} · {entries.length} רשומות בסך הכל</span>
      </div>

      <div style={S.scopes}>
        {(["GROUP", "NETWORK", "SYSTEM"] as ChronoScope[]).map((s) => (
          <span key={s} style={{ ...S.scopePill, ...(s === scope ? S.scopeHere : null) }}>
            {s} <b style={{ fontFamily: "ui-monospace, monospace" }}>{counts[s]}</b>
          </span>
        ))}
        <span style={S.rule}>
          אותו ציר בשלושת המסופים — רק הזום משתנה. סדר לפי חותמות זמן בלבד:
          <b> כרונולוגיה אינה סיבתיות</b>. רק הפניה מתועדת ברשומה מוצגת כקישור.
        </span>
      </div>

      {shown.length === 0 ? (
        <div style={S.empty}>
          אין רשומה שמגיעה לזום הזה. זו תשובה, לא חוסר —
          {scope === "SYSTEM" ? " אין רשומה עם רלוונטיות מערכתית מאומתת." : " שום רשומה קיימת לא נכנסת להיקף הזה."}
        </div>
      ) : (
        shown.map((e) => (
          <div key={e.record_id} style={S.row}>
            <span style={S.at}>{e.at.slice(5, 16).replace("T", " ")}</span>
            <span style={{ ...S.dot, background: KIND_COLOR[e.kind] ?? COLOR.textFaint }} />
            <span style={S.kind}>{e.kind}</span>
            <span style={S.label}>{e.label}</span>
            <span style={{ ...S.layer, color: e.layer === "CANON" ? COLOR_ROLE.purple : COLOR.textFaint }}>{e.layer}</span>
            <span style={{
              ...S.verif,
              color: e.verification === "VERIFIED" ? COLOR_ROLE.green : COLOR.textFaint,
            }}>{e.verification}</span>
            <span style={S.id}>{e.record_id.slice(0, 22)}</span>
            {e.references.length > 0 ? (
              <span style={S.refs} title={e.references.join(" · ")}>→ {e.references.length} הפניה מתועדת</span>
            ) : null}
          </div>
        ))
      )}

      {here.length > shown.length ? (
        <div style={S.more}>ועוד {here.length - shown.length} בזום הזה</div>
      ) : null}
    </section>
  );
}

const S: Record<string, React.CSSProperties> = {
  band: { border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.md, padding: "8px 12px", background: "rgba(90,120,180,0.04)", marginBottom: SPACE.md },
  head: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  eyebrow: { ...TYPE.micro, fontSize: FS.tag, letterSpacing: 1.2, color: COLOR.textDim },
  span: { ...TYPE.micro, fontSize: FS.tag, color: COLOR.textFaint },
  scopes: { display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", margin: "5px 0 6px" },
  scopePill: { ...TYPE.micro, fontSize: FS.tag, color: COLOR.textFaint, border: `1px solid ${COLOR.border}`, borderRadius: 4, padding: "1px 6px" },
  scopeHere: { color: COLOR.text, borderColor: COLOR.borderStrong, background: "rgba(120,150,220,0.1)" },
  rule: { fontSize: FS.tag, color: COLOR.textFaint, lineHeight: 1.5, flex: 1, minWidth: 240 },
  row: { display: "flex", alignItems: "center", gap: 7, padding: "2px 0", borderTop: `1px solid ${COLOR.border}`, fontSize: 10 },
  at: { fontFamily: "ui-monospace, monospace", fontSize: FS.tag, color: COLOR.textFaint, minWidth: 74 },
  dot: { width: 6, height: 6, borderRadius: "50%", flexShrink: 0 },
  kind: { fontFamily: "ui-monospace, monospace", fontSize: FS.tag, color: COLOR.textDim, minWidth: 112 },
  label: { color: COLOR.text, flex: 1, minWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  layer: { ...TYPE.micro, fontSize: FS.tag },
  verif: { ...TYPE.micro, fontSize: FS.tag, minWidth: 52 },
  id: { fontFamily: "ui-monospace, monospace", fontSize: FS.tag, color: COLOR.textFaint },
  refs: { fontSize: FS.tag, color: COLOR_ROLE.blue },
  empty: { fontSize: 10, color: COLOR.textFaint, fontStyle: "italic", padding: "5px 0", lineHeight: 1.6 },
  more: { fontSize: FS.tag, color: COLOR.textFaint, paddingTop: 4 },
};
