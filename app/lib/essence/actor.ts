/**
 * Essence · Actor Types
 *
 * Separates authorization contracts from the API surface.
 * Pipeline-runner imports from here (not from api.ts) to avoid the
 * pipeline-runner → api.ts upward dependency.
 *
 * EssenceActor is a discriminated union — agents, users, and legacy imports
 * carry distinct metadata and are never conflated.
 */

import type { AgentName } from './access';

// ── Authorization Context ──────────────────────────────────────────────────────

/**
 * Proof that a user-authorized action is in progress.
 * Required for confirmUpdate, rejectUpdate, and correctItem.
 * Agent-supplied strings are NOT accepted in place of this struct.
 */
export interface UserAuthorizedActionContext {
  readonly actorType: 'user';
  readonly actionId: string;
  readonly authorizedAt: string; // ISO 8601
}

// ── Legacy Source Types ────────────────────────────────────────────────────────

/** The format or origin of a legacy import source. */
export type LegacySourceType =
  | 'jarvis_json'
  | 'notion_export'
  | 'manual_import';

// ── EssenceActor ──────────────────────────────────────────────────────────────

/**
 * Any entity that can submit a proposal or correction.
 * Each variant carries the metadata appropriate to its kind.
 * Never represent user actions or legacy imports as agents.
 */
export type EssenceActor =
  | {
      readonly type: 'agent';
      readonly agentName: AgentName;
    }
  | {
      readonly type: 'user';
      readonly actionContext: UserAuthorizedActionContext;
    }
  | {
      readonly type: 'legacy_import';
      readonly sourceType: LegacySourceType;
      /** The specific file or record that was the source of this import. */
      readonly sourceReference?: string;
    };

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Serializes an actor to a stable string label for use in string-typed
 * schema fields (recordedBy, createdBy, agentName in evolution entries).
 */
export function actorLabel(actor: EssenceActor): string {
  switch (actor.type) {
    case 'agent': return actor.agentName;
    case 'user': return 'user';
    case 'legacy_import': return `legacy:${actor.sourceType}`;
  }
}

/** Type guard: true when the actor is a user-authorized action. */
export function isUserActor(actor: EssenceActor): actor is Extract<EssenceActor, { type: 'user' }> {
  return actor.type === 'user';
}
