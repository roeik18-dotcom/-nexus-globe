/**
 * ValueRepository — Stable Contract v0.1
 *
 * Source: docs/philos-universal-data-model-v0.md §2.2
 * Grade:  Stable Contract v0.1 — interface is locked; implementations may
 *         be swapped freely (JSON → PostgreSQL) without touching callers.
 *
 * All subsystems (OPM, Marketplace, World, Agents) interact with Value
 * through this interface, never through storage adapters directly.
 */

import type { Value, CreateValueInput, UpdateValueInput } from "./schema";
import type { EvidenceGrade } from "../types";

export interface ValueQuery {
  domain?: string;
  evidenceGrade?: EvidenceGrade;
  limit?: number;
  offset?: number;
  // To find values for a specific capability, query ValueCapabilityRelationRepository.
}

export interface ValueRepository {
  create(input: CreateValueInput): Promise<Value>;
  get(id: string): Promise<Value | null>;
  update(id: string, updates: UpdateValueInput): Promise<Value>;
  delete(id: string): Promise<void>;
  search(query: ValueQuery): Promise<Value[]>;
}
