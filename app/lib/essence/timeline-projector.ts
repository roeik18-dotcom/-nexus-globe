/**
 * Essence · Timeline Projector (M1-1D / M1-1F)
 *
 * Deterministic, idempotent replay of EssenceTimelineEvents into profile read-state.
 *
 * Rebuilds the four profile layers (core, aspirations, expression, identity) and
 * profile.evolution[] from the authoritative Timeline. The `state` property is left
 * empty — state items require fields not carried in the timeline payload (M1-E deferred).
 *
 * Constraints (from M1-1D spec):
 *   - Event ordering: occurredAt (ISO 8601 lex) → id (lex tiebreaker)
 *   - Unknown schemaVersion or eventType → throws; no silent skip
 *   - Only interpretation_committed events produce profile mutations
 *   - Idempotent: same event set → same output profile regardless of call count
 *
 * M1-1F additions:
 *   - computeProjectionFingerprint: deterministic hash of derivable fields
 *   - Snapshot-aware rebuildProfile: loads delta events from a valid snapshot
 *   - saveSnapshot: captures a projection checkpoint in the snapshot repository
 *
 * rebuildProfile / rebuildAllProfiles return projected profiles without saving.
 * Callers who want to persist the rebuild must call profileRepo.saveProfile themselves.
 *
 * verifyProjection compares the stored profile (written by the live write path) against
 * a fresh replay result and reports structured differences in derivable fields only
 * (content, confidence, archivedAt null/non-null, evolution ordering).
 */

import { createEmptyEssenceProfile } from './schema';
import { TIMELINE_SCHEMA_VERSION } from './timeline';
import { getEssenceNode } from './ontology';
import { PROJECTOR_VERSION } from './snapshot';
import type { EssenceProfile, EssenceEvolutionEntry, Interpretation } from './schema';
import type { EssenceLayer } from './ontology';
import type { EssenceTimelineEvent, InterpretationCommittedPayload, InterpretationArchivedPayload } from './timeline';
import type { EssenceTimelineRepository } from './api';
import type { EssenceRepository } from './repository';
import type { EssenceProfileSnapshot, EssenceSnapshotRepository } from './snapshot';

// ── Public types ──────────────────────────────────────────────────────────────

export interface ProjectionDifference {
  /** Dotted path identifying the field that diverges. */
  path: string;
  stored: unknown;
  projected: unknown;
}

export interface ProjectionVerificationReport {
  profileId: string;
  verifiedAt: string;
  match: boolean;
  storedEvolutionCount: number;
  projectedEvolutionCount: number;
  storedInterpretationCount: number;
  projectedInterpretationCount: number;
  differences: ProjectionDifference[];
  /** Deterministic fingerprint of derivable fields in the stored profile. */
  storedFingerprint: string;
  /** Deterministic fingerprint of derivable fields in the freshly projected profile. */
  projectedFingerprint: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const KNOWN_SCHEMA_VERSIONS = new Set([TIMELINE_SCHEMA_VERSION]);

const KNOWN_EVENT_TYPES = new Set<string>([
  'observation_received',
  'proposal_created',
  'review_decided',
  'interpretation_committed',
  'interpretation_archived',
  'proposal_rejected',
  'proposal_expired',
  'user_confirmation_required',
]);

const PROJECTION_LAYERS: EssenceLayer[] = ['core', 'aspirations', 'expression', 'identity'];

// ── Fingerprint ───────────────────────────────────────────────────────────────

/**
 * Deterministic fingerprint of the derivable fields in a projected profile.
 * Stable across replays: evolution sorted by id, interpretations sorted by
 * nodeId then id. Captures content, confidence, archivedAt null/non-null.
 */
export function computeProjectionFingerprint(profile: EssenceProfile): string {
  const evo = [...profile.evolution]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(e => ({
      id: e.id,
      nodeId: e.nodeId,
      prev: e.previousInterpretationId,
      next: e.newInterpretationId,
    }));

  const layers: Record<string, Record<string, Array<{ id: string; content: string; confidence: string; archived: boolean }>>> = {};
  for (const layer of PROJECTION_LAYERS) {
    const layerData = profile[layer] as Record<string, Interpretation[]>;
    const nodeEntries = Object.entries(layerData).sort(([a], [b]) => a.localeCompare(b));
    layers[layer] = Object.fromEntries(
      nodeEntries.map(([nodeId, interps]) => [
        nodeId,
        [...interps]
          .sort((a, b) => a.id.localeCompare(b.id))
          .map(i => ({ id: i.id, content: i.content, confidence: i.confidence, archived: i.archivedAt !== null })),
      ]),
    );
  }

  return JSON.stringify({ evo, layers });
}

// ── Projector ─────────────────────────────────────────────────────────────────

export class EssenceTimelineProjector {
  constructor(
    private readonly profileRepo: EssenceRepository,
    private readonly timelineRepo: EssenceTimelineRepository,
    private readonly snapshotRepo?: EssenceSnapshotRepository,
  ) {}

  /**
   * Rebuild a profile's read state from its timeline events.
   * If a snapshot repository is configured and a valid snapshot exists, replays
   * only the delta events that arrived after the snapshot. Returns the projected
   * profile without persisting it.
   */
  async rebuildProfile(profileId: string): Promise<EssenceProfile> {
    const allEvents = await this.timelineRepo.loadByProfile(profileId);

    if (!this.snapshotRepo) {
      return this.project(profileId, allEvents);
    }

    const snapshot = await this.snapshotRepo.loadLatest(profileId);
    if (!snapshot || snapshot.projectorVersion !== PROJECTOR_VERSION) {
      return this.project(profileId, allEvents);
    }

    // Delta replay: only events that come after the snapshot anchor.
    const deltaEvents = allEvents.filter(e => {
      const cmp = e.occurredAt.localeCompare(snapshot.lastEventOccurredAt);
      if (cmp > 0) return true;
      if (cmp === 0) return e.id.localeCompare(snapshot.lastEventId) > 0;
      return false;
    });

    if (deltaEvents.length === 0) {
      return cloneProfile(snapshot.profile);
    }

    return this.projectDelta(cloneProfile(snapshot.profile), deltaEvents);
  }

  /**
   * Rebuild all profiles that have at least one timeline event.
   * Returns a map of profileId → projected profile. Does NOT persist anything.
   */
  async rebuildAllProfiles(): Promise<Map<string, EssenceProfile>> {
    const all = await this.timelineRepo.loadAll();
    const profileIds = new Set(all.map(e => e.profileId));
    const result = new Map<string, EssenceProfile>();
    for (const profileId of profileIds) {
      result.set(profileId, await this.rebuildProfile(profileId));
    }
    return result;
  }

  /**
   * Compare the stored profile (written by the live write path) against a fresh
   * replay result. Reports differences in derivable fields only.
   */
  async verifyProjection(profileId: string): Promise<ProjectionVerificationReport> {
    const verifiedAt = new Date().toISOString();
    const stored = await this.profileRepo.getProfile(profileId);
    const projected = await this.rebuildProfile(profileId);
    const differences: ProjectionDifference[] = [];

    const storedFingerprint = stored ? computeProjectionFingerprint(stored) : '';
    const projectedFingerprint = computeProjectionFingerprint(projected);

    // ── evolution[] ───────────────────────────────────────────────────────────
    const storedEvo = stored?.evolution ?? [];
    const projEvo = projected.evolution;
    const evoLen = Math.max(storedEvo.length, projEvo.length);
    for (let i = 0; i < evoLen; i++) {
      const s = storedEvo[i];
      const p = projEvo[i];
      if (!s) {
        differences.push({ path: `evolution[${i}]`, stored: undefined, projected: p.newInterpretationId });
        continue;
      }
      if (!p) {
        differences.push({ path: `evolution[${i}]`, stored: s.newInterpretationId, projected: undefined });
        continue;
      }
      for (const field of ['nodeId', 'newInterpretationId', 'previousInterpretationId'] as const) {
        if (s[field] !== p[field]) {
          differences.push({ path: `evolution[${i}].${field}`, stored: s[field], projected: p[field] });
        }
      }
    }

    // ── layers ────────────────────────────────────────────────────────────────
    for (const layer of PROJECTION_LAYERS) {
      const storedLayer = ((stored?.[layer] ?? {}) as Record<string, Interpretation[]>);
      const projLayer = (projected[layer] as Record<string, Interpretation[]>);
      const nodeIds = new Set([...Object.keys(storedLayer), ...Object.keys(projLayer)]);

      for (const nodeId of nodeIds) {
        const storedInterps = storedLayer[nodeId] ?? [];
        const projInterps = projLayer[nodeId] ?? [];
        const storedById = new Map(storedInterps.map(i => [i.id, i]));
        const projById = new Map(projInterps.map(i => [i.id, i]));
        const allIds = new Set([...storedById.keys(), ...projById.keys()]);

        for (const id of allIds) {
          const s = storedById.get(id);
          const p = projById.get(id);
          const base = `${layer}.${nodeId}[${id}]`;

          if (!s) {
            differences.push({ path: base, stored: undefined, projected: p!.content });
            continue;
          }
          if (!p) {
            differences.push({ path: base, stored: s.content, projected: undefined });
            continue;
          }
          for (const field of ['content', 'confidence'] as const) {
            if (s[field] !== p[field]) {
              differences.push({ path: `${base}.${field}`, stored: s[field], projected: p[field] });
            }
          }
          // archivedAt: compare null vs non-null (exact timestamp not derivable)
          const sArchived = s.archivedAt !== null;
          const pArchived = p.archivedAt !== null;
          if (sArchived !== pArchived) {
            differences.push({ path: `${base}.archivedAt`, stored: s.archivedAt, projected: p.archivedAt });
          }
        }
      }
    }

    return {
      profileId,
      verifiedAt,
      match: differences.length === 0,
      storedEvolutionCount: storedEvo.length,
      projectedEvolutionCount: projEvo.length,
      storedInterpretationCount: countInterpretations(stored),
      projectedInterpretationCount: countInterpretations(projected),
      differences,
      storedFingerprint,
      projectedFingerprint,
    };
  }

  /**
   * Save a projection snapshot for a profile at its current timeline position.
   * Requires a snapshotRepo; throws if none is configured.
   */
  async saveSnapshot(profileId: string): Promise<EssenceProfileSnapshot> {
    if (!this.snapshotRepo) {
      throw new Error('EssenceTimelineProjector: no snapshot repository configured');
    }

    const events = await this.timelineRepo.loadByProfile(profileId);
    const sorted = sortEvents(events);
    if (sorted.length === 0) {
      throw new Error(`Cannot save snapshot for profile with no timeline events: ${profileId}`);
    }

    const profile = await this.rebuildProfile(profileId);
    const lastEvent = sorted[sorted.length - 1];

    const snapshot: EssenceProfileSnapshot = {
      snapshotId: `snap_${lastEvent.id}`,
      profileId,
      projectorVersion: PROJECTOR_VERSION,
      lastEventId: lastEvent.id,
      lastEventOccurredAt: lastEvent.occurredAt,
      eventCount: sorted.length,
      capturedAt: new Date().toISOString(),
      profile,
    };

    await this.snapshotRepo.save(snapshot);
    return snapshot;
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private project(profileId: string, rawEvents: EssenceTimelineEvent[]): EssenceProfile {
    const events = sortEvents(rawEvents);
    const profile = createEmptyEssenceProfile(profileId);
    if (events.length > 0) {
      profile.createdAt = events[0].occurredAt;
      profile.updatedAt = events[events.length - 1].occurredAt;
    }

    for (const event of events) {
      if (!KNOWN_SCHEMA_VERSIONS.has(event.schemaVersion)) {
        throw new Error(
          `EssenceTimelineProjector: unsupported schemaVersion ${event.schemaVersion} in event ${event.id}`,
        );
      }
      if (!KNOWN_EVENT_TYPES.has(event.eventType)) {
        throw new Error(
          `EssenceTimelineProjector: unknown eventType '${event.eventType}' in event ${event.id}`,
        );
      }
      if (event.eventType === 'interpretation_committed') {
        this.applyInterpretationCommitted(profile, event);
      } else if (event.eventType === 'interpretation_archived') {
        this.applyInterpretationArchived(profile, event);
      }
    }

    return profile;
  }

  private projectDelta(base: EssenceProfile, deltaEvents: EssenceTimelineEvent[]): EssenceProfile {
    const sorted = sortEvents(deltaEvents);
    for (const event of sorted) {
      if (!KNOWN_SCHEMA_VERSIONS.has(event.schemaVersion)) {
        throw new Error(
          `EssenceTimelineProjector: unsupported schemaVersion ${event.schemaVersion} in event ${event.id}`,
        );
      }
      if (!KNOWN_EVENT_TYPES.has(event.eventType)) {
        throw new Error(
          `EssenceTimelineProjector: unknown eventType '${event.eventType}' in event ${event.id}`,
        );
      }
      if (event.eventType === 'interpretation_committed') {
        this.applyInterpretationCommitted(base, event);
      } else if (event.eventType === 'interpretation_archived') {
        this.applyInterpretationArchived(base, event);
      }
    }
    return base;
  }

  private applyInterpretationCommitted(profile: EssenceProfile, event: EssenceTimelineEvent): void {
    const payload = event.payload as InterpretationCommittedPayload;
    const nodeId = event.nodeId;
    if (!nodeId) {
      throw new Error(
        `EssenceTimelineProjector: interpretation_committed event ${event.id} has null nodeId`,
      );
    }

    const node = getEssenceNode(nodeId);
    if (!node) {
      throw new Error(
        `EssenceTimelineProjector: unknown nodeId '${nodeId}' in event ${event.id}`,
      );
    }

    const layer = node.layer;
    const now = event.occurredAt;

    // Archive the previous interpretation before writing the new one.
    if (payload.previousInterpretationId) {
      archiveInProfile(profile, payload.previousInterpretationId, now);
    }

    const source = payload.source ?? 'agent_inference';
    const observationIds = payload.observationIds ? [...payload.observationIds] : [];
    const evidenceStatus = (payload.evidenceStatus ?? (observationIds.length > 0 ? 'referenced' : 'unavailable')) as Interpretation['evidenceStatus'];

    const interp: Interpretation = {
      id: payload.interpretationId,
      version: 1,
      nodeId,
      layer,
      stabilityClass: node.stabilityClass,
      content: payload.content,
      observationIds,
      confidence: payload.confidence,
      interpretationKind: 'probable_interpretation',
      provenance: {
        source,
        confidence: payload.confidence,
        createdBy: payload.committedBy,
        firstObservedAt: now,
        lastConfirmedAt: now,
        lastUpdatedAt: now,
        evidenceIds: observationIds,
        conflictingInterpretationIds: [],
      },
      sensitivity: 'personal',
      temporalKind: 'trait',
      stateScope: null,
      expiresAt: null,
      archivedAt: null,
      conflictIds: [],
      evidenceStatus,
    };

    const layerData = profile[layer] as Record<string, Interpretation[]>;
    if (!layerData[nodeId]) layerData[nodeId] = [];
    layerData[nodeId].push(interp);
    profile.updatedAt = now;

    const evoEntry: EssenceEvolutionEntry = {
      // ID is deterministically derived from the event ID so it's stable across replays.
      id: `proj_${event.id}`,
      nodeId,
      previousInterpretationId: payload.previousInterpretationId,
      newInterpretationId: payload.interpretationId,
      triggeredBy: source,
      agentName: payload.committedBy,
      timestamp: now,
      note: null,
    };
    profile.evolution.push(evoEntry);
  }

  private applyInterpretationArchived(profile: EssenceProfile, event: EssenceTimelineEvent): void {
    const payload = event.payload as InterpretationArchivedPayload;
    const nodeId = event.nodeId ?? payload.interpretationId;
    const now = event.occurredAt;

    archiveInProfile(profile, payload.interpretationId, now);

    const evoEntry: EssenceEvolutionEntry = {
      id: `proj_${event.id}`,
      nodeId,
      previousInterpretationId: payload.interpretationId,
      newInterpretationId: payload.interpretationId,
      triggeredBy: 'agent_inference',
      agentName: payload.archivedBy,
      timestamp: now,
      note: payload.reason,
    };
    profile.evolution.push(evoEntry);
  }
}

// ── Module-level helpers ──────────────────────────────────────────────────────

/** Sort events by occurredAt (ISO 8601 lex), then by id as stable tiebreaker. */
function sortEvents(events: EssenceTimelineEvent[]): EssenceTimelineEvent[] {
  return [...events].sort((a, b) => {
    const t = a.occurredAt.localeCompare(b.occurredAt);
    if (t !== 0) return t;
    return a.id.localeCompare(b.id);
  });
}

function archiveInProfile(profile: EssenceProfile, interpretationId: string, archivedAt: string): void {
  for (const layer of PROJECTION_LAYERS) {
    const layerData = profile[layer] as Record<string, Interpretation[]>;
    for (const interps of Object.values(layerData)) {
      const found = interps.find(i => i.id === interpretationId);
      if (found) {
        (found as { archivedAt: string | null }).archivedAt = archivedAt;
        return;
      }
    }
  }
}

function countInterpretations(profile: EssenceProfile | null): number {
  if (!profile) return 0;
  return PROJECTION_LAYERS.reduce((sum, layer) => {
    const layerData = profile[layer] as Record<string, Interpretation[]>;
    return sum + Object.values(layerData).reduce((n, arr) => n + arr.length, 0);
  }, 0);
}

/** Deep clone a profile by round-tripping through JSON. */
export function cloneProfile(profile: EssenceProfile): EssenceProfile {
  return JSON.parse(JSON.stringify(profile)) as EssenceProfile;
}
