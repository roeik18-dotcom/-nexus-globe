/**
 * Essence · Orientation → Philos Metadata Layer (Phase 1)
 *
 * ADDITIVE metadata over ORIENTATION_SCHEMA. Pure data + types — no engine logic,
 * no inference, no writes. Safe to import anywhere. Does not touch the schema,
 * providers, accumulator, proposal engine, calibration, or the Python mirror.
 *
 * Purpose: give each orientation dimension a Philos-grounded *structure* — the
 * Vesica 3-architecture (pole · relation · pole) — WITHOUT locking the contested
 * mapping from orientation dimensions to Philos Dimensions/Departments.
 *
 * Decisions (see ADR-001-orientation-dimensions.md):
 *  - Vesica structure for the four cleanly-bipolar dimensions (Map-C).
 *  - TaskFraming left FLAT — its three values are not a bipolar triad (TF-3).
 *  - The dimension → Philos-department/dimension mapping is DELIBERATELY
 *    `unresolved`: the theory underdetermines it (Essence orientation is
 *    communication *style*; Philos Dimensions/Departments are a resource/load
 *    model). Nothing is hard-coded, so a future theory-justified mapping can be
 *    added without a code change — and the test suite asserts it stays unresolved.
 */

import {
  ORIENTATION_SCHEMA,
  type OrientationDimensionKey,
} from './orientation';

/**
 * A dimension modeled as a Philos Vesica: two opposing poles with the middle
 * value as the relation (the lens / balancing point between them). All three
 * fields are members of the dimension's ORIENTATION_SCHEMA value set (asserted
 * by the test suite, so this can never drift from the schema).
 */
export interface VesicaAxis {
  readonly kind: 'vesica';
  readonly poleNegative: string;
  readonly relation: string;
  readonly polePositive: string;
}

/**
 * A dimension whose three values are NOT a bipolar triad and are deliberately
 * left unstructured (no pole/relation claim). `reason` records why.
 */
export interface FlatAxis {
  readonly kind: 'flat';
  readonly values: readonly string[];
  readonly reason: string;
}

export type OrientationAxis = VesicaAxis | FlatAxis;

/**
 * The mapping from an orientation dimension to Philos Dimensions/Departments.
 *
 * Phase 1 provides ONLY the `unresolved` shape. The theory does not determine
 * this mapping (see ADR-001), so committing one now would encode an intuition as
 * if it were necessary. A future `resolved` variant will be added ONLY alongside
 * an ADR that derives the mapping from first principles.
 */
export interface UnresolvedBinding {
  readonly status: 'unresolved';
  /** Documented candidate mappings (see ADR-001) — none of them active. */
  readonly candidates: readonly string[];
  readonly note: string;
}

export type PhilosBinding = UnresolvedBinding;

export interface OrientationPhilosEntry {
  readonly axis: OrientationAxis;
  readonly philos: PhilosBinding;
}

const ADR = 'ADR-001-orientation-dimensions.md';

const unresolved = (candidates: readonly string[]): UnresolvedBinding => ({
  status: 'unresolved',
  candidates,
  note: `Mapping underdetermined by Philos theory — see ${ADR}. Not hard-coded by design.`,
});

/**
 * Phase 1 metadata — one entry per ORIENTATION_SCHEMA key.
 *
 * Value ROLES (which value is a pole vs the relation) are the structural claim of
 * this layer; the VALUE SET is validated against ORIENTATION_SCHEMA by the test
 * suite, so the map can never invent values or drift from the schema.
 */
export const ORIENTATION_PHILOS_MAP: Readonly<
  Record<OrientationDimensionKey, OrientationPhilosEntry>
> = {
  OrientationCommunicationStyle: {
    axis: { kind: 'vesica', poleNegative: 'direct', relation: 'collaborative', polePositive: 'exploratory' },
    philos: unresolved(['Map-A', 'Map-B']),
  },
  OrientationResponseDepth: {
    axis: { kind: 'vesica', poleNegative: 'brief', relation: 'balanced', polePositive: 'explanatory' },
    philos: unresolved(['Map-A', 'Map-B']),
  },
  OrientationDecisionStyle: {
    axis: { kind: 'vesica', poleNegative: 'decisive', relation: 'comparative', polePositive: 'deliberative' },
    philos: unresolved(['Map-A', 'Map-B']),
  },
  OrientationTaskCadence: {
    axis: { kind: 'vesica', poleNegative: 'single_step', relation: 'phased', polePositive: 'continuous' },
    philos: unresolved(['Map-A', 'Map-B']),
  },
  OrientationTaskFraming: {
    axis: {
      kind: 'flat',
      values: [...ORIENTATION_SCHEMA.OrientationTaskFraming],
      reason:
        'The three values are not a bipolar triad; not forced into a vesica (TF-3, see ADR-001).',
    },
    philos: unresolved(['TF-1', 'TF-2', 'TF-3', 'Map-A', 'Map-B']),
  },
};

/** True when nodeId has a Philos metadata entry (i.e. is an orientation dimension). */
export function isPhilosMapped(nodeId: string): nodeId is OrientationDimensionKey {
  return nodeId in ORIENTATION_PHILOS_MAP;
}
