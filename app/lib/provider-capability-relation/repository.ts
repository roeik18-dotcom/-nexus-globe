/**
 * ProviderCapabilityRelationRepository — Stable Contract v0.1
 *
 * Source: docs/philos-universal-data-model-v0.md §3.2
 * Grade:  Stable Contract v0.1 — interface is locked; implementations may
 *         be swapped freely (JSON → PostgreSQL) without touching callers.
 *
 * All subsystems that need to traverse Capability → Provider links use this
 * interface, never the storage adapter directly.
 */

import type {
  ProviderCapabilityRelation,
  CreatePcrInput,
  UpdatePcrInput,
  PcrRelationType,
  PcrRelationStatus,
} from "./schema";
import type { EvidenceGrade } from "../types";

export interface PcrQuery {
  providerId?: string;
  capabilityId?: string;
  missionId?: string;
  gapId?: string;
  relationType?: PcrRelationType;
  status?: PcrRelationStatus;
  evidenceGrade?: EvidenceGrade;
  limit?: number;
  offset?: number;
}

export interface ProviderCapabilityRelationRepository {
  create(input: CreatePcrInput): Promise<ProviderCapabilityRelation>;
  get(id: string): Promise<ProviderCapabilityRelation | null>;
  update(id: string, updates: UpdatePcrInput): Promise<ProviderCapabilityRelation>;
  delete(id: string): Promise<void>;
  search(query: PcrQuery): Promise<ProviderCapabilityRelation[]>;
}
