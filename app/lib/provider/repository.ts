/**
 * ProviderRepository — Stable Contract v0.1
 *
 * Source: docs/philos-universal-data-model-v0.md §2.4
 * Grade:  Stable Contract v0.1 — interface is locked; implementations may
 *         be swapped freely (JSON → PostgreSQL) without touching callers.
 *
 * All subsystems (OPM, Marketplace, World, Agents) interact with Provider
 * through this interface, never through storage adapters directly.
 */

import type { Provider, CreateProviderInput, UpdateProviderInput, ProviderType } from "./schema";
import type { EvidenceGrade } from "../types";

export interface ProviderQuery {
  domain?: string;
  providerType?: ProviderType;
  evidenceGrade?: EvidenceGrade;
  limit?: number;
  offset?: number;
  // To find providers for a specific capability, query ProviderCapabilityRelationRepository.
}

export interface ProviderRepository {
  create(input: CreateProviderInput): Promise<Provider>;
  get(id: string): Promise<Provider | null>;
  update(id: string, updates: UpdateProviderInput): Promise<Provider>;
  delete(id: string): Promise<void>;
  search(query: ProviderQuery): Promise<Provider[]>;
}
