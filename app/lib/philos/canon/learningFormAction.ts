"use server";

/**
 * LOOP 6 (LEARNING) — the acquisition path for the real State' boundary
 * (`recordLearning`, `actionLifecycle.ts`, persisted but never reachable
 * from any UI). Nothing here computes a candidate state — canon's own
 * design (`learning.ts` header) forbids that; `candidate_level`/
 * `candidate_stability` are the caller's own real, human self-assessment
 * of their new state, exactly the same kind of self-report already
 * accepted for a fresh Observation (`observationFormAction.ts`) — never a
 * formula-derived number.
 *
 * `priorState` is never invented: it is derived (`deriveCellStateForPersisted
 * Observation`) from a real, already-persisted Observation the caller
 * picks by `canon_event_id` — the same derivation `cellStateDerivation.ts`
 * already uses elsewhere.
 *
 * THE EVIDENCE PRECONDITION (added after the self-verification path was
 * removed). Learning is the step where a claim is allowed to change what the
 * system believes about a person. Canon is explicit that a claimed outcome
 * must never update State' as though verified — so an Effect alone is not
 * enough. There must ALSO be a verification, written separately, by a
 * signed-in person who is neither the subject nor the actor
 * (`independentEvidence.ts` holds that rule; this module does not restate
 * it). Without one, this writer refuses and records nothing.
 *
 * WHY THE EFFECT IS JOINED, NOT MUTATED. `deriveLearning` is a pure canon
 * function that reads `effect.verified_outcome` to decide whether a state
 * change is permitted. The stored Effect deliberately no longer carries that
 * field — the person reporting an outcome cannot certify it — so the
 * verification is JOINED onto the Effect in memory, for this derivation only,
 * from the real verification record. Nothing is invented and nothing is
 * written back: the stored Effect still says, truthfully, "reported"; the
 * separate verification record still says who checked it; and the pure
 * function finally sees both, which is what it always needed.
 *
 * `outcome_verification_ref` cites that verification record's own id.
 */
import { revalidatePath } from "next/cache";

import { recordLearning, LearningReferentialIntegrityError } from "./actionLifecycle";
import { deriveCellStateForPersistedObservation } from "./cellStateDerivation";
import { canonEventStore } from "./canonEventStoreAccessor";
import { loadEffects } from "./effectStoreAccessor";
import { loadActions } from "./actionStoreAccessor";
import { checkIndependentEvidence, type EvidenceRefusal } from "./independentEvidence";
import { loadVerifications } from "./outcomeVerificationStoreAccessor";
import { createIdGenerator, systemClock } from "@/app/lib/philos/eventStore";

export type CreateLearningResult =
  | { ok: true; learning_id: string; outcome: "state_prime" | "no_update"; reason?: string }
  | { ok: false; message: string; refusal?: "evidence_missing" | EvidenceRefusal };

/** Testable core — no `revalidatePath`. */
export async function createLearningForCurrentUserCore(formData: FormData): Promise<CreateLearningResult> {
  const effect_ref = String(formData.get("effect_ref") ?? "").trim();
  const canon_event_id = String(formData.get("canon_event_id") ?? "").trim();
  const update_method = String(formData.get("update_method") ?? "").trim();
  const provenance = String(formData.get("provenance") ?? "").trim();
  const context = String(formData.get("context") ?? "").trim();
  const confidence = Number(formData.get("confidence"));
  const candidateLevel = Number(formData.get("candidate_level"));
  const candidateStability = Number(formData.get("candidate_stability"));

  if (!effect_ref) return { ok: false, message: "effect_ref is required — pick a real, already-recorded Effect" };
  if (!canon_event_id) return { ok: false, message: "canon_event_id is required — pick a real, already-recorded Observation as the prior state" };
  if (!update_method) return { ok: false, message: "update_method is required" };
  if (!provenance) return { ok: false, message: "provenance is required" };
  if (!context) return { ok: false, message: "context is required" };
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return { ok: false, message: "confidence must be a number between 0 and 1" };
  if (!Number.isFinite(candidateLevel)) return { ok: false, message: "candidate_level must be a number" };
  if (!Number.isFinite(candidateStability)) return { ok: false, message: "candidate_stability must be a number" };

  const now = systemClock.now();

  const [effects, actions, verifications] = await Promise.all([
    loadEffects(), loadActions(), loadVerifications(),
  ]);
  const effectRecord = effects.find((r) => r.effect.effect_id === effect_ref);
  if (!effectRecord) return { ok: false, message: "no real, already-recorded Effect matches effect_ref" };

  /* THE EVIDENCE PRECONDITION. See module header. */
  const forThisEffect = verifications.filter((r) => r.effect_id === effect_ref);
  if (forThisEffect.length === 0) {
    return {
      ok: false,
      refusal: "evidence_missing",
      message: "לתוצאה הזו אין עדיין אימות עצמאי — בלי ראיה אין מסקנה. אדם אחר, שאינו מי שביצע את הפעולה ואינו מי שהתוצאה נוגעת אליו, צריך לאמת אותה תחילה.",
    };
  }
  /* The actor is read from the stored Action, never from the form. An Action
     that cannot be found leaves the actor unknown, and `checkIndependent
     Evidence` then fails closed rather than assuming independence. */
  const actionRecord = actions.find((r) => r.action?.action_id === effectRecord.effect.action_ref);
  let accepted: (typeof forThisEffect)[number] | undefined;
  let lastRefusal: EvidenceRefusal = "no_verification";
  for (const candidate of forThisEffect) {
    const check = checkIndependentEvidence({
      verification: candidate.verification,
      subject: effectRecord.effect.subject,
      actor: actionRecord?.action.owner,
      concerns_subject_internal_state: effectRecord.effect.concerns_subject_internal_state,
    });
    if (check.independent) { accepted = candidate; break; }
    lastRefusal = check.refusal;
  }
  if (!accepted) {
    return {
      ok: false,
      refusal: lastRefusal,
      message: "קיים אימות לתוצאה, אך הוא אינו עצמאי ולכן אינו ראיה קבילה — מסקנה לא נרשמה.",
    };
  }

  const derivation = await deriveCellStateForPersistedObservation(canonEventStore(), canon_event_id, now);
  if (derivation.kind !== "cell_state") {
    return { ok: false, message: `cannot derive a real prior state from that Observation: ${derivation.reason}` };
  }
  const priorState = derivation.candidate;
  const priorSystemicChannel = derivation.provenance.source_observation_systemic_channel;

  try {
    const stored = await recordLearning({
      learning_id: createIdGenerator().next("learning"),
      prior_state_ref: canon_event_id,
      outcome_verification_ref: accepted.verification_id,
      update_method,
      provenance,
      confidence,
      time: now,
      context,
      effect_ref,
      /* JOINED, NOT MUTATED — see module header. */
      effect: { ...effectRecord.effect, verified_outcome: accepted.verification },
      priorState,
      priorSystemicChannel,
      candidateStatePrime: { domain: priorState.domain, frame: priorState.frame, level: candidateLevel, stability: candidateStability },
      candidateSystemicChannel: priorSystemicChannel,
      candidateSystemicChannelForDelta: priorSystemicChannel,
      recordedAt: now,
    });
    const result = stored.learning.result;
    return {
      ok: true,
      learning_id: stored.learning.learning_id,
      outcome: result.kind,
      reason: result.kind === "no_update" ? result.reason : undefined,
    };
  } catch (e) {
    if (e instanceof LearningReferentialIntegrityError) return { ok: false, message: e.message };
    throw e;
  }
}

/** Network edge — records a real Learning for the real current subject's
 *  own real prior state, then revalidates every screen that projects it. */
export async function createLearningForCurrentUser(formData: FormData): Promise<CreateLearningResult> {
  const result = await createLearningForCurrentUserCore(formData);
  if (result.ok) {
    revalidatePath("/marketplace");
    revalidatePath("/hub/community");
    revalidatePath("/dynamics");
    revalidatePath("/hub");
    revalidatePath("/brain");
  }
  return result;
}
