/**
 * Philos — `DecisionCase`, the aggregate root.
 *
 * ## The one rule: it holds REFERENCES, never content
 *
 * Every field below that names other records is a list of ids. There is no
 * field on this record that restates something a canon record already says —
 * no outcome text, no verification, no learning content, no state. If you can
 * read a fact from a `DecisionCase` without following a reference, that fact
 * is either the case's own (its title, its risk level, its status) or it is a
 * bug.
 *
 * This is the correction to the first pass, which built a self-contained
 * decision model beside the canon spine instead of on top of it. A
 * `DecisionCase` is an INDEX over records that already exist; it is the
 * missing connective tissue, not a second system.
 *
 * ## Why an aggregate root at all
 *
 * The canon records chain pairwise — `Effect.action_ref`,
 * `Learning.effect_ref` — which is enough to walk backwards from an Effect
 * and nothing like enough to ask "what was this whole episode about". There
 * was no object for the episode. Without one, the alternatives considered,
 * the authority that permitted the action, and the learning that came out of
 * it are each reachable only from a different starting point, and no query
 * can say they belong to the same story.
 *
 * ## Fails closed
 *
 * A reference that does not resolve is an ERROR, never an empty render — see
 * `decisionCaseResolver.ts`. An index whose entries silently vanish when the
 * target is missing is worse than no index: it reports a smaller, tidier
 * story than the truth and gives no sign that it did.
 */
import { parseOffsetInstant } from "../canon/observation";
import { isRecordOrigin, type RecordOrigin } from "../recordOrigin";
import { isRiskLevel, type RiskLevel } from "./evidenceAxes";

/**
 * The stages a case moves through. `blocked`, `rejected`, `cancelled`,
 * `failed` and `superseded` are terminal-ish states that may be reached from
 * anywhere — a case that dies is a real outcome and must be recordable
 * without pretending it completed.
 */
export const CASE_STATUSES = [
  "draft",
  "open",
  "deliberating",
  "decided",
  "authorized",
  "executing",
  "observed",
  "evidenced",
  "learned",
  "closed",
  "blocked",
  "rejected",
  "cancelled",
  "failed",
  "superseded",
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export interface DecisionCase {
  case_id: string;
  /** The human problem, in the person's words. The case's OWN content. */
  title: string;

  // ── References. Every one of these is an id into an existing store. ──
  /** Canon subjects affected. */
  subject_refs: readonly string[];
  /** Groups participating. */
  group_refs: readonly string[];
  /** `Need.need_id` — what is missing. */
  need_refs: readonly string[];
  /** `CanonEvent.canon_event_id` of Observations — what is known. */
  observation_refs: readonly string[];
  /** Alternatives put forward, as records. */
  proposal_refs: readonly string[];

  // ── The appraisal layer. See `gap.ts` and `valueMechanism.ts`. ──
  /** `Gap.gap_id` — the difference between what is and what is wanted. */
  gap_refs: readonly string[];
  /** `Appraisal.appraisal_id` — what that gap MEANS, and to whom. */
  appraisal_refs: readonly string[];
  /** `ValueConflict.conflict_id` — which values pull apart here. */
  value_conflict_refs: readonly string[];
  /** `ValueTradeoff.tradeoff_id` — the price the decision chose to pay. */
  value_tradeoff_ref?: string;
  /** `ValueImpact.impact_id` — what happened to each value afterwards. */
  value_impact_refs: readonly string[];
  /** `Decision.decision_id` — what was chosen. At most one per case. */
  decision_ref?: string;
  /** `Action.action_id` — what was actually done. */
  action_refs: readonly string[];
  /** `Effect.effect_id` — what happened next. */
  effect_refs: readonly string[];
  /** `VerificationRecord.verification_id` — how it is known. */
  evidence_refs: readonly string[];
  /** `Learning.learning_id` — what is reusable. */
  learning_refs: readonly string[];
  /** Who was entitled to decide and to act. */
  authority_policy_ref?: string;

  // ── The case's own facts. ──
  risk_level: RiskLevel;
  status: CaseStatus;
  record_origin: RecordOrigin;
  opened_at: string;
  closed_at?: string;
}

export type DecisionCaseError =
  | { field: "case_id"; reason: "empty" }
  | { field: "title"; reason: "empty" }
  | { field: "risk_level"; reason: "unknown_value" }
  | { field: "status"; reason: "unknown_value" }
  | { field: "record_origin"; reason: "unknown_value" }
  | { field: "opened_at"; reason: "invalid_or_no_offset" }
  | { field: "closed_at"; reason: "invalid_or_no_offset" }
  | { field: "closed_at"; reason: "before_opened_at" }
  | { field: keyof DecisionCase; reason: "not_a_string_list" }
  | { field: keyof DecisionCase; reason: "duplicate_reference" };

export interface DecisionCaseValidation {
  valid: boolean;
  errors: DecisionCaseError[];
}

const STATUS_SET: ReadonlySet<string> = new Set(CASE_STATUSES);

export function isCaseStatus(v: unknown): v is CaseStatus {
  return typeof v === "string" && STATUS_SET.has(v);
}

function nonEmpty(s: unknown): s is string {
  return typeof s === "string" && s.trim() !== "";
}

/** Every list-of-references field, so validation cannot miss a new one. */
export const REFERENCE_LIST_FIELDS = [
  "subject_refs",
  "group_refs",
  "need_refs",
  "observation_refs",
  "proposal_refs",
  "gap_refs",
  "appraisal_refs",
  "value_conflict_refs",
  "value_impact_refs",
  "action_refs",
  "effect_refs",
  "evidence_refs",
  "learning_refs",
] as const satisfies readonly (keyof DecisionCase)[];

/** Pure, deterministic, total. All checks run; no short-circuiting. */
export function validateDecisionCase(c: DecisionCase): DecisionCaseValidation {
  const errors: DecisionCaseError[] = [];

  if (!nonEmpty(c?.case_id)) errors.push({ field: "case_id", reason: "empty" });
  if (!nonEmpty(c?.title)) errors.push({ field: "title", reason: "empty" });
  if (!isRiskLevel(c?.risk_level)) errors.push({ field: "risk_level", reason: "unknown_value" });
  if (!isCaseStatus(c?.status)) errors.push({ field: "status", reason: "unknown_value" });
  if (!isRecordOrigin(c?.record_origin)) {
    errors.push({ field: "record_origin", reason: "unknown_value" });
  }

  const openedMs = parseOffsetInstant(c?.opened_at);
  if (openedMs === null) errors.push({ field: "opened_at", reason: "invalid_or_no_offset" });

  if (c?.closed_at !== undefined) {
    const closedMs = parseOffsetInstant(c.closed_at);
    if (closedMs === null) {
      errors.push({ field: "closed_at", reason: "invalid_or_no_offset" });
    } else if (openedMs !== null && closedMs < openedMs) {
      errors.push({ field: "closed_at", reason: "before_opened_at" });
    }
  }

  for (const field of REFERENCE_LIST_FIELDS) {
    const list = c?.[field];
    if (!Array.isArray(list) || list.some((x) => !nonEmpty(x))) {
      errors.push({ field, reason: "not_a_string_list" });
      continue;
    }
    /* A reference listed twice is a bug in whatever wrote it, and it would
       double-count in every projection that reads the case. */
    if (new Set(list).size !== list.length) {
      errors.push({ field, reason: "duplicate_reference" });
    }
  }

  return { valid: errors.length === 0, errors };
}

/** Every reference the case makes, flattened, for integrity checking. */
export function allReferences(c: DecisionCase): { field: string; ref: string }[] {
  const out: { field: string; ref: string }[] = [];
  for (const field of REFERENCE_LIST_FIELDS) {
    for (const ref of c[field] ?? []) out.push({ field, ref });
  }
  if (c.decision_ref) out.push({ field: "decision_ref", ref: c.decision_ref });
  if (c.authority_policy_ref) {
    out.push({ field: "authority_policy_ref", ref: c.authority_policy_ref });
  }
  if (c.value_tradeoff_ref) {
    out.push({ field: "value_tradeoff_ref", ref: c.value_tradeoff_ref });
  }
  return out;
}

/** A new, empty case. Every list starts genuinely empty — never seeded. */
export function emptyCase(input: {
  case_id: string;
  title: string;
  risk_level: RiskLevel;
  opened_at: string;
  record_origin: RecordOrigin;
  subject_refs?: readonly string[];
}): DecisionCase {
  return {
    case_id: input.case_id,
    title: input.title,
    subject_refs: input.subject_refs ?? [],
    group_refs: [],
    need_refs: [],
    observation_refs: [],
    proposal_refs: [],
    gap_refs: [],
    appraisal_refs: [],
    value_conflict_refs: [],
    value_impact_refs: [],
    action_refs: [],
    effect_refs: [],
    evidence_refs: [],
    learning_refs: [],
    risk_level: input.risk_level,
    status: "open",
    record_origin: input.record_origin,
    opened_at: input.opened_at,
  };
}
