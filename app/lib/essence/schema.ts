/**
 * Essence · Data Schema v1
 *
 * TypeScript types for the Philos Human Model.
 * Implements the two-tier epistemic model: Observation (raw, never modified)
 * → Interpretation (derived, versioned). No interpretation writes directly to
 * Canonical Essence — all writes go through the semantic pipeline.
 *
 * Evidence Engine lives outside this module. Evidence is cross-domain
 * infrastructure; types here hold references only (string IDs).
 */

import type { EssenceLayer, StabilityClass } from './ontology';

// ── Enumerations ───────────────────────────────────────────────────────────────

/** Where an observation originated. */
export type ObservationSource =
  | 'user_statement'       // user said it directly, verbatim
  | 'user_correction'      // user corrected a prior interpretation
  | 'agent_inference'      // an agent derived this from behavior
  | 'behavioral_pattern'   // repeated action across sessions
  | 'creative_artifact'    // derived from work the user produced
  | 'external_signal';     // signal from an integrated external system

/** How certain an interpretation is. */
export type ConfidenceLevel =
  | 'verified'    // user explicitly confirmed
  | 'high'        // multiple independent behavioral signals
  | 'medium'      // one strong signal or two weak
  | 'low'         // single weak signal; hypothesis only
  | 'speculative'; // named uncertainty — should not write to Foundational nodes

/** What kind of interpretation this is, in epistemic terms. */
export type InterpretationKind =
  | 'observed_pattern'             // recurring behavior observed across sessions
  | 'probable_interpretation'      // agent's best inference from available signals
  | 'user_confirmed_understanding'; // user confirmed this interpretation is accurate

/** How sensitive the information is. Controls what agents can read it. */
export type SensitivityLevel =
  | 'public'           // shareable, can inform any output
  | 'personal'         // inform agent behavior, do not surface to external systems
  | 'private'          // inform only the requesting agent for the current task
  | 'highly_sensitive'; // require explicit user request before any agent reads it

/** Whether this interpretation describes a permanent trait or a temporal state. */
export type TemporalKind =
  | 'trait'    // stable across time — stored in long-term Essence
  | 'state'    // time-bounded condition — stored in state layer with TTL
  | 'phase'    // multi-month arc — reviewed at end of arc
  | 'history'; // archived; informs interpretation but does not drive current behavior

/**
 * The temporal scope of a state interpretation.
 * Only applies when temporalKind === 'state'.
 */
export type StateTemporalScope =
  | 'momentary'   // minutes — e.g. current mood mid-session
  | 'session'     // current conversation or working block
  | 'daily'       // today's context, resets at end of day
  | 'short_term'  // days to a few weeks
  | 'open_ended'; // no defined TTL; requires explicit archival

/** The type of conflict between two interpretations. */
export type ConflictType =
  | 'temporal_change'         // interpretation changed over time; may be evolution
  | 'context_difference'      // true in one context, different in another; both may be valid
  | 'preference_shift'        // user preferences have shifted; old may be outdated
  | 'role_difference'         // different roles produce genuinely different traits
  | 'unresolved_contradiction'; // logically incompatible; requires user resolution

// ── Retrieval Mode ─────────────────────────────────────────────────────────────

/**
 * How much of the profile to load for a given query.
 * Defined here (not in api.ts) to avoid the api.ts ↔ access.ts circular dependency.
 */
export type RetrievalMode =
  | 'compact'       // high-confidence traits only; minimal payload
  | 'task_relevant' // nodes relevant to the current task context (default)
  | 'creative'      // Expression + CreativeDNA + Aesthetics + active state
  | 'strategic'     // Aspirations + Core Values + Principles
  | 'deep';         // full profile; only for Philos or explicit user request

// ── Evidence ───────────────────────────────────────────────────────────────────

/** Where evidence for an interpretation stands in the verification lifecycle. */
export type EvidenceStatus = 'unavailable' | 'referenced' | 'evaluated';

/** A reference to one piece of cross-domain evidence. */
export interface EvidenceReference {
  evidenceId: string;
  sourceType: string;
  addedAt: string;
  addedBy: string;
}

// ── Phase ──────────────────────────────────────────────────────────────────────

/** Lifecycle stage of a multi-month arc. */
export type PhaseStatus = 'emerging' | 'active' | 'waning' | 'completed';

/** Tracks a phase arc on an ontology node. */
export interface PhaseMarker {
  nodeId: string;
  status: PhaseStatus;
  startedAt: string;
  completedAt?: string;
}

// ── Raw Observation ────────────────────────────────────────────────────────────

/**
 * A single observed signal. Raw data — never modified after creation.
 * Observations accumulate; interpretations are derived from them.
 * If a signal was wrong, a new observation records the correction —
 * the original is never deleted.
 */
export interface Observation {
  readonly id: string;
  readonly source: ObservationSource;
  /** The agent or system that recorded this observation. */
  readonly recordedBy: string;
  /** Raw content — verbatim or lightly structured; never interpreted here. */
  readonly content: string;
  /** Session or context in which this was observed. */
  readonly sessionId: string | null;
  readonly observedAt: string; // ISO 8601
  /** Cross-domain Evidence Engine IDs. Essence holds references only. */
  readonly evidenceIds: ReadonlyArray<string>;
  /** If this observation corrects a prior one, that observation's ID. */
  readonly correctsObservationId: string | null;
}

// ── Provenance ─────────────────────────────────────────────────────────────────

/**
 * Full audit trail for an interpretation. Tracks where the belief came from
 * and how confident the system is in it.
 */
export interface Provenance {
  source: ObservationSource;
  confidence: ConfidenceLevel;
  /** Agent or pipeline step that created this interpretation. */
  createdBy: string;
  firstObservedAt: string; // ISO 8601
  lastConfirmedAt: string; // ISO 8601
  lastUpdatedAt: string;   // ISO 8601
  /** Cross-domain Evidence Engine IDs that support this interpretation. */
  evidenceIds: ReadonlyArray<string>;
  /** If there are interpretations that contradict this one, their IDs. */
  conflictingInterpretationIds: ReadonlyArray<string>;
}

// ── Conflict ───────────────────────────────────────────────────────────────────

/**
 * A detected conflict between one or more existing interpretations and an incoming candidate.
 * Created by the ConflictDetection stage of the semantic pipeline when a blocking conflict
 * is found. Resolved automatically (temporal_change / preference_shift) or by user confirmation.
 *
 * Fields use explicit names rather than positional tuple members:
 *   existingInterpretationIds  — committed interpretations involved in the conflict.
 *   triggeringObservationId    — the Observation that triggered detection (never a fake ID).
 *   candidateInterpretationId  — absent when the candidate was blocked before being committed.
 */
export interface Conflict {
  readonly id: string;
  readonly type: ConflictType;
  readonly detectedAt: string; // ISO 8601
  /** Committed interpretation IDs that this conflict involves. */
  readonly existingInterpretationIds: ReadonlyArray<string>;
  /** The Observation that triggered conflict detection. Always a real Observation ID. */
  readonly triggeringObservationId: string;
  /** Set only when a candidate Interpretation was committed before the conflict was detected. */
  readonly candidateInterpretationId?: string;
  resolvedAt: string | null;
  resolution: 'accepted_newer' | 'accepted_older' | 'both_valid' | 'user_resolved' | null;
  resolutionNote: string | null;
}

// ── Interpretation ─────────────────────────────────────────────────────────────

/**
 * A derived understanding of a person — always backed by ≥1 Observation.
 * Interpretations are versioned; the current one is the canonical belief.
 * They go through the semantic pipeline before entering Canonical Essence.
 */
export interface Interpretation {
  readonly id: string;
  readonly version: number;
  /** The ontology node this interpretation belongs to. */
  nodeId: string;
  layer: EssenceLayer;
  stabilityClass: StabilityClass;
  /** The actual interpreted content — structured or prose. */
  content: string;
  /** Must reference ≥1 observation ID. */
  readonly observationIds: ReadonlyArray<string>;
  confidence: ConfidenceLevel;
  interpretationKind: InterpretationKind;
  provenance: Provenance;
  sensitivity: SensitivityLevel;
  temporalKind: TemporalKind;
  /** Only when temporalKind === 'state'. */
  stateScope: StateTemporalScope | null;
  /** Unix epoch ms; when state TTL expires. null = no expiry. */
  expiresAt: number | null;
  /** ISO 8601; set when this interpretation is superseded or archived. */
  archivedAt: string | null;
  /** IDs of Conflict records touching this interpretation. */
  conflictIds: ReadonlyArray<string>;
  evidenceStatus: EvidenceStatus;
}

// ── State Item ─────────────────────────────────────────────────────────────────

/**
 * An interpretation that describes a time-bounded state rather than a stable trait.
 * Lives in the State layer of EssenceProfile; reviewed/expired per its scope.
 */
export interface EssenceStateItem extends Interpretation {
  temporalKind: 'state';
  stateScope: StateTemporalScope;
  /** Unix epoch ms TTL. null for open_ended scope. */
  ttlMs: number | null;
  /** Human-readable condition that triggers a review, e.g. "end of production cycle". */
  reviewCondition: string | null;
  sessionId: string | null;
  isActive: boolean;
}

// ── Evolution Log ──────────────────────────────────────────────────────────────

/** An entry in the immutable audit log of Essence changes over time. */
export interface EssenceEvolutionEntry {
  readonly id: string;
  readonly nodeId: string;
  readonly previousInterpretationId: string | null;
  readonly newInterpretationId: string;
  readonly triggeredBy: ObservationSource;
  readonly agentName: string;
  readonly timestamp: string; // ISO 8601
  readonly note: string | null;
}

// ── Essence Profile ────────────────────────────────────────────────────────────

/**
 * The complete Human Model for one person.
 *
 * Layout follows the DAG:
 *   core → aspirations, expression → identity
 *
 * Each layer maps ontology node IDs to their active interpretations.
 * State items live in their own separate map (keyed by StateTemporalScope).
 * Conflicts are tracked globally; evolution is append-only.
 */
export interface EssenceProfile {
  readonly profileId: string;
  readonly schemaVersion: '1';
  createdAt: string;   // ISO 8601
  updatedAt: string;   // ISO 8601

  /**
   * Core — what fundamentally defines this person.
   * Nodes: Values, Beliefs, Worldview, Motivations, Needs,
   *        Psychology, CognitivePatterns, IntrinsicConstraints
   */
  core: Record<string, Interpretation[]>;

  /**
   * Aspirations — where this person is going.
   * Nodes: Aspirations_Becoming, Aspirations_LifeDirections,
   *        Aspirations_DesiredConditions, Aspirations_Contribution,
   *        Aspirations_Legacy
   */
  aspirations: Record<string, Interpretation[]>;

  /**
   * Expression — how this person shows up.
   * Nodes: Aesthetics, CreativeDNA, Principles, Communication, Style, Preferences
   */
  expression: Record<string, Interpretation[]>;

  /**
   * Identity — how this person is known.
   * Nodes: Roles, PublicPersona, ProfessionalIdentity, PersonalIdentity
   */
  identity: Record<string, Interpretation[]>;

  /**
   * State — time-bounded conditions; not stable traits.
   * Separate from the four layers; expires per scope.
   */
  state: {
    momentary: EssenceStateItem[];
    session: EssenceStateItem[];
    daily: EssenceStateItem[];
    short_term: EssenceStateItem[];
    open_ended: EssenceStateItem[];
  };

  /** Raw observations — the epistemic bedrock. Never modified after creation. */
  observations: Observation[];

  /** Active conflicts awaiting resolution. */
  conflicts: Conflict[];

  /** Append-only evolution log. */
  evolution: EssenceEvolutionEntry[];
}

// ── Factory ────────────────────────────────────────────────────────────────────

export function createEmptyEssenceProfile(profileId: string): EssenceProfile {
  const now = new Date().toISOString();
  return {
    profileId,
    schemaVersion: '1',
    createdAt: now,
    updatedAt: now,
    core: {},
    aspirations: {},
    expression: {},
    identity: {},
    state: {
      momentary: [],
      session: [],
      daily: [],
      short_term: [],
      open_ended: [],
    },
    observations: [],
    conflicts: [],
    evolution: [],
  };
}
