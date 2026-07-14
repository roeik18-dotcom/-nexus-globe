/**
 * ValueCapabilityRelation Schema v0.1 — Candidate
 *
 * Source: docs/philos-universal-data-model-v0.md §3.1
 * Grade:  Candidate — structure designed; not validated against real
 *         gap-closure evidence or selected capabilities.
 *
 * This Relation is the authoritative link between Value nodes and
 * Capability nodes in the PUDM chain:
 *   Mission → Gap → Value ─[ValueCapabilityRelation]─ Capability → Provider
 *
 * Neither Value nor Capability owns this relationship.
 * The Relation carries the status, context (missionId/gapId), relationType,
 * and evidence. Nodes hold only their own identity and context.
 *
 * relationType semantics:
 *   can_address  — taxonomic: this capability can address this value in general.
 *                  No missionId/gapId required.
 *   required_for — contextual: this capability is required for a specific
 *                  mission or gap. missionId or gapId must be present.
 *   selected_for — execution: this capability has been chosen for a specific
 *                  mission or gap. Requires Behavior or Outcomes evidence.
 */

import type { EvidenceGrade, SignalType } from "../types";
export type { EvidenceGrade, SignalType };

// ─── Enumerated types ─────────────────────────────────────────────────────────

export type RelationType = "can_address" | "required_for" | "selected_for";
export type RelationStatus = "candidate" | "active" | "rejected" | "historical";

// ─── Sub-structures ───────────────────────────────────────────────────────────

export interface RelationEvidenceRecord {
  signal: SignalType;
  source: string | null;
  observedAt: string | null;  // ISO 8601
  note: string;
}

// ─── Full Relation node ───────────────────────────────────────────────────────

export interface ValueCapabilityRelation {
  id: string;
  type: "ValueCapabilityRelation";
  valueId: string;
  capabilityId: string;
  missionId?: string;
  gapId?: string;
  relationType: RelationType;
  status: RelationStatus;
  evidenceGrade: EvidenceGrade;
  createdAt: string;   // ISO 8601
  updatedAt: string;
  evidence: RelationEvidenceRecord[];
}

// ─── Input types (used by ValueCapabilityRelationRepository) ─────────────────

export type CreateRelationInput = Omit<
  ValueCapabilityRelation,
  "id" | "type" | "createdAt" | "updatedAt"
> & {
  evidenceGrade?: EvidenceGrade;
};

export type UpdateRelationInput = Partial<Omit<ValueCapabilityRelation, "id" | "type" | "createdAt">>;
