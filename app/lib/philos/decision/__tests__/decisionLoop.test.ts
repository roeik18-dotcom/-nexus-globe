/**
 * THE END-TO-END PROOF, in one isolated store.
 *
 *   Observation → DecisionCase → Decision → authorized Action → Effect
 *   → DecisionReview → Evidence → Learning → a LATER DecisionCase that
 *   references that Learning.
 *
 * Everything runs against injected in-memory stores and an injected viewer.
 * Nothing here can reach `.philos-canon-data`.
 *
 * The acceptance assertions live at the bottom, under "ACCEPTANCE": one
 * object per semantic fact, no duplicated Effect/Evidence/Learning, outcome
 * verification never implying causality, a later decision able to name the
 * earlier Learning that shaped it, and unresolved links failing closed.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { recordAuthenticatedAction, recordLearning } from "@/app/lib/philos/canon/actionLifecycle";
import type { Action } from "@/app/lib/philos/canon/action";
import { InMemoryActionStore } from "@/app/lib/philos/canon/actionStore";
import { _setActionStore, loadActions } from "@/app/lib/philos/canon/actionStoreAccessor";
import type { CellState } from "@/app/lib/philos/canon/cellState";
import { InMemoryEffectStore } from "@/app/lib/philos/canon/effectStore";
import { _setEffectStore, loadEffects } from "@/app/lib/philos/canon/effectStoreAccessor";
import { InMemoryLearningStore } from "@/app/lib/philos/canon/learningStore";
import { _setLearningStore, loadLearnings } from "@/app/lib/philos/canon/learningStoreAccessor";
import { InMemoryVerificationStore } from "@/app/lib/philos/canon/outcomeVerificationStore";
import {
  _setVerificationStore,
  loadVerifications,
  verificationStore,
} from "@/app/lib/philos/canon/outcomeVerificationStoreAccessor";
import {
  setViewerProvider,
  type ViewerContext,
  type ViewerProvider,
} from "@/app/lib/philos/identity/viewerContext";
import {
  attachToCase,
  openCaseCore,
  recordDecisionCore,
  recordReviewCore,
} from "../decisionActions";
import { resolveCase } from "../decisionCaseResolver";
import { learningsCarriedIn } from "../decisionCaseResolver";
import {
  _setDecisionCaseStore,
  _setDecisionReviewStore,
  _setDecisionStore,
  inMemoryDecisionCaseStore,
  inMemoryDecisionReviewStore,
  inMemoryDecisionStore,
  loadCases,
  loadDecisionReviews,
  loadDecisions,
} from "../decisionStore";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

function viewerAs(subject: string): ViewerProvider {
  const ctx = {
    subject_id: subject,
    person_id: subject === "person_roei" ? "p_you" : "p_bet",
    source: "LOCAL_SINGLE_USER",
  } as ViewerContext;
  return { kind: "LOCAL_SINGLE_USER", resolve: async () => ctx };
}

/** A real Observation id. The canon event store is not exercised here; the
 *  case carries the reference and the resolver does not dereference
 *  observations (see `decisionCaseResolver.ts`). */
const OBSERVATION_REF = "ce_observation_0001";

const PRIOR_STATE: CellState = { domain: "G", frame: "I", level: -2, stability: 0.4 };
const NEXT_STATE: CellState = { domain: "G", frame: "I", level: -1, stability: 0.5 };

async function seedAction(id: string): Promise<string> {
  const action: Action = {
    action_id: id,
    type: "non_transfer",
    owner: "person_roei",
    mechanism_scope: "self_regulation",
    consent: true,
    inputs: [OBSERVATION_REF],
    reversibility: "reversible — can be undone within 24h",
    time: "2026-08-28T09:30:00+03:00",
    provenance: "self-initiated for the decision case",
  };
  const stored = await recordAuthenticatedAction(action, "2026-08-28T09:30:05+03:00");
  return stored.action.action_id;
}

beforeEach(() => {
  _setDecisionCaseStore(inMemoryDecisionCaseStore());
  _setDecisionStore(inMemoryDecisionStore());
  _setDecisionReviewStore(inMemoryDecisionReviewStore());
  _setActionStore(new InMemoryActionStore());
  _setEffectStore(new InMemoryEffectStore());
  _setVerificationStore(new InMemoryVerificationStore());
  _setLearningStore(new InMemoryLearningStore());
  setViewerProvider(viewerAs("person_roei"));
});

afterEach(() => {
  _setDecisionCaseStore(null);
  _setDecisionStore(null);
  _setDecisionReviewStore(null);
  _setActionStore(null);
  _setEffectStore(null);
  _setVerificationStore(null);
  _setLearningStore(null);
});

describe("the full loop, end to end", () => {
  it("runs Observation → Case → Decision → Action → Effect → Review → Evidence → Learning → a later Case", async () => {
    // ── 1. OBSERVATION → CASE ────────────────────────────────────────────
    const opened = await openCaseCore(
      formData({
        title: "השרשרת אינה מחוברת לקנון",
        risk_level: "significant",
        observation_refs: OBSERVATION_REF,
      }),
    );
    expect(opened.ok).toBe(true);
    const case_id = opened.case_id!;

    // ── 2. THE ACTION, recorded through the CANON writer ─────────────────
    const action_ref = await seedAction("act_case_1");

    // ── 3. THE DECISION, citing the observation and the action ───────────
    const decided = await recordDecisionCore(
      formData({
        case_id,
        statement: "לחבר את לולאת ההחלטות לשדרת הקנון",
        because: "המודל המקביל שכפל תוצאה, ראיה ולמידה",
        decision_logic: "העדפתי הפניה על פני שכפול, גם במחיר עבודה נוספת",
        expected_outcome: "כל עובדה סמנטית תישמר באובייקט אחד בלבד",
        alternatives: "להשאיר את המודל המקביל ולסנכרן אותו",
        observation_refs: OBSERVATION_REF,
        chosen_action_ref: action_ref,
        horizon_days: "7",
      }),
    );
    expect(decided.ok).toBe(true);
    const decision_ref = decided.decision_id!;

    // The case now points at both, and its status advanced.
    const afterDecision = (await loadCases()).find((c) => c.case_id === case_id)!;
    expect(afterDecision.decision_ref).toBe(decision_ref);
    expect(afterDecision.action_refs).toEqual([action_ref]);
    expect(afterDecision.status).toBe("authorized");

    // ── 4. THE REVIEW creates the EFFECT through the canon writer ────────
    const reviewed = await recordReviewCore(
      formData({
        decision_ref,
        what_happened: "הסקירה יוצרת Effect אמיתי במקום לאחסן טקסט תוצאה",
        expectation_met: "met",
        alternative_explanations: "אולי זה קרה ממילא בגלל שינוי אחר",
        intervening_factors: "עבודת ניקוי מקבילה על ה-UI",
        causal_relation: "causally_supported",
      }),
    );
    expect(reviewed.ok).toBe(true);
    const effect_ref = reviewed.effect_ref!;

    // The Effect is REAL, in the canon store, and holds the outcome text.
    const effects = await loadEffects();
    expect(effects).toHaveLength(1);
    expect(effects[0].effect.effect_id).toBe(effect_ref);
    expect(effects[0].effect.action_ref).toBe(action_ref);
    expect(effects[0].record_origin).toBe("REAL");
    expect(effects[0].effect.claimed_outcome.statement).toContain("Effect אמיתי");

    // The review does NOT carry the outcome text — it references it.
    const review = (await loadDecisionReviews())[0].review;
    expect(review.effect_ref).toBe(effect_ref);
    expect(Object.keys(review)).not.toContain("what_happened");
    expect(Object.keys(review)).not.toContain("verification_tier");
    expect(Object.keys(review)).not.toContain("reviewer");

    // The case at `significant` risk is not met by a self-attested outcome,
    // so the causal claim was capped — verification gates it, never grants it.
    expect(reviewed.capped).toBe(true);
    expect(reviewed.causal_relation).toBe("associated_with");

    // ── 5. EVIDENCE through the existing verification store ─────────────
    const [verification] = await verificationStore().append([
      {
        verification_id: "ver_case_1",
        effect_id: effect_ref,
        recorded_at: "2026-08-28T12:00:00+03:00",
        verification: {
          statement: "נבדק מול המאגר: קיים Effect אחד בלבד",
          provenance: "בדיקה של אדם שני",
          verifier_type: "third_party",
          method: "קריאת המאגר",
          confidence: 0.9,
          time: "2026-08-28T12:00:00+03:00",
          verifier_id: "person_bet",
        },
        record_origin: "REAL",
      },
    ]);
    expect(
      (await attachToCase(case_id, "evidence_refs", verification.verification_id, "evidenced")).ok,
    ).toBe(true);

    // ── 6. LEARNING through the CANON learning writer ────────────────────
    // Canon requires the Effect to carry a verified outcome before a Learning
    // may produce a state_prime, so the Effect is re-recorded with it. This is
    // canon's gate, unmodified.
    const withVerified = {
      ...effects[0].effect,
      verified_outcome: verification.verification,
    };
    _setEffectStore(new InMemoryEffectStore([{ ...effects[0], effect: withVerified }]));

    const learning = await recordLearning({
      learning_id: "learn_case_1",
      prior_state_ref: "state_t0_case_1",
      effect_ref,
      effect: withVerified,
      outcome_verification_ref: verification.verification_id,
      update_method: "השוואת מצב לפני ואחרי",
      provenance: "decision case review",
      confidence: 0.7,
      time: "2026-08-28T13:00:00+03:00",
      context: "הפניה במקום שכפול מפחיתה סתירות בין רשומות",
      priorState: PRIOR_STATE,
      candidateStatePrime: NEXT_STATE,
      recordedAt: "2026-08-28T13:00:05+03:00",
    });
    expect(learning.learning.result.kind).toBe("state_prime");
    expect(
      (await attachToCase(case_id, "learning_refs", learning.learning.learning_id, "learned")).ok,
    ).toBe(true);

    // ── 7. A LATER CASE that carries that Learning forward ───────────────
    const later = await openCaseCore(
      formData({ title: "להחיל את אותו כלל על מסוף נוסף", risk_level: "low" }),
    );
    expect(later.ok).toBe(true);
    expect(
      (await attachToCase(later.case_id!, "learning_refs", learning.learning.learning_id)).ok,
    ).toBe(true);

    // ── ACCEPTANCE ───────────────────────────────────────────────────────

    // (a) ONE OBJECT PER SEMANTIC FACT.
    expect(await loadEffects()).toHaveLength(1);
    expect(await loadVerifications()).toHaveLength(1);
    expect(await loadLearnings()).toHaveLength(1);
    expect(await loadDecisions()).toHaveLength(1);
    expect(await loadDecisionReviews()).toHaveLength(1);
    expect(await loadActions()).toHaveLength(1);

    // (b) THE CASE RESOLVES, and every reference points at a real record.
    const resolved = await resolveCase(
      (await loadCases()).find((c) => c.case_id === case_id)!,
    );
    expect(resolved.resolved).toBe(true);
    expect(resolved.unresolved).toEqual([]);
    expect(resolved.effects).toHaveLength(1);
    expect(resolved.evidence).toHaveLength(1);
    expect(resolved.learnings).toHaveLength(1);
    expect(resolved.decision!.decision_id).toBe(decision_ref);

    // (c) THE OUTCOME LEVEL IS DERIVED, not stored anywhere.
    expect(resolved.outcome_levels[effect_ref]).toBe("independently_verified");
    expect(Object.keys(resolved.reviews[0])).not.toContain("outcome_level");

    // (d) A LATER DECISION CAN NAME THE EARLIER LEARNING THAT SHAPED IT.
    const laterResolved = await resolveCase(
      (await loadCases()).find((c) => c.case_id === later.case_id)!,
    );
    expect(laterResolved.resolved).toBe(true);
    const carried = learningsCarriedIn(laterResolved);
    expect(carried.map((l) => l.learning.learning_id)).toEqual(["learn_case_1"]);
  });
});

describe("ACCEPTANCE — verification does not imply causality", () => {
  it("keeps the causal rung where the evidence left it even after independent verification", async () => {
    const opened = await openCaseCore(formData({ title: "בדיקת הפרדת הצירים", risk_level: "low" }));
    const action_ref = await seedAction("act_case_2");
    const decided = await recordDecisionCore(
      formData({
        case_id: opened.case_id!,
        statement: "החלטה",
        because: "סיבה",
        decision_logic: "שיקול",
        expected_outcome: "ציפייה",
        chosen_action_ref: action_ref,
        horizon_days: "7",
      }),
    );

    // No alternative explanation recorded → `causally_supported` is refused,
    // and the strongest possible verification cannot change that.
    const reviewed = await recordReviewCore(
      formData({
        decision_ref: decided.decision_id!,
        what_happened: "זה קרה",
        expectation_met: "met",
        causal_relation: "causally_supported",
      }),
    );
    expect(reviewed.causal_relation).toBe("probably_contributed");
    expect(reviewed.capped).toBe(true);

    // The stored rung is the one that was earned, not the one requested.
    const review = (await loadDecisionReviews())[0].review;
    expect(review.causal_relation).toBe("probably_contributed");
  });
});

describe("ACCEPTANCE — unresolved links fail closed", () => {
  it("refuses to attach a reference that does not resolve", async () => {
    const opened = await openCaseCore(formData({ title: "מקרה", risk_level: "low" }));
    const r = await attachToCase(opened.case_id!, "effect_refs", "eff_does_not_exist");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("unresolved");
    // The case is unchanged: no revision was appended.
    const c = (await loadCases()).find((x) => x.case_id === opened.case_id)!;
    expect(c.effect_refs).toEqual([]);
  });

  it("reports an unresolved reference rather than silently dropping it", async () => {
    const opened = await openCaseCore(formData({ title: "מקרה", risk_level: "low" }));
    const c = (await loadCases()).find((x) => x.case_id === opened.case_id)!;
    const broken = { ...c, effect_refs: ["eff_ghost"] };
    const resolved = await resolveCase(broken);
    expect(resolved.resolved).toBe(false);
    expect(resolved.unresolved).toEqual([{ field: "effect_refs", ref: "eff_ghost" }]);
  });

  it("refuses to review a decision that has no action to hang an Effect from", async () => {
    const opened = await openCaseCore(formData({ title: "מקרה", risk_level: "low" }));
    const decided = await recordDecisionCore(
      formData({
        case_id: opened.case_id!,
        statement: "החלטה",
        because: "סיבה",
        decision_logic: "שיקול",
        expected_outcome: "ציפייה",
        no_action_because: "מחכה לתשובה מבחוץ",
        horizon_days: "7",
      }),
    );
    expect(decided.ok).toBe(true);
    const r = await recordReviewCore(
      formData({
        decision_ref: decided.decision_id!,
        what_happened: "משהו קרה",
        expectation_met: "met",
      }),
    );
    expect(r.reason).toBe("no_action_to_review");
    // No Effect was invented to make the review possible.
    expect(await loadEffects()).toHaveLength(0);
  });

  it("refuses a decision that names an Action which does not exist", async () => {
    const opened = await openCaseCore(formData({ title: "מקרה", risk_level: "low" }));
    const r = await recordDecisionCore(
      formData({
        case_id: opened.case_id!,
        statement: "החלטה",
        because: "סיבה",
        decision_logic: "שיקול",
        expected_outcome: "ציפייה",
        chosen_action_ref: "act_ghost",
        horizon_days: "7",
      }),
    );
    expect(r.reason).toBe("action_not_found");
  });

  it("refuses an Effect that belongs to a different Action", async () => {
    const opened = await openCaseCore(formData({ title: "מקרה", risk_level: "low" }));
    const mine = await seedAction("act_mine");
    const other = await seedAction("act_other");
    const decided = await recordDecisionCore(
      formData({
        case_id: opened.case_id!,
        statement: "החלטה",
        because: "סיבה",
        decision_logic: "שיקול",
        expected_outcome: "ציפייה",
        chosen_action_ref: mine,
        horizon_days: "7",
      }),
    );
    // An Effect recorded against the OTHER action.
    const otherCase = await openCaseCore(formData({ title: "אחר", risk_level: "low" }));
    const otherDecision = await recordDecisionCore(
      formData({
        case_id: otherCase.case_id!,
        statement: "אחרת",
        because: "סיבה",
        decision_logic: "שיקול",
        expected_outcome: "ציפייה",
        chosen_action_ref: other,
        horizon_days: "7",
      }),
    );
    const otherReview = await recordReviewCore(
      formData({
        decision_ref: otherDecision.decision_id!,
        what_happened: "קרה משהו אחר",
        expectation_met: "met",
      }),
    );

    const r = await recordReviewCore(
      formData({
        decision_ref: decided.decision_id!,
        what_happened: "מנסה לצרף תוצאה של פעולה אחרת",
        expectation_met: "met",
        effect_ref: otherReview.effect_ref!,
      }),
    );
    expect(r.reason).toBe("effect_action_mismatch");
  });
});

describe("ACCEPTANCE — no duplicate records", () => {
  it("never writes a second Effect when one is named", async () => {
    const opened = await openCaseCore(formData({ title: "מקרה", risk_level: "low" }));
    const action_ref = await seedAction("act_reuse");
    const decided = await recordDecisionCore(
      formData({
        case_id: opened.case_id!,
        statement: "החלטה",
        because: "סיבה",
        decision_logic: "שיקול",
        expected_outcome: "ציפייה",
        chosen_action_ref: action_ref,
        horizon_days: "7",
      }),
    );
    const first = await recordReviewCore(
      formData({
        decision_ref: decided.decision_id!,
        what_happened: "התוצאה",
        expectation_met: "met",
      }),
    );
    expect(await loadEffects()).toHaveLength(1);

    // A second review of the same decision is refused outright.
    const second = await recordReviewCore(
      formData({
        decision_ref: decided.decision_id!,
        what_happened: "שוב",
        expectation_met: "met",
        effect_ref: first.effect_ref!,
      }),
    );
    expect(second.reason).toBe("already_reviewed");
    expect(await loadEffects()).toHaveLength(1);
  });

  it("does not add the same reference to a case twice", async () => {
    const opened = await openCaseCore(formData({ title: "מקרה", risk_level: "low" }));
    const action_ref = await seedAction("act_dedupe");
    await attachToCase(opened.case_id!, "action_refs", action_ref);
    await attachToCase(opened.case_id!, "action_refs", action_ref);
    const c = (await loadCases()).find((x) => x.case_id === opened.case_id)!;
    expect(c.action_refs).toEqual([action_ref]);
  });
});
