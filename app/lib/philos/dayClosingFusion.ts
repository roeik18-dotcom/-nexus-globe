/**
 * Day Closing — Human × Value chronological question engine.
 *
 * Generates the DAY EVENTS → ACTIONS → OBSERVED EFFECTS → EVIDENCE →
 * HUMAN STATE CHANGE → VALUE-DOMAIN STATE CHANGE → HUMAN × VALUE RELATIONS
 * → GAPS/CONSTRAINTS → TARGETED QUESTIONS chain, entirely from data this
 * product already computes (`ActionLifecycleSummary`, `NeedRecord[]`,
 * `TensionItem[]`) — no new store, no new persisted record.
 *
 * Every question is JUSTIFIED by a real, checked piece of unresolved state
 * (an Action with no Effect, an unverified claim, a real Tension, a real
 * pending Need). Nothing is asked "because it's Tuesday" — a day with no
 * open gap produces an empty question list, not a static checklist.
 *
 * Two classes (`value`, `human_value`) are DELIBERATELY never derived from
 * data: no `ValueDomainConfig` exists anywhere in this repo (confirmed
 * repeatedly, see PHILOS-PRODUCT-MASTER-LEDGER.md §13/§18), so "did the
 * Human state enable the Value Domain?" has no evidence to check against.
 * Per the product rule that introduced this engine ("if relation is
 * unsupported: UNKNOWN" / "do not infer Human↔Value causality without
 * evidence"), these render as one explicit blocked notice each — never a
 * fabricated relation, never silently omitted.
 *
 * "Persist evidence/learning" (Day Closing(N) → Day Opening(N+1)):
 * `DayCycle.tsx`'s own header already establishes the real continuity
 * mechanism — tensions/needs/lifecycle are LIVE state computed fresh every
 * render from canon's real stores, so whatever is open at closing IS what
 * opening shows tomorrow, by construction. This module adds no second,
 * competing persistence format. Answering a question here is NOT wired to
 * a write path this pass — doing so honestly requires a canon-side
 * decision (does an answer become a new Learning? a new Evidence record?)
 * that is a schema decision, not a UI form to bolt on.
 */
import type { OrientationCore } from "./orientationCore";
import type { ActionLifecycleEntry, ActionLifecycleSummary, EffectWithLearning } from "./canon/actionLifecycle";
import type { TensionItem } from "./tension";
import type { NeedRecord } from "./canon/needStore";
import type { EntityLink } from "./bridge/entityLink";
import { linksForEntity } from "./bridge/entityLink";
import {
  buildCapabilityGapSummary,
  deriveDomainStateUpdate,
  type CapabilityGapSummary,
  type DomainState,
  type ValueDomain,
  type ValueDomainConfigInstance,
} from "./valueDomain/valueDomainConfig";

export type QuestionClass =
  | "clarify"
  | "evidence"
  | "gap"
  | "constraint"
  | "value"
  | "human_value"
  | "expected_vs_actual"
  | "learning"
  | "next_action";

export interface ClosingQuestion {
  id: string;
  question_class: QuestionClass;
  text: string;
  /** WHY THIS QUESTION? — the real unresolved item that justified it. */
  reason: string;
  /** "blocked" for `value`/`human_value` (no Value Domain Config exists to
   *  check against); "open" for every other, evidence-justified question. */
  status: "open" | "blocked";
  related_action_id?: string;
  related_need_id?: string;
  related_tension_id?: string;
}

export interface HumanChangeRow {
  domain: "G" | "E" | "C";
  current_level: number | null;
  delta: number | null;
}

function humanChangeRows(core: OrientationCore): HumanChangeRow[] {
  return (["G", "E", "C"] as const).map((d) => {
    const mark = core[d];
    const prior = d === "G" ? core.priorG : d === "E" ? core.priorE : core.priorC;
    return {
      domain: d,
      current_level: mark ? mark.level : null,
      delta: mark && prior ? mark.level - prior.level : null,
    };
  });
}

function clarifyQuestions(todaysActions: ActionLifecycleEntry[]): ClosingQuestion[] {
  return todaysActions
    .filter((a) => a.verification_state === "no_effect_recorded")
    .map((a) => ({
      id: `clarify_${a.action.action.action_id}`,
      question_class: "clarify",
      text: `מה בפועל קרה עם "${a.action.action.type}"?`,
      reason: `Action קיים (${a.action.action.action_id}) ללא Effect רשום כלל.`,
      status: "open",
      related_action_id: a.action.action.action_id,
    }));
}

function evidenceQuestions(todaysActions: ActionLifecycleEntry[]): ClosingQuestion[] {
  return todaysActions
    .filter((a) => a.verification_state === "effect_claimed_only")
    .map((a) => ({
      id: `evidence_${a.action.action.action_id}`,
      question_class: "evidence",
      text: `איזו עדות מאמתת את התוצאה שנטענה עבור "${a.action.action.type}"?`,
      reason: `יש claimed_outcome אך אין עדיין verified_outcome.`,
      status: "open",
      related_action_id: a.action.action.action_id,
    }));
}

function expectedVsActualQuestions(todaysActions: ActionLifecycleEntry[]): ClosingQuestion[] {
  const questions: ClosingQuestion[] = [];
  for (const a of todaysActions) {
    for (const e of a.effects) {
      const claimed = e.effect.effect.claimed_outcome?.statement;
      const verified = e.effect.effect.verified_outcome?.statement;
      if (claimed && verified && claimed !== verified) {
        questions.push({
          id: `expected_actual_${e.effect.effect.effect_id}`,
          question_class: "expected_vs_actual",
          text: `מה צפוי מול מה שקרה בפועל עבור "${a.action.action.type}"?`,
          reason: `claimed_outcome (${claimed}) ≠ verified_outcome (${verified}) — פער אמיתי בין הנטען לאומת.`,
          status: "open",
          related_action_id: a.action.action.action_id,
        });
      }
    }
  }
  return questions;
}

function gapAndNextActionQuestions(pendingNeeds: NeedRecord[]): ClosingQuestion[] {
  return pendingNeeds.flatMap((n) => [
    {
      id: `gap_${n.need.need_id}`,
      question_class: "gap" as const,
      text: `מה מנע השגת "${n.need.desired_change}"?`,
      reason: `Need רשום (${n.need.need_id}) ללא Action מקושר.`,
      status: "open" as const,
      related_need_id: n.need.need_id,
    },
    {
      id: `next_action_${n.need.need_id}`,
      question_class: "next_action" as const,
      text: `מה הפעולה הקטנה הבאה הרלוונטית ל-"${n.need.desired_change}"?`,
      reason: `נגזר מאותו Need פתוח — לא פעולה כללית.`,
      status: "open" as const,
      related_need_id: n.need.need_id,
    },
  ]);
}

function constraintQuestions(tensions: TensionItem[]): ClosingQuestion[] {
  return tensions
    .filter((t) => t.severity === "high" || t.severity === "medium")
    .map((t) => ({
      id: `constraint_${t.id}`,
      question_class: "constraint",
      text: `מה מגביל כרגע התקדמות ב-"${t.label}"?`,
      reason: `Tension אמיתי (${t.severity}): ${t.current_state}.`,
      status: "open",
      related_tension_id: t.id,
    }));
}

function learningQuestion(lifecycle: ActionLifecycleSummary, todaysActions: ActionLifecycleEntry[]): ClosingQuestion[] {
  const todaysVerified = todaysActions.filter((a) => a.verification_state === "effect_verified");
  const todaysUnrealized = todaysVerified.filter((a) => !a.effects.some((e: EffectWithLearning) => e.learnings.some((l) => l.learning.result.kind === "state_prime")));
  if (todaysUnrealized.length === 0) return [];
  return [{
    id: "learning_unrealized_today",
    question_class: "learning",
    text: `${todaysUnrealized.length} Effect אומת היום לא הוביל לעדכון מצב אמיתי — מה צריך להשתנות בפעם הבאה?`,
    reason: `Effect מאומת קיים, אך לא נגזר ממנו Learning מסוג state_prime.`,
    status: "open",
  }];
}

/** The two Human×Value classes: always present, always `blocked`, never
 *  derived from data that does not exist. */
function fusionBlockedQuestions(): ClosingQuestion[] {
  return [
    {
      id: "value_domain_blocked",
      question_class: "value",
      text: "האם הפעולה אכן שירתה/יצרה את הערך המיועד ב-Value Domain הנבחר?",
      reason: "אין עדיין תצורת Value Domain אמיתית במאגר להערכת תרומה לערך.",
      status: "blocked",
    },
    {
      id: "human_value_blocked",
      question_class: "human_value",
      text: "האם מצב האדם הנוכחי אפשר או הגביל את ה-Value Domain הנבחר?",
      reason: "לא ידוע — אין קשר מתועד בין Human Config ל-Value Domain Config; לא מוסק ללא ראיה.",
      status: "blocked",
    },
  ];
}

export function buildDayClosingQuestions(params: {
  todaysActions: ActionLifecycleEntry[];
  pendingNeeds: NeedRecord[];
  tensions: TensionItem[];
  lifecycle: ActionLifecycleSummary;
}): ClosingQuestion[] {
  return [
    ...clarifyQuestions(params.todaysActions),
    ...evidenceQuestions(params.todaysActions),
    ...expectedVsActualQuestions(params.todaysActions),
    ...gapAndNextActionQuestions(params.pendingNeeds),
    ...constraintQuestions(params.tensions),
    ...learningQuestion(params.lifecycle, params.todaysActions),
    ...fusionBlockedQuestions(),
  ];
}

export { humanChangeRows };

// ── Runtime loop: reconciliation → carry-forward → next Day Opening ────────
//
// PHILOS MASTER RUNTIME LOOP (Day Closing → State Update → Next Day
// Opening). Everything below is a PURE function over data already computed
// by existing code (`OrientationCore`, `ActionLifecycleSummary`,
// `NeedRecord[]`, `TensionItem[]`, the Canonical Cross-Entity Link
// Registry) — no new store, no new persisted record, no mutation of canon.
// The "persistence" this loop provides is exactly `DayCycle.tsx`'s
// established model: these are LIVE reads, so Day Closing(N)'s carry-
// forward IS Day Opening(N+1)'s input, by construction, every render.

export type ReconciliationStatus =
  | "not_executed"
  | "executed"
  | "effect_pending"
  | "effect_observed";

export interface ReconciliationEntry {
  id: string;
  kind: "need" | "action";
  label: string;
  status: ReconciliationStatus;
  related_need_id?: string;
  related_action_id?: string;
}

/**
 * INTENT → ACTION → EXPECTED EFFECT → OBSERVED EFFECT chain, classified.
 * "PLANNED" (as a status distinct from "not executed") is deliberately not
 * produced: there is no persisted Day-Opening-of-record to check a plan
 * against — Day Opening is itself a live read, not a stored commitment
 * (see this file's own header). A pending Need IS the real, checked
 * "intended but not yet acted on" signal; inventing a separate persisted
 * plan object to distinguish "planned" from "not executed" would be new
 * ontology this task's own scope forbids adding.
 */
export function buildDayReconciliation(params: {
  pendingNeeds: NeedRecord[];
  todaysActions: ActionLifecycleEntry[];
}): ReconciliationEntry[] {
  const needEntries: ReconciliationEntry[] = params.pendingNeeds.map((n) => ({
    id: `need_${n.need.need_id}`,
    kind: "need",
    label: n.need.desired_change,
    status: "not_executed",
    related_need_id: n.need.need_id,
  }));
  const actionEntries: ReconciliationEntry[] = params.todaysActions.map((a) => ({
    id: `action_${a.action.action.action_id}`,
    kind: "action",
    label: a.action.action.type,
    status:
      a.verification_state === "effect_verified" ? "effect_observed"
      : a.verification_state === "effect_claimed_only" ? "effect_pending"
      : "executed",
    related_action_id: a.action.action.action_id,
  }));
  return [...needEntries, ...actionEntries];
}

/**
 * Real (possibly DEMO-only) Value-Domain carry-forward — populated ONLY
 * when a caller supplies a `valueDomain` param to `buildCarryForward` (see
 * below). `updated_states` are states `deriveDomainStateUpdate` actually
 * advanced today — never every state, never a fabricated jump.
 */
export interface ValueDomainCarryForward {
  domain: ValueDomain;
  summary: CapabilityGapSummary[];
  updated_states: DomainState[];
  todays_results_count: number;
}

export interface CarryForwardState {
  subject: string;
  today: string;
  human_change: HumanChangeRow[];
  /** "unknown_blocked" for any subject with no attached Value-Domain
   *  config instance — true for every REAL subject today, since no real
   *  `ValueDomainConfig` exists (see `valueDomainConfig.ts`'s own header).
   *  A real `ValueDomainCarryForward` is only ever populated for a caller
   *  that explicitly attaches one (currently: the DEMO Music reference
   *  instance only — never fabricated for a real subject). */
  value_domain_state: "unknown_blocked" | ValueDomainCarryForward;
  open_needs: NeedRecord[];
  open_loop_actions: ActionLifecycleEntry[];
  unresolved_tensions: TensionItem[];
  reconciliation: ReconciliationEntry[];
  /** Real ACTION_AFFECTS_COMMUNITY / EFFECT_AFFECTS_PERSON bridge links
   *  found for today's own Actions/Effects — empty when today's Actions
   *  are genuinely private (no collective relevance), never fabricated. */
  collective_propagation: EntityLink[];
  learning_realized_today: number;
}

/**
 * The one canonical carry-forward object. Callers pass in the SAME
 * core/lifecycle/tensions/pendingNeeds/registry every other Day Closing
 * surface already computes — this performs no I/O, no re-derivation.
 */
export function buildCarryForward(params: {
  subject: string;
  today: string;
  core: OrientationCore;
  lifecycle: ActionLifecycleSummary;
  pendingNeeds: NeedRecord[];
  tensions: TensionItem[];
  todaysActions: ActionLifecycleEntry[];
  realizedLearningsToday: number;
  bridgeRegistry: EntityLink[];
  /** Optional — absent for every real subject today (no real config
   *  exists). When present, Human state is NEVER mutated as a side effect
   *  of computing this — the two states stay independently derived. */
  valueDomain?: { config: ValueDomainConfigInstance; subject: string };
}): CarryForwardState {
  let valueDomainState: CarryForwardState["value_domain_state"] = "unknown_blocked";
  if (params.valueDomain) {
    const { config, subject } = params.valueDomain;
    const todaysResults = config.actionResults.filter((r) => r.time.slice(0, 10) === params.today);
    const updatedStates: DomainState[] = [];
    for (const result of todaysResults) {
      const priorForParam = config.states
        .filter((s) => s.parameter_id === result.parameter_id && s.subject === subject)
        .sort((a, b) => b.observed_at.localeCompare(a.observed_at))[0];
      if (!priorForParam) continue;
      const updated = deriveDomainStateUpdate(priorForParam, result);
      if (updated) updatedStates.push(updated);
    }
    const effectiveConfig: ValueDomainConfigInstance = { ...config, states: [...config.states, ...updatedStates] };
    valueDomainState = {
      domain: config.domain,
      summary: buildCapabilityGapSummary(effectiveConfig, subject),
      updated_states: updatedStates,
      todays_results_count: todaysResults.length,
    };
  }
  const openLoopActions = params.lifecycle.actions.filter((a) => a.verification_state === "no_effect_recorded");
  const collectivePropagation = params.todaysActions.flatMap((a) => [
    ...linksForEntity(params.bridgeRegistry, "action", a.action.action.action_id),
    ...a.effects.flatMap((e) => linksForEntity(params.bridgeRegistry, "effect", e.effect.effect.effect_id)),
  ]);
  return {
    subject: params.subject,
    today: params.today,
    human_change: humanChangeRows(params.core),
    value_domain_state: valueDomainState,
    open_needs: params.pendingNeeds,
    open_loop_actions: openLoopActions,
    unresolved_tensions: params.tensions,
    reconciliation: buildDayReconciliation({ pendingNeeds: params.pendingNeeds, todaysActions: params.todaysActions }),
    collective_propagation: collectivePropagation,
    learning_realized_today: params.realizedLearningsToday,
  };
}

export interface DayOpeningBrief {
  subject: string;
  where_am_i_today: string;
  what_changed_since_yesterday: string;
  what_remains_open: string;
  what_is_constrained: string;
  what_possibility_exists: string;
  what_matters_most: string;
  next_relevant_action: string;
  /** All four honestly state "לא נבחר Value Domain" when
   *  `carryForward.value_domain_state === "unknown_blocked"` — true for
   *  every real subject today. */
  what_changed_in_value_domain: string;
  active_domain_gap: string;
  capability_change: string;
  domain_action_today: string;
}

/** Generates Day Opening(N+1) from the SAME carry-forward object Day
 *  Closing(N) produced — the loop's actual "next day" step. Every field is
 *  a real summary sentence built from real counts/labels, never a
 *  fabricated narrative. */
export function buildNextDayOpening(carryForward: CarryForwardState): DayOpeningBrief {
  const risingCount = carryForward.human_change.filter((r) => r.delta !== null && r.delta > 0).length;
  const fallingCount = carryForward.human_change.filter((r) => r.delta !== null && r.delta < 0).length;
  const highTensions = carryForward.unresolved_tensions.filter((t) => t.severity === "high");

  return {
    subject: carryForward.subject,
    where_am_i_today: carryForward.human_change.every((r) => r.current_level === null)
      ? "לא ידוע — אין תצפית אמיתית זמינה."
      : `${carryForward.human_change.filter((r) => r.current_level !== null).length}/3 תחומים עם מצב אמיתי ידוע.`,
    what_changed_since_yesterday: risingCount + fallingCount === 0
      ? "אין דלתא אמיתית מהתצפית הקודמת."
      : `${risingCount} תחום/ים בעלייה, ${fallingCount} בירידה.`,
    what_remains_open: carryForward.open_needs.length + carryForward.open_loop_actions.length === 0
      ? "אין Need או Action פתוח."
      : `${carryForward.open_needs.length} Need פתוח, ${carryForward.open_loop_actions.length} Action ללא Effect.`,
    what_is_constrained: highTensions.length === 0
      ? "אין Tension בחומרה גבוהה כרגע."
      : `${highTensions.length} Tension בחומרה גבוהה: ${highTensions.map((t) => t.label).join(", ")}.`,
    what_possibility_exists: carryForward.open_needs.length === 0
      ? "לא ידוע — אין Need פתוח לשייך אליו אפשרות פעולה."
      : `יש ${carryForward.open_needs.length} Need פתוח שניתן לפעול לגביו.`,
    what_matters_most: highTensions[0]?.label ?? carryForward.open_needs[0]?.need.desired_change ?? "לא ידוע — אין פריט דחוף מתועד.",
    next_relevant_action: carryForward.open_needs[0]
      ? `הפעולה הקטנה הבאה עבור "${carryForward.open_needs[0].need.desired_change}"`
      : carryForward.open_loop_actions[0]
        ? `להשלים Effect עבור "${carryForward.open_loop_actions[0].action.action.type}"`
        : "לא ידוע — אין פריט פתוח לשייך אליו פעולה הבאה.",
    ...buildValueDomainOpeningFields(carryForward.value_domain_state),
  };
}

function buildValueDomainOpeningFields(
  state: CarryForwardState["value_domain_state"],
): Pick<DayOpeningBrief, "what_changed_in_value_domain" | "active_domain_gap" | "capability_change" | "domain_action_today"> {
  if (state === "unknown_blocked") {
    return {
      what_changed_in_value_domain: "לא ידוע — לא נבחר Value Domain / אין Config עבור נושא זה.",
      active_domain_gap: "לא ידוע — לא נבחר Value Domain.",
      capability_change: "לא ידוע — לא נבחר Value Domain.",
      domain_action_today: "לא ידוע — לא נבחר Value Domain.",
    };
  }
  const gapRows = state.summary.filter((s) => s.gaps.length > 0);
  const capabilityRows = state.summary.flatMap((s) => s.capabilities);
  return {
    what_changed_in_value_domain: state.updated_states.length === 0
      ? `אין שינוי אמיתי היום ב-${state.domain.label}.`
      : `${state.updated_states.length} פרמטר/ים ב-${state.domain.label} התעדכנו היום (Δ +1, מבוסס תוצאה מאושרת).`,
    active_domain_gap: gapRows.length === 0
      ? "אין Gap פתוח מתועד."
      : `${gapRows[0].parameter_label}: ${gapRows[0].gaps[0].label}`,
    capability_change: capabilityRows.length === 0
      ? "אין Capability מתועד."
      : `${capabilityRows.length} Capability מתועד — ${capabilityRows.map((c) => `${c.label} (${c.status})`).join(", ")}.`,
    domain_action_today: state.todays_results_count === 0
      ? "אין Action בתחום היום."
      : `${state.todays_results_count} תוצאת Action בתחום היום.`,
  };
}
