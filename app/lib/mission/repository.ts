/**
 * MissionRepository — Stable Contract v0.1
 *
 * The single interface through which all Philos subsystems interact with
 * Mission data. OPM, Marketplace, World, and Agents depend on this contract,
 * not on any storage implementation.
 *
 * Grade: Stable Contract v0.1
 * — Subsystems may depend on this interface.
 * — Storage adapters must conform to it (JsonMissionRepository, future PgMissionRepository, etc.).
 * — The interface may gain new methods in v0.2 but existing signatures are stable.
 *
 * Invariant R1 (from PUDM §3): Missions must not reference Values directly.
 *   The chain Mission → Gap → Value is enforced at the domain level, not here.
 *   This repository stores and retrieves Missions as given; callers are responsible
 *   for maintaining R1 before calling create() or update().
 */

import type { Mission, CreateMissionInput, UpdateMissionInput } from "./schema";

// ─── Query ───────────────────────────────────────────────────────────────────

export interface MissionQuery {
  /** Filter by lifecycle status. */
  status?: Mission["state"]["status"];
  /** Filter by actor id. */
  actorId?: string;
  /** Filter by time horizon. */
  horizon?: Mission["state"]["horizon"];
  /** Filter by a required value id present in requiredValues[]. */
  requiredValueId?: string;
  /** Maximum number of results. Defaults to 50. */
  limit?: number;
  /** Zero-based offset for pagination. */
  offset?: number;
}

// ─── Repository interface ─────────────────────────────────────────────────────

export interface MissionRepository {
  /**
   * Persist a new Mission. The repository assigns id, type, createdAt,
   * updatedAt, and defaults evidenceGrade to "Candidate".
   */
  create(input: CreateMissionInput): Promise<Mission>;

  /**
   * Retrieve a Mission by id. Returns null if not found.
   */
  get(id: string): Promise<Mission | null>;

  /**
   * Apply partial updates to an existing Mission.
   * updatedAt is refreshed automatically by the repository.
   * Throws if the Mission does not exist.
   */
  update(id: string, updates: UpdateMissionInput): Promise<Mission>;

  /**
   * Permanently remove a Mission.
   * Throws if the Mission does not exist.
   */
  delete(id: string): Promise<void>;

  /**
   * Search Missions by structured criteria.
   * Returns an empty array (never throws) if no records match.
   */
  search(query: MissionQuery): Promise<Mission[]>;
}
