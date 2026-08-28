/**
 * THE NINE-STEP PROOF, on the case Roei put forward.
 *
 * A person's partner does not match what their social circle expects. The
 * question is not "is there a gap" — it is why that gap became important, by
 * which values, which of those values collided, what price the decision paid,
 * and what actually happened to each value afterwards.
 *
 *   1. what the gap was
 *   2. who interpreted it
 *   3. by which values
 *   4. which values collided
 *   5. which trade-off was chosen
 *   6. what was done
 *   7. what the real impact on each value was
 *   8. which evidence supports that
 *   9. how it changed a later decision
 *
 * Everything runs in isolated in-memory stores. Nothing reaches
 * `.philos-canon-data`, and no REAL record outside these stores is touched.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { recordAuthenticatedAction } from "@/app/lib/philos/canon/actionLifecycle";
import type { Action } from "@/app/lib/philos/canon/action";
import { InMemoryActionStore } from "@/app/lib/philos/canon/actionStore";
import { _setActionStore } from "@/app/lib/philos/canon/actionStoreAccessor";
import { InMemoryEffectStore } from "@/app/lib/philos/canon/effectStore";
import { _setEffectStore } from "@/app/lib/philos/canon/effectStoreAccessor";
import { InMemoryLearningStore } from "@/app/lib/philos/canon/learningStore";
import { _setLearningStore } from "@/app/lib/philos/canon/learningStoreAccessor";
import { InMemoryVerificationStore } from "@/app/lib/philos/canon/outcomeVerificationStore";
import {
  _setVerificationStore,
  verificationStore,
} from "@/app/lib/philos/canon/outcomeVerificationStoreAccessor";
import { InMemoryValueDeclarationStore } from "@/app/lib/philos/community/valueDeclarationStore";
import { _setValueDeclarationStore } from "@/app/lib/philos/community/valueDeclarationStoreAccessor";
import type { ValueDeclaration } from "@/app/lib/philos/community/valueDeclaration";
import {
  setViewerProvider,
  type ViewerContext,
  type ViewerProvider,
} from "@/app/lib/philos/identity/viewerContext";
import {
  _setAppraisalStore,
  _setGapStore,
  _setValueConflictStore,
  _setValueImpactStore,
  _setValueTradeoffStore,
  inMemoryAppraisalStore,
  inMemoryGapStore,
  inMemoryValueConflictStore,
  inMemoryValueImpactStore,
  inMemoryValueTradeoffStore,
  loadValueImpacts,
} from "../appraisalStore";
import {
  recordAppraisalCore,
  recordGapCore,
  recordTradeoffCore,
  recordValueConflictCore,
  recordValueImpactCore,
} from "../appraisalActions";
import { openCaseCore, recordDecisionCore, recordReviewCore } from "../decisionActions";
import { resolveCase } from "../decisionCaseResolver";
import {
  _setDecisionCaseStore,
  _setDecisionReviewStore,
  _setDecisionStore,
  inMemoryDecisionCaseStore,
  inMemoryDecisionReviewStore,
  inMemoryDecisionStore,
  loadCases,
} from "../decisionStore";
import { impactMatchedExpectation, tradeoffContradictions } from "../valueMechanism";

function fd(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

function viewerAs(subject: string): ViewerProvider {
  const ctx = {
    subject_id: subject,
    person_id: subject === "person_roei" ? "p_you" : "p_bet",
    source: "LOCAL_SINGLE_USER",
  } as ViewerContext;
  return { kind: "LOCAL_SINGLE_USER", resolve: async () => ctx };
}

/** The two values the person actually declared. Read from the EXISTING
 *  declaration store — this layer never creates a value. */
const DECLARED: ValueDeclaration[] = [
  {
    value_id: "v_love",
    scope: "PERSONAL",
    label: "אהבה וקבלה",
    holder_id: "person_roei",
    declared_by: "person_roei",
    evidence: "הצהרתי על כך בשיחה על מה שחשוב לי בקשר",
    status: "DECLARED",
    created_at: "2026-08-01T09:00:00+03:00",
  },
  {
    value_id: "v_standing",
    scope: "PERSONAL",
    label: "מעמד ואישור חברתי",
    holder_id: "person_roei",
    declared_by: "person_roei",
    evidence: "הצהרתי שחשוב לי איך חבריי רואים אותי",
    status: "DECLARED",
    created_at: "2026-08-01T09:05:00+03:00",
  },
];

const OBSERVATION_REF = "ce_obs_partner_0001";

beforeEach(async () => {
  _setDecisionCaseStore(inMemoryDecisionCaseStore());
  _setDecisionStore(inMemoryDecisionStore());
  _setDecisionReviewStore(inMemoryDecisionReviewStore());
  _setGapStore(inMemoryGapStore());
  _setAppraisalStore(inMemoryAppraisalStore());
  _setValueConflictStore(inMemoryValueConflictStore());
  _setValueTradeoffStore(inMemoryValueTradeoffStore());
  _setValueImpactStore(inMemoryValueImpactStore());
  _setActionStore(new InMemoryActionStore());
  _setEffectStore(new InMemoryEffectStore());
  _setVerificationStore(new InMemoryVerificationStore());
  _setLearningStore(new InMemoryLearningStore());
  _setValueDeclarationStore(new InMemoryValueDeclarationStore(DECLARED));
  setViewerProvider(viewerAs("person_roei"));
});

afterEach(() => {
  for (const reset of [
    _setDecisionCaseStore, _setDecisionStore, _setDecisionReviewStore,
    _setGapStore, _setAppraisalStore, _setValueConflictStore,
    _setValueTradeoffStore, _setValueImpactStore,
    _setActionStore, _setEffectStore, _setVerificationStore, _setLearningStore,
    _setValueDeclarationStore,
  ] as ((s: null) => void)[]) {
    reset(null);
  }
});

async function seedAction(id: string): Promise<string> {
  const action: Action = {
    action_id: id,
    type: "non_transfer",
    owner: "person_roei",
    mechanism_scope: "self_regulation",
    consent: true,
    inputs: [OBSERVATION_REF],
    reversibility: "reversible — ניתן לשנות עמדה בהמשך",
    time: "2026-08-28T11:00:00+03:00",
    provenance: "self-initiated",
  };
  const stored = await recordAuthenticatedAction(action, "2026-08-28T11:00:05+03:00");
  return stored.action.action_id;
}

describe("the partner case, nine steps", () => {
  it("carries gap → appraisal → conflict → tradeoff → action → impact → evidence → learning → a later decision", async () => {
    // ── 1. WHAT THE GAP WAS ──────────────────────────────────────────────
    const opened = await openCaseCore(
      fd({ title: "בת הזוג אינה תואמת את ציפיות החברה", risk_level: "significant" }),
    );
    const case_id = opened.case_id!;

    const gap = await recordGapCore(
      fd({
        case_id,
        current_state: "החברים מגיבים בקרירות לבת הזוג שלי",
        desired_state: "שהקשר שלי יתקבל בקבוצה כמו שהוא",
        // The "should" here comes from a group standard, not from survival.
        requirement_source: "external_standard",
        observation_refs: OBSERVATION_REF,
      }),
    );
    expect(gap.ok).toBe(true);

    // ── 2 + 3. WHO INTERPRETED IT, AND BY WHICH VALUES ───────────────────
    // The gate: without citing a declared value this cannot be a shortage.
    const withoutValue = await recordAppraisalCore(
      fd({ case_id, gap_ref: gap.id!, kind: "shortage", because: "זה פשוט מטריד אותי" }),
    );
    expect(withoutValue.ok).toBeUndefined();
    expect(withoutValue.reason).toBe("no_value_cited");

    const appraisal = await recordAppraisalCore(
      fd({
        case_id,
        gap_ref: gap.id!,
        kind: "shortage",
        value_refs: "v_standing",
        because: "אני מייחס חשיבות לאיך שחבריי רואים אותי, ולכן הקרירות שלהם נוגעת בי",
        salience: "high",
        context: "מפגשים חברתיים קבועים",
      }),
    );
    expect(appraisal.ok).toBe(true);

    // ── 4. WHICH VALUES COLLIDED ─────────────────────────────────────────
    const conflict = await recordValueConflictCore(
      fd({
        case_id,
        value_a_ref: "v_love",
        value_b_ref: "v_standing",
        tension_level: "active",
        context: "להישאר בקשר מול להשתייך לקבוצה",
        evidence_refs: "ce_obs_partner_0001",
      }),
    );
    expect(conflict.ok).toBe(true);

    // ── 5 + 6. THE PRICE, AND WHAT WAS DONE ──────────────────────────────
    const action_ref = await seedAction("act_boundary");
    const decision = await recordDecisionCore(
      fd({
        case_id,
        statement: "להישאר בקשר ולהציב גבול מול החברים",
        because: "הקשר חשוב לי יותר מהנוחות של הקבוצה",
        decision_logic: "כשהתנגשות היא בין ערך אישי לערך חברתי, אני מעדיף את האישי",
        expected_outcome: "בעוד חודש הקשר יישאר יציב, והמחיר יהיה ריחוק מסוים מהקבוצה",
        alternatives: "להיפרד כדי לשמר את המעמד\nלהתעלם ולא להגיב",
        observation_refs: OBSERVATION_REF,
        chosen_action_ref: action_ref,
        horizon_days: "30",
      }),
    );
    expect(decision.ok).toBe(true);

    // The gate: a decision cannot walk past the conflict it recorded.
    const ignoring = await recordTradeoffCore(
      fd({
        case_id,
        decision_ref: decision.decision_id!,
        prioritized_value_refs: "v_love",
        deprioritized_value_refs: "v_standing",
        rationale: "מתעלם מהמתח",
        conflict_refs: "",
      }),
    );
    expect(ignoring.ok).toBeUndefined();
    expect(ignoring.reason).toBe("conflict_unanswered");

    // And a "tradeoff" that costs nothing is not a tradeoff.
    const costless = await recordTradeoffCore(
      fd({
        case_id,
        decision_ref: decision.decision_id!,
        conflict_refs: conflict.id!,
        prioritized_value_refs: "v_love",
        deprioritized_value_refs: "",
        rationale: "רוצה גם וגם",
      }),
    );
    expect(costless.reason).toBe("no_price_paid");

    const tradeoff = await recordTradeoffCore(
      fd({
        case_id,
        decision_ref: decision.decision_id!,
        conflict_refs: conflict.id!,
        prioritized_value_refs: "v_love",
        deprioritized_value_refs: "v_standing",
        rationale: "בחרתי בקשר, ביודעין שהמעמד שלי בקבוצה ייפגע",
      }),
    );
    expect(tradeoff.ok).toBe(true);

    // ── The Effect, through the canon writer, via the review ─────────────
    const review = await recordReviewCore(
      fd({
        decision_ref: decision.decision_id!,
        what_happened: "הצבתי גבול. הקשר נשאר. שניים מהחברים התרחקו.",
        expectation_met: "met",
        alternative_explanations: "ייתכן שהריחוק נבע ממעבר דירה של אחד מהם",
        intervening_factors: "תקופת עומס בעבודה אצל כולם",
        causal_relation: "probably_contributed",
      }),
    );
    expect(review.ok).toBe(true);
    const effect_ref = review.effect_ref!;

    // ── 8. EVIDENCE, through the existing verification store ─────────────
    const [verification] = await verificationStore().append([
      {
        verification_id: "ver_partner_1",
        effect_id: effect_ref,
        recorded_at: "2026-09-28T10:00:00+03:00",
        verification: {
          statement: "בת הזוג אישרה שהקשר נשאר יציב לאורך החודש",
          provenance: "שיחה עם הצד השני בקשר",
          verifier_type: "counterparty",
          method: "אישור ישיר",
          confidence: 0.8,
          time: "2026-09-28T10:00:00+03:00",
          verifier_id: "person_bet",
        },
        record_origin: "REAL",
      },
    ]);

    // ── 7. THE REAL IMPACT ON EACH VALUE ─────────────────────────────────
    // The gate: no evidence, no direction.
    const unevidenced = await recordValueImpactCore(
      fd({ case_id, effect_ref, value_ref: "v_love", observed_direction: "advanced" }),
    );
    expect(unevidenced.reason).toBe("observed_without_evidence");

    const loveImpact = await recordValueImpactCore(
      fd({
        case_id,
        effect_ref,
        value_ref: "v_love",
        observed_direction: "advanced",
        magnitude: "moderate",
        evidence_refs: verification.verification_id,
        confidence: "0.7",
      }),
    );
    expect(loveImpact.ok).toBe(true);

    const standingImpact = await recordValueImpactCore(
      fd({
        case_id,
        effect_ref,
        value_ref: "v_standing",
        observed_direction: "set_back",
        magnitude: "moderate",
        evidence_refs: verification.verification_id,
      }),
    );
    expect(standingImpact.ok).toBe(true);

    // The expectation was NOT typed in — it was read from the tradeoff.
    const impacts = (await loadValueImpacts()).map((r) => r.impact);
    const love = impacts.find((i) => i.value_ref === "v_love")!;
    const standing = impacts.find((i) => i.value_ref === "v_standing")!;
    expect(love.expected_direction).toBe("advanced");
    expect(standing.expected_direction).toBe("set_back");

    // Both went as the decision said they would. The price was real and paid.
    expect(impactMatchedExpectation(love)).toBe(true);
    expect(impactMatchedExpectation(standing)).toBe(true);
    expect(tradeoffContradictions(impacts)).toEqual([]);

    // ── THE WHOLE CASE RESOLVES ──────────────────────────────────────────
    const resolved = await resolveCase((await loadCases()).find((c) => c.case_id === case_id)!);
    expect(resolved.resolved).toBe(true);
    expect(resolved.unresolved).toEqual([]);

    // Every step is reachable from the one case, and each appears ONCE.
    expect(resolved.gaps).toHaveLength(1);
    expect(resolved.appraisals).toHaveLength(1);
    expect(resolved.value_conflicts).toHaveLength(1);
    expect(resolved.value_tradeoff!.tradeoff.tradeoff_id).toBe(tradeoff.id);
    expect(resolved.value_impacts).toHaveLength(2);
    expect(resolved.effects).toHaveLength(1);
    expect(resolved.reviews).toHaveLength(1);

    // The chain reads end to end: which value made the gap matter, and which
    // value the decision chose to pay with.
    expect(resolved.appraisals[0].appraisal.value_refs).toEqual(["v_standing"]);
    expect(resolved.value_tradeoff!.tradeoff.deprioritized_value_refs).toEqual(["v_standing"]);

    // ── 9. A LATER DECISION, SHAPED BY THIS ONE ──────────────────────────
    const later = await openCaseCore(
      fd({ title: "הזמנה לאירוע של אותה קבוצה", risk_level: "low" }),
    );
    const laterGap = await recordGapCore(
      fd({
        case_id: later.case_id!,
        current_state: "הוזמנתי לבד, בלי בת הזוג",
        desired_state: "להגיע כזוג",
        requirement_source: "external_standard",
      }),
    );
    // The same value is cited again — and this time the person already knows
    // the price, because the earlier case recorded it.
    const laterAppraisal = await recordAppraisalCore(
      fd({
        case_id: later.case_id!,
        gap_ref: laterGap.id!,
        kind: "acceptable_tradeoff",
        value_refs: "v_standing",
        because: "בפעם הקודמת בחרתי בקשר ושילמתי במעמד. המחיר הזה כבר ידוע לי ומקובל עליי.",
        salience: "low",
        context: "אותה קבוצה חברתית",
      }),
    );
    expect(laterAppraisal.ok).toBe(true);

    // The later case classified the SAME gap kind differently — not as a
    // shortage this time — and the earlier case is what made that possible.
    const laterResolved = await resolveCase(
      (await loadCases()).find((c) => c.case_id === later.case_id)!,
    );
    expect(laterResolved.resolved).toBe(true);
    expect(laterResolved.appraisals[0].appraisal.kind).toBe("acceptable_tradeoff");
    expect(resolved.appraisals[0].appraisal.kind).toBe("shortage");
    // Same value, same person, different appraisal — which is exactly what a
    // values layer is for.
    expect(laterResolved.appraisals[0].appraisal.value_refs).toEqual(
      resolved.appraisals[0].appraisal.value_refs,
    );
  });
});

describe("values are a mechanism, not a display", () => {
  it("cannot record an appraisal citing a value the person never declared", async () => {
    const opened = await openCaseCore(fd({ title: "מקרה", risk_level: "low" }));
    const gap = await recordGapCore(
      fd({
        case_id: opened.case_id!,
        current_state: "מצב",
        desired_state: "רצוי",
        requirement_source: "stated_goal",
      }),
    );
    const r = await recordAppraisalCore(
      fd({
        case_id: opened.case_id!,
        gap_ref: gap.id!,
        kind: "threat",
        value_refs: "v_never_declared",
        because: "כי",
      }),
    );
    expect(r.reason).toBe("value_not_held_by_appraiser");
  });

  it("refuses an impact on a value the decision never weighed", async () => {
    const opened = await openCaseCore(fd({ title: "מקרה", risk_level: "low" }));
    const action_ref = await seedAction("act_narrow");
    const decision = await recordDecisionCore(
      fd({
        case_id: opened.case_id!,
        statement: "החלטה",
        because: "סיבה",
        decision_logic: "שיקול",
        expected_outcome: "ציפייה",
        chosen_action_ref: action_ref,
        horizon_days: "7",
      }),
    );
    await recordTradeoffCore(
      fd({
        case_id: opened.case_id!,
        decision_ref: decision.decision_id!,
        prioritized_value_refs: "v_love",
        deprioritized_value_refs: "v_standing",
        rationale: "נימוק",
      }),
    );
    const review = await recordReviewCore(
      fd({
        decision_ref: decision.decision_id!,
        what_happened: "קרה משהו",
        expectation_met: "met",
      }),
    );
    const r = await recordValueImpactCore(
      fd({
        case_id: opened.case_id!,
        effect_ref: review.effect_ref!,
        value_ref: "v_unweighed",
        observed_direction: "advanced",
        evidence_refs: "ver_x",
      }),
    );
    expect(r.reason).toBe("value_not_in_tradeoff");
  });

  it("refuses a value impact when the decision recorded no tradeoff at all", async () => {
    const opened = await openCaseCore(fd({ title: "מקרה", risk_level: "low" }));
    const action_ref = await seedAction("act_no_tradeoff");
    const decision = await recordDecisionCore(
      fd({
        case_id: opened.case_id!,
        statement: "החלטה",
        because: "סיבה",
        decision_logic: "שיקול",
        expected_outcome: "ציפייה",
        chosen_action_ref: action_ref,
        horizon_days: "7",
      }),
    );
    const review = await recordReviewCore(
      fd({
        decision_ref: decision.decision_id!,
        what_happened: "קרה משהו",
        expectation_met: "met",
      }),
    );
    const r = await recordValueImpactCore(
      fd({
        case_id: opened.case_id!,
        effect_ref: review.effect_ref!,
        value_ref: "v_love",
        observed_direction: "advanced",
        evidence_refs: "ver_x",
      }),
    );
    // No pre-registered expectation exists, so nothing can be compared.
    expect(r.reason).toBe("no_tradeoff");
  });
});
