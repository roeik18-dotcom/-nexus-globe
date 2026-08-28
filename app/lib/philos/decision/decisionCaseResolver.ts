/**
 * Philos — resolving a `DecisionCase` against the canon stores.
 *
 * ## Fails closed
 *
 * A reference that does not resolve is reported as an UNRESOLVED entry, and
 * `resolved` is false. It is never dropped, never rendered as an empty slot,
 * and never quietly skipped. An index whose broken entries vanish reports a
 * smaller, tidier story than the truth and gives no sign that it did — which
 * is worse than having no index, because it looks complete.
 *
 * Callers that need to act on a case (a writer, a gate) must check `resolved`
 * and refuse. Callers that only display it must show the unresolved
 * references as unresolved.
 *
 * ## One object per semantic fact
 *
 * Everything this returns is the canon record itself — the actual `Effect`,
 * the actual `Learning`, the actual `VerificationRecord`. Nothing here copies
 * a field out of a canon record into a case-shaped summary, because the copy
 * would be a second place the fact lives and the two could drift.
 */
import type { ActionRecord } from "../canon/actionStore";
import { loadActions } from "../canon/actionStoreAccessor";
import type { EffectRecord } from "../canon/effectStore";
import { loadEffects } from "../canon/effectStoreAccessor";
import type { LearningRecord } from "../canon/learningStore";
import { loadLearnings } from "../canon/learningStoreAccessor";
import type { VerificationRecord } from "../canon/outcomeVerificationStore";
import { loadVerifications } from "../canon/outcomeVerificationStoreAccessor";
import {
  type AppraisalRecord,
  type GapRecord,
  loadAppraisals,
  loadGaps,
  loadValueConflicts,
  loadValueImpacts,
  loadValueTradeoffs,
  type ValueConflictRecord,
  type ValueImpactRecord,
  type ValueTradeoffRecord,
} from "./appraisalStore";
import { allReferences, type DecisionCase } from "./decisionCase";
import type { Decision } from "./decision";
import type { DecisionReview } from "./decisionReview";
import { outcomeVerificationLevel, type OutcomeVerificationLevel } from "./evidenceAxes";
import { loadDecisionReviews, loadDecisions } from "./decisionStore";

export interface UnresolvedReference {
  field: string;
  ref: string;
}

export interface ResolvedCase {
  case: DecisionCase;
  /** False if ANY reference could not be resolved. */
  resolved: boolean;
  unresolved: UnresolvedReference[];

  decision?: Decision;
  reviews: DecisionReview[];

  // ── The appraisal layer. ──
  gaps: GapRecord[];
  appraisals: AppraisalRecord[];
  value_conflicts: ValueConflictRecord[];
  value_tradeoff?: ValueTradeoffRecord;
  value_impacts: ValueImpactRecord[];
  actions: ActionRecord[];
  effects: EffectRecord[];
  evidence: VerificationRecord[];
  learnings: LearningRecord[];

  /**
   * The OUTCOME axis, derived per referenced Effect — never stored anywhere.
   * Keyed by `effect_id`.
   */
  outcome_levels: Readonly<Record<string, OutcomeVerificationLevel>>;
}

/**
 * Resolve every reference a case makes.
 *
 * `observation_refs`, `need_refs`, `group_refs`, `subject_refs`,
 * `proposal_refs` and `authority_policy_ref` are NOT dereferenced here: their
 * target stores are read through different accessors with different scoping
 * rules, and pulling them in would make this function depend on almost every
 * store in the codebase. They are carried on the case and checked by the
 * writers that set them. What this resolves is the causal spine — decision,
 * action, effect, evidence, learning — which is what every gate and every
 * projection actually walks.
 */
export async function resolveCase(c: DecisionCase): Promise<ResolvedCase> {
  const [
    actions, effects, evidence, learnings, decisions, reviews,
    allGaps, allAppraisals, allConflicts, allTradeoffs, allImpacts,
  ] = await Promise.all([
    loadActions(),
    loadEffects(),
    loadVerifications(),
    loadLearnings(),
    loadDecisions(),
    loadDecisionReviews(),
    loadGaps(),
    loadAppraisals(),
    loadValueConflicts(),
    loadValueTradeoffs(),
    loadValueImpacts(),
  ]);

  const unresolved: UnresolvedReference[] = [];

  const pick = <T>(
    field: string,
    refs: readonly string[],
    all: readonly T[],
    idOf: (t: T) => string | undefined,
  ): T[] => {
    const out: T[] = [];
    for (const ref of refs) {
      const found = all.find((x) => idOf(x) === ref);
      if (found === undefined) unresolved.push({ field, ref });
      else out.push(found);
    }
    return out;
  };

  const resolvedActions = pick("action_refs", c.action_refs, actions, (r) => r.action?.action_id);
  const resolvedEffects = pick("effect_refs", c.effect_refs, effects, (r) => r.effect?.effect_id);
  const resolvedEvidence = pick(
    "evidence_refs",
    c.evidence_refs,
    evidence,
    (r) => r.verification_id,
  );
  const resolvedLearnings = pick(
    "learning_refs",
    c.learning_refs,
    learnings,
    (r) => r.learning?.learning_id,
  );

  const resolvedGaps = pick("gap_refs", c.gap_refs, allGaps, (r) => r.gap?.gap_id);
  const resolvedAppraisals = pick(
    "appraisal_refs", c.appraisal_refs, allAppraisals, (r) => r.appraisal?.appraisal_id,
  );
  const resolvedConflicts = pick(
    "value_conflict_refs", c.value_conflict_refs, allConflicts, (r) => r.conflict?.conflict_id,
  );
  const resolvedImpacts = pick(
    "value_impact_refs", c.value_impact_refs, allImpacts, (r) => r.impact?.impact_id,
  );

  let value_tradeoff: ValueTradeoffRecord | undefined;
  if (c.value_tradeoff_ref) {
    const found = allTradeoffs.find((r) => r.tradeoff?.tradeoff_id === c.value_tradeoff_ref);
    if (!found) unresolved.push({ field: "value_tradeoff_ref", ref: c.value_tradeoff_ref });
    else value_tradeoff = found;
  }

  /* AN APPRAISAL MUST POINT AT A GAP THE CASE ALSO LISTS. The other direction
     of the same link, checked so a case cannot carry an appraisal of
     something it does not contain. */
  for (const a of resolvedAppraisals) {
    if (!c.gap_refs.includes(a.appraisal.gap_ref)) {
      unresolved.push({ field: "appraisal.gap_ref", ref: a.appraisal.gap_ref });
    }
  }

  let decision: Decision | undefined;
  if (c.decision_ref) {
    const found = decisions.find((r) => r.decision.decision_id === c.decision_ref);
    if (!found) unresolved.push({ field: "decision_ref", ref: c.decision_ref });
    else decision = found.decision;
  }

  const caseReviews = reviews
    .map((r) => r.review)
    .filter((r) => r.case_id === c.case_id);

  /* A review must point at an Effect the case also lists. A review whose
     Effect is not part of the case is a broken link in the other direction,
     and it fails closed here too. */
  for (const r of caseReviews) {
    if (!c.effect_refs.includes(r.effect_ref)) {
      unresolved.push({ field: "review.effect_ref", ref: r.effect_ref });
    }
  }

  const outcome_levels: Record<string, OutcomeVerificationLevel> = {};
  for (const rec of resolvedEffects) {
    outcome_levels[rec.effect.effect_id] = outcomeVerificationLevel(rec.effect);
  }

  return {
    case: c,
    resolved: unresolved.length === 0,
    unresolved,
    decision,
    reviews: caseReviews,
    gaps: resolvedGaps,
    appraisals: resolvedAppraisals,
    value_conflicts: resolvedConflicts,
    value_tradeoff,
    value_impacts: resolvedImpacts,
    actions: resolvedActions,
    effects: resolvedEffects,
    evidence: resolvedEvidence,
    learnings: resolvedLearnings,
    outcome_levels,
  };
}

export class UnresolvedCaseError extends Error {
  readonly unresolved: readonly UnresolvedReference[];
  constructor(caseId: string, unresolved: readonly UnresolvedReference[]) {
    super(
      `DecisionCase ${caseId} has ${unresolved.length} unresolved reference(s): ` +
        unresolved.map((u) => `${u.field}=${u.ref}`).join(", ") +
        " — refusing to act on a case whose references do not resolve",
    );
    this.name = "UnresolvedCaseError";
    this.unresolved = unresolved;
  }
}

/** For writers and gates: resolve, or throw. Never returns a partial case. */
export async function requireResolvedCase(c: DecisionCase): Promise<ResolvedCase> {
  const r = await resolveCase(c);
  if (!r.resolved) throw new UnresolvedCaseError(c.case_id, r.unresolved);
  return r;
}

/**
 * WHICH EARLIER LEARNING SHAPED THIS DECISION.
 *
 * A case cites Learnings it USED as well as Learnings it PRODUCED, and the
 * two are told apart by time, not by a flag: a Learning recorded before this
 * case opened cannot have come out of it, so it must have been carried in.
 * That makes "show me exactly which earlier learning affected this decision"
 * answerable from the records rather than from a claim.
 */
export function learningsCarriedIn(resolved: ResolvedCase): LearningRecord[] {
  const openedMs = Date.parse(resolved.case.opened_at);
  if (Number.isNaN(openedMs)) return [];
  return resolved.learnings.filter((l) => {
    const t = Date.parse(l.recorded_at);
    return !Number.isNaN(t) && t < openedMs;
  });
}

/** Learnings this case produced — recorded at or after it opened. */
export function learningsProduced(resolved: ResolvedCase): LearningRecord[] {
  const openedMs = Date.parse(resolved.case.opened_at);
  if (Number.isNaN(openedMs)) return resolved.learnings;
  return resolved.learnings.filter((l) => {
    const t = Date.parse(l.recorded_at);
    return !Number.isNaN(t) && t >= openedMs;
  });
}
