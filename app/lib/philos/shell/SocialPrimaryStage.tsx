/**
 * SOCIAL PRIMARY STAGE — the ONE primary composition contract.
 *
 * WHY THIS EXISTS. The three social scales were made visually consistent and
 * were still three implementations. Community owned an operational-card
 * grammar, Globe owned a floating-HUD grammar, World owned a
 * badge-plus-container grammar. Each answered the same eight questions —
 * what is this, which object, what status, when, which roles, which
 * relations, what provenance, where is the audit — in its own layout, with
 * its own labels, in its own order. Visual convergence made the three answers
 * LOOK alike. It did not make them ONE answer.
 *
 * This module is the answer, once. Every scale renders this stage, passes the
 * same `SocialPrimaryContext`, and plugs in ONLY its unique representation:
 *
 *     SocialFrame
 *       └── SocialPrimaryStage        <- header + the six context cells + audit
 *           ├── GROUP   representation   (operational community board)
 *           ├── NETWORK representation   (the sphere)
 *           └── SYSTEM  representation   (observed / reference architecture)
 *
 * THE RULE: nothing above or beside the representation slot may be authored
 * per scale. If a scale needs a new primary element, it is added HERE, as a
 * primitive every scale receives — never inline on one route. That is the
 * whole point: `DUPLICATED_PRIMARY_GRAMMAR = 0` is a property of this file
 * existing and the three routes owning nothing but their `children`.
 *
 * WHAT IS DELIBERATELY NOT HERE. Routing (three routes stay three routes),
 * data (this component loads nothing and derives nothing), and truth (every
 * status, provenance and count is displayed exactly as handed in; there is no
 * default branch that promotes UNKNOWN to 0 or CLAIMED to VERIFIED).
 *
 * `density` is the ONLY concession to surface: "page" for the two document
 * scales, "hud" for the sphere, which floats over a moving canvas and needs an
 * opaque backdrop and a narrower column. It changes padding and background.
 * It does not change which primitives render, their order, or their labels.
 */
import type { ReactNode } from "react";

import { COLOR, FS, PRODUCT_FAMILY_CUE, RADIUS, SPACE, STATUS, TYPE } from "./designTokens";
import type { SocialSelection } from "../social/socialSelection";
import type { Scale } from "../social/socialSystemProjection";
import { noRoleReason, roleTouchOf, type InternalRole } from "../social/roleTouch";
import type { ViewerContext } from "../identity/viewerContext";

/** The role colours, as declared by the Colour Source Lock. Cell_ID != Color_ID:
 *  these paint an internal ROLE that the record activates, never a cell. */
const ROLE_COLOR: Record<InternalRole, string> = {
  RED: "#f2635c", WHITE: "#e6edf7", GREEN: "#34d399", PURPLE: "#a78bfa",
};

/** Provenance tiers, counted. UNKNOWN is carried as its own number and is
 *  never folded into zero. */
export interface ProvenanceTally {
  real: number | null;
  derived: number | null;
  demo: number | null;
}

/** Relation accounting, already layered by `networkAccounting`. A scale that
 *  has no relation layer passes `null` — which renders as UNKNOWN, not 0. */
export interface RelationTally {
  entity_links: number;
  gated_relations: number;
  drawn_arcs: number;
  /** passed / candidates through the network truth gate. */
  passed: number;
  candidates: number;
}

/**
 * EVERY fact the primary stage displays, at every scale. One shape, filled by
 * one loader (`loadSocialSystem`) plus the shared selection/chronology
 * resolvers — so two scales cannot disagree about a number they both show.
 */
export interface SocialPrimaryContext {
  scale: Scale;
  /** WHOSE view this is. Present so the stage can state it; never used to filter. */
  viewer: ViewerContext;

  /** PRIMARY HEADER */
  title: string;
  subtitle: string;
  /** The scale's own headline figure and what it counts. `n: null` = UNKNOWN. */
  headline: { n: number | null; unit: string; note?: string };

  /** CURRENT OBJECT + CURRENT STATUS — the shared selection, one identity
   *  across all three scales. */
  selection: SocialSelection;
  /** Whether THIS scale can show the selected object, and why not when it
   *  cannot. Absence always carries a reason. */
  presence?: { present: boolean; because: string };

  /** How many of the chronology's records this scale actually shows. Used by
   *  the SCALE cell; the timeline itself lives in section C and is not
   *  restated here. */
  inScope: number;

  /** RELATION CONTEXT — null where the scale has no relation layer. */
  relations: RelationTally | null;

  /** PROVENANCE CONTEXT */
  provenance: ProvenanceTally;

  /** AUDIT ENTRY — collapsed, never removed. */
  audit?: ReactNode;

  density?: "page" | "hud";
}

/* ─────────────────────────────────────────────────────────────────────────
   THE EIGHT SHARED PRIMITIVES
   Exported individually so a scale can be composed by hand if it must, and
   so a test can assert that all three routes render the same components
   rather than three look-alikes.
   ───────────────────────────────────────────────────────────────────────── */

/** 1 — PRIMARY HEADER. Scale badge, title, and the one headline figure. */
export function PrimaryHeader({ ctx }: { ctx: SocialPrimaryContext }) {
  const hud = ctx.density === "hud";
  return (
    <div style={{ ...S.header, ...(hud ? S.headerHud : null) }}>
      <span style={S.scaleBadge}>{ctx.scale}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: hud ? FS.read : FS.head, fontWeight: 700, color: COLOR.text }}>{ctx.title}</div>
        <div style={{ fontSize: FS.tag, color: COLOR.textFaint, lineHeight: 1.55, marginTop: 2 }}>{ctx.subtitle}</div>
      </div>
      <div style={{ textAlign: "center", flexShrink: 0 }}>
        <div style={{
          fontSize: hud ? 20 : 26, fontWeight: 700, lineHeight: 1,
          color: ctx.headline.n === null ? COLOR.textFaint : COLOR.text,
          fontVariantNumeric: "tabular-nums",
        }}>{ctx.headline.n === null ? "—" : ctx.headline.n}</div>
        <div style={{ ...TYPE.micro, fontSize: FS.tag, color: COLOR.textFaint, marginTop: 4 }}>{ctx.headline.unit}</div>
      </div>
    </div>
  );
}

/**
 * The ONE cell shape every context primitive below is built from.
 *
 * `scope` is load-bearing, not decoration. Without it this rail produced two
 * contradictions the moment it shipped:
 *
 *   - The frame's ROLES lane counts roles active across the SCALE (GREEN 11
 *     at GROUP). This rail's ROLES cell reports the roles the SELECTED record
 *     activates (— when nothing is selected). One word, two meanings, ten
 *     centimetres apart, one saying 11 and the other saying nothing.
 *   - RELATIONS and PROVENANCE describe the LINK REGISTRY, which is one
 *     registry for the whole product. Printed unlabelled inside a stage whose
 *     headline reads "0 RECORDS AT THIS SCALE", World showed "0 records" and
 *     "38 links · 12 REAL" side by side and looked broken.
 *
 * Both figures were correct. Neither said what it was about.
 */
function Cell({ label, scope, children, title }: { label: string; scope: "SELECTED" | "REGISTRY"; children: ReactNode; title?: string }) {
  return (
    <div data-stage-cell={label} data-cell-scope={scope} style={S.cell} title={title}>
      <span data-cell-label style={S.cellLabel}>
        {label}
        <span style={S.cellScope}>{scope === "SELECTED" ? "· הנבחר" : "· כל המאגר"}</span>
      </span>
      <div style={S.cellBody}>{children}</div>
    </div>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <span style={{ color: COLOR.textFaint }}>{children}</span>;
}

/** 2 — CURRENT OBJECT. */
export function ObjectContext({ ctx }: { ctx: SocialPrimaryContext }) {
  const sel = ctx.selection;
  return (
    <Cell label="OBJECT" scope="SELECTED">
      {sel.status === "none" ? <Muted>לא נבחר אובייקט</Muted>
        : sel.status === "unresolved" ? (
          <span style={{ color: STATUS.unknown.text }}>
            UNRESOLVED — <code style={S.mono}>{sel.record_id}</code>
          </span>
        ) : (
          /* The record's own LABEL leads; its id moved to the title.
             A raw `action_msw4v8oy_000001` was the one identifier still
             sitting in a primary cell, and an id answers "which row in the
             store", not "what did I select". It is one hover away here, and
             still printed in full in the timeline rows and the audit lane. */
          <>
            <div style={{ color: COLOR.text }} title={sel.object.record_id}>
              {sel.object.kind}
              {sel.object.label ? <span style={{ color: COLOR.textDim }}> · {sel.object.label}</span> : null}
            </div>
            {ctx.presence && !ctx.presence.present ? (
              <div style={{ color: COLOR.textFaint, marginTop: 2 }}>
                NOT_APPLICABLE — {ctx.presence.because}
              </div>
            ) : null}
          </>
        )}
    </Cell>
  );
}

/** 3 — CURRENT STATUS. Truth status of the selected record, never averaged
 *  and never inferred from the scale it is being viewed at. */
export function StatusContext({ ctx }: { ctx: SocialPrimaryContext }) {
  const sel = ctx.selection;
  const v = sel.status === "resolved" ? sel.object.verification : null;
  const tone = v === "VERIFIED" ? STATUS.verified.text : v === "CLAIMED" ? STATUS.claimed.text : COLOR.textFaint;
  return (
    <Cell label="STATUS" scope="SELECTED" title="CLAIMED != VERIFIED — אף גזירה אינה מייצרת אימות">
      {v === null ? <Muted>UNKNOWN</Muted> : <span style={{ color: tone, fontWeight: 700, letterSpacing: 0.4 }}>{v}</span>}
    </Cell>
  );
}

/** 4 — CURRENT SCALE VERDICT. Does the selected record reach THIS scale, and
 *  what do the other two say about it? This replaced a TIME cell that printed
 *  the chronology's whole span and `inScope/total` — facts the orientation
 *  band states once and the timeline states again. TIME now appears exactly
 *  once in the product, in section C. */
export function ScaleVerdictContext({ ctx }: { ctx: SocialPrimaryContext }) {
  const sel = ctx.selection;
  return (
    <Cell label="SCALE" scope="SELECTED" title="EXISTS_IN_SOCIAL_MODEL != ELIGIBLE_AT_CURRENT_SCALE">
      {sel.status !== "resolved" ? (
        <>
          <span style={{ color: COLOR.text, fontWeight: 700 }}>{ctx.headline.n ?? "—"}</span>{" "}
          <Muted>רשומות מגיעות ל-{ctx.scale}</Muted>
        </>
      ) : (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {(["GROUP", "NETWORK", "SYSTEM"] as Scale[]).map((sc) => {
            const p = sel.object.scales[sc];
            const here = sc === ctx.scale;
            return (
              <span key={sc} title={p.present ? (p.as ?? "present") : "absent"}
                    style={{ opacity: p.present ? 1 : 0.55, fontWeight: here ? 800 : 500 }}>
                <span style={{ ...S.dot, background: p.present ? STATUS.real.text : COLOR.textFaint }} />
                <span style={{ color: here ? COLOR.text : COLOR.textDim }}>{sc}</span>
              </span>
            );
          })}
        </div>
      )}
      {ctx.presence && !ctx.presence.present ? (
        <div style={{ color: COLOR.textFaint, marginTop: 3 }}>{ctx.presence.because}</div>
      ) : null}
    </Cell>
  );
}

/** 5 — ROLE CONTEXT. Which internal roles the selected record activates.
 *  A record may activate more than one; none is also an answer with a reason. */
export function RoleContext({ ctx }: { ctx: SocialPrimaryContext }) {
  const sel = ctx.selection;
  const roles = sel.status === "resolved" ? roleTouchOf(sel.object.kind, sel.object.verification) : [];
  return (
    <Cell label="ROLES" scope="SELECTED">
      {sel.status !== "resolved" ? <Muted>—</Muted>
        : roles.length === 0 ? <Muted>{noRoleReason(sel.object.kind)}</Muted>
        : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {roles.map((r) => (
              <span key={r.role} title={r.because} style={{ color: ROLE_COLOR[r.role], fontWeight: 700 }}>
                <span style={{ ...S.dot, background: ROLE_COLOR[r.role] }} />{r.role}
              </span>
            ))}
          </div>
        )}
    </Cell>
  );
}

/** 6 — RELATION CONTEXT. Four accounting layers, never summed together. */
export function RelationContext({ ctx }: { ctx: SocialPrimaryContext }) {
  const r = ctx.relations;
  return (
    <Cell label="RELATIONS" scope="REGISTRY" title="ארבע שכבות חשבונאות — לא נסכמות זו לזו">
      {r === null ? <Muted>UNKNOWN — אין שכבת יחסים בקנה־מידה זה</Muted> : (
        <>
          <div><code style={S.mono}>{r.passed}/{r.candidates}</code> <Muted>שער האמת</Muted></div>
          <div style={{ marginTop: 2 }}>
            <code style={S.mono}>{r.entity_links}</code> <Muted>links</Muted>
            {" · "}<code style={S.mono}>{r.drawn_arcs}</code> <Muted>arcs</Muted>
          </div>
        </>
      )}
    </Cell>
  );
}

/** 7 — PROVENANCE CONTEXT. SOURCE != REAL, DEMO != REAL. */
export function ProvenanceContext({ ctx }: { ctx: SocialPrimaryContext }) {
  const p = ctx.provenance;
  const item = (n: number | null, label: string, color: string) => (
    <span key={label} style={{ display: "inline-flex", alignItems: "baseline", gap: 4 }}>
      <span style={{ fontWeight: 700, color: n === null ? COLOR.textFaint : color, fontVariantNumeric: "tabular-nums" }}>
        {n === null ? "—" : n}
      </span>
      <span style={{ ...TYPE.micro, fontSize: FS.tag, color: COLOR.textFaint }}>{label}</span>
    </span>
  );
  return (
    <Cell label="PROVENANCE" scope="REGISTRY" title="DEMO != REAL · גזירה אינה רישום">
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {item(p.real, "REAL", STATUS.real.text)}
        {item(p.derived, "DERIVED", "#8fa3c9")}
        {item(p.demo, "DEMO", STATUS.demo.text)}
      </div>
    </Cell>
  );
}

/** 8 — AUDIT ENTRY. Present at every scale, collapsed at every scale. */
export function AuditEntry({ ctx }: { ctx: SocialPrimaryContext }) {
  if (!ctx.audit) return null;
  return (
    <details style={S.audit}>
      <summary style={S.auditSummary}>מקור · פרובננס · נוסחאות — AUDIT</summary>
      <div style={{ marginTop: 6 }}>{ctx.audit}</div>
    </details>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   THE STAGE
   ───────────────────────────────────────────────────────────────────────── */

export default function SocialPrimaryStage({
  ctx, children,
}: {
  ctx: SocialPrimaryContext;
  /** The ONE thing a scale owns: how it draws itself. */
  children: ReactNode;
}) {
  const hud = ctx.density === "hud";
  return (
    <div dir="rtl" data-social-stage={ctx.scale} style={{ ...S.stage, ...(hud ? S.stageHud : null) }}>
      <div data-stage-slot="header"><PrimaryHeader ctx={ctx} /></div>

      {/* The six context cells, in ONE fixed order at every scale. A scale
          cannot reorder them, rename them, or drop one — that is what made
          the three read as three products even after they matched visually. */}
      <div data-stage-slot="context" style={{ ...S.contextRail, ...(hud ? S.contextRailHud : null) }}>
        <ObjectContext ctx={ctx} />
        <StatusContext ctx={ctx} />
        <ScaleVerdictContext ctx={ctx} />
        <RoleContext ctx={ctx} />
        <RelationContext ctx={ctx} />
        <ProvenanceContext ctx={ctx} />
      </div>
      <div data-stage-note style={S.scopeNote}>
ארבעת הראשונים מתארים את הרשומה <b>הנבחרת</b>; שניים האחרונים את <b>מאגר הקשרים כולו</b>,
        שהוא אחד לכל המוצר ואינו משתנה עם הזום. מספר קשרים גדול לצד 0 רשומות בקנה־מידה הזה אינו סתירה — הם עונים על שתי שאלות.
      </div>

      {/* THE ONLY PER-SCALE REGION. Everything else on this stage is shared. */}
      <div data-stage-slot="representation" data-scale={ctx.scale} style={S.representation}>
        {children}
      </div>

      <div data-stage-slot="audit"><AuditEntry ctx={ctx} /></div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  stage: { display: "flex", flexDirection: "column", gap: SPACE.sm },
  stageHud: { gap: 6 },

  header: {
    display: "flex", alignItems: "flex-start", gap: SPACE.md,
    padding: "14px 16px",
    border: `1px solid ${PRODUCT_FAMILY_CUE.borderActive}`,
    borderRadius: RADIUS.md,
    background: "rgba(120,150,220,0.10)",
    boxShadow: "inset 0 1px 0 0 rgba(160,190,255,0.10)",
  },
  headerHud: { padding: "9px 12px", background: "rgba(4,10,22,0.97)", backdropFilter: "blur(10px)" },

  scaleBadge: {
    ...TYPE.micro, fontSize: FS.tag, letterSpacing: 1.6, fontWeight: 800,
    color: PRODUCT_FAMILY_CUE.labelActive,
    border: `1px solid ${PRODUCT_FAMILY_CUE.borderActive}`,
    borderRadius: RADIUS.pill, padding: "3px 9px",
    flexShrink: 0, whiteSpace: "nowrap",
  },

  contextRail: {
    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(168px, 1fr))", gap: 1,
    border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.md,
    background: COLOR.border, overflow: "hidden",
  },
  contextRailHud: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },

  cell: { background: COLOR.bg, padding: "8px 11px", minWidth: 0 },
  cellLabel: {
    ...TYPE.micro, fontSize: FS.tag, letterSpacing: 1.4,
    color: PRODUCT_FAMILY_CUE.label, display: "block", marginBottom: 3,
  },
  cellScope: { ...TYPE.micro, fontSize: FS.tag, color: COLOR.textFaint, marginInlineStart: 5, letterSpacing: 0.6, fontWeight: 400 },
  scopeNote: { fontSize: FS.tag, color: COLOR.textFaint, lineHeight: 1.6, padding: "0 2px" },
  cellBody: { fontSize: FS.meta, color: COLOR.textDim, lineHeight: 1.5, minWidth: 0, wordBreak: "break-word" },

  mono: { fontFamily: "ui-monospace, monospace", fontSize: FS.base, color: COLOR.text, direction: "ltr", unicodeBidi: "isolate" },
  dot: { display: "inline-block", width: 6, height: 6, borderRadius: 3, marginInlineEnd: 5 },

  representation: { minWidth: 0 },

  audit: { background: "rgba(0,0,0,0.26)", opacity: 0.72, borderRadius: RADIUS.md, padding: "6px 12px" },
  auditSummary: { cursor: "pointer", fontSize: FS.meta, letterSpacing: 1, color: "#6c86b5", padding: "3px 0" },
};
