"use server";

/**
 * Philos — the decision-loop writers, routed through the CANON writers.
 *
 * ## What changed, and why
 *
 * The first pass wrote a self-contained decision model beside the canon
 * spine: a review stored its own outcome text, its own verifier and its own
 * verification tier, and no `Effect`, `OutcomeVerification` or `Learning` was
 * ever written. Two objects held one fact each, and the canon-side one did
 * not exist — so the day's gates saw nothing while the journal showed a
 * completed review.
 *
 * Now: a review either NAMES an existing `Effect` or creates one through
 * `recordAuthenticatedEffect`; supporting material goes through the existing
 * verification writer; a learning goes through `recordLearning`. This module
 * writes exactly three record types of its own — `DecisionCase`, `Decision`,
 * `DecisionReview` — and every one of them is references plus facts that no
 * canon record carries.
 *
 * ## Identity is never taken from the form
 *
 * `subject` on a Decision and the verifier on any verification come from the
 * authenticated session. `record_origin: "REAL"` is conferred here and only
 * here, per the record-origin contract.
 *
 * ## Fails closed
 *
 * A case whose references do not resolve is refused, not rendered partial. A
 * review of a decision with no action is refused rather than inventing an
 * Effect with no Action to hang from.
 */
import { revalidatePath } from "next/cache";

import { recordAuthenticatedEffect } from "../canon/actionLifecycle";
import type { Effect } from "../canon/effect";
import { loadEffects } from "../canon/effectStoreAccessor";
import { loadActions } from "../canon/actionStoreAccessor";
import { parseOffsetInstant } from "../canon/observation";
import type { OutcomeVerification } from "../canon/outcomeVerification";
import { createIdGenerator, systemClock } from "../eventStore";
import { resolveViewerContext } from "../identity/viewerContext";
import {
  chosenActionRef,
  DAY_MS,
  DEFAULT_HORIZON_DAYS,
  type Decision,
  validateDecision,
} from "./decision";
import {
  type CaseStatus,
  type DecisionCase,
  emptyCase,
  validateDecisionCase,
} from "./decisionCase";
import { resolveCase } from "./decisionCaseResolver";
import {
  type DecisionReview,
  EXPECTATION_OUTCOMES,
  type ExpectationOutcome,
  isResolved,
  validateDecisionReview,
} from "./decisionReview";
import {
  CAUSAL_RELATION,
  type CausalRelation,
  checkCausalRelation,
  DEFAULT_CAUSAL_RELATION,
  isRiskLevel,
  outcomeVerificationLevel,
  type RiskLevel,
} from "./evidenceAxes";
import {
  decisionCaseStore,
  decisionReviewStore,
  decisionStore,
  loadCases,
  loadDecisionReviews,
  loadDecisions,
} from "./decisionStore";

/**
 * ONE generator for this module's whole lifetime.
 *
 * `createIdGenerator()` seeds its counter at zero and its base from
 * `Date.now()`, so calling it afresh per id yields `x_<same-ms>_000001` twice
 * whenever two ids are minted inside the same millisecond — which a case
 * revision plus the decision that triggered it always are. A module-level
 * generator keeps the counter monotonic, which is exactly the ordering
 * guarantee the padded counter exists to provide.
 */
const ids = createIdGenerator();

function revalidateAll(): void {
  for (const p of ["/decisions", "/hub"]) revalidatePath(p);
}

function field(v: FormData, k: string): string {
  return String(v.get(k) ?? "").trim();
}

/** One per line, blanks dropped. Nothing is invented to fill an empty box. */
function lines(raw: string): string[] {
  return raw.split("\n").map((l) => l.trim()).filter((l) => l !== "");
}

/**
 * Append a new revision of a case. The log is append-only, so a status change
 * or a new reference is a NEW record carrying the whole case, never an edit.
 */
async function reviseCase(next: DecisionCase): Promise<void> {
  const validation = validateDecisionCase(next);
  if (!validation.valid) {
    throw new Error(`DecisionCase ${next.case_id} failed validation before revision`);
  }
  await decisionCaseStore().append([
    {
      case: next,
      recorded_at: systemClock.now(),
      revision_id: ids.next("caserev"),
    },
  ]);
}

/** Add a reference without ever duplicating one. */
function withRef(
  c: DecisionCase,
  key: "observation_refs" | "action_refs" | "effect_refs" | "evidence_refs" | "learning_refs" | "need_refs",
  ref: string,
): DecisionCase {
  const list = c[key];
  if (list.includes(ref)) return c;
  return { ...c, [key]: [...list, ref] };
}

// ── OPENING A CASE ────────────────────────────────────────────────────────

export type CaseRefusal = "fields_incomplete" | "subject_missing" | "invalid_case";

export type CaseFormState = { ok?: true; case_id?: string; error?: string; reason?: CaseRefusal };

export async function openCaseCore(formData: FormData): Promise<CaseFormState> {
  const title = field(formData, "title");
  if (title === "") {
    return { reason: "fields_incomplete", error: "חסר למילוי: מה הבעיה" };
  }

  const viewer = await resolveViewerContext();
  if (!viewer.subject_id) {
    return { reason: "subject_missing", error: "לא ניתן לזהות מי פותח — נדרשת כניסה" };
  }

  const rawRisk = field(formData, "risk_level");
  const risk_level: RiskLevel = isRiskLevel(rawRisk) ? rawRisk : "low";

  let c = emptyCase({
    case_id: ids.next("case"),
    title,
    risk_level,
    opened_at: systemClock.now(),
    record_origin: "REAL",
    subject_refs: [viewer.subject_id],
  });
  for (const ref of lines(field(formData, "observation_refs"))) {
    c = withRef(c, "observation_refs", ref);
  }

  if (!validateDecisionCase(c).valid) {
    return { reason: "invalid_case", error: "רשומת המקרה אינה תקינה" };
  }

  await reviseCase(c);
  return { ok: true, case_id: c.case_id };
}

export async function openCaseFormAction(
  _prev: CaseFormState,
  formData: FormData,
): Promise<CaseFormState> {
  const r = await openCaseCore(formData);
  if (r.ok) revalidateAll();
  return r;
}

// ── RECORDING A DECISION ──────────────────────────────────────────────────

export type DecisionRefusal =
  | "fields_incomplete"
  | "case_not_found"
  | "case_already_decided"
  | "horizon_not_in_future"
  | "action_not_found"
  | "invalid_decision"
  | "subject_missing";

export type DecisionFormState = {
  ok?: true;
  decision_id?: string;
  case_id?: string;
  error?: string;
  reason?: DecisionRefusal;
};

const DECISION_TEXT: Record<DecisionRefusal, string> = {
  fields_incomplete: "חסרים שדות",
  case_not_found: "המקרה שנבחר אינו קיים",
  case_already_decided: "במקרה הזה כבר נרשמה החלטה",
  horizon_not_in_future: "מועד הבדיקה חייב להיות אחרי מועד ההחלטה",
  action_not_found: "הפעולה שנבחרה אינה קיימת במאגר",
  invalid_decision: "הרשומה אינה תקינה",
  subject_missing: "לא ניתן לזהות מי מחליט — נדרשת כניסה",
};

const DECISION_FIELDS: ReadonlyArray<{ name: string; label: string }> = [
  { name: "case_id", label: "מזהה המקרה" },
  { name: "statement", label: "מה החלטת" },
  { name: "because", label: "למה" },
  { name: "decision_logic", label: "לפי איזה שיקול" },
  { name: "expected_outcome", label: "מה אתה מצפה שיקרה" },
];

export async function recordDecisionCore(formData: FormData): Promise<DecisionFormState> {
  const missing = DECISION_FIELDS.filter((f) => field(formData, f.name) === "");
  if (missing.length > 0) {
    return {
      reason: "fields_incomplete",
      error: `חסר למילוי: ${missing.map((f) => f.label).join(" · ")}`,
    };
  }

  const viewer = await resolveViewerContext();
  if (!viewer.subject_id) {
    return { reason: "subject_missing", error: DECISION_TEXT.subject_missing };
  }

  const case_id = field(formData, "case_id");
  const cases = await loadCases();
  const theCase = cases.find((c) => c.case_id === case_id);
  if (!theCase) return { reason: "case_not_found", error: DECISION_TEXT.case_not_found };
  if (theCase.decision_ref) {
    return { reason: "case_already_decided", error: DECISION_TEXT.case_already_decided };
  }

  const decided_at = systemClock.now();
  const decidedMs = parseOffsetInstant(decided_at);
  if (decidedMs === null) {
    return { reason: "horizon_not_in_future", error: DECISION_TEXT.horizon_not_in_future };
  }

  const explicitDue = field(formData, "review_horizon");
  const rawDays = Number(field(formData, "horizon_days"));
  const days = Number.isFinite(rawDays) && rawDays > 0 ? Math.floor(rawDays) : DEFAULT_HORIZON_DAYS;
  const review_horizon = explicitDue || new Date(decidedMs + days * DAY_MS).toISOString();

  const dueMs = parseOffsetInstant(review_horizon);
  if (dueMs === null || dueMs <= decidedMs) {
    return { reason: "horizon_not_in_future", error: DECISION_TEXT.horizon_not_in_future };
  }

  /* THE CHOSEN ACTION. An `action_ref` must name a real, stored Action — a
     decision pointing at an Action that does not exist is exactly the
     dangling reference this pass exists to make impossible. "Nothing yet" is
     explicit and must say why. */
  const actionRef = field(formData, "chosen_action_ref");
  let chosen_action: Decision["chosen_action"];
  if (actionRef !== "") {
    const actions = await loadActions();
    if (!actions.some((r) => r.action?.action_id === actionRef)) {
      return { reason: "action_not_found", error: DECISION_TEXT.action_not_found };
    }
    chosen_action = { kind: "action", action_ref: actionRef };
  } else {
    chosen_action = {
      kind: "no_action_yet",
      because: field(formData, "no_action_because") || "טרם בוצעה פעולה",
    };
  }

  const rawConfidence = Number(field(formData, "confidence"));
  const confidence =
    Number.isFinite(rawConfidence) && rawConfidence >= 0 && rawConfidence <= 1
      ? rawConfidence
      : 0.5;

  const decision: Decision = {
    decision_id: ids.next("decision"),
    case_id,
    // SERVER-DERIVED. No form field reaches this.
    subject: viewer.subject_id,
    statement: field(formData, "statement"),
    because: field(formData, "because"),
    decision_logic: field(formData, "decision_logic"),
    expected_outcome: field(formData, "expected_outcome"),
    alternatives_considered: lines(field(formData, "alternatives")),
    observation_refs: lines(field(formData, "observation_refs")),
    chosen_action,
    confidence,
    // Mirrors the case. The case is the authority on risk.
    stakes: theCase.risk_level,
    decided_at,
    review_horizon,
    record_origin: "REAL",
  };

  if (!validateDecision(decision).valid) {
    return { reason: "invalid_decision", error: DECISION_TEXT.invalid_decision };
  }

  await decisionStore().append([{ decision, recorded_at: systemClock.now() }]);

  /* The case now points at the decision, and at the action it chose. One
     object per fact: the case holds the REFERENCE, the decision holds the
     reasoning. */
  let next: DecisionCase = { ...theCase, decision_ref: decision.decision_id, status: "decided" };
  for (const ref of decision.observation_refs) next = withRef(next, "observation_refs", ref);
  const chosenRef = chosenActionRef(decision);
  if (chosenRef) {
    next = withRef(next, "action_refs", chosenRef);
    next = { ...next, status: "authorized" };
  }
  await reviseCase(next);

  return { ok: true, decision_id: decision.decision_id, case_id };
}

export async function recordDecisionFormAction(
  _prev: DecisionFormState,
  formData: FormData,
): Promise<DecisionFormState> {
  const r = await recordDecisionCore(formData);
  if (r.ok) revalidateAll();
  return r;
}

// ── REVIEWING ─────────────────────────────────────────────────────────────

export type ReviewRefusal =
  | "fields_incomplete"
  | "decision_not_found"
  | "already_reviewed"
  | "reviewer_missing"
  | "no_action_to_review"
  | "effect_not_found"
  | "effect_action_mismatch"
  | "case_unresolved"
  | "invalid_review";

export type ReviewFormState = {
  ok?: true;
  review_id?: string;
  effect_ref?: string;
  /** The rung actually EARNED. */
  causal_relation?: CausalRelation;
  /** True when the claim was demoted. The screen must say so. */
  capped?: boolean;
  error?: string;
  reason?: ReviewRefusal;
};

const REVIEW_TEXT: Record<ReviewRefusal, string> = {
  fields_incomplete: "חסרים שדות",
  decision_not_found: "ההחלטה שנבחרה אינה קיימת",
  already_reviewed: "ההחלטה הזו כבר נסקרה — סקירה נרשמת פעם אחת",
  reviewer_missing: "לא ניתן לזהות מי סוקר — נדרשת כניסה",
  no_action_to_review: "אי אפשר לסקור החלטה שטרם בוצעה בה פעולה — אין תוצאה שאפשר לתלות בה",
  effect_not_found: "התוצאה שנבחרה אינה קיימת במאגר",
  effect_action_mismatch: "התוצאה שנבחרה אינה מקושרת לפעולה שההחלטה בחרה",
  case_unresolved: "למקרה יש הפניות שאינן נפתרות — לא נרשמת סקירה על מקרה שבור",
  invalid_review: "רשומת הסקירה אינה תקינה",
};

function asOutcome(v: string): ExpectationOutcome {
  return (EXPECTATION_OUTCOMES as readonly string[]).includes(v)
    ? (v as ExpectationOutcome)
    : "cannot_tell";
}

function asRelation(v: string): CausalRelation {
  return (CAUSAL_RELATION as readonly string[]).includes(v)
    ? (v as CausalRelation)
    : DEFAULT_CAUSAL_RELATION;
}

export async function recordReviewCore(formData: FormData): Promise<ReviewFormState> {
  const decision_ref = field(formData, "decision_ref");
  if (decision_ref === "" || field(formData, "what_happened") === "") {
    return { reason: "fields_incomplete", error: "חסר למילוי: מזהה ההחלטה · מה קרה בפועל" };
  }

  const viewer = await resolveViewerContext();
  if (!viewer.subject_id) {
    return { reason: "reviewer_missing", error: REVIEW_TEXT.reviewer_missing };
  }

  const [decisions, reviews, cases] = await Promise.all([
    loadDecisions(),
    loadDecisionReviews(),
    loadCases(),
  ]);

  const storedDecision = decisions.find((r) => r.decision.decision_id === decision_ref);
  if (!storedDecision) {
    return { reason: "decision_not_found", error: REVIEW_TEXT.decision_not_found };
  }
  if (reviews.some((r) => r.review.decision_ref === decision_ref)) {
    return { reason: "already_reviewed", error: REVIEW_TEXT.already_reviewed };
  }

  const decision = storedDecision.decision;
  const theCase = cases.find((c) => c.case_id === decision.case_id);
  if (!theCase) return { reason: "decision_not_found", error: REVIEW_TEXT.decision_not_found };

  const actionRef = chosenActionRef(decision);
  if (!actionRef) {
    return { reason: "no_action_to_review", error: REVIEW_TEXT.no_action_to_review };
  }

  /* THE EFFECT. Either it already exists and is named, or it is created here
     through the CANON writer — never stored locally. This is the single
     change that removes the outcome duplication. */
  const suppliedEffect = field(formData, "effect_ref");
  const reviewed_at = systemClock.now();
  let effect_ref: string;

  if (suppliedEffect !== "") {
    const effects = await loadEffects();
    const found = effects.find((r) => r.effect?.effect_id === suppliedEffect);
    if (!found) return { reason: "effect_not_found", error: REVIEW_TEXT.effect_not_found };
    if (found.effect.action_ref !== actionRef) {
      return { reason: "effect_action_mismatch", error: REVIEW_TEXT.effect_action_mismatch };
    }
    effect_ref = suppliedEffect;
  } else {
    const claimed: OutcomeVerification = {
      /* WHAT HAPPENED lives here, on the canon record, and nowhere else. */
      statement: field(formData, "what_happened"),
      provenance: `decision review of ${decision.decision_id}`,
      verifier_type: "self",
      method: "סקירת החלטה במועד שנקבע",
      confidence: 0.5,
      time: reviewed_at,
      verifier_id: viewer.subject_id,
    };
    const effect: Effect = {
      effect_id: ids.next("effect"),
      action_ref: actionRef,
      subject: decision.subject,
      concerns_subject_internal_state: field(formData, "concerns_internal_state") === "on",
      claimed_outcome: claimed,
      context: `DecisionCase ${decision.case_id}`,
      time: reviewed_at,
      provenance: `recorded by the decision review of ${decision.decision_id}`,
    };
    const stored = await recordAuthenticatedEffect(effect, reviewed_at);
    effect_ref = stored.effect.effect_id;
  }

  /* THE OUTCOME AXIS IS DERIVED, NOT STORED. Read from the canon Effect that
     now holds the fact. */
  const effectsNow = await loadEffects();
  const effectRecord = effectsNow.find((r) => r.effect.effect_id === effect_ref);
  const outcome_level = outcomeVerificationLevel(effectRecord?.effect);

  const expectation_met = asOutcome(field(formData, "expectation_met"));
  const alternative_explanations = lines(field(formData, "alternative_explanations"));
  const intervening_factors = lines(field(formData, "intervening_factors"));
  const counterevidence_refs = lines(field(formData, "counterevidence_refs"));
  const comparison_basis = field(formData, "comparison_basis");
  const time_window = field(formData, "time_window");

  /* The claim is checked against BOTH axes and can only ever be lowered.
     Nothing about a strong outcome verification raises it on its own. */
  const claim = checkCausalRelation({
    claimed: asRelation(field(formData, "causal_relation")),
    risk_level: theCase.risk_level,
    outcome_level,
    expectation_resolved: isResolved(expectation_met),
    alternative_explanations,
    comparison_basis: comparison_basis || undefined,
  });

  const rawCausalConfidence = Number(field(formData, "causal_confidence"));
  const causal_confidence =
    Number.isFinite(rawCausalConfidence) && rawCausalConfidence >= 0 && rawCausalConfidence <= 1
      ? rawCausalConfidence
      : undefined;

  const dueMs = parseOffsetInstant(decision.review_horizon);
  const nowMs = parseOffsetInstant(reviewed_at);

  const review: DecisionReview = {
    review_id: ids.next("review"),
    case_id: decision.case_id,
    decision_ref,
    effect_ref,
    expectation_met,
    causal_relation: claim.entitled,
    ...(causal_confidence !== undefined ? { causal_confidence } : {}),
    alternative_explanations,
    intervening_factors,
    counterevidence_refs,
    ...(time_window ? { time_window } : {}),
    ...(comparison_basis ? { comparison_basis } : {}),
    reviewed_at,
    reviewed_early: dueMs !== null && nowMs !== null && nowMs < dueMs,
    record_origin: "REAL",
  };

  if (!validateDecisionReview(review).valid) {
    return { reason: "invalid_review", error: REVIEW_TEXT.invalid_review };
  }

  const nextCase: DecisionCase = {
    ...withRef(theCase, "effect_refs", effect_ref),
    status: "observed" as CaseStatus,
  };

  /* FAIL CLOSED. If the case's references do not resolve, no review is
     written — a review anchored to a broken case is not evidence of
     anything. */
  const check = await resolveCase(nextCase);
  if (!check.resolved) {
    const detail = check.unresolved.map((u) => `${u.field}=${u.ref}`).join(", ");
    return { reason: "case_unresolved", error: `${REVIEW_TEXT.case_unresolved} (${detail})` };
  }

  await decisionReviewStore().append([{ review, recorded_at: systemClock.now() }]);
  await reviseCase(nextCase);

  return {
    ok: true,
    review_id: review.review_id,
    effect_ref,
    causal_relation: claim.entitled,
    capped: claim.capped,
  };
}

export async function recordReviewFormAction(
  _prev: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const r = await recordReviewCore(formData);
  if (r.ok) revalidateAll();
  return r;
}

// ── ATTACHING CANON RECORDS TO A CASE ─────────────────────────────────────

/**
 * Record an id the case should carry. Used by the paths that create canon
 * records outside this module — a verification through the existing verify
 * writer, a Learning through `recordLearning` — so the case indexes them
 * without this module reimplementing either writer.
 *
 * Refuses a reference that does not resolve: the case never gains a link to
 * something that is not there.
 */
export async function attachToCase(
  case_id: string,
  key: "evidence_refs" | "learning_refs" | "effect_refs" | "action_refs" | "need_refs",
  ref: string,
  status?: CaseStatus,
): Promise<{ ok: boolean; error?: string }> {
  const cases = await loadCases();
  const theCase = cases.find((c) => c.case_id === case_id);
  if (!theCase) return { ok: false, error: `case ${case_id} not found` };

  const next: DecisionCase = {
    ...withRef(theCase, key, ref),
    ...(status ? { status } : {}),
  };

  const check = await resolveCase(next);
  if (!check.resolved) {
    return {
      ok: false,
      error: `unresolved: ${check.unresolved.map((u) => `${u.field}=${u.ref}`).join(", ")}`,
    };
  }

  await reviseCase(next);
  return { ok: true };
}

// ── THE ONE-SCREEN PATH ───────────────────────────────────────────────────

/**
 * Open a case and record its decision in one submission.
 *
 * The screen asks one question ("what did you decide?"), and a case is the
 * container that question implies — asking a person to create a case first
 * and then decide inside it would be the model leaking into the product. This
 * composes the two writers; it does not bypass either, and either one's
 * refusal aborts the whole thing.
 *
 * The case is opened FIRST because the decision needs its id. If the decision
 * is then refused, the case remains, open and undecided — which is a true
 * record of what happened (someone started framing a problem and did not
 * finish) rather than a phantom.
 */
export async function openCaseAndRecordDecisionCore(
  formData: FormData,
): Promise<DecisionFormState> {
  const caseData = new FormData();
  caseData.set("title", field(formData, "statement"));
  caseData.set("risk_level", field(formData, "risk_level"));
  caseData.set("observation_refs", field(formData, "observation_refs"));

  const opened = await openCaseCore(caseData);
  if (!opened.ok || !opened.case_id) {
    return {
      reason: "fields_incomplete",
      error: opened.error ?? "לא ניתן היה לפתוח מקרה",
    };
  }

  const decisionData = new FormData();
  for (const [k, v] of formData.entries()) decisionData.append(k, v);
  decisionData.set("case_id", opened.case_id);
  return recordDecisionCore(decisionData);
}

export async function openCaseAndRecordDecisionFormAction(
  _prev: DecisionFormState,
  formData: FormData,
): Promise<DecisionFormState> {
  const r = await openCaseAndRecordDecisionCore(formData);
  if (r.ok) revalidateAll();
  return r;
}
