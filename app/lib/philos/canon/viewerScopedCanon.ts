/**
 * VIEWER-SCOPED CANON — the same gate `projectCanonDynamics` already applies
 * to Observations, applied to Action / Effect / Need / Offer.
 *
 * THE DEFECT THIS CLOSES. `/planet` loaded all four canon stores unscoped and
 * handed them to `CanonActivityPanel`, whose `RELATED PEOPLE` line is the
 * distinct set of every owner/subject/source in them. User B therefore read
 * `person_roei` on their own Globe. It was invisible only because an unrelated
 * `nodes.length === 0` early return happened to stop the render first — a
 * route guard standing in for an access rule, which is why removing that guard
 * exposed the leak rather than creating it.
 *
 * FAIL CLOSED. No resolvable viewer means an EMPTY slice, never the whole
 * store. A record whose owning identity cannot be established is not shown.
 *
 * WHAT THIS DOES NOT DECIDE. Group facts stay group facts: a roster, a group's
 * budget, its event log. This gate is about PERSON-OWNED canon records, which
 * carry an explicit owner/subject/source field and belong to that person.
 */

export interface CanonViewerIdentity {
  subject_id?: string;
  person_id?: string;
}

/** Pure and total. Exported so the rule is testable without a store. */
export function ownedByViewer(owner: string | undefined | null, viewer: CanonViewerIdentity | null): boolean {
  if (!viewer || !owner) return false;
  return (
    (viewer.subject_id !== undefined && owner === viewer.subject_id) ||
    (viewer.person_id !== undefined && owner === viewer.person_id)
  );
}

/** Generic scoper: keep only records whose owning identity IS the viewer. */
export function scopeToViewer<T>(
  records: readonly T[],
  ownerOf: (r: T) => string | undefined,
  viewer: CanonViewerIdentity | null,
): T[] {
  if (!viewer) return [];
  return records.filter((r) => ownedByViewer(ownerOf(r), viewer));
}

/* The four owning fields, named once so a call site cannot pick the wrong one. */
export const ACTION_OWNER = <T extends { action: { owner?: string } }>(r: T) => r.action.owner;
export const EFFECT_OWNER = <T extends { effect: { subject?: string } }>(r: T) => r.effect.subject;
export const NEED_OWNER = <T extends { need: { subject?: string } }>(r: T) => r.need.subject;
export const OFFER_OWNER = <T extends { offer: { source?: string } }>(r: T) => r.offer.source;
