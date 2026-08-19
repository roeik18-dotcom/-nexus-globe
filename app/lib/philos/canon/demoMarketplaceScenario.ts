/**
 * DEMO Marketplace scenario — Community → Marketplace → Action → Effect →
 * Dynamics wiring (approved DEMO-data pass). Demonstrates the full canon
 * chain NEED ↔ RESOURCE/OFFER → MATCH → ACTION → EFFECT using literal,
 * schema-valid canon objects run through the REAL, unmodified canon
 * functions (`validateNeed`, `validateOffer`, `evaluateMatch`,
 * `validateTransferAgainstMatch`, `validateEffect`, `isEffectVerified`,
 * `deriveLearning`, `computeStateDelta`) — never a second/parallel
 * matching engine.
 *
 * **Never written to any real store.** Canon's own `PERSISTENCE_POLICY.md`
 * says Need/Offer/Transfer/Effect/Learning are caller-supplied or (for
 * Action/Effect/Learning, this session's later approval) persisted only
 * through `actionLifecycle.ts::recordAction/recordEffect/recordLearning` —
 * this file calls NONE of those. Every object here is a plain, literal,
 * in-memory value, exactly like `demoCommunities.ts`'s literal `PhilosEvent`
 * objects — real schema, demo content, zero disk writes, zero mutation of
 * the real `.philos-canon-data/*.jsonl` stores.
 *
 * **Connected to a real DEMO gap, not invented from nothing.** The subject
 * (`dg_lior`) and the need (technical knowledge to build a compost
 * facility) are the SAME person and SAME real unresolved allocation
 * (`demo_alloc_compost`, still `"voting"` in `demoCommunities.ts` — that
 * fixture is untouched, its own meaning as an open loop preserved) from
 * `[DEMO] קרן חדשנות ירוקה`. This scenario shows the MECHANISM that could
 * close that gap — it does not silently mark the real demo allocation
 * resolved.
 */
import type { Need } from "./need";
import { validateNeed } from "./need";
import type { Offer } from "./offer";
import { validateOffer } from "./offer";
import type { MatchAttempt, MatchResult } from "./matching";
import { evaluateMatch } from "./matching";
import type { Transfer } from "./transfer";
import { validateTransferAgainstMatch } from "./transfer";
import type { Effect } from "./effect";
import { isEffectVerified, validateEffect } from "./effect";
import type { CellState } from "./cellState";
import type { DeriveLearningParams, Learning } from "./learning";
import { deriveLearning } from "./learning";
import { computeStateDelta, type StateDelta } from "./stateDelta";
import { DEMO_GREEN_INNOVATION_ID } from "../demoCommunities";

export const DEMO_SCENARIO_SUBJECT = "dg_lior";
export const DEMO_SCENARIO_RELATED_ALLOCATION = "demo_alloc_compost";
/** Real reference to the DEMO community this scenario's gap comes from —
 *  imported BY VALUE from `demoCommunities.ts`, never re-typed as a second
 *  string literal, so the two files cannot silently drift apart. Used to
 *  link Marketplace back to Community (bidirectional connectivity, not
 *  just Community → Marketplace). */
export const DEMO_SCENARIO_COMMUNITY_ID = DEMO_GREEN_INNOVATION_ID;

export const DEMO_NEED: Need = {
  need_id: "demo_need_compost_expertise",
  subject: DEMO_SCENARIO_SUBJECT,
  desired_change: "ידע טכני מקצועי להקמת מתקן קומפוסט שכונתי",
  scope: { kind: "domain", domain: "C" },
  provenance: "self_reported",
  context: "[DEMO] תרחיש שוק — קשור ל-demo_alloc_compost (קרן חדשנות ירוקה)",
  time: "2026-08-11T09:00:00+03:00",
  expiry: "2026-09-11T09:00:00+03:00",
  consent_scope: "visible_to_matching_engine",
};

export const DEMO_OFFER: Offer = {
  offer_id: "demo_offer_compost_consultant",
  source: "demo_provider_compost_consultant",
  source_cell: { domain: "C", frame: "I" },
  available_resource: "ייעוץ טכני + ליווי הקמה למתקן קומפוסט שכונתי",
  // Real canon resource-type vocabulary (RESOURCE_TYPE_EXAMPLES, offer.ts) — not invented.
  resource_type: "knowledge",
  amount_or_capacity: "3 מפגשי ייעוץ + ליווי מרחוק",
  competence: "[DEMO] מהנדס סביבה מוסמך, 8 שנות ניסיון בהקמת מתקני קומפוסט קהילתיים",
  willingness: true,
  consent: true,
  availability: "[DEMO] זמין החל מ-2026-08-15",
  cost: "ללא עלות — התנדבות",
  constraints: [],
  expiry: "2026-09-11T09:00:00+03:00",
  provenance: "self_reported",
};

export const DEMO_MATCH_ATTEMPT: MatchAttempt = {
  match_id: "demo_match_compost_1",
  need_ref: DEMO_NEED.need_id,
  offer_ref: DEMO_OFFER.offer_id,
  source: DEMO_OFFER.source,
  target: DEMO_NEED.subject,
  cell: { domain: "C", frame: "I" },
  CAN: true,
  WANTS: true,
  ALLOWED: true,
  APPROPRIATE: true,
  AVAILABLE: true,
  CONSENT: true,
  context: "[DEMO] תרחיש שוק",
  time: "2026-08-11T10:00:00+03:00",
};

export function buildDemoMatchResult(): MatchResult {
  return evaluateMatch(DEMO_MATCH_ATTEMPT, DEMO_NEED, DEMO_OFFER);
}

export const DEMO_TRANSFER: Transfer = {
  action_id: "demo_action_compost_consulting",
  type: "transfer",
  owner: DEMO_OFFER.source,
  mechanism_scope: "melting_pot",
  consent: true,
  inputs: [DEMO_NEED.need_id, DEMO_OFFER.offer_id, DEMO_SCENARIO_RELATED_ALLOCATION],
  reversibility: "irreversible — ידע שהועבר",
  time: "2026-08-12T09:00:00+03:00",
  provenance: "self_reported",
  source: DEMO_OFFER.source,
  target: DEMO_NEED.subject,
  source_cell: { domain: "C", frame: "I" },
  target_cell: { domain: "C", frame: "I" },
  resource: DEMO_OFFER.available_resource,
  resource_type: DEMO_OFFER.resource_type,
  amount: DEMO_OFFER.amount_or_capacity,
  conversion_mechanism: "מפגשי ייעוץ ישירים + מסמך הדרכה",
  cost: DEMO_OFFER.cost,
  expiry_or_validity: DEMO_OFFER.expiry,
  claimed_outcome: "[DEMO] הועבר ידע טכני מלא להקמת המתקן",
};

export const DEMO_EFFECT: Effect = {
  effect_id: "demo_effect_compost_consulting",
  action_ref: DEMO_TRANSFER.action_id,
  subject: DEMO_NEED.subject,
  concerns_subject_internal_state: false,
  claimed_outcome: {
    statement: "[DEMO] dg_lior מדווח שקיבל את הידע הדרוש ומתחיל בהקמת המתקן",
    provenance: "self_reported",
    verifier_type: "self",
    confidence: 0.85,
    time: "2026-08-13T12:00:00+03:00",
    method: "self_report_checkin",
  },
  verified_outcome: {
    statement: "[DEMO] היועץ אישר שהמפגשים התקיימו והידע הועבר במלואו",
    provenance: "self_reported",
    verifier_type: "counterparty",
    confidence: 0.9,
    time: "2026-08-13T14:00:00+03:00",
    method: "community_attestation",
  },
  context: "[DEMO] תרחיש שוק",
  time: "2026-08-13T12:00:00+03:00",
  provenance: "self_reported",
};

export const DEMO_PRIOR_STATE: CellState = { domain: "C", frame: "I", level: -2, stability: 0.4 };
export const DEMO_CANDIDATE_STATE_PRIME: CellState = { domain: "C", frame: "I", level: 0, stability: 0.6 };

export function buildDemoLearning(): Learning {
  const params: DeriveLearningParams = {
    learning_id: "demo_learning_compost_consulting",
    prior_state_ref: "demo_cellstate_prior",
    effect_ref: DEMO_EFFECT.effect_id,
    outcome_verification_ref: "demo_verification_1",
    update_method: "manual_review",
    provenance: "self_reported",
    confidence: 0.85,
    time: "2026-08-13T15:00:00+03:00",
    context: "[DEMO] תרחיש שוק",
    effect: DEMO_EFFECT,
    priorState: DEMO_PRIOR_STATE,
    candidateStatePrime: DEMO_CANDIDATE_STATE_PRIME,
  };
  return deriveLearning(params);
}

export function buildDemoDelta(): StateDelta | null {
  const learning = buildDemoLearning();
  if (learning.result.kind !== "state_prime") return null;
  return computeStateDelta(DEMO_PRIOR_STATE, learning.result.candidate_state_prime);
}

export type CommitmentStage =
  | "proposed"
  | "agreed"
  | "resource_committed"
  | "executed"
  | "effect_pending"
  | "effect_observed"
  | "closed_learning";

export const COMMITMENT_STAGE_LABEL: Record<CommitmentStage, string> = {
  proposed: "PROPOSED — הוצע",
  agreed: "AGREED — הותאם, טרם התחייבות",
  resource_committed: "RESOURCE COMMITTED — משאב הוקצה",
  executed: "EXECUTED — הפעולה בוצעה",
  effect_pending: "EFFECT PENDING — ממתין לעדות",
  effect_observed: "EFFECT OBSERVED — עדות נצפתה",
  closed_learning: "CLOSED / LEARNING — נסגר, נלמד",
};

/**
 * A match does not automatically become an Action (explicit product
 * requirement). This is NOT a second, invented state machine — it is a
 * real, checked read of the SAME real DEMO objects already defined above
 * (match/transfer/effect/learning), reporting the furthest stage that
 * object graph actually reached. No stage is asserted without the real
 * object backing it.
 */
export function deriveCommitmentStage(): CommitmentStage {
  const match = buildDemoMatchResult();
  if (match.decision !== "permitted") return "proposed";
  // "agreed" and "resource_committed" are not separately observable here:
  // canon's Transfer type has no pre-execution "agreed but not yet
  // committed" state of its own — a Transfer object IS the commitment
  // record. This fixture's DEMO_TRANSFER exists unconditionally, so a
  // permitted match always reads as at least "executed" in this scenario;
  // a real, live Marketplace would need canon to grow an Agreement
  // primitive to represent the gap honestly instead of skipping it.
  if (!DEMO_EFFECT.claimed_outcome) return "executed";
  if (!DEMO_EFFECT.verified_outcome) return "effect_pending";
  const learning = buildDemoLearning();
  if (learning.result.kind === "state_prime") return "closed_learning";
  return "effect_observed";
}

/** Real, checked structural validity of every DEMO object — proves this
 *  scenario is schema-valid canon data, not display-only fiction. */
export function demoScenarioIsSchemaValid(): boolean {
  const needOk = validateNeed(DEMO_NEED).valid;
  const offerOk = validateOffer(DEMO_OFFER).valid;
  const match = buildDemoMatchResult();
  const transferOk = validateTransferAgainstMatch(DEMO_TRANSFER, match).valid;
  const effectOk = validateEffect(DEMO_EFFECT).valid;
  return needOk && offerOk && match.decision === "permitted" && transferOk && effectOk && isEffectVerified(DEMO_EFFECT);
}
