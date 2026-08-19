"use server";

/**
 * LOOP 6 (EFFECT/EVIDENCE) — the acquisition path for real Effect
 * creation. Wraps the existing `recordEffect` (`actionLifecycle.ts`) —
 * persisted since the Marketplace Legacy Convergence pass but never
 * reachable from any UI. `subject` is always REAL_CURRENT_SUBJECT.
 *
 * `claimed_outcome.verifier_type` is hardcoded `"self"` — the only
 * verifier that can exist truthfully with one real subject; canon §17
 * itself states `self` is always sufficient authority, so a genuine,
 * single-user self-verification is not a workaround, it is a fully valid
 * verification path. `verified_outcome` is optional: only set when the
 * caller explicitly checks "I confirm this outcome actually occurred" —
 * never defaulted, since an unchecked box must leave the Effect honestly
 * `effect_claimed_only`, not silently promoted to verified.
 */
import { revalidatePath } from "next/cache";

import { recordEffect, EffectReferentialIntegrityError } from "./actionLifecycle";
import type { Effect } from "./effect";
import { REAL_CURRENT_SUBJECT } from "@/app/lib/philos/subjectRegistry";
import { createIdGenerator, systemClock } from "@/app/lib/philos/eventStore";

export type CreateEffectResult =
  | { ok: true; effect_id: string }
  | { ok: false; message: string };

/** Testable core — no `revalidatePath`. */
export async function createEffectForCurrentUserCore(formData: FormData): Promise<CreateEffectResult> {
  const action_ref = String(formData.get("action_ref") ?? "").trim();
  const context = String(formData.get("context") ?? "").trim();
  const provenance = String(formData.get("provenance") ?? "").trim();
  const statement = String(formData.get("statement") ?? "").trim();
  const method = String(formData.get("method") ?? "").trim();
  const concerns_subject_internal_state = formData.get("concerns_subject_internal_state") === "on";
  const self_verified = formData.get("self_verified") === "on";
  const confidence = Number(formData.get("confidence"));

  if (!action_ref) return { ok: false, message: "action_ref is required — pick a real, already-recorded Action" };
  if (!context) return { ok: false, message: "context is required" };
  if (!provenance) return { ok: false, message: "provenance is required" };
  if (!statement) return { ok: false, message: "statement is required — what outcome are you claiming?" };
  if (!method) return { ok: false, message: "method is required — how do you know this?" };
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    return { ok: false, message: "confidence must be a number between 0 and 1" };
  }

  const now = systemClock.now();
  const outcome = { statement, provenance, verifier_type: "self" as const, confidence, time: now, method };

  const effect: Effect = {
    effect_id: createIdGenerator().next("effect"),
    action_ref,
    subject: REAL_CURRENT_SUBJECT,
    concerns_subject_internal_state,
    claimed_outcome: outcome,
    verified_outcome: self_verified ? { ...outcome } : undefined,
    context,
    time: now,
    provenance,
  };

  try {
    const stored = await recordEffect(effect, now);
    return { ok: true, effect_id: stored.effect.effect_id };
  } catch (e) {
    if (e instanceof EffectReferentialIntegrityError) return { ok: false, message: e.message };
    throw e;
  }
}

/** Network edge — records a real Effect for the real current subject, then
 *  revalidates every screen that projects it. */
export async function createEffectForCurrentUser(formData: FormData): Promise<CreateEffectResult> {
  const result = await createEffectForCurrentUserCore(formData);
  if (result.ok) {
    revalidatePath("/marketplace");
    revalidatePath("/hub/community");
    revalidatePath("/dynamics");
    revalidatePath("/hub");
  }
  return result;
}
