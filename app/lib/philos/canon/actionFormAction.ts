"use server";

/**
 * LOOP 5 — the acquisition path for real Action creation. Wraps the
 * existing `recordAction` (`actionLifecycle.ts`) — persisted since the
 * "Marketplace Legacy Convergence" pass but never reachable from any UI or
 * server action until now. `owner` is always REAL_CURRENT_SUBJECT, never
 * client-supplied — same posture as every other write path in this
 * directory (`observationFormAction.ts`, `app/marketplace/actions.ts`).
 * `consent` is a real per-submission checkbox (canon §10 CONSENT gate),
 * never defaulted true.
 */
import { revalidatePath } from "next/cache";

import { recordAuthenticatedAction, ActionReferentialIntegrityError } from "./actionLifecycle";
import type { Action, ActionType, MechanismScope } from "./action";
import { resolveViewerContext } from "@/app/lib/philos/identity/viewerContext";
import { createIdGenerator, systemClock } from "@/app/lib/philos/eventStore";
import { verifyMatchPermit } from "./matchPermit";

export type CreateActionResult =
  | { ok: true; action_id: string }
  | { ok: false; message: string };

const ACTION_TYPES: ActionType[] = ["transfer", "non_transfer"];
const MECHANISM_SCOPES: MechanismScope[] = ["self_regulation", "melting_pot"];

/** Testable core — no `revalidatePath`. Same split as `observationFormAction.ts`. */
export async function createActionForCurrentUserCore(formData: FormData): Promise<CreateActionResult> {
  // Server-resolved identity. Never a client-supplied subject.
  const viewer = await resolveViewerContext();
  const type = String(formData.get("type") ?? "");
  const mechanism_scope = String(formData.get("mechanism_scope") ?? "");
  const reversibility = String(formData.get("reversibility") ?? "").trim();
  const provenance = String(formData.get("provenance") ?? "").trim();
  const consent = formData.get("consent") === "on";
  /* The operational day this Action belongs to. Optional and backward
     compatible: a form that does not send it produces an Action with no day
     link, exactly as before this field existed. */
  const day_ref = String(formData.get("day_ref") ?? "").trim();
  const inputs = formData.getAll("inputs").map(String).filter((s) => s.trim() !== "");

  if (!ACTION_TYPES.includes(type as ActionType)) return { ok: false, message: "type must be transfer or non_transfer" };
  if (!MECHANISM_SCOPES.includes(mechanism_scope as MechanismScope)) return { ok: false, message: "mechanism_scope must be self_regulation or melting_pot" };
  if (!reversibility) return { ok: false, message: "reversibility is required" };
  if (!provenance) return { ok: false, message: "provenance is required" };
  if (!consent) return { ok: false, message: "consent — יש לאשר במפורש (canon §10 CONSENT gate)" };

  // Match→Action integrity gate: an Action whose `inputs` name both a
  // real Need and a real Offer is claiming to fulfill that specific
  // match — it must prove the match was actually evaluated permitted,
  // recently, via a signed `MatchPermit` (see `matchPermit.ts`'s own
  // header for why this is a stateless token, not a persisted record).
  // Actions that don't reference a Need+Offer pair (no inputs, a Need
  // alone, etc.) aren't claiming to fulfill a match, so this gate does
  // not apply to them — preserves every other real write path exactly
  // as it was.
  const referencedNeedId = inputs.find((id) => id.startsWith("need_"));
  const referencedOfferId = inputs.find((id) => id.startsWith("offer_"));
  let provenanceWithAudit = provenance;
  if (referencedNeedId && referencedOfferId) {
    const permitRaw = formData.get("match_permit");
    let permitCandidate: unknown;
    try {
      permitCandidate = typeof permitRaw === "string" && permitRaw.trim() !== "" ? JSON.parse(permitRaw) : undefined;
    } catch {
      permitCandidate = undefined;
    }
    const verification = verifyMatchPermit(permitCandidate, referencedNeedId, referencedOfferId, systemClock.now());
    if (!verification.valid) {
      return { ok: false, message: `Action references Need+Offer as a match, but the match was not verified: ${verification.reason}` };
    }
    provenanceWithAudit = `${provenance} [match_permit verified: ${referencedNeedId}↔${referencedOfferId}]`;
  }

  const action: Action = {
    action_id: createIdGenerator().next("action"),
    type: type as ActionType,
    owner: viewer.subject_id,
    mechanism_scope: mechanism_scope as MechanismScope,
    consent,
    inputs,
    reversibility,
    time: systemClock.now(),
    provenance: provenanceWithAudit,
    ...(day_ref !== "" ? { day_ref } : {}),
  };

  try {
    const stored = await recordAuthenticatedAction(action, systemClock.now());
    return { ok: true, action_id: stored.action.action_id };
  } catch (e) {
    if (e instanceof ActionReferentialIntegrityError) return { ok: false, message: e.message };
    throw e;
  }
}

/** Network edge — records a real Action for the real current subject, then
 *  revalidates every screen that projects it. */
export async function createActionForCurrentUser(formData: FormData): Promise<CreateActionResult> {
  const result = await createActionForCurrentUserCore(formData);
  if (result.ok) {
    revalidatePath("/marketplace");
    revalidatePath("/hub/community");
    revalidatePath("/dynamics");
    revalidatePath("/hub");
  }
  return result;
}
