/**
 * GapRepository — Stable Contract v0.1
 *
 * Source: docs/philos-universal-data-model-v0.md §2.2
 * Grade:  Stable Contract v0.1 — interface is locked; implementations may
 *         be swapped freely (JSON → PostgreSQL) without touching callers.
 *
 * All subsystems (OPM, Marketplace, World, Agents) interact with Gap
 * through this interface, never through storage adapters directly.
 */

import type { Gap, CreateGapInput, UpdateGapInput, GapStatus } from "./schema";

export interface GapQuery {
  missionId?: string;
  status?: GapStatus;
  requiredValueId?: string;
  limit?: number;
  offset?: number;
}

export interface GapRepository {
  create(input: CreateGapInput): Promise<Gap>;
  get(id: string): Promise<Gap | null>;
  update(id: string, updates: UpdateGapInput): Promise<Gap>;
  delete(id: string): Promise<void>;
  search(query: GapQuery): Promise<Gap[]>;
}
