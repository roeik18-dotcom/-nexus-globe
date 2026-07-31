/**
 * Essence · Orientation dimension metadata (Presentation/Interaction layer)
 *
 * ADDITIVE metadata over ORIENTATION_SCHEMA. Pure data + types — no engine logic,
 * no inference, no writes. Safe to import anywhere. Does not touch the schema,
 * providers, accumulator, proposal engine, calibration, or the Python mirror.
 *
 * VISION DECISION (see ADR-001-orientation-dimensions.md): Essence Orientation is
 * a Presentation/Interaction layer of the AI (how to engage the user) — it is NOT
 * part of the Philos ontology / human model. Therefore each dimension's
 * relationship to Philos Dimensions/Departments is `independent` (no mapping, by
 * design), and the per-dimension structure below is a NEUTRAL bipolar-axis
 * description (two poles + a middle/balance value) — useful e.g. for a UI slider,
 * NOT a Philos "Vesica" claim.
 *
 * Structure decisions:
 *  - Bipolar axis (pole · middle · pole) for the four cleanly-bipolar dimensions.
 *  - TaskFraming left FLAT — its three values are not a bipolar triad (TF-3).
 *  - Philos binding = `independent` for every dimension (no mapping); a guard test
 *    asserts this, so a mapping cannot be introduced without a deliberate change
 *    here + an ADR update.
 */

import {
  ORIENTATION_SCHEMA,
  type OrientationDimensionKey,
} from './orientation';

/**
 * A dimension whose three values form a bipolar axis: two opposing poles with the
 * middle value as the balance point between them. All three fields are members of
 * the dimension's ORIENTATION_SCHEMA value set (asserted by the test suite, so it
 * can never drift from the schema). Neutral structural description — not a Philos
 * claim.
 */
export interface BipolarAxis {
  readonly kind: 'bipolar';
  readonly poleNegative: string;
  readonly middle: string;
  readonly polePositive: string;
}

/**
 * A dimension whose three values are NOT a bipolar triad and are deliberately
 * left unstructured (no pole/middle claim). `reason` records why.
 */
export interface FlatAxis {
  readonly kind: 'flat';
  readonly values: readonly string[];
  readonly reason: string;
}

export type OrientationAxis = BipolarAxis | FlatAxis;

/**
 * Each dimension's relationship to the Philos model. Per the vision decision
 * (ADR-001) Essence Orientation is a Presentation/Interaction layer, so this is
 * `independent` for every dimension — no mapping to Philos Dimensions/Departments.
 * (Should the vision later place Essence inside the Philos ontology, a `resolved`
 * variant would be added ONLY alongside an ADR that derives the mapping.)
 */
export interface IndependentBinding {
  readonly status: 'independent';
  readonly reason: string;
}

export type PhilosBinding = IndependentBinding;

export interface OrientationPhilosEntry {
  readonly axis: OrientationAxis;
  readonly philos: PhilosBinding;
}

const ADR = 'ADR-001-orientation-dimensions.md';

const independent = (): IndependentBinding => ({
  status: 'independent',
  reason:
    'Essence Orientation is a Presentation/Interaction layer, not part of the ' +
    `Philos ontology — no mapping by design. See ${ADR}.`,
});

/**
 * Orientation dimension metadata — one entry per ORIENTATION_SCHEMA key.
 *
 * Value ROLES (which value is a pole vs the middle) are the structural claim of
 * this layer; the VALUE SET is validated against ORIENTATION_SCHEMA by the test
 * suite, so the map can never invent values or drift from the schema.
 */
export const ORIENTATION_PHILOS_MAP: Readonly<
  Record<OrientationDimensionKey, OrientationPhilosEntry>
> = {
  OrientationCommunicationStyle: {
    axis: { kind: 'bipolar', poleNegative: 'direct', middle: 'collaborative', polePositive: 'exploratory' },
    philos: independent(),
  },
  OrientationResponseDepth: {
    axis: { kind: 'bipolar', poleNegative: 'brief', middle: 'balanced', polePositive: 'explanatory' },
    philos: independent(),
  },
  OrientationDecisionStyle: {
    axis: { kind: 'bipolar', poleNegative: 'decisive', middle: 'comparative', polePositive: 'deliberative' },
    philos: independent(),
  },
  OrientationTaskCadence: {
    axis: { kind: 'bipolar', poleNegative: 'single_step', middle: 'phased', polePositive: 'continuous' },
    philos: independent(),
  },
  OrientationTaskFraming: {
    axis: {
      kind: 'flat',
      values: [...ORIENTATION_SCHEMA.OrientationTaskFraming],
      reason: 'The three values are not a bipolar triad; left flat (TF-3, see ADR-001).',
    },
    philos: independent(),
  },
};

/** True when nodeId is an Essence orientation dimension present in this metadata. */
export function isOrientationDimension(nodeId: string): nodeId is OrientationDimensionKey {
  return nodeId in ORIENTATION_PHILOS_MAP;
}
