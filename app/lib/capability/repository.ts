/**
 * CapabilityRepository — Stable Contract v0.1
 *
 * Source: docs/philos-universal-data-model-v0.md §2.3
 * Grade:  Stable Contract v0.1 — interface is locked; implementations may
 *         be swapped freely (JSON → PostgreSQL) without touching callers.
 *
 * All subsystems (OPM, Marketplace, World, Agents) interact with Capability
 * through this interface, never through storage adapters directly.
 */

import type { Capability, CreateCapabilityInput, UpdateCapabilityInput } from "./schema";
import type { EvidenceGrade } from "../types";

export interface CapabilityQuery {
  domain?: string;
  evidenceGrade?: EvidenceGrade;
  providerId?: string;    // find capabilities held by a specific provider
  limit?: number;
  offset?: number;
  // To find capabilities for a specific value, query ValueCapabilityRelationRepository.
}

export interface CapabilityRepository {
  create(input: CreateCapabilityInput): Promise<Capability>;
  get(id: string): Promise<Capability | null>;
  update(id: string, updates: UpdateCapabilityInput): Promise<Capability>;
  delete(id: string): Promise<void>;
  search(query: CapabilityQuery): Promise<Capability[]>;
}
