/**
 * ValueCapabilityRelationRepository — Stable Contract v0.1
 *
 * Source: docs/philos-universal-data-model-v0.md §3.1
 * Grade:  Stable Contract v0.1 — interface is locked; implementations may
 *         be swapped freely (JSON → PostgreSQL) without touching callers.
 *
 * All subsystems that need to traverse Value → Capability links use this
 * interface, never the storage adapter directly.
 */

import type {
  ValueCapabilityRelation,
  CreateRelationInput,
  UpdateRelationInput,
  RelationType,
  RelationStatus,
} from "./schema";
import type { EvidenceGrade } from "../types";

export interface RelationQuery {
  valueId?: string;
  capabilityId?: string;
  missionId?: string;
  gapId?: string;
  relationType?: RelationType;
  status?: RelationStatus;
  evidenceGrade?: EvidenceGrade;
  limit?: number;
  offset?: number;
}

export interface ValueCapabilityRelationRepository {
  create(input: CreateRelationInput): Promise<ValueCapabilityRelation>;
  get(id: string): Promise<ValueCapabilityRelation | null>;
  update(id: string, updates: UpdateRelationInput): Promise<ValueCapabilityRelation>;
  delete(id: string): Promise<void>;
  search(query: RelationQuery): Promise<ValueCapabilityRelation[]>;
}
