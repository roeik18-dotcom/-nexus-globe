"use server";

import { revalidatePath } from "next/cache";

import { createIdGenerator, systemClock } from "@/app/lib/philos/eventStore";
import { type ValueDeclaration } from "@/app/lib/philos/community/valueDeclaration";
import { valueDeclarationStore } from "@/app/lib/philos/community/valueDeclarationStoreAccessor";
import { ValueDeclarationRejectedError } from "@/app/lib/philos/community/valueDeclarationStore";

export type DeclareValueResult = { ok: true; value_id: string } | { ok: false; message: string };

/**
 * Materialize a PERSONAL or GROUP value.
 *
 * The only path by which either entity comes into existence. Nothing derives a
 * value from contradictions, mentions, membership, frequency or the nearest
 * value family — a person states their own, or a group adopts one with a
 * recorded authority.
 *
 * Every gate below is enforced server-side, not in the form, because a form is
 * a convenience and a store is a contract.
 */
export async function declareValue(formData: FormData): Promise<DeclareValueResult> {
  const scope = String(formData.get("scope") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const holder_id = String(formData.get("holder_id") ?? "").trim();
  const declared_by = String(formData.get("declared_by") ?? "").trim();
  const authorized_by = String(formData.get("authorized_by") ?? "").trim();
  const evidence = String(formData.get("evidence") ?? "").trim();
  const value_family_ref = String(formData.get("value_family_ref") ?? "").trim();

  if (scope !== "PERSONAL" && scope !== "GROUP") return { ok: false, message: "scope must be PERSONAL or GROUP" };
  if (!label) return { ok: false, message: "יש לנסח את הערך במילים שלך — לא נגזר משום מקום" };
  if (!holder_id || !declared_by) return { ok: false, message: "holder_id and declared_by are required" };
  if (!evidence) return { ok: false, message: "evidence — יש לנמק למה זה ערך (הנימוק הוא הראיה)" };

  // A person declares their OWN value. Declaring for someone else is asserting
  // on their behalf.
  if (scope === "PERSONAL" && holder_id !== declared_by) {
    return { ok: false, message: "ערך אישי מוצהר רק על ידי בעליו" };
  }
  // "The group holds this value" with no stated authority is an inference.
  if (scope === "GROUP" && !authorized_by) {
    return { ok: false, message: "ערך קבוצתי דורש מקור סמכות — מי או מה אישר את האימוץ" };
  }

  const decl: ValueDeclaration = {
    value_id: createIdGenerator().next("value"),
    scope,
    label,
    holder_id,
    declared_by,
    ...(scope === "GROUP" ? { authorized_by } : {}),
    evidence,
    // Always DECLARED. Verification is a separate, later record.
    status: "DECLARED",
    ...(value_family_ref ? { value_family_ref } : {}),
    created_at: systemClock.now(),
  };

  try {
    await valueDeclarationStore().append([decl]);
  } catch (err) {
    if (err instanceof ValueDeclarationRejectedError) {
      return { ok: false, message: err.rejections.map((r) => r.message).join("; ") };
    }
    throw err;
  }

  revalidatePath("/hub/community");
  revalidatePath("/planet");
  revalidatePath("/world");
  return { ok: true, value_id: decl.value_id };
}
