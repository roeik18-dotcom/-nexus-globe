/**
 * Orientation dimension metadata (Presentation/Interaction layer) — invariants.
 *
 * Guards that the additive layer (ADR-001):
 *  - covers every ORIENTATION_SCHEMA dimension exactly,
 *  - uses only real schema values for poles/middle (no drift, no invented values),
 *  - models the four bipolar dimensions as bipolar axes and TaskFraming as flat, and
 *  - CRITICALLY encodes NO Philos mapping (every binding `independent`, per the
 *    vision decision that Essence Orientation is a Presentation/Interaction layer).
 *
 * The last group is the safeguard: a mapping cannot be introduced without a
 * deliberate change here + an ADR update.
 */

import { describe, it, expect } from 'vitest';
import {
  ORIENTATION_SCHEMA,
  isValidOrientationValue,
  type OrientationDimensionKey,
} from '../orientation';
import {
  ORIENTATION_PHILOS_MAP,
  isOrientationDimension,
} from '../orientation-philos-map';

const DIMENSION_KEYS = Object.keys(ORIENTATION_SCHEMA) as OrientationDimensionKey[];

describe('ORIENTATION_PHILOS_MAP — coverage', () => {
  it('covers every schema dimension exactly (no missing, no extra)', () => {
    expect(Object.keys(ORIENTATION_PHILOS_MAP).sort()).toEqual([...DIMENSION_KEYS].sort());
  });

  it('isOrientationDimension agrees with the schema keys', () => {
    for (const k of DIMENSION_KEYS) expect(isOrientationDimension(k)).toBe(true);
    expect(isOrientationDimension('NotADimension')).toBe(false);
  });
});

describe('ORIENTATION_PHILOS_MAP — axis structure', () => {
  it('TaskFraming is the only flat axis; the other four are bipolar', () => {
    for (const k of DIMENSION_KEYS) {
      const kind = ORIENTATION_PHILOS_MAP[k].axis.kind;
      if (k === 'OrientationTaskFraming') expect(kind).toBe('flat');
      else expect(kind).toBe('bipolar');
    }
  });

  it('each bipolar axis uses exactly the three schema values (permutation, no invented values)', () => {
    for (const k of DIMENSION_KEYS) {
      const axis = ORIENTATION_PHILOS_MAP[k].axis;
      if (axis.kind !== 'bipolar') continue;
      const used = [axis.poleNegative, axis.middle, axis.polePositive];
      // every value is valid for this dimension
      for (const v of used) expect(isValidOrientationValue(k, v)).toBe(true);
      // all three are distinct
      expect(new Set(used).size).toBe(3);
      // and together they are exactly the schema value set
      expect([...used].sort()).toEqual([...ORIENTATION_SCHEMA[k]].sort());
    }
  });

  it('the flat axis lists exactly the schema values and gives a reason', () => {
    const axis = ORIENTATION_PHILOS_MAP.OrientationTaskFraming.axis;
    expect(axis.kind).toBe('flat');
    if (axis.kind === 'flat') {
      expect([...axis.values].sort()).toEqual(
        [...ORIENTATION_SCHEMA.OrientationTaskFraming].sort(),
      );
      expect(axis.reason.length).toBeGreaterThan(0);
    }
  });
});

describe('ORIENTATION_PHILOS_MAP — no Philos mapping is encoded (ADR-001 guard)', () => {
  it('every Philos binding is independent (Presentation/Interaction layer)', () => {
    for (const k of DIMENSION_KEYS) {
      expect(ORIENTATION_PHILOS_MAP[k].philos.status).toBe('independent');
    }
  });

  it('each independent binding states a reason referencing the ADR', () => {
    for (const k of DIMENSION_KEYS) {
      const philos = ORIENTATION_PHILOS_MAP[k].philos;
      expect(philos.reason.length).toBeGreaterThan(0);
      expect(philos.reason).toContain('ADR-001');
    }
  });
});
