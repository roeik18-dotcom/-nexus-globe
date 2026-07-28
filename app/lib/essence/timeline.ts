/**
 * Essence · Timeline Domain Model (M1-1A)
 *
 * The Essence Timeline is the authoritative append-only history of every
 * meaningful write in the Essence system.
 *
 * H1 invariant:
 *   The Timeline is the source of truth.
 *   profile.evolution[] is a derived read projection, rebuilt by replay.
 *   No component may write to evolution[] except the Timeline projector.
 *
 * Event type taxonomy:
 *   observation_received         — a raw signal was recorded for a profile
 *   proposal_created             — an agent submitted a proposed Essence update
 *   review_decided               — Philos made a review decision on a proposal
 *   interpretation_committed     — a reviewed proposal was committed to the profile
 *   proposal_rejected            — Philos or policy permanently rejected a proposal
 *   proposal_expired             — a proposal's TTL elapsed before it was acted on
 *   user_confirmation_required   — Philos deferred a proposal to the user
 *
 * Schema version:
 *   All events carry schemaVersion: 1. When the payload shape changes in a
 *   future milestone, introduce a new version number so replayers can branch.
 */

import type { ConfidenceLevel, ObservationSource } from './schema';

export const TIMELINE_SCHEMA_VERSION = 1 as const;
export type TimelineSchemaVersion = typeof TIMELINE_SCHEMA_VERSION;

// ── Event type discriminant ────────────────────────────────────────────────────

export type EssenceTimelineEventType =
  | 'observation_received'
  | 'proposal_created'
  | 'review_decided'
  | 'interpretation_committed'
  | 'proposal_rejected'
  | 'proposal_expired'
  | 'user_confirmation_required';

// ── Per-event payloads ─────────────────────────────────────────────────────────

export interface ObservationReceivedPayload {
  readonly eventType: 'observation_received';
  readonly observationId: string;
  readonly source: ObservationSource;
  readonly recordedBy: string;
}

export interface ProposalCreatedPayload {
  readonly eventType: 'proposal_created';
  readonly proposalId: string;
  readonly proposedContent: string;
  readonly proposedBy: string;
  readonly accumulatedConfidence: ConfidenceLevel | null;
  readonly evidenceObservationIds: readonly string[];
}

export interface ReviewDecidedPayload {
  readonly eventType: 'review_decided';
  readonly proposalId: string;
  readonly decision: 'accept' | 'reject' | 'require_user_confirmation' | 'defer';
  readonly reason: string;
  readonly reviewer: 'philos';
  readonly policyVersion: string;
  readonly newStatus: string;
}

export interface InterpretationCommittedPayload {
  readonly eventType: 'interpretation_committed';
  readonly proposalId: string;
  readonly interpretationId: string;
  readonly content: string;
  readonly confidence: ConfidenceLevel;
  readonly committedBy: string;
  /** The interpretation that was archived when this one was written, if any. */
  readonly previousInterpretationId: string | null;
}

export interface ProposalRejectedPayload {
  readonly eventType: 'proposal_rejected';
  readonly proposalId: string;
  readonly reason: string;
  readonly rejectedBy: string;
}

export interface ProposalExpiredPayload {
  readonly eventType: 'proposal_expired';
  readonly proposalId: string;
  readonly expiredAt: string; // ISO 8601 — the expiresAt value from the proposal
}

export interface UserConfirmationRequiredPayload {
  readonly eventType: 'user_confirmation_required';
  readonly proposalId: string;
  readonly proposedContent: string;
  readonly reason: string;
}

/** Discriminated union over all payload shapes. Keyed by eventType. */
export type EssenceTimelinePayload =
  | ObservationReceivedPayload
  | ProposalCreatedPayload
  | ReviewDecidedPayload
  | InterpretationCommittedPayload
  | ProposalRejectedPayload
  | ProposalExpiredPayload
  | UserConfirmationRequiredPayload;

// ── Core event record ──────────────────────────────────────────────────────────

/**
 * A single immutable entry in the Essence Timeline.
 *
 * Linkage fields (nodeId, proposalId, interpretationId, observationId) index
 * the event by the domain objects involved. They are set to null when the event
 * does not involve that object type — e.g., observation_received has no proposalId.
 *
 * The payload carries the full event-specific data and repeats the eventType
 * discriminant so payload types are self-describing after deserialization.
 */
export interface EssenceTimelineEvent {
  /** Unique event ID, format 'tevt-<random>'. */
  readonly id: string;
  readonly schemaVersion: TimelineSchemaVersion;
  readonly eventType: EssenceTimelineEventType;
  /** ISO 8601 timestamp of when the event occurred. */
  readonly occurredAt: string;
  readonly profileId: string;
  /** The Essence ontology node involved, or null if not node-specific. */
  readonly nodeId: string | null;
  readonly proposalId: string | null;
  readonly interpretationId: string | null;
  readonly observationId: string | null;
  readonly payload: EssenceTimelinePayload;
}
