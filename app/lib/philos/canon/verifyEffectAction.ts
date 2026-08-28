"use server";

/**
 * INDEPENDENT VERIFICATION — BY SOMEONE WHO IS NOT YOU.
 *
 * The Effect form hardcoded `verifier_type: "self"` and offered a
 * `self_verified` checkbox, so the same person performed the action, reported
 * the outcome, and confirmed it. `isEffectVerified` treats `self` as always
 * sufficient, which is correct canon for a self-report — but it meant
 * `EvidencePresent` could be closed by one person agreeing with themselves.
 * No information is added when the confirmer and the actor are the same human.
 *
 * THREE IDENTITIES, ALL CHECKED, NONE FROM THE FORM.
 *   verifier — the authenticated viewer, taken from the session.
 *   actor    — the Action's owner, read from the stored Action.
 *   subject  — the Effect's subject, read from the stored Effect.
 * The verifier must differ from BOTH. Differing from the actor alone is not
 * enough: an Effect can concern a person who did not perform the action, and
 * letting the subject certify an outcome about themselves is the same
 * self-confirmation wearing a different label.
 *
 * WHAT THIS DOES NOT DO. It does not weaken `isEffectVerified`, and it does
 * not touch canon's rule that a `third_party` verification of an internal
 * state needs the subject's consent — that check is applied here too, before
 * anything is written.
 */
import { revalidatePath } from "next/cache";

import { resolveViewerContext } from "../identity/viewerContext";
import { createIdGenerator, systemClock } from "../eventStore";
import { loadActions } from "./actionStoreAccessor";
import { loadEffects } from "./effectStoreAccessor";
import { isActionAdmissible } from "./actionStore";
import { isEffectAdmissible } from "./effectStore";
import { checkIndependentEvidence, isIndependentKind } from "./independentEvidence";
import type { OutcomeVerification, VerifierType } from "./outcomeVerification";
import { loadVerifications, verificationStore } from "./outcomeVerificationStoreAccessor";

/** Every way an independent verification can be refused. A closed set. */
export type VerifyRefusal =
  | "effect_not_found"
  | "effect_not_real"
  | "action_not_found"
  | "action_not_real"
  | "already_verified"
  | "verifier_is_subject"
  | "verifier_is_actor"
  | "verifier_id_missing"
  | "verifier_type_self_not_independent"
  | "internal_state_needs_subject_consent"
  | "invalid_verification"
  | "no_verification";

export type VerifyEffectResult =
  | { ok: true; effect_id: string; verifier_id: string }
  | { ok: false; reason: VerifyRefusal; message: string };

const TEXT: Record<VerifyRefusal, string> = {
  effect_not_found: "התוצאה שנבחרה אינה קיימת במאגר",
  effect_not_real: "לתוצאה שנבחרה אין מקור REAL",
  action_not_found: "הפעולה שהתוצאה מקושרת אליה אינה קיימת",
  action_not_real: "לפעולה המקושרת אין מקור REAL",
  already_verified: "התוצאה הזו כבר אומתה — אימות נרשם פעם אחת",
  verifier_is_subject: "אי אפשר לאמת תוצאה שנוגעת לך עצמך — אישור עצמי אינו אימות",
  verifier_is_actor: "אי אפשר לאמת תוצאה של פעולה שאתה ביצעת — זה אותו אדם משני צדדים",
  verifier_type_self_not_independent: "סוג האימות self אינו אימות עצמאי — יש לבחור counterparty, third_party או observed_measured",
  internal_state_needs_subject_consent: "התוצאה נוגעת למצב הפנימי של הנבדק — נדרשת הסכמתו המפורשת לאימות",
  invalid_verification: "רשומת האימות אינה תקינה — יש למלא ניסוח, שיטה, מקור וודאות בין 0 ל־1",
  verifier_id_missing: "לא ניתן לזהות מי מאמת — נדרשת כניסה של המאמת",
  no_verification: "לא נמסרה רשומת אימות",
};

const fail = (reason: VerifyRefusal): VerifyEffectResult =>
  ({ ok: false, reason, message: TEXT[reason] });

export async function verifyEffectCore(formData: FormData): Promise<VerifyEffectResult> {
  const viewer = await resolveViewerContext();
  const verifier_id = viewer.subject_id;

  const effect_id = String(formData.get("effect_id") ?? "").trim();
  const verifier_type = String(formData.get("verifier_type") ?? "").trim() as VerifierType;
  const statement = String(formData.get("statement") ?? "").trim();
  const method = String(formData.get("method") ?? "").trim();
  const provenance = String(formData.get("provenance") ?? "").trim();
  const confidence = Number(String(formData.get("confidence") ?? "").trim());
  const subject_consent = formData.get("subject_consent") === "on";

  if (!isIndependentKind(verifier_type)) return fail("verifier_type_self_not_independent");

  const [effects, actions, existing] = await Promise.all([
    loadEffects(), loadActions(), loadVerifications(),
  ]);

  const record = effects.find((r) => r.effect?.effect_id === effect_id);
  if (!record) return fail("effect_not_found");
  if (!isEffectAdmissible(record)) return fail("effect_not_real");
  /* Verification happens once. A second one would let a person keep trying
     verifiers until one agrees. */
  if (existing.some((r) => r.effect_id === effect_id)) return fail("already_verified");

  const action = actions.find((r) => r.action?.action_id === record.effect.action_ref);
  if (!action) return fail("action_not_found");
  if (!isActionAdmissible(action)) return fail("action_not_real");

  const verification: OutcomeVerification = {
    statement, provenance, verifier_type, method,
    confidence, time: systemClock.now(),
    ...(subject_consent ? { subject_consent: true } : {}),
    /* SERVER-DERIVED. No form field reaches this — the whole point is that
       the person cannot name themselves as somebody else. */
    verifier_id,
  };

  /* THE RULE ITSELF IS NOT RESTATED HERE. The reader decides what counts as
     evidence; if the writer applied a softer rule, it would happily store
     records the reader then ignores, and the person would be told their
     verification was accepted while the gate stayed shut. Same function,
     same answer, both sides. */
  const check = checkIndependentEvidence({
    verification,
    subject: record.effect.subject,
    actor: action.action.owner,
    concerns_subject_internal_state: record.effect.concerns_subject_internal_state,
  });
  if (!check.independent) return fail(check.refusal);

  await verificationStore().append([{
    verification_id: createIdGenerator().next("verification"),
    effect_id,
    recorded_at: systemClock.now(),
    verification,
    record_origin: "REAL",
  }]);
  return { ok: true, effect_id, verifier_id };
}

export async function verifyEffect(formData: FormData): Promise<VerifyEffectResult> {
  const r = await verifyEffectCore(formData);
  if (r.ok) { revalidatePath("/marketplace"); revalidatePath("/brain"); revalidatePath("/hub"); }
  return r;
}
