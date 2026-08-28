/**
 * Philos — Gap and Appraisal.
 *
 * **This is a hypothesis layer, not canon.** It is an analysis mechanism for
 * how a difference becomes a reason to act. It is not a claim about the
 * structure of reality, it is not added to `PHILOS-MELTING-POT-CANON.md`, and
 * nothing here changes the 926-concept taxonomy. Treat every type below as
 * this pass's own construction, stated plainly.
 *
 * ## The correction this module encodes
 *
 * The system previously went from Observation straight to Need, which quietly
 * asserted that a difference IS a shortage. It is not. The same gap can be a
 * threat, a shortage, an opportunity, an acceptable trade, or beneath
 * noticing — and which one it is depends on the observer, not on the gap:
 *
 *     current state ─┐
 *                    ├─→ GAP ─→ [observer's frame] ─→ APPRAISAL
 *     desired/required ┘
 *
 * A shortage is therefore not "an interpretation of a difference". It is
 * **the classification of a gap against a requirement, goal or value held by
 * a particular observer at a particular time and context**. Even an
 * objectively physical shortage — too little oxygen — is defined against the
 * threshold a system needs to keep existing, not by the bare existence of a
 * difference.
 *
 * ## The mechanism: values must ACT, not be displayed
 *
 * The whole point of this module is `appraise`, which **refuses** to classify
 * a gap as anything other than `not_relevant` unless it names the value
 * positions that make it matter. Values had been sitting in a catalogue,
 * shown as content, taking no part in the computation that runs from
 * observation to decision. Here they are a precondition: no cited value, no
 * appraisal. That is a gate, not a score — nothing is weighed, ranked or
 * summed, and no number is invented.
 *
 * ## What is deliberately NOT here
 *
 * No generic "energy flow". In a human system that word covers attention,
 * arousal, motivation, effort, money, time, knowledge, trust, authority and
 * influence at once, and collapsing them into one quantity would be a
 * simulated measurement. Typed flows with an explicit `measurement_mode` are
 * a separate, later piece of work and are not started here.
 */
import { parseOffsetInstant } from "../canon/observation";
import { isRecordOrigin, type RecordOrigin } from "../recordOrigin";

/**
 * How the desired side of a gap was established. This is NOT the size of the
 * gap — it is where the "should" came from, which is what makes the gap
 * arguable rather than a fact.
 */
export const REQUIREMENT_SOURCES = [
  /** A threshold the system needs to keep functioning. */
  "survival_threshold",
  /** An explicit goal the subject set. */
  "stated_goal",
  /** A standard a group or society applies. */
  "external_standard",
  /** A comparison with someone or something else. */
  "comparison",
  /** The subject's own expectation, unexamined. */
  "personal_expectation",
] as const;
export type RequirementSource = (typeof REQUIREMENT_SOURCES)[number];

export interface Gap {
  gap_id: string;
  case_id: string;
  /** Whose gap this is. */
  subject: string;
  /** What is, in the subject's words. Never generated. */
  current_state: string;
  /** What is wanted or required, in the subject's words. */
  desired_state: string;
  /** Where the "should" came from. The gap is only as solid as this. */
  requirement_source: RequirementSource;
  /** `canon_event_id` of Observations that establish the current side. */
  observation_refs: readonly string[];
  observed_at: string;
  record_origin: RecordOrigin;
}

/**
 * What the gap MEANS to this observer. Deliberately five, and deliberately
 * including two that lead nowhere: a system that can only classify gaps as
 * problems will manufacture problems.
 */
export const APPRAISALS = [
  "shortage",
  "threat",
  "opportunity",
  "acceptable_tradeoff",
  "not_relevant",
] as const;
export type AppraisalKind = (typeof APPRAISALS)[number];

/** The appraisals that assert the gap matters and therefore need a reason. */
export function assertsRelevance(kind: AppraisalKind): boolean {
  return kind === "shortage" || kind === "threat" || kind === "opportunity";
}

export interface Appraisal {
  appraisal_id: string;
  case_id: string;
  gap_ref: string;
  /** WHO is appraising. The same gap appraised by someone else is a
   *  different record, never an overwrite of this one. */
  appraiser: string;
  kind: AppraisalKind;
  /**
   * THE VALUES THAT MAKE IT SO — `ValueDeclaration.value_id` references into
   * the EXISTING declaration store. Never a copy of the value, never a new
   * value catalogue.
   *
   * Required to be non-empty for `shortage`/`threat`/`opportunity`; see
   * `appraise`.
   */
  value_refs: readonly string[];
  /** Why these values make this gap that kind of thing. The subject's words. */
  because: string;
  /**
   * How much this matters to the appraiser, as an ORDINAL word, never a
   * number. There is no scale behind it and inventing one would be the
   * simulated measurement this layer exists to avoid.
   */
  salience: "low" | "medium" | "high";
  /** The window in which this appraisal holds. Appraisals expire; gaps do not. */
  appraised_at: string;
  context: string;
  record_origin: RecordOrigin;
}

// ── VALIDATION ────────────────────────────────────────────────────────────

export type GapError =
  | { field: "gap_id"; reason: "empty" }
  | { field: "case_id"; reason: "empty" }
  | { field: "subject"; reason: "empty" }
  | { field: "current_state"; reason: "empty" }
  | { field: "desired_state"; reason: "empty" }
  | { field: "requirement_source"; reason: "unknown_value" }
  | { field: "observation_refs"; reason: "not_a_string_list" }
  | { field: "observed_at"; reason: "invalid_or_no_offset" }
  | { field: "record_origin"; reason: "unknown_value" };

export type AppraisalError =
  | { field: "appraisal_id"; reason: "empty" }
  | { field: "case_id"; reason: "empty" }
  | { field: "gap_ref"; reason: "empty" }
  | { field: "appraiser"; reason: "empty" }
  | { field: "kind"; reason: "unknown_value" }
  | { field: "value_refs"; reason: "not_a_string_list" }
  | { field: "value_refs"; reason: "required_for_this_kind" }
  | { field: "because"; reason: "empty" }
  | { field: "salience"; reason: "unknown_value" }
  | { field: "appraised_at"; reason: "invalid_or_no_offset" }
  | { field: "context"; reason: "empty" }
  | { field: "record_origin"; reason: "unknown_value" };

function nonEmpty(s: unknown): s is string {
  return typeof s === "string" && s.trim() !== "";
}

const SOURCE_SET: ReadonlySet<string> = new Set(REQUIREMENT_SOURCES);
const KIND_SET: ReadonlySet<string> = new Set(APPRAISALS);
const SALIENCE_SET: ReadonlySet<string> = new Set(["low", "medium", "high"]);

export function validateGap(g: Gap): { valid: boolean; errors: GapError[] } {
  const errors: GapError[] = [];
  if (!nonEmpty(g?.gap_id)) errors.push({ field: "gap_id", reason: "empty" });
  if (!nonEmpty(g?.case_id)) errors.push({ field: "case_id", reason: "empty" });
  if (!nonEmpty(g?.subject)) errors.push({ field: "subject", reason: "empty" });
  if (!nonEmpty(g?.current_state)) errors.push({ field: "current_state", reason: "empty" });
  if (!nonEmpty(g?.desired_state)) errors.push({ field: "desired_state", reason: "empty" });
  if (typeof g?.requirement_source !== "string" || !SOURCE_SET.has(g.requirement_source)) {
    errors.push({ field: "requirement_source", reason: "unknown_value" });
  }
  if (!Array.isArray(g?.observation_refs) || g.observation_refs.some((x) => !nonEmpty(x))) {
    errors.push({ field: "observation_refs", reason: "not_a_string_list" });
  }
  if (parseOffsetInstant(g?.observed_at) === null) {
    errors.push({ field: "observed_at", reason: "invalid_or_no_offset" });
  }
  if (!isRecordOrigin(g?.record_origin)) {
    errors.push({ field: "record_origin", reason: "unknown_value" });
  }
  return { valid: errors.length === 0, errors };
}

export function validateAppraisal(a: Appraisal): { valid: boolean; errors: AppraisalError[] } {
  const errors: AppraisalError[] = [];
  if (!nonEmpty(a?.appraisal_id)) errors.push({ field: "appraisal_id", reason: "empty" });
  if (!nonEmpty(a?.case_id)) errors.push({ field: "case_id", reason: "empty" });
  if (!nonEmpty(a?.gap_ref)) errors.push({ field: "gap_ref", reason: "empty" });
  if (!nonEmpty(a?.appraiser)) errors.push({ field: "appraiser", reason: "empty" });
  if (typeof a?.kind !== "string" || !KIND_SET.has(a.kind)) {
    errors.push({ field: "kind", reason: "unknown_value" });
  }
  if (!Array.isArray(a?.value_refs) || a.value_refs.some((x) => !nonEmpty(x))) {
    errors.push({ field: "value_refs", reason: "not_a_string_list" });
  } else if (KIND_SET.has(a.kind) && assertsRelevance(a.kind) && a.value_refs.length === 0) {
    /* THE GATE, restated structurally so a record cannot exist in the
       forbidden shape even if some future writer forgets to call `appraise`. */
    errors.push({ field: "value_refs", reason: "required_for_this_kind" });
  }
  if (!nonEmpty(a?.because)) errors.push({ field: "because", reason: "empty" });
  if (typeof a?.salience !== "string" || !SALIENCE_SET.has(a.salience)) {
    errors.push({ field: "salience", reason: "unknown_value" });
  }
  if (parseOffsetInstant(a?.appraised_at) === null) {
    errors.push({ field: "appraised_at", reason: "invalid_or_no_offset" });
  }
  if (!nonEmpty(a?.context)) errors.push({ field: "context", reason: "empty" });
  if (!isRecordOrigin(a?.record_origin)) {
    errors.push({ field: "record_origin", reason: "unknown_value" });
  }
  return { valid: errors.length === 0, errors };
}

// ── THE GATE ──────────────────────────────────────────────────────────────

export type AppraisalRefusal =
  | "no_value_cited"
  | "value_not_held_by_appraiser"
  | "unknown_kind";

export interface AppraisalCheck {
  ok: boolean;
  refusal?: AppraisalRefusal;
  /** The value refs that were accepted as the basis. */
  basis: readonly string[];
  message?: string;
}

const REFUSAL_TEXT: Record<AppraisalRefusal, string> = {
  no_value_cited:
    "אי אפשר לקבוע שפער הוא מחסור, איום או הזדמנות בלי לציין לפי איזה ערך — פער כשלעצמו אינו בעיה",
  value_not_held_by_appraiser:
    "הערך שצוין אינו מוצהר על ידי מי שמעריך — אי אפשר להעריך לפי ערך שאינו שלך",
  unknown_kind: "סוג ההערכה אינו מוכר",
};

/**
 * Whether this appraisal may be recorded. Pure, total, never throws.
 *
 * **The one rule.** An appraisal that asserts the gap matters
 * (`shortage`/`threat`/`opportunity`) must cite at least one value the
 * appraiser actually holds. `acceptable_tradeoff` and `not_relevant` may cite
 * none: deciding something does not matter needs no justification from a
 * value, and demanding one would push people to invent a value in order to
 * dismiss something.
 *
 * `heldValueIds` are `ValueDeclaration.value_id`s from the EXISTING
 * declaration store — this function never reads a store and never invents a
 * value; the caller supplies what the person has actually declared.
 */
export function appraise(input: {
  kind: AppraisalKind;
  value_refs: readonly string[];
  heldValueIds: readonly string[];
}): AppraisalCheck {
  const { kind, value_refs, heldValueIds } = input;

  if (!KIND_SET.has(kind)) {
    return { ok: false, refusal: "unknown_kind", basis: [], message: REFUSAL_TEXT.unknown_kind };
  }

  const cited = (value_refs ?? []).filter((v) => nonEmpty(v));

  if (!assertsRelevance(kind)) {
    /* Dismissing a gap needs no value. It is still recorded, with whatever
       basis was given. */
    return { ok: true, basis: cited };
  }

  if (cited.length === 0) {
    return {
      ok: false,
      refusal: "no_value_cited",
      basis: [],
      message: REFUSAL_TEXT.no_value_cited,
    };
  }

  const held = new Set(heldValueIds ?? []);
  const notHeld = cited.filter((v) => !held.has(v));
  if (notHeld.length > 0) {
    return {
      ok: false,
      refusal: "value_not_held_by_appraiser",
      basis: [],
      message: `${REFUSAL_TEXT.value_not_held_by_appraiser} (${notHeld.join(", ")})`,
    };
  }

  return { ok: true, basis: cited };
}
