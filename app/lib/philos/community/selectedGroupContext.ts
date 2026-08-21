/**
 * SELECTED GROUP CONTEXT — which group is being INSPECTED. A third thing.
 *
 * PHILOS now keeps three questions apart that were one variable before:
 *
 *   ResolvedViewerContext   WHO I AM / what the system knows about me
 *   ViewerGroupOverlay      WHAT I BELONG TO
 *   SelectedGroupContext    WHAT I AM LOOKING AT        ← this module
 *
 * The distinction is not academic. `groupContext.ts` — correctly, for its own
 * question — REFUSES a selection the viewer has no membership in, because it
 * answers "which group's member-owned records may be read as this viewer's".
 * Applying that rule to inspection would make discovery impossible: a viewer
 * could only ever look at groups they already belong to, which is the opposite
 * of an open spectrum. So inspection is a separate resolver with a separate
 * rule: ANY group in the registry may be inspected, and inspecting it grants
 * nothing.
 *
 * INSPECTION NEVER BECOMES MEMBERSHIP. This module writes nothing, emits no
 * event, and returns no viewer-scoped field. The relation shown beside an
 * inspected group is read from the overlay, which only recorded events fill.
 *
 * PERSISTENCE ACROSS TERMINALS is by URL (`?group=`), deliberately: the app is
 * RSC-rendered with no shared client store, so a query parameter is the only
 * carrier that survives Community → Network → Marketplace → Dynamics → back
 * without inventing a session-scoped mutable server state that a second viewer
 * could observe.
 */
import type { ValueGroupRegistry, RegistryEntry } from "./valueGroupRegistry";

/** The query parameter every terminal reads. One name, one meaning. */
export const SELECTED_GROUP_PARAM = "group";

export type SelectedGroupContext =
  /** A real registry group is being inspected. Carries no viewer claim. */
  | { status: "selected"; group_id: string; entry: RegistryEntry; because: "EXPLICIT_SELECTION" }
  /** Nothing selected. A REAL state — never silently replaced by a default. */
  | { status: "none"; because: string }
  /** A selection naming a group that does not exist. Said out loud, so a stale
   *  or hand-typed link reports itself instead of falling back to some group. */
  | { status: "unknown_group"; requested: string; because: string };

/**
 * Resolve inspection from a raw parameter value.
 *
 * Takes the registry and the raw param — no viewer, by construction. A
 * function that cannot see the viewer cannot leak the viewer into inspection.
 */
export function resolveSelectedGroup(
  registry: ValueGroupRegistry,
  requested: unknown,
): SelectedGroupContext {
  const raw = Array.isArray(requested) ? requested[0] : requested;
  if (typeof raw !== "string" || raw.trim() === "") {
    return { status: "none", because: "לא נבחרה קבוצה לבדיקה" };
  }
  const entry = registry.byId(raw.trim());
  if (!entry) {
    return {
      status: "unknown_group",
      requested: raw.trim(),
      because: `אין קבוצה בשם "${raw.trim()}" ברישום — לא נבחרת קבוצה אחרת במקומה`,
    };
  }
  return { status: "selected", group_id: entry.group.group_id, entry, because: "EXPLICIT_SELECTION" };
}

/** Build a link that carries the current selection to another terminal. */
export function withSelectedGroup(href: string, ctx: SelectedGroupContext): string {
  if (ctx.status !== "selected") return href;
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}${SELECTED_GROUP_PARAM}=${encodeURIComponent(ctx.group_id)}`;
}
