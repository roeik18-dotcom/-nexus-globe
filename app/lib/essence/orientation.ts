/**
 * Essence · Orientation Dimensions v1
 *
 * Defines the V1 set of orientation dimension types and the canonical
 * node ID registry. Orientation dimensions are stored as Interpretation
 * nodes in the Expression layer of EssenceProfile — five independent nodes,
 * one per dimension.
 *
 * TypeScript types and ORIENTATION_NODE_IDS are the canonical source of truth.
 * The Python renderer (essence_context.py) holds a manual mirror of this set.
 * Update both files together when adding or removing dimensions.
 *
 * Lifecycle: each dimension is a single-valued trait. Future write paths
 * (M0-5+) must ensure exactly one active Interpretation per node.
 * The current read path uses selectBest() which resolves by confidence
 * level — not ideal for preferences but no preference-aware resolver
 * exists yet. This is a documented limitation of M0-4.
 *
 * Stability note: preferences here are stable across sessions only while
 * the same InMemoryEssenceRepository state is loaded. There is no
 * persistent storage in M0-4 — data does not survive a process restart.
 */

export type OrientationCommunicationStyle =
  | 'direct'
  | 'exploratory'
  | 'collaborative';

export type OrientationResponseDepth =
  | 'brief'
  | 'balanced'
  | 'explanatory';

export type OrientationTaskFraming =
  | 'action_first'
  | 'context_first'
  | 'options_first';

export type OrientationDecisionStyle =
  | 'decisive'
  | 'comparative'
  | 'deliberative';

export type OrientationTaskCadence =
  | 'single_step'
  | 'phased'
  | 'continuous';

/**
 * Maps each orientation node ID to its specific allowed values.
 * The key-to-value-type binding is enforced by TypeScript at compile time.
 */
export type OrientationNodeValueMap = {
  OrientationCommunicationStyle: OrientationCommunicationStyle;
  OrientationResponseDepth:      OrientationResponseDepth;
  OrientationTaskFraming:        OrientationTaskFraming;
  OrientationDecisionStyle:      OrientationDecisionStyle;
  OrientationTaskCadence:        OrientationTaskCadence;
};

export type OrientationDimensionKey = keyof OrientationNodeValueMap;

/**
 * Canonical set of orientation node IDs.
 *
 * This set is the authoritative list. The Python renderer in
 * voice-gateway/app/essence_context.py holds a manual mirror.
 * Keep them in sync — drift causes silent rendering gaps.
 */
export const ORIENTATION_NODE_IDS: ReadonlySet<OrientationDimensionKey> =
  new Set<OrientationDimensionKey>([
    'OrientationCommunicationStyle',
    'OrientationResponseDepth',
    'OrientationTaskFraming',
    'OrientationDecisionStyle',
    'OrientationTaskCadence',
  ]);
