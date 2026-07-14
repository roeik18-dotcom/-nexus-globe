/**
 * Shared PUDM primitives
 *
 * Source: docs/philos-universal-data-model-v0.md §1–§4
 * Grade:  Candidate — mirrors the evidence model in research-charter.md §5.
 *
 * All entity schemas (Mission, Gap, Value, Capability, Provider) import
 * from here. No entity schema is the authoritative source for these types.
 *
 * ValueRef is the universal id-only pointer to a Value node. Every node
 * in the PUDM chain that references a Value carries exactly this shape.
 * Do not extend it inside an entity schema — file a PUDM revision instead.
 */

// ─── Evidence model ───────────────────────────────────────────────────────────

/** Certainty of a node's structure and data, per PUDM §4. */
export type EvidenceGrade =
  | "Frozen"
  | "Candidate"
  | "Placeholder"
  | "Not established";

/** Strength of an evidence signal, weakest to strongest. */
export type SignalType = "Intent" | "Behavior" | "Outcomes";

// ─── Universal Value pointer ──────────────────────────────────────────────────

/**
 * Pure pointer to a Value node.
 * Value label and evidenceGrade are owned by the Value node.
 * Resolve from ValueRepository when display data is needed.
 */
export interface ValueRef {
  valueId: string;
}

/**
 * Pure pointer to a Capability node.
 * Capability label and evidence are owned by the Capability node.
 * Resolve from CapabilityRepository when display data is needed.
 */
export interface CapabilityRef {
  capabilityId: string;
}

/**
 * Pure pointer to a Provider node.
 * Provider details are owned by the Provider node.
 * Resolve from ProviderRepository when display data is needed.
 */
export interface ProviderRef {
  providerId: string;
}
