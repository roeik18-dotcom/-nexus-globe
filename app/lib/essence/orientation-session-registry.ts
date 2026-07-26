/**
 * Essence · Orientation Session Registry (M0-8C)
 *
 * Per-session registry for OrientationInferenceOrchestrator instances.
 * The orchestrator is stateful — its accumulator builds evidence across exchanges
 * within a session. A new instance per HTTP request would reset the accumulator,
 * so each session must share a single persistent orchestrator.
 *
 * TODO: TTL-based eviction. Sessions that never disconnect (e.g. a stuck
 * WebSocket) will grow the registry without bound. A background sweep that
 * evicts entries idle longer than N hours is the correct fix; left for a
 * follow-up milestone.
 */

import type { OrientationInferenceOrchestrator } from './orientation-orchestrator';

const _registry = new Map<string, OrientationInferenceOrchestrator>();

/**
 * Return the orchestrator for sessionId, creating it with factory() if absent.
 * factory() is called at most once per sessionId.
 */
export function getOrCreate(
  sessionId: string,
  factory: () => OrientationInferenceOrchestrator,
): OrientationInferenceOrchestrator {
  let orchestrator = _registry.get(sessionId);
  if (!orchestrator) {
    orchestrator = factory();
    _registry.set(sessionId, orchestrator);
  }
  return orchestrator;
}

/** Release the orchestrator for sessionId. No-op if sessionId is not registered. */
export function release(sessionId: string): void {
  _registry.delete(sessionId);
}

/** Test helper — clear all entries from the registry. Not for production use. */
export function _clearRegistry(): void {
  _registry.clear();
}
