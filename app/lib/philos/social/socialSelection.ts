/**
 * SOCIAL SELECTION STATE — one selected object, carried across all scales.
 *
 * Selecting a group card in Community, a node on Globe and a row in World are
 * the same act on the same object. The selection therefore lives in ONE place
 * (the `sel` query parameter) and is a `record_id` — the same identity the
 * projection uses — never a per-surface index, label or node handle.
 *
 * WHY A QUERY PARAM. The nav already carries `ctx`/`subject`/`community`
 * between the three surfaces, so `sel` rotates with the user for free and
 * survives a reload and a shared link. No client store, no second source of
 * truth about what is selected.
 *
 * An unresolvable `sel` is reported as UNRESOLVED rather than silently
 * dropped: a link to a record that no longer exists is a fact worth showing,
 * not a blank screen.
 */
import type { SocialObject } from "./socialSystemProjection";

export const SELECTION_PARAM = "sel";

export type SocialSelection =
  | { status: "none" }
  | { status: "resolved"; record_id: string; object: SocialObject }
  | { status: "unresolved"; record_id: string };

export function resolveSocialSelection(
  raw: string | string[] | undefined,
  objects: readonly SocialObject[],
): SocialSelection {
  const id = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  if (!id) return { status: "none" };
  const object = objects.find((o) => o.record_id === id);
  return object ? { status: "resolved", record_id: id, object } : { status: "unresolved", record_id: id };
}

/** Href that keeps the current selection while moving to another scale. */
export function withSelection(href: string, recordId: string | undefined): string {
  if (!recordId) return href;
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}${SELECTION_PARAM}=${encodeURIComponent(recordId)}`;
}
