/**
 * Philos canonical event log — types.
 *
 * PHILOS-SYSTEM-BLUEPRINT §11: "All feeds, statistics, timelines, budgets,
 * profiles, impact, replay, and globe visuals derive from ONE event log. No
 * screen is built on separately-fabricated telemetry."
 *
 * Every field a screen displays must be traceable to an event in this log. The
 * projection layer (projectValueGroup.ts) is the only thing that reads it.
 */

/**
 * §10: the six evidence levels, which must never be collapsed into each other.
 * Ordered weakest → strongest. `system_inference` is deliberately last and is
 * NOT stronger than external verification — it is a separate kind of claim, and
 * the blueprint's rule is that inferred impact is never shown as verified fact.
 */
export const VERIFICATION_LEVELS = [
  "claim",
  "self_report",
  "evidence",
  "community_verified",
  "external_verified",
  "system_inference",
] as const;

export type VerificationStatus = (typeof VERIFICATION_LEVELS)[number];

/** Only these two count as "verified" when a screen labels a figure. */
export const VERIFIED_STATUSES: readonly VerificationStatus[] = [
  "community_verified",
  "external_verified",
];

export type EntityType = "person" | "value_group" | "allocation" | "transfer" | "impact";

export type EventType =
  // identity
  | "person.registered"
  | "group.opened"
  // people
  | "leader.appointed"
  | "member.joined"
  // activity
  | "request.opened"
  | "update.posted"
  | "meeting.scheduled"
  // resources
  | "resource.received"
  | "allocation.proposed"
  | "allocation.voted"
  | "allocation.approved"
  | "transfer.approved"
  | "transfer.completed"
  // impact
  | "impact.recorded"
  | "verification.requested"
  | "impact.verified"
  /* day — the operational day's two HUMAN ACTS, and only those two.
     A person opening a day and recording its closing are things a person
     DOES, so they are recorded here like any other act. The passage of
     time is not: there is no `day.expired`, no midnight event and no
     stored completion status, because a day ending is not an act anyone
     performs. OPEN/PARTIAL/CLOSED is DERIVED at read time from explicit
     gates (`day/daySession.ts`) and never written — the same rule the
     invitation path already follows for expiry.

     These live on `PhilosEvent` rather than `GroupEvent` because a day
     belongs to a PERSON, not a group: `entity_type: "person"` carries
     them with no group_id, and inventing one to satisfy a group-scoped
     log would be a false claim about who the record concerns.

     Their payloads are NOT free-form: `day/dayEvent.ts` defines
     `DayOpenedPayload` / `DayClosingRecordedPayload` and validates them
     before append. */
  | "day.opened"
  | "day.closing_recorded";

/**
 * Outcome of one verification attempt.
 *
 * `rejected` and `inconclusive` are first-class results, not absences: a checked
 * claim that failed is a different (and more informative) state than a claim
 * nobody looked at, and the screen must be able to tell them apart.
 */
export const VERIFICATION_RESULTS = [
  "verified",
  "partially_verified",
  "rejected",
  "inconclusive",
] as const;

export type VerificationResult = (typeof VERIFICATION_RESULTS)[number];

/** How the checking was actually done — determines which status it can confer. */
export const VERIFICATION_METHODS = [
  "community_attestation",
  "external_audit",
  "document_review",
  "site_visit",
  "measurement",
  "system_inference",
] as const;

export type VerificationMethod = (typeof VERIFICATION_METHODS)[number];

/**
 * `impact.verified` — a SEPARATE event from `impact.recorded`.
 *
 * Verification is an act performed by someone, at a time, by a method, on
 * evidence.  Folding it into a `verification_status` field on the claim itself
 * (as this log did before) loses all four: the claim appeared to verify itself,
 * with no verifier, no timestamp and no method.  §10's ladder is only meaningful
 * if the rung a claim sits on was put there by a second party.
 */
export interface ImpactVerificationPayload {
  /** event_id of the `impact.recorded` event being checked. */
  target_impact_event_id: string;
  verification_method: VerificationMethod;
  result: VerificationResult;
  notes?: string;
  /**
   * How much of the claim the verifier could actually support, 0..1.
   *
   * EXPLICIT ONLY. Never inferred from `result` — a `partially_verified` with no
   * stated fraction means "some of this held up, and we did not quantify how
   * much", which is honest. Deriving e.g. 0.5 from the word "partially" would
   * manufacture a number nobody measured, which is the exact move Philos exists
   * to refuse.
   */
  verified_fraction?: number;
}

export interface ImpactVerifiedEvent extends PhilosEvent {
  event_type: "impact.verified";
  payload: ImpactVerificationPayload & Record<string, unknown>;
}

/**
 * `verification.requested` — someone asked for a claim to be checked.
 *
 * This exists so `under_review` is a state the log CARRIES rather than one the
 * projection guesses. Without it, "under review" could only be inferred from the
 * absence of a verification — and absence of checking is not evidence that
 * checking is under way. Same principle as verified_fraction: if nobody recorded
 * it, it did not happen.
 */
export interface VerificationRequestPayload {
  /** event_id of the `impact.recorded` event to be checked. */
  target_impact_event_id: string;
  reason: string;
  /** Which role is being asked to check — not a named person, so it can be reassigned. */
  requested_verifier_role: string;
}

export interface VerificationRequestedEvent extends PhilosEvent {
  event_type: "verification.requested";
  payload: VerificationRequestPayload & Record<string, unknown>;
}

export function isVerificationRequestedEvent(
  e: PhilosEvent,
): e is VerificationRequestedEvent {
  if (e.event_type !== "verification.requested") return false;
  const p = e.payload as Partial<VerificationRequestPayload> | undefined;
  return (
    typeof p?.target_impact_event_id === "string" &&
    typeof p?.reason === "string" &&
    typeof p?.requested_verifier_role === "string"
  );
}

export function isImpactVerifiedEvent(e: PhilosEvent): e is ImpactVerifiedEvent {
  if (e.event_type !== "impact.verified") return false;
  const p = e.payload as Partial<ImpactVerificationPayload> | undefined;
  return (
    typeof p?.target_impact_event_id === "string" &&
    (VERIFICATION_RESULTS as readonly string[]).includes(p?.result ?? "") &&
    (VERIFICATION_METHODS as readonly string[]).includes(p?.verification_method ?? "")
  );
}

/**
 * Which status a *successful* verification confers, by method.
 *
 * Community attestation and external audit are different rungs of §10's ladder
 * and must not collapse into one another.  `system_inference` can never confer
 * verification — the blueprint forbids presenting inferred impact as fact — so
 * it maps to its own status and `isVerified` rejects it.
 */
const METHOD_STATUS: Record<VerificationMethod, VerificationStatus> = {
  community_attestation: "community_verified",
  external_audit: "external_verified",
  document_review: "external_verified",
  site_visit: "external_verified",
  measurement: "external_verified",
  system_inference: "system_inference",
};

export const statusForMethod = (m: VerificationMethod): VerificationStatus => METHOD_STATUS[m];

/** §9: a resource movement, in the units the ledger understands. */
export interface ResourceDelta {
  kind: "money" | "time" | "knowledge" | "equipment" | "service";
  /** Positive = into the group, negative = out of it. */
  amount: number;
  currency?: "ILS";
}

export interface ImpactClaim {
  people_affected: number;
  statement: string;
  resources_invested: number;
}

/** §11 canonical event shape. */
export interface PhilosEvent {
  event_id: string;
  actor_id: string;
  entity_type: EntityType;
  entity_id: string;
  event_type: EventType;
  value_tags: string[];
  timestamp: string; // ISO 8601 with offset
  visibility: "public" | "private" | "invite";
  /** Free-form payload, typed per event_type by the projection. */
  payload?: Record<string, unknown>;
  resource_delta?: ResourceDelta;
  evidence?: string[];
  /** 0..1. Absent means the event asserts nothing probabilistic. */
  confidence?: number;
  impact_claim?: ImpactClaim;
  verification_status?: VerificationStatus;
  /**
   * Dynamics Layer (PHILOS-DYNAMICS-LAYER.md) — the event_ids that produced this
   * event. This is the ONE envelope evolution the orchestration layer introduces:
   * additive, optional, and treated as a schema change, not "just a projection".
   *
   * Tri-state, and the distinction is load-bearing:
   *   • absent    → causality UNKNOWN (not recorded) — never read as "no cause"
   *   • []        → explicitly NO known direct cause
   *   • non-empty → declared direct causal parents (cause → effect)
   *
   * Immutable after creation: the log is append-only, so a correction is a NEW
   * event, never an edit. A caused_by link is a DECLARATION — never proof of
   * verified causation. `eventCausality.ts` validates the shape; whether a link is
   * trustworthy is a separate axis (evidence_level), decided by the Step-2
   * projection, never inferred from the mere presence of this field.
   */
  caused_by?: string[];
}

/**
 * Every figure a screen shows carries this, per the blueprint's global rule:
 * "every metric declares source · time-range · sample-size · confidence ·
 * verification-status".
 */
export interface Provenance {
  /** event_ids this figure was computed from. */
  source_events: string[];
  sample_size: number;
  verification_status: VerificationStatus;
  confidence?: number;
  /** ISO range [from, to] the figure covers, when it is time-bounded. */
  time_range?: [string, string];
}

export function isVerified(status: VerificationStatus): boolean {
  return VERIFIED_STATUSES.includes(status);
}

/** Sort ascending by timestamp; ties broken by event_id for determinism. */
export function inOrder(events: readonly PhilosEvent[]): PhilosEvent[] {
  return [...events].sort((a, b) =>
    a.timestamp === b.timestamp
      ? a.event_id.localeCompare(b.event_id)
      : a.timestamp.localeCompare(b.timestamp),
  );
}
