/**
 * SOCIAL FRAME — ONE structure, rendered identically by Community, Globe and
 * World, with the material rotating by zoom.
 *
 * WHAT THIS REPLACES AND WHY. The social layer had accumulated six sibling
 * bands — zoom strip, value spine, roles strip, chronology, source spine,
 * person frame — each with its own border, eyebrow, tint and footnote. Six
 * boxes stacked vertically is accumulation, not a system: nothing aligned,
 * every band restated its own framing, and the reader had to re-orient at
 * each border. The three surfaces looked like three pages that happened to
 * share components.
 *
 * This is ONE bordered structure with internal lanes on a SHARED COLUMN GRID.
 * Every lane uses the same left gutter for its label and the same right rail
 * for its provenance, so the eye tracks one axis down the whole frame instead
 * of restarting six times. That shared axis is the unification — the lanes
 * are regions of one object, not neighbours.
 *
 * THE MATERIAL ROTATES, THE STRUCTURE DOES NOT. Community, Globe and World
 * pass the same props and get the same lanes in the same order. What changes
 * is scope: which chronology entries are in view, which counts are real, and
 * which lanes have anything to say. A lane with nothing to say says so in
 * place — it does not disappear, because a missing lane and an empty lane
 * mean different things and only one of them is a fact about the data.
 *
 * FLOW. The lanes are ordered as the system actually runs, top to bottom:
 *   WHERE   this zoom, and what the other two hold
 *   VALUE   contradictions -> ... -> membership (product organisation, not
 *           a causal derivation)
 *   ROLES   RED / WHITE / GREEN / PURPLE, real counts only
 *   TIME    the one chronology, filtered to this zoom
 *   SOURCE  provenance and taxonomy, collapsed
 *
 * Colour discipline unchanged: PRODUCT_FAMILY_CUE tints the frame as a family
 * container; canonical roles are never restated by it.
 */
import type { ReactNode } from "react";

import { atScope, SCOPE_OF_SURFACE, type ChronoEntry, type ChronoScope } from "../social/socialChronology";
import { ABSENCE_TEXT, type Scale, type SocialObject } from "../social/socialSystemProjection";
import { withSelection, type SocialSelection } from "../social/socialSelection";
import type { SpineLink } from "../valueSystem/socialValueSpine";
import { COLOR, COLOR_ROLE, PRODUCT_FAMILY_CUE, RADIUS, SPACE, TYPE } from "./designTokens";

export type SocialSurface = "community" | "globe" | "world";

const ZOOM: { key: SocialSurface; label: string; level: ChronoScope }[] = [
  { key: "community", label: "Community", level: "GROUP" },
  { key: "globe", label: "Globe", level: "NETWORK" },
  { key: "world", label: "World", level: "SYSTEM" },
];

const KIND_COLOR: Record<string, string> = {
  action: COLOR_ROLE.red, effect: COLOR_ROLE.red,
  observation: COLOR_ROLE.white, need: COLOR_ROLE.orange, offer: COLOR_ROLE.orange,
  "member.joined": COLOR_ROLE.green, "leader.appointed": COLOR_ROLE.green,
  "group.opened": COLOR_ROLE.green, "transfer.completed": COLOR_ROLE.yellow,
};

export interface SocialRoles {
  action: number | null; evidence: number | null;
  relations?: number | null; meaning?: number | null;
}

export default function SocialFrame({
  surface, spine, roles, chronology, chronoLimit = 6, audit, primary, selection, objects = [],
}: {
  surface: SocialSurface;
  spine: SpineLink[];
  roles: SocialRoles;
  chronology: ChronoEntry[];
  chronoLimit?: number;
  /** Source/provenance material — collapsed, never removed. */
  audit?: ReactNode;
  /** This surface's own primary content, rendered inside the frame so the
   *  frame reads as the surface rather than a header sitting above it. */
  primary?: ReactNode;
  /** The one selected object, shared across all three scales. */
  selection?: SocialSelection;
  /** The unified projection — one identity, three representations. */
  objects?: SocialObject[];
}) {
  const scope = SCOPE_OF_SURFACE[surface];
  const here = atScope(chronology, scope);
  const counts: Record<ChronoScope, number> = {
    GROUP: atScope(chronology, "GROUP").length,
    NETWORK: atScope(chronology, "NETWORK").length,
    SYSTEM: atScope(chronology, "SYSTEM").length,
  };
  const shown = [...here].reverse().slice(0, chronoLimit);
  const span = chronology.length > 0
    ? `${chronology[0].at.slice(0, 10)} → ${chronology[chronology.length - 1].at.slice(0, 10)}`
    : "—";

  return (
    <section dir="rtl" style={S.frame}>
      {/* WHERE ─────────────────────────────────────────────────────── */}
      <div style={S.lane}>
        <span style={S.gutter}>WHERE</span>
        <div style={S.body}>
          <div style={S.zoomRow}>
            {ZOOM.map((z, i) => (
              <span key={z.key} style={S.zoomCell}>
                {i > 0 ? <span style={S.arrow} aria-hidden>→</span> : null}
                <span style={{ ...S.zoom, ...(z.key === surface ? S.zoomHere : null) }}>
                  <b style={S.zoomLevel}>{z.level}</b> {z.label}
                  <span style={S.zoomN}>{counts[z.level]}</span>
                </span>
              </span>
            ))}
          </div>
          <div style={S.note}>
            זום מוצר — לא שרשרת סיבתית ולא יחס קנוני. אותו ציר בשלושתם; רק ההיקף משתנה.
          </div>
        </div>
        <span style={S.rail}>{span}</span>
      </div>

      {/* SELECTED — the SAME object at all three scales ───────────── */}
      {selection && selection.status !== "none" ? (
        <div style={S.lane}>
          <span style={S.gutter}>OBJECT</span>
          <div style={S.body}>
            {selection.status === "unresolved" ? (
              <div style={S.empty}>
                <code style={S.tId}>{selection.record_id}</code> — UNRESOLVED. הבחירה מצביעה על רשומה
                שאינה בהקרנה. זו עובדה שמוצגת, לא מסך ריק.
              </div>
            ) : (
              <>
                <div style={S.selHead}>
                  <span style={{ ...S.tDot, background: KIND_COLOR[selection.object.kind] ?? COLOR.textFaint }} />
                  <span style={S.tKind}>{selection.object.kind}</span>
                  <span style={S.tLabel}>{selection.object.label}</span>
                  <code style={S.tId}>{selection.object.record_id}</code>
                  <span style={{ ...S.tVerif, color: selection.object.verification === "VERIFIED" ? COLOR_ROLE.green : COLOR.textFaint }}>
                    {selection.object.verification}
                  </span>
                  <span style={S.tVerif}>{selection.object.provenance}</span>
                </div>
                <div style={S.scaleRow}>
                  {(["GROUP", "NETWORK", "SYSTEM"] as Scale[]).map((sc) => {
                    const p = selection.object.scales[sc];
                    return (
                      <span key={sc} style={{ ...S.scaleCell, opacity: p.present ? 1 : 0.62 }}
                            title={p.present ? p.as : p.absent_because ? ABSENCE_TEXT[p.absent_because] : ""}>
                        <b style={{ ...S.zoomLevel, color: p.present ? COLOR_ROLE.green : COLOR.textFaint }}>{sc}</b>
                        <span style={S.scaleAs}>
                          {p.present ? (p.as ?? "present") : (p.absent_because ? ABSENCE_TEXT[p.absent_because] : "absent")}
                        </span>
                      </span>
                    );
                  })}
                </div>
                {selection.object.source_record_ids.length > 0 ? (
                  <div style={S.note}>
                    הפניות מתועדות: {selection.object.source_record_ids.map((r) => (
                      <code key={r} style={S.tId}>{r} </code>
                    ))}
                  </div>
                ) : (
                  <div style={S.note}>אין הפניה מתועדת ברשומה — ולכן אין קישור מצויר.</div>
                )}
              </>
            )}
          </div>
          <span style={S.rail}>SELECTED</span>
        </div>
      ) : null}

      {/* VALUE ─────────────────────────────────────────────────────── */}
      <div style={S.lane}>
        <span style={S.gutter}>VALUE</span>
        <div style={S.body}>
          <div style={S.spineRow}>
            {spine.map((l, i) => (
              <span key={l.key} style={S.spineCell}>
                {i > 0 ? <span style={S.arrow} aria-hidden>→</span> : null}
                <span style={S.spineItem} title={`${l.gloss}\n${l.basis}\nלא נובע: ${l.not_implied}`}>
                  <b style={{ ...S.spineN, color: l.count === null ? COLOR.textFaint : COLOR.text }}>
                    {l.count === null ? "—" : l.count}
                  </b>
                  <span style={S.spineLabel}>{l.label}</span>
                  <span style={S.spineStatus}>{l.status}</span>
                </span>
              </span>
            ))}
          </div>
          <div style={S.note}>
            ארגון מוצר של מושגים קיימים. <b>SOURCE ≠ REAL</b> — מספר גדול מציין מלאי מקור, לא ישויות אמיתיות.
          </div>
        </div>
        <span style={S.rail}>SPINE</span>
      </div>

      {/* ROLES ─────────────────────────────────────────────────────── */}
      <div style={S.lane}>
        <span style={S.gutter}>ROLES</span>
        <div style={S.body}>
          <div style={S.roleRow}>
            <Role glyph="🔴" name="RED" v={roles.action} hex={COLOR_ROLE.red} what="Action / Effect" />
            <Role glyph="⚪" name="WHITE" v={roles.evidence} hex={COLOR_ROLE.white} what="ראיה / פרובננס" />
            <Role glyph="🟢" name="GREEN" v={roles.relations ?? null} hex={COLOR_ROLE.green} what="קשרים מתועדים" />
            <Role glyph="🟣" name="PURPLE" v={roles.meaning ?? null} hex={COLOR_ROLE.purple} what="פרשנות ערך" />
          </div>
          <div style={S.note}>
            תפקידים בתוך המסוף — לא מסופים ולא זרימה סיבתית בין צבעים.
            GREEN הוא קשר מתועד בלבד; דמיון אינו קשר. <b>UNKNOWN ≠ 0</b>.
          </div>
        </div>
        <span style={S.rail}>INTERNAL</span>
      </div>

      {/* TIME ──────────────────────────────────────────────────────── */}
      <div style={S.lane}>
        <span style={S.gutter}>TIME</span>
        <div style={S.body}>
          {shown.length === 0 ? (
            <div style={S.empty}>
              אין רשומה שמגיעה לזום הזה — זו תשובה, לא חוסר.
              {scope === "SYSTEM" ? " אין רשומה עם רלוונטיות מערכתית מאומתת." : ""}
            </div>
          ) : shown.map((e) => (
            <a key={e.record_id} href={withSelection(surfaceHref(surface), e.record_id)}
               style={{ ...S.tRow, ...(selection?.status === "resolved" && selection.record_id === e.record_id ? S.tRowHere : null) }}>
              <span style={S.tAt}>{e.at.slice(5, 16).replace("T", " ")}</span>
              <span style={{ ...S.tDot, background: KIND_COLOR[e.kind] ?? COLOR.textFaint }} />
              <span style={S.tKind}>{e.kind}</span>
              <span style={S.tLabel}>{e.label}</span>
              {e.references.length > 0 ? <span style={S.tRef}>→ {e.references.length}</span> : null}
              <span style={{ ...S.tVerif, color: e.verification === "VERIFIED" ? COLOR_ROLE.green : COLOR.textFaint }}>
                {e.verification}
              </span>
              <span style={S.tId}>{e.record_id.slice(0, 20)}</span>
            </a>
          ))}
          <div style={S.note}>
            סדר לפי חותמות זמן בלבד — <b>כרונולוגיה אינה סיבתיות</b>. רק הפניה מתועדת ברשומה היא קישור.
            {here.length > shown.length ? ` ועוד ${here.length - shown.length} בזום הזה.` : ""}
          </div>
        </div>
        <span style={S.rail}>{here.length}/{chronology.length}</span>
      </div>

      {/* PRIMARY — this surface's own content, inside the frame ─────── */}
      {primary ? (
        <div style={S.lane}>
          <span style={S.gutter}>NOW</span>
          <div style={S.body}>{primary}</div>
          <span style={S.rail}>{scope}</span>
        </div>
      ) : null}

      {/* SOURCE ────────────────────────────────────────────────────── */}
      {audit ? (
        <div style={{ ...S.lane, borderBottom: "none" }}>
          <span style={S.gutter}>SOURCE</span>
          <div style={S.body}>
            <details>
              <summary style={S.auditSummary}>מקור · פרובננס · טקסונומיה — AUDIT</summary>
              <div style={{ marginTop: 6 }}>{audit}</div>
            </details>
          </div>
          <span style={S.rail}>AUDIT</span>
        </div>
      ) : null}
    </section>
  );
}

function Role({ glyph, name, v, hex, what }: { glyph: string; name: string; v: number | null; hex: string; what: string }) {
  const has = v !== null && v > 0;
  return (
    <span title={what} style={{ ...S.role, borderColor: has ? `${hex}55` : COLOR.border, background: has ? `${hex}10` : "transparent" }}>
      <span style={{ fontSize: 9 }}>{glyph}</span>
      <span style={{ ...TYPE.micro, fontSize: 7.5, color: has ? hex : COLOR.textFaint }}>{name}</span>
      <b style={{ fontSize: 11, fontFamily: "ui-monospace, monospace", color: has ? COLOR.text : "#8798b8" }}>
        {v === null ? "UNKNOWN" : v}
      </b>
    </span>
  );
}

/* ONE COLUMN GRID for every lane: a fixed left gutter for the lane name, a
   flexible body, a fixed right rail for provenance/scope. This is what makes
   the frame read as one object rather than stacked boxes. */
function surfaceHref(s: SocialSurface): string {
  return s === "community" ? "/hub/community" : s === "globe" ? "/planet" : "/world";
}

const GUTTER = 52;
const RAIL = 78;

const S: Record<string, React.CSSProperties> = {
  frame: {
    border: `1px solid ${PRODUCT_FAMILY_CUE.borderIdle}`,
    background: PRODUCT_FAMILY_CUE.bgIdle,
    borderRadius: RADIUS.md,
    marginBottom: SPACE.md,
    overflow: "hidden",
  },
  lane: {
    display: "flex", alignItems: "flex-start", gap: 10,
    padding: "7px 12px",
    borderBottom: `1px solid ${COLOR.border}`,
  },
  gutter: {
    ...TYPE.micro, fontSize: 8, letterSpacing: 1.3, color: PRODUCT_FAMILY_CUE.label,
    width: GUTTER, flexShrink: 0, paddingTop: 3,
  },
  body: { flex: 1, minWidth: 0 },
  rail: {
    ...TYPE.micro, fontSize: 7.5, color: COLOR.textFaint,
    width: RAIL, flexShrink: 0, textAlign: "start", paddingTop: 3,
    fontFamily: "ui-monospace, monospace",
  },
  note: { fontSize: 8.5, color: COLOR.textFaint, lineHeight: 1.55, marginTop: 3 },

  zoomRow: { display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" },
  zoomCell: { display: "flex", alignItems: "center", gap: 2 },
  arrow: { fontSize: 9, color: COLOR.textFaint, padding: "0 3px" },
  zoom: { display: "inline-flex", alignItems: "baseline", gap: 5, padding: "2px 8px", borderRadius: RADIUS.sm, border: "1px solid transparent", fontSize: 10, color: COLOR.textFaint },
  zoomHere: { background: PRODUCT_FAMILY_CUE.bgActive, border: `1px solid ${PRODUCT_FAMILY_CUE.borderActive}`, color: COLOR.text },
  zoomLevel: { ...TYPE.micro, fontSize: 7.5, letterSpacing: 1 },
  zoomN: { fontFamily: "ui-monospace, monospace", fontSize: 10, color: COLOR.textDim },

  spineRow: { display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" },
  spineCell: { display: "flex", alignItems: "center", gap: 2 },
  spineItem: { display: "inline-flex", alignItems: "baseline", gap: 4, padding: "2px 7px", borderRadius: RADIUS.sm, border: `1px solid ${COLOR.border}` },
  spineN: { fontSize: 12, fontFamily: "ui-monospace, monospace" },
  spineLabel: { fontSize: 8.5, color: COLOR.textDim },
  spineStatus: { ...TYPE.micro, fontSize: 6.5, color: COLOR.textFaint },

  roleRow: { display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" },
  role: { display: "inline-flex", alignItems: "baseline", gap: 4, border: "1px solid", borderRadius: RADIUS.sm, padding: "2px 8px" },

  tRow: { display: "flex", alignItems: "center", gap: 7, fontSize: 9.5, padding: "1px 4px", textDecoration: "none", color: "inherit" },
  tAt: { fontFamily: "ui-monospace, monospace", fontSize: 8.5, color: COLOR.textFaint, minWidth: 70 },
  tDot: { width: 5, height: 5, borderRadius: "50%", flexShrink: 0 },
  tKind: { fontFamily: "ui-monospace, monospace", fontSize: 9, color: COLOR.textDim, minWidth: 104 },
  tLabel: { color: COLOR.text, flex: 1, minWidth: 60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  tRef: { fontSize: 8, color: COLOR_ROLE.blue },
  tVerif: { ...TYPE.micro, fontSize: 7, minWidth: 46 },
  tId: { fontFamily: "ui-monospace, monospace", fontSize: 7.5, color: COLOR.textFaint },

  empty: { fontSize: 9.5, color: COLOR.textFaint, fontStyle: "italic", lineHeight: 1.6 },
  selHead: { display: "flex", alignItems: "center", gap: 7, fontSize: 10 },
  scaleRow: { display: "flex", alignItems: "stretch", gap: 5, flexWrap: "wrap", marginTop: 4 },
  scaleCell: { display: "inline-flex", flexDirection: "column", gap: 1, border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.sm, padding: "3px 8px", maxWidth: 240 },
  scaleAs: { fontSize: 8, color: COLOR.textFaint, lineHeight: 1.4 },
  tRowHere: { background: PRODUCT_FAMILY_CUE.bgActive, borderRadius: RADIUS.sm },
  auditSummary: { cursor: "pointer", ...TYPE.micro, fontSize: 8, letterSpacing: 1, color: COLOR.textFaint, padding: "2px 0" },
};
