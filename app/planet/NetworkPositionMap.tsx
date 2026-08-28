/**
 * NetworkPositionMap — GLOBE's own question, drawn.
 *
 * Globe is the NETWORK terminal, but everything it rendered about the selected
 * entity was either the shared spine (identical on all three terminals) or a
 * geographic counter — "1/177 מדינות", "3 קבוצות · 23 חברים". The one thing
 * that is genuinely Globe's, the real edge population, reached the page and
 * went only into the WebGL sphere: `projectGlobeGraph` already returns typed
 * nodes and directed arcs, each naming the event that created it.
 *
 * So this draws NETWORK POSITION: who this entity is connected to, by which
 * relation, in which direction, and how far its reach extends.
 *
 * NOTHING IS INVENTED AND NOTHING IS SIMULATED.
 *   - Every node and every edge is a real `GlobeNode`/`GlobeArc`; an arc exists
 *     only where `ARC_RELATIONS` matched a real event, and each carries its own
 *     `event_id`.
 *   - Layout is DETERMINISTIC — a ring ordered by node id, never a force
 *     simulation. A random layout would imply spatial meaning the data does not
 *     carry, and would differ between server and client render. The same
 *     reasoning `GroupNetworkView` already applies in Community.
 *   - `amount` renders only where the event recorded one. An arc with no amount
 *     is still drawn (the transfer happened) but shows no figure.
 *   - Geographic reach states resolution honestly: an entity resolved to a
 *     country polygon is NOT plottable, and says so, rather than being given a
 *     coordinate.
 */
import type { GlobeArc, GlobeNode } from "@/app/lib/philos/projectGlobeGraph";
import { COLOR, RADIUS, STATUS, TYPE } from "@/app/lib/philos/shell/designTokens";

/** One visual encoding per REAL relation type. Adding a row here is a
 *  statement about what a line means, never a styling tweak. */
const REL: Record<string, { color: string; label_he: string }> = {
  "group.opened": { color: "#5b9cf6", label_he: "פתיחת קבוצה" },
  "member.joined": { color: "#34d399", label_he: "הצטרפות" },
  "leader.appointed": { color: "#a78bfa", label_he: "מינוי תפקיד" },
  "transfer.completed": { color: "#fbbf24", label_he: "העברת משאב" },
};
const REL_FALLBACK = { color: "#5a6d92", label_he: "קשר" };

/** Node shape/size per kind — the group is the subject and reads largest. */
const NODE: Record<GlobeNode["type"], { r: number; fill: string; label_he: string }> = {
  value_group: { r: 13, fill: "#34d399", label_he: "קבוצת ערך" },
  person: { r: 6.5, fill: "#5b9cf6", label_he: "אדם" },
  value: { r: 8, fill: "#a78bfa", label_he: "ערך" },
  recipient: { r: 7, fill: "#fb923c", label_he: "נמען" },
};

export interface GeographicReach {
  countriesWithPresence: number;
  totalCountries: number;
  groupsLocated: number;
  membersLocated: number;
  plottable: number;
  /** The selected entity's own resolution, stated not upgraded. */
  precision: string | null;
  countryName: string | null;
}

const W = 760, H = 340, CX = 380, CY = 168;

export default function NetworkPositionMap({
  nodes, arcs, centerId, reach,
}: {
  nodes: readonly GlobeNode[];
  arcs: readonly GlobeArc[];
  /** The selected entity — placed at the centre. */
  centerId: string | null;
  reach: GeographicReach;
}) {
  // The centre is the selected value_group when the graph contains it.
  const centre = nodes.find((n) => n.id === centerId)
    ?? nodes.find((n) => n.type === "value_group")
    ?? null;

  // DETERMINISTIC RING. Ordered by id so the same data always draws the same
  // picture, on the server and on the client.
  const ring = nodes.filter((n) => n.id !== centre?.id).slice().sort((a, b) => a.id.localeCompare(b.id));
  const radius = ring.length > 14 ? 132 : ring.length > 7 ? 118 : 100;
  const pos = new Map<string, { x: number; y: number }>();
  if (centre) pos.set(centre.id, { x: CX, y: CY });
  ring.forEach((n, i) => {
    // Start at -90° so the first node sits at the top, then go clockwise.
    const a = (i / Math.max(1, ring.length)) * Math.PI * 2 - Math.PI / 2;
    pos.set(n.id, { x: CX + Math.cos(a) * radius * 1.45, y: CY + Math.sin(a) * radius });
  });

  const drawable = arcs.filter((a) => pos.has(a.source_id) && pos.has(a.target_id));
  const byRelation = [...new Set(arcs.map((a) => a.relation))].sort();
  const transfers = arcs.filter((a) => typeof a.amount === "number");
  const maxAmount = transfers.reduce((m, a) => Math.max(m, a.amount ?? 0), 0);

  return (
    <section dir="rtl" style={S.band}>
      <header style={S.head}>
        <div>
          <div style={S.eyebrow}>מיקום ברשת · NETWORK POSITION</div>
          <h2 style={S.title}>מי מחובר לישות הזאת, באיזה קשר, ובאיזה כיוון</h2>
        </div>
        <div style={S.headMeta}>
          <span style={S.chip}>{nodes.length} צמתים</span>
          <span style={S.chip}>{arcs.length} קשתות</span>
          <span style={{ ...S.chip, color: transfers.length ? "#fbbf24" : COLOR.textFaint }}>
            {transfers.length} תנועות משאב
          </span>
        </div>
      </header>

      {nodes.length === 0 ? (
        <div style={S.empty}>
          אין צמתים — לא נרשם אירוע חברות, מינוי או העברה עבור הישות הנבחרת.
          קשת נוצרת רק מאירוע אמיתי, ולכן רשת ריקה היא ממצא ולא חוסר נתונים.
        </div>
      ) : (
        <div dir="ltr" style={{ overflowX: "auto" }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img"
            aria-label={`רשת הישות: ${nodes.length} צמתים, ${arcs.length} קשתות`}
            style={{ display: "block", minWidth: 620 }}>
            <defs>
              {byRelation.map((rel) => (
                <marker key={rel} id={`ar-${rel.replace(/\./g, "-")}`} viewBox="0 0 10 10"
                  refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill={(REL[rel] ?? REL_FALLBACK).color} />
                </marker>
              ))}
            </defs>

            {/* EDGES FIRST, so nodes always sit on top of the lines. */}
            {drawable.map((a, i) => {
              const s = pos.get(a.source_id)!, t = pos.get(a.target_id)!;
              const enc = REL[a.relation] ?? REL_FALLBACK;
              // Curve away from the straight line so reciprocal pairs never overlap.
              const mx = (s.x + t.x) / 2, my = (s.y + t.y) / 2;
              const dx = t.x - s.x, dy = t.y - s.y;
              const len = Math.hypot(dx, dy) || 1;
              const bow = 16;
              const qx = mx - (dy / len) * bow, qy = my + (dx / len) * bow;
              // Width carries magnitude ONLY where a real amount was recorded.
              const w = a.amount && maxAmount > 0 ? 1 + (a.amount / maxAmount) * 3 : 1.2;
              return (
                <path key={`${a.event_id}-${i}`}
                  d={`M ${s.x} ${s.y} Q ${qx} ${qy} ${t.x} ${t.y}`}
                  fill="none" stroke={enc.color} strokeWidth={w} strokeOpacity={0.55}
                  markerEnd={`url(#ar-${a.relation.replace(/\./g, "-")})`}>
                  <title>{`${enc.label_he} · ${a.label}${a.amount ? ` · ${a.amount.toLocaleString()} ${a.currency ?? ""}` : ""} · ${a.timestamp.slice(0, 10)} · event=${a.event_id}`}</title>
                </path>
              );
            })}

            {/* NODES */}
            {[...(centre ? [centre] : []), ...ring].map((n) => {
              const p = pos.get(n.id)!;
              const enc = NODE[n.type];
              const isCentre = n.id === centre?.id;
              return (
                <g key={n.id}>
                  {isCentre ? (
                    <circle cx={p.x} cy={p.y} r={enc.r + 7} fill="none"
                      stroke={enc.fill} strokeOpacity={0.35} strokeWidth={1} />
                  ) : null}
                  <circle cx={p.x} cy={p.y} r={enc.r} fill={enc.fill}
                    fillOpacity={isCentre ? 0.95 : 0.8}
                    stroke="#0a0e17" strokeWidth={1.5}>
                    <title>{`${n.label} · ${enc.label_he} · ${n.id}`}</title>
                  </circle>
                  <text x={p.x} y={p.y + enc.r + 12} textAnchor="middle"
                    style={{ fontSize: isCentre ? 12 : 10.5, fontWeight: isCentre ? 800 : 600,
                      fill: isCentre ? COLOR.text : COLOR.textDim }}>
                    {n.label.length > 20 ? `${n.label.slice(0, 20)}…` : n.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {/* RELATION LEGEND — only relations that actually occur. */}
      {byRelation.length > 0 ? (
        <div style={S.legend}>
          {byRelation.map((rel) => {
            const enc = REL[rel] ?? REL_FALLBACK;
            const n = arcs.filter((a) => a.relation === rel).length;
            return (
              <span key={rel} style={S.legendItem}>
                <i style={{ inlineSize: 14, blockSize: 2, background: enc.color, display: "inline-block" }} />
                {enc.label_he} <b style={{ color: COLOR.text }}>{n}</b>
                <span style={{ color: COLOR.textFaint, fontFamily: "ui-monospace, monospace",
                  fontSize: 11 }}>{rel}</span>
              </span>
            );
          })}
        </div>
      ) : null}

      {/* GEOGRAPHIC REACH — the network's spatial extent, stated at its real
          resolution. `plottable` is the honest field: a country-resolved entity
          has no recorded coordinate and is never given one. */}
      <div style={S.reach}>
        <div style={S.eyebrow}>טווח גאוגרפי · REACH</div>
        <div style={S.reachGrid}>
          <ReachStat label="מדינות עם נוכחות"
            value={`${reach.countriesWithPresence}/${reach.totalCountries}`}
            bar={reach.totalCountries ? reach.countriesWithPresence / reach.totalCountries : 0} />
          <ReachStat label="קבוצות ממוקמות" value={String(reach.groupsLocated)} bar={null} />
          <ReachStat label="חברים ברשת" value={String(reach.membersLocated)} bar={null} />
          <ReachStat label="ניתנות לשרטוט"
            value={`${reach.plottable}/${reach.groupsLocated}`}
            bar={reach.groupsLocated ? reach.plottable / reach.groupsLocated : 0}
            note={reach.plottable === 0 ? "אין קואורדינטה שנרשמה — רזולוציה מנהלית בלבד" : undefined} />
        </div>
        <div style={{ fontSize: 12, color: COLOR.textFaint, marginBlockStart: 6 }}>
          רזולוציית הישות הנבחרת: <b style={{ color: COLOR.textDim }}>{reach.precision ?? "לא ידוע"}</b>
          {reach.countryName ? ` · ${reach.countryName}` : ""}
        </div>
      </div>
    </section>
  );
}

function ReachStat({ label, value, bar, note }: {
  label: string; value: string; bar: number | null; note?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 12, color: COLOR.textFaint }}>{label}</span>
      <span style={{ fontSize: 19, fontWeight: 800, color: COLOR.text }}>{value}</span>
      {bar !== null ? (
        <span style={{ blockSize: 4, background: "rgba(90,111,150,0.25)", borderRadius: 2,
          display: "block", overflow: "hidden" }}>
          <i style={{ display: "block", blockSize: "100%",
            inlineSize: `${Math.max(bar * 100, bar > 0 ? 2 : 0)}%`,
            background: bar > 0 ? STATUS.real.text : "transparent" }} />
        </span>
      ) : null}
      {note ? <span style={{ fontSize: 11.5, color: "#fbbf24" }}>{note}</span> : null}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  band: {
    background: "linear-gradient(180deg, rgba(52,211,153,0.06), rgba(11,15,26,0.9))",
    border: `1px solid ${COLOR.borderStrong}`, borderRadius: 20,
    padding: "16px 20px 14px", margin: "0 16px 14px",
    display: "flex", flexDirection: "column", gap: 10,
  },
  head: { display: "flex", flexWrap: "wrap", alignItems: "flex-end",
    justifyContent: "space-between", gap: 8 },
  eyebrow: { ...TYPE.micro, color: "#34d399", marginBottom: 4 },
  title: { fontSize: 15, fontWeight: 700, margin: 0, color: COLOR.text },
  headMeta: { display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" },
  chip: { fontSize: 12, fontWeight: 700, color: COLOR.textDim,
    border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.pill, padding: "2px 9px",
    fontFamily: "ui-monospace, monospace" },
  empty: { fontSize: 13, color: COLOR.textDim, lineHeight: 1.7, padding: "18px 0" },
  legend: { display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center",
    fontSize: 12.5, color: COLOR.textDim },
  legendItem: { display: "inline-flex", alignItems: "center", gap: 6 },
  reach: { borderTop: `1px solid ${COLOR.border}`, paddingBlockStart: 10 },
  reachGrid: { display: "grid", gap: "10px 20px", marginBlockStart: 6,
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" },
};
