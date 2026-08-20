"use server";

import { revalidatePath } from "next/cache";

import { createIdGenerator, systemClock } from "@/app/lib/philos/eventStore";
import { loadNeeds } from "@/app/lib/philos/canon/needStoreAccessor";
import { mayDeclare, type NeedGroupLink } from "@/app/lib/philos/community/needGroupLink";
import { needGroupLinkStore, loadNeedGroupLinks } from "@/app/lib/philos/community/needGroupLinkStoreAccessor";
import { NeedGroupLinkRejectedError } from "@/app/lib/philos/community/needGroupLinkStore";

export type DeclareNeedGroupResult =
  | { ok: true; link_id: string }
  | { ok: false; message: string };

/**
 * Attach an EXISTING Need to a value group, by explicit declaration of the
 * Need's own subject.
 *
 * This is the ONLY path by which a historical Need acquires a group. It is
 * not a backfill: nothing in `needs.jsonl` is read-modified-written, and the
 * canon Need entity is untouched. It is not an inference: the group is not
 * read from the Need's text, its values, its timing or the subject's
 * memberships — it arrives as an argument because a human chose it.
 *
 * The authority gate is real and enforced server-side: only the Need's own
 * `subject` may declare, because only they are sovereign over their own Need
 * (canon §12). A declaration for someone else's Need is refused here, not
 * filtered downstream.
 */
export async function declareNeedGroup(formData: FormData): Promise<DeclareNeedGroupResult> {
  const need_id = String(formData.get("need_id") ?? "").trim();
  const group_id = String(formData.get("group_id") ?? "").trim();
  const declared_by = String(formData.get("declared_by") ?? "").trim();
  const evidence = String(formData.get("evidence") ?? "").trim();

  if (!need_id || !group_id || !declared_by) {
    return { ok: false, message: "need_id, group_id and declared_by are all required — nothing is defaulted" };
  }
  if (!evidence) {
    return { ok: false, message: "evidence — יש לנמק במפורש למה ה-Need שייך לקבוצה (לא נגזר מהטקסט)" };
  }

  // The Need must actually exist, and the declarer must be its subject.
  const needs = await loadNeeds();
  const target = needs.find((n) => n.need.need_id === need_id);
  if (!target) return { ok: false, message: `${need_id} is not in the need log` };
  if (!mayDeclare(target.need.subject, declared_by)) {
    return { ok: false, message: `only the Need's own subject may declare its group (subject=${target.need.subject})` };
  }

  // Already declared? Append-only means a correction is a new record, but a
  // duplicate of the SAME group is a no-op, reported rather than silently
  // written twice.
  const existing = await loadNeedGroupLinks();
  const current = existing.filter((l) => l.need_id === need_id).at(-1);
  if (current && current.group_id === group_id) {
    return { ok: false, message: `${need_id} is already declared to ${group_id} (${current.link_id})` };
  }

  const link: NeedGroupLink = {
    link_id: createIdGenerator().next("link"),
    need_id,
    group_id,
    declared_by,
    evidence,
    declaration_source: "self",
    created_at: systemClock.now(),
  };

  try {
    await needGroupLinkStore().append([link]);
  } catch (err) {
    if (err instanceof NeedGroupLinkRejectedError) {
      return { ok: false, message: err.rejections.map((r) => r.message).join("; ") };
    }
    throw err;
  }

  revalidatePath("/hub/community");
  revalidatePath("/marketplace");
  revalidatePath("/planet");
  return { ok: true, link_id: link.link_id };
}
