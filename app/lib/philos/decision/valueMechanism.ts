/**
 * Philos — values as an evaluation MECHANISM.
 *
 * **Hypothesis layer, not canon.** Same standing as `gap.ts`: an analysis
 * mechanism, not a claim about reality, not added to the canon document, and
 * it changes none of the 926 concepts.
 *
 * ## The problem this fixes
 *
 * Values existed in the concept store and took almost no part in the
 * computation that runs from observation to decision. They were CONTENT —
 * catalogued, coloured, displayed — where they should have been the criterion
 * by which a gap becomes important, an option is preferred, and an outcome is
 * judged. This module makes them act at three points, each as a GATE rather
 * than a score:
 *
 *   appraisal → `gap.ts::appraise` refuses a "this matters" without a value
 *   decision  → `checkTradeoff` refuses a decision that ignores a recorded conflict
 *   review    → `checkValueImpact` refuses an observed direction without evidence
 *
 * Nothing here weighs, ranks or sums values, and no aggregate "value score"
 * exists. Two values in conflict are recorded as being in conflict; which one
 * wins is a person's declared choice with a stated price, never a computed
 * optimum.
 *
 * ## What is REFERENCED rather than rebuilt
 *
 * Three of the five objects in the original sketch already exist in this
 * codebase, and creating them again would be exactly the parallel-model
 * duplication removed in `9a3c86d`:
 *
 *   `ValueDefinition` → `valueSystem/baseValueRegistry.ts::BaseValue`
 *      (BV01..BV65, the source catalogue). Referenced by id.
 *   `ValuePosition`   → `community/valueDeclaration.ts::ValueDeclaration`
 *      (holder, scope, declared_by, evidence, status). Referenced by
 *      `value_id`; this module never stores who holds what.
 *   a catalogue of known oppositions →
 *      `valueSystem/contradictionMaster.ts::ContradictionMasterEntry`
 *      (pole_a/pole_b). A `ValueConflict` may cite one, and does not restate it.
 *
 * What is genuinely new — nothing in the codebase held these facts — is the
 * RUNTIME conflict between two values for one subject in one context, the
 * price a decision chose to pay, and what actually happened to each value
 * afterwards.
 */
import { parseOffsetInstant } from "../canon/observation";
import { isRecordOrigin, type RecordOrigin } from "../recordOrigin";

// ── VALUE CONFLICT ────────────────────────────────────────────────────────

/**
 * Ordinal, never numeric. How hard the two values pull apart FOR THIS SUBJECT
 * IN THIS CONTEXT — which is a judgement, not a measurement.
 */
export const TENSION_LEVELS = ["latent", "active", "forcing"] as const;
export type TensionLevel = (typeof TENSION_LEVELS)[number];

export interface ValueConflict {
  conflict_id: string;
  case_id: string;
  /** `ValueDeclaration.value_id`. Never a copy of the value. */
  value_a_ref: string;
  value_b_ref: string;
  /** Whose conflict. Two people can hold the same pair without conflict. */
  subject: string;
  context: string;
  tension_level: TensionLevel;
  /**
   * The known contradiction this instance is an example of, if it is one —
   * `ContradictionMasterEntry.contradiction_id`. Optional, and absent is
   * meaningful: a real conflict need not appear in the master catalogue.
   */
  contradiction_ref?: string;
  /** What shows the conflict is real. May be empty for `latent`. */
  evidence_refs: readonly string[];
  recognised_at: string;
  record_origin: RecordOrigin;
}

// ── VALUE TRADEOFF ────────────────────────────────────────────────────────

export interface ValueTradeoff {
  tradeoff_id: string;
  case_id: string;
  /** The Decision that paid this price. One tradeoff per decision. */
  decision_ref: string;
  /** The conflicts this tradeoff answers. */
  conflict_refs: readonly string[];
  /** `ValueDeclaration.value_id`s the decision advanced. */
  prioritized_value_refs: readonly string[];
  /**
   * The values the decision knowingly set back. REQUIRED to be non-empty —
   * a "tradeoff" that gives nothing up is not a tradeoff, it is a claim to
   * have escaped the conflict, and recording it as a tradeoff would hide the
   * fact that nothing was actually weighed.
   */
  deprioritized_value_refs: readonly string[];
  /** Why this price was worth paying. The person's words. */
  rationale: string;
  /** Who was entitled to make this call. */
  authorized_by_ref?: string;
  decided_at: string;
  record_origin: RecordOrigin;
}

// ── VALUE IMPACT ──────────────────────────────────────────────────────────

/**
 * Direction only. Never a magnitude on an invented scale — `magnitude` below
 * is the person's own ordinal word, and there is no arithmetic on it.
 */
export const IMPACT_DIRECTIONS = ["advanced", "unchanged", "set_back", "unknown"] as const;
export type ImpactDirection = (typeof IMPACT_DIRECTIONS)[number];

export interface ValueImpact {
  impact_id: string;
  case_id: string;
  /** The canon `Effect` this impact is read from. */
  effect_ref: string;
  /** `ValueDeclaration.value_id`. */
  value_ref: string;
  /**
   * What the tradeoff PREDICTED would happen to this value. Taken from the
   * tradeoff at decision time, so the comparison below is against a
   * pre-registered expectation rather than a memory.
   */
  expected_direction: ImpactDirection;
  /** What actually happened. `unknown` is a real answer. */
  observed_direction: ImpactDirection;
  /** The person's own ordinal word. No scale, no arithmetic. */
  magnitude?: "slight" | "moderate" | "large";
  /** `VerificationRecord.verification_id`s. Required for a non-unknown
   *  observed direction — see `checkValueImpact`. */
  evidence_refs: readonly string[];
  confidence?: number;
  observed_at: string;
  record_origin: RecordOrigin;
}

/** Did the value go the way the decision said it would? Pure, total. */
export function impactMatchedExpectation(i: ValueImpact): boolean | null {
  if (i.observed_direction === "unknown" || i.expected_direction === "unknown") return null;
  return i.observed_direction === i.expected_direction;
}

// ── VALIDATION ────────────────────────────────────────────────────────────

function nonEmpty(s: unknown): s is string {
  return typeof s === "string" && s.trim() !== "";
}
function stringList(v: unknown): v is readonly string[] {
  return Array.isArray(v) && v.every((x) => nonEmpty(x));
}

const TENSION_SET: ReadonlySet<string> = new Set(TENSION_LEVELS);
const DIRECTION_SET: ReadonlySet<string> = new Set(IMPACT_DIRECTIONS);
const MAGNITUDE_SET: ReadonlySet<string> = new Set(["slight", "moderate", "large"]);

export interface Validation<E> {
  valid: boolean;
  errors: E[];
}

export type ValueConflictError = { field: string; reason: string };

export function validateValueConflict(c: ValueConflict): Validation<ValueConflictError> {
  const errors: ValueConflictError[] = [];
  if (!nonEmpty(c?.conflict_id)) errors.push({ field: "conflict_id", reason: "empty" });
  if (!nonEmpty(c?.case_id)) errors.push({ field: "case_id", reason: "empty" });
  if (!nonEmpty(c?.value_a_ref)) errors.push({ field: "value_a_ref", reason: "empty" });
  if (!nonEmpty(c?.value_b_ref)) errors.push({ field: "value_b_ref", reason: "empty" });
  if (nonEmpty(c?.value_a_ref) && c.value_a_ref === c.value_b_ref) {
    /* A value cannot conflict with itself; such a record would make every
       tradeoff against it vacuous. */
    errors.push({ field: "value_b_ref", reason: "same_as_value_a" });
  }
  if (!nonEmpty(c?.subject)) errors.push({ field: "subject", reason: "empty" });
  if (!nonEmpty(c?.context)) errors.push({ field: "context", reason: "empty" });
  if (typeof c?.tension_level !== "string" || !TENSION_SET.has(c.tension_level)) {
    errors.push({ field: "tension_level", reason: "unknown_value" });
  }
  if (!stringList(c?.evidence_refs)) {
    errors.push({ field: "evidence_refs", reason: "not_a_string_list" });
  } else if (c.tension_level !== "latent" && c.evidence_refs.length === 0) {
    /* A conflict said to be ACTIVE or FORCING is a claim about the person's
       real situation and needs something behind it. `latent` is the honest
       label for "I can see these could collide but they have not yet". */
    errors.push({ field: "evidence_refs", reason: "required_above_latent" });
  }
  if (parseOffsetInstant(c?.recognised_at) === null) {
    errors.push({ field: "recognised_at", reason: "invalid_or_no_offset" });
  }
  if (!isRecordOrigin(c?.record_origin)) {
    errors.push({ field: "record_origin", reason: "unknown_value" });
  }
  return { valid: errors.length === 0, errors };
}

export function validateValueTradeoff(t: ValueTradeoff): Validation<ValueConflictError> {
  const errors: ValueConflictError[] = [];
  if (!nonEmpty(t?.tradeoff_id)) errors.push({ field: "tradeoff_id", reason: "empty" });
  if (!nonEmpty(t?.case_id)) errors.push({ field: "case_id", reason: "empty" });
  if (!nonEmpty(t?.decision_ref)) errors.push({ field: "decision_ref", reason: "empty" });
  for (const f of ["conflict_refs", "prioritized_value_refs", "deprioritized_value_refs"] as const) {
    if (!stringList(t?.[f])) errors.push({ field: f, reason: "not_a_string_list" });
  }
  if (stringList(t?.prioritized_value_refs) && t.prioritized_value_refs.length === 0) {
    errors.push({ field: "prioritized_value_refs", reason: "empty_list" });
  }
  if (stringList(t?.deprioritized_value_refs) && t.deprioritized_value_refs.length === 0) {
    /* See the field comment: a tradeoff that costs nothing is not a tradeoff. */
    errors.push({ field: "deprioritized_value_refs", reason: "empty_list" });
  }
  if (stringList(t?.prioritized_value_refs) && stringList(t?.deprioritized_value_refs)) {
    const both = t.prioritized_value_refs.filter((v) => t.deprioritized_value_refs.includes(v));
    if (both.length > 0) {
      errors.push({ field: "deprioritized_value_refs", reason: "also_prioritized" });
    }
  }
  if (!nonEmpty(t?.rationale)) errors.push({ field: "rationale", reason: "empty" });
  if (parseOffsetInstant(t?.decided_at) === null) {
    errors.push({ field: "decided_at", reason: "invalid_or_no_offset" });
  }
  if (!isRecordOrigin(t?.record_origin)) {
    errors.push({ field: "record_origin", reason: "unknown_value" });
  }
  return { valid: errors.length === 0, errors };
}

export function validateValueImpact(i: ValueImpact): Validation<ValueConflictError> {
  const errors: ValueConflictError[] = [];
  if (!nonEmpty(i?.impact_id)) errors.push({ field: "impact_id", reason: "empty" });
  if (!nonEmpty(i?.case_id)) errors.push({ field: "case_id", reason: "empty" });
  if (!nonEmpty(i?.effect_ref)) errors.push({ field: "effect_ref", reason: "empty" });
  if (!nonEmpty(i?.value_ref)) errors.push({ field: "value_ref", reason: "empty" });
  for (const f of ["expected_direction", "observed_direction"] as const) {
    if (typeof i?.[f] !== "string" || !DIRECTION_SET.has(i[f])) {
      errors.push({ field: f, reason: "unknown_value" });
    }
  }
  if (i?.magnitude !== undefined && !MAGNITUDE_SET.has(i.magnitude)) {
    errors.push({ field: "magnitude", reason: "unknown_value" });
  }
  if (!stringList(i?.evidence_refs)) {
    errors.push({ field: "evidence_refs", reason: "not_a_string_list" });
  }
  if (i?.confidence !== undefined) {
    const c = i.confidence;
    if (typeof c !== "number" || !Number.isFinite(c) || c < 0 || c > 1) {
      errors.push({ field: "confidence", reason: "not_a_probability" });
    }
  }
  if (parseOffsetInstant(i?.observed_at) === null) {
    errors.push({ field: "observed_at", reason: "invalid_or_no_offset" });
  }
  if (!isRecordOrigin(i?.record_origin)) {
    errors.push({ field: "record_origin", reason: "unknown_value" });
  }
  return { valid: errors.length === 0, errors };
}

// ── THE GATES ─────────────────────────────────────────────────────────────

export type TradeoffRefusal =
  | "conflict_unanswered"
  | "no_price_paid"
  | "value_on_both_sides";

export interface TradeoffCheck {
  ok: boolean;
  refusal?: TradeoffRefusal;
  /** Conflicts recorded on the case that this tradeoff does not answer. */
  unanswered: readonly string[];
  message?: string;
}

const TRADEOFF_TEXT: Record<TradeoffRefusal, string> = {
  conflict_unanswered:
    "נרשם קונפליקט ערכים שההחלטה אינה מתייחסת אליו — אי אפשר להחליט ולהתעלם מהמתח שכבר זוהה",
  no_price_paid:
    "פשרה חייבת לוותר על משהו. אם שום ערך לא נדחק — זו אינה פשרה אלא טענה שנמלטת מהקונפליקט",
  value_on_both_sides: "אותו ערך מופיע גם כמקודם וגם כנדחק",
};

/**
 * DECISIONS MUST ANSWER THE CONFLICTS THEY KNOW ABOUT.
 *
 * Pure, total, never throws. This is the second place values act: a case with
 * a recorded, non-latent `ValueConflict` cannot produce a decision that says
 * nothing about it. Before this, a person could record "these two values are
 * tearing at each other", then decide, and the record would show a clean
 * choice with the tension nowhere in it.
 *
 * `latent` conflicts are exempt: noticing that two values COULD collide is
 * not the same as facing it, and requiring an answer would make people stop
 * recording latent conflicts.
 */
export function checkTradeoff(input: {
  tradeoff?: Pick<
    ValueTradeoff,
    "conflict_refs" | "prioritized_value_refs" | "deprioritized_value_refs"
  >;
  /** The case's conflicts, with their tension levels. */
  caseConflicts: readonly Pick<ValueConflict, "conflict_id" | "tension_level">[];
}): TradeoffCheck {
  const mustAnswer = (input.caseConflicts ?? [])
    .filter((c) => c.tension_level !== "latent")
    .map((c) => c.conflict_id);

  const answered = new Set(input.tradeoff?.conflict_refs ?? []);
  const unanswered = mustAnswer.filter((id) => !answered.has(id));

  if (unanswered.length > 0) {
    return {
      ok: false,
      refusal: "conflict_unanswered",
      unanswered,
      message: `${TRADEOFF_TEXT.conflict_unanswered} (${unanswered.join(", ")})`,
    };
  }

  if (!input.tradeoff) return { ok: true, unanswered: [] };

  if ((input.tradeoff.deprioritized_value_refs ?? []).length === 0) {
    return {
      ok: false,
      refusal: "no_price_paid",
      unanswered: [],
      message: TRADEOFF_TEXT.no_price_paid,
    };
  }

  const both = (input.tradeoff.prioritized_value_refs ?? []).filter((v) =>
    (input.tradeoff!.deprioritized_value_refs ?? []).includes(v),
  );
  if (both.length > 0) {
    return {
      ok: false,
      refusal: "value_on_both_sides",
      unanswered: [],
      message: `${TRADEOFF_TEXT.value_on_both_sides} (${both.join(", ")})`,
    };
  }

  return { ok: true, unanswered: [] };
}

export type ImpactRefusal = "observed_without_evidence" | "value_not_in_tradeoff";

export interface ImpactCheck {
  ok: boolean;
  refusal?: ImpactRefusal;
  message?: string;
}

/**
 * AN OBSERVED IMPACT ON A VALUE NEEDS EVIDENCE.
 *
 * The third place values act. Saying "my sense of belonging went up" is a
 * claim about an outcome, and this layer holds it to the same standard as any
 * other outcome claim: a direction other than `unknown` needs at least one
 * evidence reference. `unknown` is always permitted and costs nothing — which
 * is what stops this gate from pushing people into inventing a direction.
 *
 * Pure, total, never throws.
 */
export function checkValueImpact(input: {
  observed_direction: ImpactDirection;
  evidence_refs: readonly string[];
  value_ref: string;
  /** The values the decision actually weighed, if a tradeoff exists. */
  tradeoffValues?: readonly string[];
}): ImpactCheck {
  if (
    input.observed_direction !== "unknown" &&
    (input.evidence_refs ?? []).filter((r) => nonEmpty(r)).length === 0
  ) {
    return {
      ok: false,
      refusal: "observed_without_evidence",
      message:
        "טענה על מה שקרה לערך היא טענה על תוצאה — בלי ראיה אפשר לרשום רק ״לא ידוע״",
    };
  }

  if (input.tradeoffValues && !input.tradeoffValues.includes(input.value_ref)) {
    return {
      ok: false,
      refusal: "value_not_in_tradeoff",
      message:
        "הערך הזה לא נשקל בהחלטה — אי אפשר לדווח על השפעה על ערך שההחלטה מעולם לא התייחסה אליו",
    };
  }

  return { ok: true };
}

/**
 * WHICH VALUE THE DECISION ACTUALLY SERVED, as opposed to which it said it
 * would. Pure; returns the impacts that contradicted the tradeoff's own
 * prediction. This is the sentence a Learning can honestly carry: not "the
 * decision worked" but "it advanced the value it set out to advance" — or
 * that it did not.
 */
export function tradeoffContradictions(
  impacts: readonly ValueImpact[],
): ValueImpact[] {
  return impacts.filter((i) => impactMatchedExpectation(i) === false);
}
