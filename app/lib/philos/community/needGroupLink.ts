/**
 * Need↔Value-Group DECLARATION — an explicit statement, never an inference.
 *
 * WHY THIS EXISTS. `NeedRecord.origin_group_id` captures the group a Need was
 * raised in AT WRITE TIME. It is only ever written going forward, and it is
 * never backfilled. That leaves a real, honest gap: Needs recorded before the
 * field existed carry no group, even when the group is obvious to a human
 * reading the Need's own text.
 *
 * Closing that gap by reading the text would be exactly the inference this
 * whole architecture forbids — a Need mentioning a group is a MENTION, not a
 * membership, the same rule that keeps `SHARED_VALUE` from becoming
 * `MEMBER_OF`. So the gap is closed the only legitimate way: the Need's own
 * subject DECLARES the attachment, explicitly, and that declaration is stored
 * as its own record.
 *
 * THE PRECEDENT THIS FOLLOWS. `personCommunityLink.ts` already does exactly
 * this for identity: the viewer declares "I am this member", it persists to
 * its own append-only log, and provenance is REAL because a human actually
 * said it. Same shape, same discipline, different fact.
 *
 * WHY ONE STEP AND NOT TWO. `PersonCommunityLink` needs DECLARED -> VERIFIED
 * because it asserts an identity across two id spaces, where the declarer
 * could be wrong about who the other party is. Here the declarer is the
 * Need's own `subject`, and canon §12 makes the subject sovereign over their
 * own Need ("Need is the sovereign subject-side entry into Matching"). A
 * subject saying where their own Need belongs is not a claim about someone
 * else, so a second confirmation step would be ceremony, not evidence.
 * `declared_by` is recorded so the authority is checkable, not assumed.
 *
 * WHAT IT DOES NOT SAY. Not that the group owns the Need, not that the group
 * is responsible for it, and not that the Need was created by the group.
 * `Need.subject` is untouched and remains sovereign. The canon Need entity is
 * untouched — nothing here edits a stored record; §12's schema closure holds.
 */

export interface NeedGroupLink {
  link_id: string;
  need_id: string;
  group_id: string;
  /** The subject who declared it — must equal the Need's own `subject`. */
  declared_by: string;
  /** Verbatim human-meaningful reason, never generated from the Need text. */
  evidence: string;
  declaration_source: "self";
  created_at: string;
}

export type NeedGroupLinkError =
  | { field: "link_id"; reason: "empty" }
  | { field: "need_id"; reason: "empty" }
  | { field: "group_id"; reason: "empty" }
  | { field: "declared_by"; reason: "empty" }
  | { field: "evidence"; reason: "empty" }
  | { field: "created_at"; reason: "empty" };

export interface NeedGroupLinkValidation {
  valid: boolean;
  errors: NeedGroupLinkError[];
}

function nonEmpty(s: unknown): s is string {
  return typeof s === "string" && s.trim() !== "";
}

export function validateNeedGroupLink(link: NeedGroupLink): NeedGroupLinkValidation {
  const errors: NeedGroupLinkError[] = [];
  if (!nonEmpty(link?.link_id)) errors.push({ field: "link_id", reason: "empty" });
  if (!nonEmpty(link?.need_id)) errors.push({ field: "need_id", reason: "empty" });
  if (!nonEmpty(link?.group_id)) errors.push({ field: "group_id", reason: "empty" });
  if (!nonEmpty(link?.declared_by)) errors.push({ field: "declared_by", reason: "empty" });
  if (!nonEmpty(link?.evidence)) errors.push({ field: "evidence", reason: "empty" });
  if (!nonEmpty(link?.created_at)) errors.push({ field: "created_at", reason: "empty" });
  return { valid: errors.length === 0, errors };
}

/**
 * The authority gate. A declaration is only valid when the declarer IS the
 * Need's subject. Anyone else attaching someone's Need to a group would be
 * asserting on their behalf — refused here rather than filtered later.
 */
export function mayDeclare(needSubject: string, declaredBy: string): boolean {
  return nonEmpty(needSubject) && nonEmpty(declaredBy) && needSubject === declaredBy;
}

/** Latest declaration per need_id, in append order — a correction is a new
 *  record, so the last one wins, and nothing is ever mutated. */
export function resolveNeedGroup(links: readonly NeedGroupLink[], needId: string): NeedGroupLink | undefined {
  let found: NeedGroupLink | undefined;
  for (const l of links) if (l.need_id === needId) found = l;
  return found;
}
