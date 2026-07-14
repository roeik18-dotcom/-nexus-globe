/**
 * ProviderCapabilityRelation Schema v0.1 — Candidate
 *
 * Source: docs/philos-universal-data-model-v0.md §3.2
 * Grade:  Candidate — structure designed; not validated against real
 *         capability delivery evidence or selected providers.
 *
 * This Relation is the authoritative link between Provider nodes and
 * Capability nodes in the PUDM chain:
 *   Mission → Gap → Value → Capability ─[ProviderCapabilityRelation]─ Provider
 *
 * Neither Provider nor Capability owns this relationship.
 * The Relation carries the status, context (missionId/gapId), relationType,
 * and evidence. Nodes hold only their own identity and context.
 *
 * relationType semantics:
 *   can_deliver  — taxonomic: this provider can deliver this capability in general.
 *                  No missionId/gapId required.
 *   selected_for — execution: this provider has been chosen to deliver this capability
 *                  for a specific mission or gap. Requires Behavior or Outcomes evidence.
 */

import type { EvidenceGrade, SignalType } from "../types";
export type { EvidenceGrade, SignalType };

// ─── Enumerated types ─────────────────────────────────────────────────────────

export type PcrRelationType = "can_deliver" | "selected_for";
export type PcrRelationStatus = "candidate" | "active" | "rejected" | "historical";

// ─── Sub-structures ───────────────────────────────────────────────────────────

export interface PcrEvidenceRecord {
  signal: SignalType;
  source: string | null;
  observedAt: string | null;  // ISO 8601
  note: string;
}

// ─── Full Relation node ───────────────────────────────────────────────────────

export interface ProviderCapabilityRelation {
  id: string;
  type: "ProviderCapabilityRelation";
  providerId: string;
  capabilityId: string;
  missionId?: string;
  gapId?: string;
  relationType: PcrRelationType;
  status: PcrRelationStatus;
  evidenceGrade: EvidenceGrade;
  createdAt: string;   // ISO 8601
  updatedAt: string;
  evidence: PcrEvidenceRecord[];
}

// ─── Input types (used by ProviderCapabilityRelationRepository) ───────────────

export type CreatePcrInput = Omit<
  ProviderCapabilityRelation,
  "id" | "type" | "createdAt" | "updatedAt"
> & {
  evidenceGrade?: EvidenceGrade;
};

export type UpdatePcrInput = Partial<Omit<ProviderCapabilityRelation, "id" | "type" | "createdAt">>;
