/**
 * VERIFIED RELATIONS — the Globe network layer, stated as records.
 *
 * Globe draws a NETWORK. A line between two nodes is a claim that a relation
 * exists, so every arc must be able to answer four questions, and this panel
 * is where it answers them for the whole graph at once:
 *
 *   RELATION TYPE    the recorded `event_type` — never a category we assigned
 *   SOURCE RECORD    the `event_id` the arc was read from
 *   PROVENANCE       the event's own `verification_status`
 *   EPISTEMIC STATUS what that verification licenses us to say
 *
 * WHAT IS NEVER AN EDGE. No arc is drawn from shared value, shared
 * contradiction, semantic similarity, taxonomy overlap or proximity.
 * SIMILARITY IS NOT A RELATION — two groups holding the same central value are
 * not connected, and the absence of a line between them is a real statement,
 * not missing data.
 *
 * The epistemic mapping is deliberately conservative: a `verified` event
 * licenses VERIFIED; anything else stays CLAIMED. There is no scoring, no
 * confidence number and no aggregate — a count of edges is a count of records,
 * nothing more.
 */
import { COLOR, COLOR_ROLE, RADIUS, SPACE, TYPE } from "./designTokens";

export interface RelationArc {
  relation: string;
  event_id: string;
  verification_status?: string;
}

/** A bridge link surfaced alongside the drawn arcs — same four questions,
 *  different layer. `provenance` is the link's own REAL/DEMO, never upgraded. */
export interface BridgeLinkRow {
  relation: string;
  link_id: string;
  provenance: "REAL" | "DEMO";
  derived?: boolean;
}

export default function VerifiedRelationInventory(
  { arcs, bridgeLinks = [] }: { arcs: RelationArc[]; bridgeLinks?: BridgeLinkRow[] },
) {
  const byType = new Map<string, RelationArc[]>();
  for (const a of arcs) {
    const list = byType.get(a.relation) ?? [];
    list.push(a);
    byType.set(a.relation, list);
  }
  const rows = [...byType.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <div dir="rtl" style={S.box}>
      <div style={S.head}>
        <span style={S.eyebrow}>קשרים מאומתים · VERIFIED RELATIONS</span>
        <span style={S.count}>{arcs.length} קשתות · {rows.length} סוגים</span>
      </div>

      {rows.map(([type, list]) => {
        const verified = list.filter((a) => a.verification_status === "verified").length;
        return (
          <div key={type} style={S.row}>
            <span style={S.type}>{type}</span>
            <span style={S.n}>{list.length}</span>
            <span style={{ ...S.badge, color: verified > 0 ? COLOR_ROLE.white : COLOR.textFaint }}>
              {verified > 0 ? `${verified} VERIFIED` : "CLAIMED"}
            </span>
            <span style={S.ids}>{list.slice(0, 3).map((a) => a.event_id).join(" · ")}
              {list.length > 3 ? ` +${list.length - 3}` : ""}</span>
          </div>
        );
      })}

      {rows.length === 0 ? <div style={S.empty}>אין קשת מתועדת — לא מומצאת</div> : null}

      {/* BRIDGE LAYER — relations that exist as EntityLink records rather than
          as drawn arcs. Kept in a separate block, and each row states its own
          provenance, so a DEMO link can never be mistaken for a REAL one.
          A derived row names what it was composed from. */}
      {bridgeLinks.length > 0 ? (
        <>
          <div style={S.sub}>שכבת גשר · BRIDGE LINKS ({bridgeLinks.length})</div>
          {bridgeLinks.map((l) => (
            <div key={l.link_id} style={S.row}>
              <span style={S.type}>{l.relation}</span>
              <span style={{
                ...S.badge,
                color: l.provenance === "REAL" ? COLOR_ROLE.green : "#fbbf24",
              }}>{l.provenance}</span>
              {l.derived ? <span style={S.derived}>DERIVED</span> : null}
              <span style={S.ids}>{l.link_id}</span>
            </div>
          ))}
        </>
      ) : null}

      <div style={S.rule}>
        כל קשת נקראת מאירוע מתועד ונושאת event_id. אין קשת מדמיון ערכי, מניגוד משותף,
        מקרבה או מחפיפת טקסונומיה — <b>דמיון אינו קשר</b>. היעדר קו הוא אמירה, לא חוסר מידע.
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  /* Near-opaque + blur on purpose: this panel is bottom-left, the same corner
     as LEGEND, and when the user expands it, it overlays. At 0.72 alpha the
     legend read straight through it and the two texts interleaved. */
  box: { border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.md, padding: "8px 11px", background: "rgba(4,10,22,0.97)", backdropFilter: "blur(10px)", marginTop: 6 },
  head: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 5 },
  eyebrow: { ...TYPE.micro, fontSize: 8.5, letterSpacing: 1.1, color: COLOR_ROLE.green },
  count: { ...TYPE.micro, fontSize: 8, color: COLOR.textFaint },
  row: { display: "flex", alignItems: "baseline", gap: 7, padding: "2px 0", borderTop: `1px solid ${COLOR.border}` },
  type: { fontSize: 10, fontFamily: "ui-monospace, monospace", color: COLOR.textDim, minWidth: 118 },
  n: { fontSize: 11, fontWeight: 700, color: COLOR.text, minWidth: 18 },
  badge: { ...TYPE.micro, fontSize: 7.5, letterSpacing: 0.8 },
  ids: { fontSize: 8, fontFamily: "ui-monospace, monospace", color: COLOR.textFaint, marginInlineStart: "auto" },
  sub: { ...TYPE.micro, fontSize: 8, color: COLOR.textFaint, margin: "6px 0 2px", borderTop: `1px solid ${COLOR.border}`, paddingTop: 4 },
  derived: { ...TYPE.micro, fontSize: 7, letterSpacing: 0.6, color: COLOR.textFaint, border: `1px solid ${COLOR.border}`, borderRadius: 3, padding: "0 3px" },
  empty: { fontSize: 10, color: COLOR.textFaint, fontStyle: "italic", padding: "3px 0" },
  rule: { fontSize: 8.5, color: COLOR.textFaint, lineHeight: 1.55, marginTop: 5, borderTop: `1px solid ${COLOR.border}`, paddingTop: 4 },
};
