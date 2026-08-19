/**
 * Human Parameter acquisition mechanism (ledger §34).
 *
 * Built to real specification, but NOT exercised against any real
 * question this pass — checked directly against every relevant sheet in
 * the real Human Config source (`MASTER_UNITS`, `SEMANTIC_DECISION_RECORDS`,
 * `EVIDENCE_PACKETS`, `SEMANTIC_REVIEW_QUEUE`) and confirmed: none of the
 * 7 verified `MEASURABLE_PARAMETER` Canonical_IDs (§24/§32,
 * `temperamentDimensions.ts`) has a real source-backed question or
 * informing source item. The temperament Heading's own rows are bare
 * labels ("-רמת פעילות-") with zero elaboration; zero rows anywhere
 * reference those 7 Canonical_IDs with question-phrased or instrument
 * content. Per the product rule that requested this mechanism ("if no
 * real question exists, stop at that precise boundary — do not fabricate
 * wording"), no `SubjectResponse`, `ParameterObservation`, or state
 * update was created for any real subject. This module is the reusable
 * mechanism only, ready for the moment real question content exists —
 * proven correct here with synthetic fixtures (this codebase's own
 * established testing convention for pure functions), never with an
 * invented real-subject fact.
 *
 * SOURCE QUESTION ≠ USER ANSWER ≠ OBSERVATION ≠ EVIDENCE ≠ STATE — kept
 * as 4 distinct real types, never collapsed.
 */

export type EvidenceType = "SELF_DECLARED" | "DIRECT_OBSERVATION" | "SYSTEM_EVENT" | "DERIVED" | "HYPOTHESIS";

/** A subject's raw response to a real source item — NOT yet durable
 *  Human state. */
export interface SubjectResponse {
  subject_id: string;
  source_item_id: string;
  canonical_parameter_id: string;
  answer: string;
  context: string;
  timestamp: string;
  provenance: EvidenceType;
  consent: boolean;
}

/** A canonical Observation derived FROM a response — only created via the
 *  explicit rule below, never automatically from a bare response. */
export interface ParameterObservation {
  subject_id: string;
  canonical_parameter_id: string;
  observed_value: string;
  context: string;
  timestamp: string;
  source: string;
  evidence_type: EvidenceType;
  response_id: string;
}

export type StateUpdateResult =
  | { kind: "state_updated"; previous_state: string | null; new_state: string; delta: string | null; direction: "increase" | "decrease" | "stable" | null; confidence: number; context: string; evidence_ids: string[]; timestamp: string }
  | { kind: "insufficient_evidence"; reason: string };

/**
 * The explicit rule deciding STATE_UPDATED vs INSUFFICIENT_EVIDENCE — one
 * response/Observation never automatically becomes a durable trait.
 * Mirrors the same discipline `deriveDomainStateUpdate`
 * (`valueDomain/valueDomainConfig.ts`, §22) already established for
 * Value-Domain parameters: requires real consent, a non-empty observed
 * value, and non-HYPOTHESIS evidence before advancing state at all.
 */
export function deriveParameterStateUpdate(params: {
  response: SubjectResponse;
  observation: ParameterObservation;
  previousState: string | null;
}): StateUpdateResult {
  if (!params.response.consent) {
    return { kind: "insufficient_evidence", reason: "no consent recorded on the response" };
  }
  if (!params.observation.observed_value.trim()) {
    return { kind: "insufficient_evidence", reason: "observation carries no observed_value" };
  }
  if (params.observation.evidence_type === "HYPOTHESIS") {
    return { kind: "insufficient_evidence", reason: "HYPOTHESIS evidence alone never updates durable state" };
  }
  return {
    kind: "state_updated",
    previous_state: params.previousState,
    new_state: params.observation.observed_value,
    delta: null,
    direction: null,
    confidence: params.observation.evidence_type === "SELF_DECLARED" ? 0.4 : 0.6,
    context: params.observation.context,
    evidence_ids: [params.observation.response_id],
    timestamp: params.observation.timestamp,
  };
}
