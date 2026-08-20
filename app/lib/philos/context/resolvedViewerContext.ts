/**
 * THE ONE SEMANTIC VIEWER CONTEXT.
 *
 * Seven terminals answered the same question three different ways for one
 * authenticated session:
 *
 *   Hub          VALUE אחריות · REFERENCE self_baseline
 *   Marketplace  VALUE אחריות · REFERENCE UNKNOWN
 *   five others  VALUE UNKNOWN · REFERENCE UNKNOWN
 *
 * Neither majority nor Hub was right. The audit found one field where Hub
 * looked at real evidence nobody else read, and one where Hub and
 * Marketplace displayed a fact about a GROUP in a slot that names the
 * PERSON. Both are fixed here, and both fixes move a number — one up, one
 * down — because the goal is one truthful answer, not fewer UNKNOWNs.
 *
 * ── WHAT COUNTS AS EVIDENCE, PER FIELD ─────────────────────────────────
 *
 * PERSONAL VALUE. Only a ValueDeclaration with `scope: "PERSONAL"` whose
 * `holder_id` is this viewer. Today the store holds exactly one declaration
 * and it is `scope: GROUP, holder: vg_ahrayut_kehilatit` — the group holds
 * אחריות, not the person. Roei DECLARED it (`declared_by: person_roei`),
 * which is an authorship fact, not a holding fact. Hub and Marketplace were
 * passing that group's `central_value` into the person strip, so the
 * product asserted a personal value that no record supports.
 *
 * ACTIVE DOMAIN. Only a real recorded DomainState for this viewer. NOT the
 * route, NOT `?ctx=`, NOT the surface. `selected.domain` — which is what the
 * shell read — is a property of a SELECTED RECORD, which is navigation
 * state. Where the user is standing is not what is active in their model.
 * The two now have different names and different types, so a future edit
 * cannot quietly reconnect them.
 *
 * REFERENCE. The `reference` carried by this viewer's most recent OBSERVED
 * cell. This is real, viewer-scoped, and Hub was the only terminal that read
 * it — the other six passed nothing and rendered UNKNOWN. Here the majority
 * was simply not looking.
 *
 * PROJECT / REFERENCE GROUP. No store records either. UNKNOWN is the honest
 * answer and stays; canon §21 forbids a default reference group.
 *
 * ── WHAT THIS MODULE MAY NOT DO ────────────────────────────────────────
 * Read the URL. Take a surface name. Accept a client-supplied identity. Fill
 * an UNKNOWN to make a screen look complete. Treat registry-wide or DEMO
 * material as this viewer's context.
 */
import type { ViewerContext } from "../identity/viewerContext";

/**
 * How well a field is known. A bare string would let every consumer assume
 * certainty; PHILOS distinguishes these everywhere else and must here too.
 */
export type ContextStatus =
  /** A record states this directly, for this viewer. */
  | "RESOLVED"
  /** Composed from recorded references — real, but not itself recorded. */
  | "DERIVED"
  /** Something suggests it; nothing confirms it. Never shown as fact. */
  | "CANDIDATE"
  /** No evidence. Not zero, not absent — untested or unrecorded. */
  | "UNKNOWN"
  /** Two records disagree. Surfaced, never silently resolved. */
  | "CONFLICTING";

export interface ContextField {
  /** null whenever status is UNKNOWN or CONFLICTING — never a filler value. */
  value: string | null;
  status: ContextStatus;
  /** Why it has this status, in the reader's terms. Always present. */
  because: string;
  /** Record ids backing it. Empty when there is nothing to point at. */
  evidence: string[];
  provenance?: "REAL" | "DERIVED" | "DEMO";
}

/** A value the viewer's GROUP holds. Deliberately NOT `personal_value`. */
export interface GroupValueRef {
  group_id: string;
  label: string;
  /** DECLARED vs VERIFIED is its own axis and is never folded into status. */
  declaration_status: string;
  /** Who recorded the declaration. Authorship, not holding. */
  declared_by: string;
}

export interface ResolvedViewerContext {
  viewer_id: string;
  subject_id: string;
  person_id: string;

  /** The viewer's OWN active value. A group's value can never fill this. */
  personal_value: ContextField;
  /** Domain the USER MODEL says is active — from DomainState, never a route. */
  active_domain: ContextField;
  project: ContextField;
  reference: ContextField;
  reference_group: ContextField;

  /**
   * Values held by groups this viewer belongs to. Present so a terminal can
   * show them WITHOUT them becoming the person's value — the distinction the
   * old `valueLabel` prop destroyed.
   */
  group_values: GroupValueRef[];

  as_of: string;
}

/**
 * WHERE THE USER IS IN THE UI. A separate type on purpose.
 *
 * This is not evidence and is not part of `ResolvedViewerContext`. Opening
 * /hub/community does not make Community the active domain; selecting a
 * record does not make that record's domain active. Keeping these in one
 * object is what let `selected.domain` be rendered as ACTIVE DOMAIN.
 */
export interface NavigationState {
  surface: string;
  /** A `?sel=` / `?ctx=` selection. Presentation scope only. */
  selected_record_id?: string;
  /** A `?community=` selection. Presentation scope only. */
  selected_group_id?: string;
}

export const UNKNOWN_FIELD = (because: string): ContextField => ({
  value: null, status: "UNKNOWN", because, evidence: [],
});

/** The shape every terminal renders. Nothing here is optional or defaulted. */
export function emptyViewerContext(viewer: ViewerContext, asOf: string): ResolvedViewerContext {
  return {
    viewer_id: viewer.viewer_id,
    subject_id: viewer.subject_id,
    person_id: viewer.person_id,
    personal_value: UNKNOWN_FIELD("לא הוצהר ערך אישי על ידי הצופה"),
    active_domain: UNKNOWN_FIELD("אין רשומת DomainState לצופה — דומיין פעיל אינו נגזר ממסך או מבחירה"),
    project: UNKNOWN_FIELD("אין מאגר שרושם פרויקט נוכחי — לא נגזר מדומיין, מערך או מקבוצה"),
    reference: UNKNOWN_FIELD("אין תצפית נצפית עם מסגרת יחוס"),
    reference_group: UNKNOWN_FIELD("אין מאגר — לא מומצאת"),
    group_values: [],
    as_of: asOf,
  };
}
