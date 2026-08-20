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

import Link from "next/link";

import { atScope, SCOPE_OF_SURFACE, type ChronoEntry, type ChronoScope } from "../social/socialChronology";
import { ABSENCE_TEXT, type Scale, type SocialObject } from "../social/socialSystemProjection";
import { withSelection, type SocialSelection } from "../social/socialSelection";
import { spineTouchOf } from "../social/spineTouch";
import { noRoleReason, PURPLE_NEVER_ACTIVATED, roleTouchOf, type InternalRole } from "../social/roleTouch";
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

  // ONE SOURCE FOR SCOPE. `objects` is the unified projection and is the only
  // thing that knows about explicit Need->group declarations; the raw
  // chronology only sees `origin_group_id`. Counting from the chronology
  // therefore disagreed with the OBJECT lane the moment a declaration existed
  // — the header said NETWORK 10 while the selected object plainly showed
  // itself present at NETWORK. Both answers came from real code; they just
  // came from two places. Scope is now read from the projection whenever it
  // is supplied, and the chronology is used only as a fallback.
  const scopeSource: { present: (s: ChronoScope) => number } = objects.length > 0
    ? { present: (sc) => objects.filter((o) => o.scales[sc].present).length }
    : { present: (sc) => atScope(chronology, sc).length };

  const presentIds = objects.length > 0
    ? new Set(objects.filter((o) => o.scales[scope].present).map((o) => o.record_id))
    : null;
  const here = presentIds
    ? chronology.filter((e) => presentIds.has(e.record_id))
    : atScope(chronology, scope);

  const counts: Record<ChronoScope, number> = {
    GROUP: scopeSource.present("GROUP"),
    NETWORK: scopeSource.present("NETWORK"),
    SYSTEM: scopeSource.present("SYSTEM"),
  };
  const shown = [...here].reverse().slice(0, chronoLimit);
  // FLOW: OBJECT -> VALUE. Which spine link the selected record actually
  // instantiates. Usually none, and that is the point — see `spineTouch`.
  const touch = selection?.status === "resolved" ? spineTouchOf(selection.object.kind) : undefined;
  // FLOW: OBJECT -> ROLES. Which internal roles the selected record activates.
  // A record may activate more than one (a verified Effect is RED and WHITE).
  const activated = selection?.status === "resolved"
    ? roleTouchOf(selection.object.kind, selection.object.verification)
    : [];
  const litRoles = new Set<InternalRole>(activated.map((a) => a.role));
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
                <span
                  style={{
                    ...S.spineItem,
                    ...(touch?.touches && touch.key === l.key ? S.spineItemHit : null),
                  }}
                  title={`${l.gloss}\n${l.basis}\nלא נובע: ${l.not_implied}`}
                >
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
          {touch ? (
            <div style={{ ...S.note, color: touch.touches ? COLOR_ROLE.green : COLOR.textFaint }}>
              {touch.touches
                ? <>הרשומה הנבחרת ממשת את החוליה המודגשת — {touch.because}.</>
                : <>הרשומה הנבחרת אינה ממשת אף חוליה בשדרה — {touch.because}.</>}
            </div>
          ) : null}
        </div>
        <span style={S.rail}>SPINE</span>
      </div>

      {/* ROLES ─────────────────────────────────────────────────────── */}
      <div style={S.lane}>
        <span style={S.gutter}>ROLES</span>
        <div style={S.body}>
          <div style={S.roleRow}>
            <Role glyph="🔴" name="RED" v={roles.action} hex={COLOR_ROLE.red} what="Action / Effect" lit={litRoles.has("RED")} />
            <Role glyph="⚪" name="WHITE" v={roles.evidence} hex={COLOR_ROLE.white} what="ראיה / פרובננס" lit={litRoles.has("WHITE")} />
            <Role glyph="🟢" name="GREEN" v={roles.relations ?? null} hex={COLOR_ROLE.green} what="קשרים מתועדים" lit={litRoles.has("GREEN")} />
            <Role glyph="🟣" name="PURPLE" v={roles.meaning ?? null} hex={COLOR_ROLE.purple} what={PURPLE_NEVER_ACTIVATED} lit={litRoles.has("PURPLE")} />
          </div>
          <div style={S.note}>
            תפקידים בתוך המסוף — לא מסופים ולא זרימה סיבתית בין צבעים.
            GREEN הוא קשר מתועד בלבד; דמיון אינו קשר. <b>UNKNOWN ≠ 0</b>.
          </div>
          {selection?.status === "resolved" ? (
            activated.length > 0 ? (
              <div style={{ ...S.note, color: COLOR.textDim }}>
                {activated.map((a) => (
                  <div key={a.role}>
                    <b style={{ color: ROLE_HEX[a.role] }}>{a.role}</b> — {a.because}
                  </div>
                ))}
              </div>
            ) : (
              <div style={S.note}>{noRoleReason(selection.object.kind)}</div>
            )
          ) : null}
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
            <Link key={e.record_id} href={withSelection(surfaceHref(surface), e.record_id)}
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
            </Link>
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

const ROLE_HEX: Record<InternalRole, string> = {
  RED: COLOR_ROLE.red, WHITE: COLOR_ROLE.white, GREEN: COLOR_ROLE.green, PURPLE: COLOR_ROLE.purple,
};

function Role({ glyph, name, v, hex, what, lit = false }: {
  glyph: string; name: string; v: number | null; hex: string; what: string;
  /** The SELECTED record activates this role. Distinct from "has a count":
   *  a role can hold real records and not be activated by this selection. */
  lit?: boolean;
}) {
  const has = v !== null && v > 0;
  return (
    <span title={what} style={{
      ...S.role,
      borderColor: lit ? hex : has ? `${hex}55` : COLOR.border,
      background: lit ? `${hex}26` : has ? `${hex}10` : "transparent",
      boxShadow: lit ? `0 0 0 1px ${hex}55` : undefined,
    }}>
      <span style={{ fontSize: FS.meta }}>{glyph}</span>
      <span style={{ fontSize: FS.tag, fontWeight: 700, letterSpacing: 0.8, color: has ? hex : COLOR.textFaint }}>{name}</span>
      <b style={{
        fontSize: v === null ? FS.tag : FS.read,
        fontFamily: "ui-monospace, monospace",
        letterSpacing: v === null ? 0.5 : 0,
        color: has ? COLOR.text : COLOR.textDim,
      }}>
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

const GUTTER = 58;
const RAIL = 84;

/**
 * TYPE SCALE — four sizes, not ten.
 *
 * This component had accumulated TEN distinct font sizes between 6.5px and
 * 12px, chosen one at a time to make something fit. 6.5px Hebrew is not small
 * text, it is unreadable text, and ten sizes is not a hierarchy — a reader
 * cannot rank ten levels, so nothing reads as more important than anything
 * else. The frame was structurally unified but typographically flat.
 *
 * Four roles, and every value below uses one of them:
 *   READ   12    content a person actually reads — labels, timeline rows
 *   META   10.5  supporting detail — kinds, counts, provenance
 *   NOTE   10    the epistemic sentences; the floor, never smaller
 *   TAG     9    uppercase micro-labels only, where letterforms are simple
 *
 * Monospace ids sit at META: they are scanned, not read, but they are also
 * the thing a reader copies to go check a record, so they cannot be 7.5px.
 */
const FS = { read: 12, meta: 10.5, note: 10, tag: 9 } as const;

/* ONE COLUMN GRID for every lane: a fixed left gutter for the lane name, a
   flexible body, a fixed right rail for provenance/scope. This is what makes
   the frame read as one object rather than stacked boxes. */
const S: Record<string, React.CSSProperties> = {
  frame: {
    border: `1px solid ${PRODUCT_FAMILY_CUE.borderIdle}`,
    background: PRODUCT_FAMILY_CUE.bgIdle,
    borderRadius: RADIUS.md,
    marginBottom: SPACE.md,
    overflow: "hidden",
  },
  lane: {
    display: "flex", alignItems: "flex-start", gap: SPACE.md,
    padding: "9px 14px",
    borderBottom: `1px solid ${COLOR.border}`,
  },
  gutter: {
    fontSize: FS.tag, fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase",
    color: PRODUCT_FAMILY_CUE.label,
    width: GUTTER, flexShrink: 0, paddingTop: 4,
  },
  body: { flex: 1, minWidth: 0 },
  rail: {
    fontSize: FS.tag, fontWeight: 600, letterSpacing: 0.4,
    color: COLOR.textFaint,
    width: RAIL, flexShrink: 0, textAlign: "start", paddingTop: 4,
    fontFamily: "ui-monospace, monospace",
  },
  /* The epistemic sentences. These carry the actual discipline of the system
     — "similarity is not a relation", "UNKNOWN != 0" — so they are readable
     text at the floor size, not decoration at 8px. */
  note: { fontSize: FS.note, color: COLOR.textDim, lineHeight: 1.6, marginTop: 5 },

  zoomRow: { display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap" },
  zoomCell: { display: "flex", alignItems: "center", gap: 3 },
  arrow: { fontSize: FS.meta, color: COLOR.textFaint, padding: "0 4px" },
  zoom: { display: "inline-flex", alignItems: "baseline", gap: 6, padding: "3px 10px", borderRadius: RADIUS.sm, border: "1px solid transparent", fontSize: FS.meta, color: COLOR.textDim },
  zoomHere: { background: PRODUCT_FAMILY_CUE.bgActive, border: `1px solid ${PRODUCT_FAMILY_CUE.borderActive}`, color: COLOR.text, fontWeight: 600 },
  zoomLevel: { fontSize: FS.tag, fontWeight: 700, letterSpacing: 1 },
  zoomN: { fontFamily: "ui-monospace, monospace", fontSize: FS.read, color: COLOR.text },

  spineRow: { display: "flex", alignItems: "stretch", gap: 3, flexWrap: "wrap" },
  spineCell: { display: "flex", alignItems: "center", gap: 3 },
  spineItem: {
    display: "inline-flex", flexDirection: "column", gap: 1,
    padding: "4px 10px", borderRadius: RADIUS.sm, border: `1px solid ${COLOR.border}`,
    minWidth: 72,
  },
  spineItemHit: { border: `1px solid ${COLOR_ROLE.green}`, background: "rgba(52,211,153,0.14)" },
  spineN: { fontSize: 15, fontWeight: 700, fontFamily: "ui-monospace, monospace", lineHeight: 1.1 },
  spineLabel: { fontSize: FS.tag, color: COLOR.textDim, letterSpacing: 0.3, lineHeight: 1.3 },
  spineStatus: { fontSize: FS.tag, color: COLOR.textFaint, letterSpacing: 0.3, transform: "scale(0.88)", transformOrigin: "right top" },

  roleRow: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" },
  role: { display: "inline-flex", alignItems: "baseline", gap: 6, border: "1px solid", borderRadius: RADIUS.sm, padding: "4px 11px" },

  /* TIME is the lane with the most to say, so its rows get the reading size
     and real row height rather than being compressed to fit more in. */
  tRow: { display: "flex", alignItems: "center", gap: SPACE.sm, fontSize: FS.meta, padding: "3px 6px", textDecoration: "none", color: "inherit", borderRadius: RADIUS.sm },
  tRowHere: { background: PRODUCT_FAMILY_CUE.bgActive, boxShadow: `inset 0 0 0 1px ${PRODUCT_FAMILY_CUE.borderActive}` },
  tAt: { fontFamily: "ui-monospace, monospace", fontSize: FS.note, color: COLOR.textDim, minWidth: 78 },
  tDot: { width: 7, height: 7, borderRadius: "50%", flexShrink: 0 },
  tKind: { fontFamily: "ui-monospace, monospace", fontSize: FS.meta, color: COLOR.textDim, minWidth: 118 },
  tLabel: { color: COLOR.text, fontSize: FS.read, flex: 1, minWidth: 70, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  tRef: { fontSize: FS.note, color: COLOR_ROLE.blue },
  tVerif: { fontSize: FS.tag, fontWeight: 700, letterSpacing: 0.5, minWidth: 54 },
  tId: { fontFamily: "ui-monospace, monospace", fontSize: FS.note, color: COLOR.textFaint },

  selHead: { display: "flex", alignItems: "center", gap: SPACE.sm, fontSize: FS.meta, flexWrap: "wrap" },
  scaleRow: { display: "flex", alignItems: "stretch", gap: 6, flexWrap: "wrap", marginTop: 6 },
  scaleCell: { display: "inline-flex", flexDirection: "column", gap: 2, border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.sm, padding: "5px 10px", maxWidth: 260 },
  scaleAs: { fontSize: FS.note, color: COLOR.textDim, lineHeight: 1.5 },

  empty: { fontSize: FS.note, color: COLOR.textDim, fontStyle: "italic", lineHeight: 1.65 },
  auditSummary: { cursor: "pointer", fontSize: FS.tag, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: COLOR.textFaint, padding: "3px 0" },
};
