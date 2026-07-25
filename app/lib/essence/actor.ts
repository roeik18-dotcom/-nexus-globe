/**
 * Essence · Actor Types
 *
 * Separates authorization contracts from the API surface.
 * Pipeline-runner imports from here (not from api.ts) to avoid the
 * pipeline-runner → api.ts upward dependency.
 */

import type { AgentName } from './access';

/**
 * Any entity that can submit a proposal or correction.
 * 'user' is the human principal — not an AgentName.
 */
export type EssenceActor = AgentName | 'user';

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
