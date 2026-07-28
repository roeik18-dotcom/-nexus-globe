/**
 * Essence · Projection Snapshot (M1-1F)
 *
 * A snapshot captures the fully-projected EssenceProfile at a known point in
 * the Timeline so that rebuildProfile() can replay only the delta events that
 * arrived after the snapshot, rather than the full event history.
 *
 * Invariants:
 *   - A snapshot is valid only for the projectorVersion that created it.
 *   - Snapshots are keyed by profileId and ordered by eventCount (newest wins).
 *   - Snapshot data is treated as a read-only starting point; delta events are
 *     applied on top of a deep copy so the snapshot object is never mutated.
 */

import type { EssenceProfile } from './schema';

/** Incremented whenever the projection logic changes in a backward-incompatible way. */
export const PROJECTOR_VERSION = 2 as const;
export type ProjectorVersion = typeof PROJECTOR_VERSION;

/**
 * An immutable projection checkpoint for a single profile.
 * lastEventId + lastEventOccurredAt together identify the most recent timeline
 * event included in this snapshot, enabling efficient delta replay.
 */
export interface EssenceProfileSnapshot {
  readonly snapshotId: string;
  readonly profileId: string;
  /** The projector version that produced this snapshot. */
  readonly projectorVersion: ProjectorVersion;
  /** ID of the last timeline event included in this snapshot. */
  readonly lastEventId: string;
  /** occurredAt of the last included event (ISO 8601). */
  readonly lastEventOccurredAt: string;
  /** Total number of events included when the snapshot was taken. */
  readonly eventCount: number;
  /** When the snapshot was captured (ISO 8601). */
  readonly capturedAt: string;
  /** The fully-projected profile at the snapshot point. */
  readonly profile: EssenceProfile;
}

/** Persistence interface for profile snapshots. */
export interface EssenceSnapshotRepository {
  save(snapshot: EssenceProfileSnapshot): Promise<void>;
  /** Returns the most recently saved snapshot for the profile, or null. */
  loadLatest(profileId: string): Promise<EssenceProfileSnapshot | null>;
}
