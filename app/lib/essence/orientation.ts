/**
 * Essence · Orientation Dimensions v1
 *
 * ORIENTATION_SCHEMA is the single source of truth for allowed dimension values.
 * Union types are derived from it; runtime validation reads from it directly.
 * The Python renderer (essence_context.py) holds a manual mirror of the values.
 * Update both files together when adding or removing dimensions or values.
 *
 * Lifecycle: each dimension is a single-valued trait. The write path (M0-5)
 * enforces exactly one active Interpretation per node via 'replace_single_value'
 * write disposition: all active interpretations for the node are archived before
 * a new one is committed.
 */

/**
 * Single source of truth for orientation dimension IDs and their allowed values.
 * TypeScript union types and runtime validation both derive from this constant.
 */
export const ORIENTATION_SCHEMA = {
  OrientationCommunicationStyle: ['direct', 'exploratory', 'collaborative'],
  OrientationResponseDepth:      ['brief', 'balanced', 'explanatory'],
  OrientationTaskFraming:        ['action_first', 'context_first', 'options_first'],
  OrientationDecisionStyle:      ['decisive', 'comparative', 'deliberative'],
  OrientationTaskCadence:        ['single_step', 'phased', 'continuous'],
} as const;

export type OrientationDimensionKey = keyof typeof ORIENTATION_SCHEMA;

export type OrientationCommunicationStyle = typeof ORIENTATION_SCHEMA.OrientationCommunicationStyle[number];
export type OrientationResponseDepth      = typeof ORIENTATION_SCHEMA.OrientationResponseDepth[number];
export type OrientationTaskFraming        = typeof ORIENTATION_SCHEMA.OrientationTaskFraming[number];
export type OrientationDecisionStyle      = typeof ORIENTATION_SCHEMA.OrientationDecisionStyle[number];
export type OrientationTaskCadence        = typeof ORIENTATION_SCHEMA.OrientationTaskCadence[number];

/**
 * Maps each orientation node ID to its specific allowed value type.
 * Key-to-value-type binding enforced at compile time.
 */
export type OrientationNodeValueMap = {
  OrientationCommunicationStyle: OrientationCommunicationStyle;
  OrientationResponseDepth:      OrientationResponseDepth;
  OrientationTaskFraming:        OrientationTaskFraming;
  OrientationDecisionStyle:      OrientationDecisionStyle;
  OrientationTaskCadence:        OrientationTaskCadence;
};

/**
 * Canonical set of orientation node IDs, derived from ORIENTATION_SCHEMA.
 *
 * The Python renderer in voice-gateway/app/essence_context.py holds a manual mirror.
 * Keep them in sync — drift causes silent rendering gaps.
 */
export const ORIENTATION_NODE_IDS: ReadonlySet<OrientationDimensionKey> =
  new Set<OrientationDimensionKey>(
    Object.keys(ORIENTATION_SCHEMA) as OrientationDimensionKey[],
  );

/** Type guard: true when nodeId is one of the five orientation dimension keys. */
export function isOrientationNode(nodeId: string): nodeId is OrientationDimensionKey {
  return nodeId in ORIENTATION_SCHEMA;
}

/**
 * Returns true when value is a valid categorical value for the given orientation node.
 * Derived from ORIENTATION_SCHEMA — no separate allowlist to maintain.
 */
export function isValidOrientationValue(
  nodeId: OrientationDimensionKey,
  value: string,
): boolean {
  return (ORIENTATION_SCHEMA[nodeId] as readonly string[]).includes(value);
}
