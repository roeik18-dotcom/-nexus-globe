/**
 * Orientation → Philos metadata layer (Phase 1) — invariants.
 *
 * Guards that the additive layer (ADR-001):
 *  - covers every ORIENTATION_SCHEMA dimension exactly,
 *  - uses only real schema values for poles/relation (no drift, no invented values),
 *  - models the four bipolar dimensions as vesicas and TaskFraming as flat, and
 *  - CRITICALLY hard-codes NO dimension→Philos mapping (every binding unresolved).
 *
 * The last group is the safeguard the directive requires: no mapping can be
 * silently locked in without a deliberate change here + an ADR update.
 */

import { describe, it, expect } from 'vitest';
import {
  ORIENTATION_SCHEMA,
  isValidOrientationValue,
  type OrientationDimensionKey,
} from '../orientation';
import {
  ORIENTATION_PHILOS_MAP,
  isPhilosMapped,
} from '../orientation-philos-map';

const DIMENSION_KEYS = Object.keys(ORIENTATION_SCHEMA) as OrientationDimensionKey[];

describe('ORIENTATION_PHILOS_MAP — coverage', () => {
  it('covers every schema dimension exactly (no missing, no extra)', () => {
    expect(Object.keys(ORIENTATION_PHILOS_MAP).sort()).toEqual([...DIMENSION_KEYS].sort());
  });

  it('isPhilosMapped agrees with the schema keys', () => {
    for (const k of DIMENSION_KEYS) expect(isPhilosMapped(k)).toBe(true);
    expect(isPhilosMapped('NotADimension')).toBe(false);
  });
});

describe('ORIENTATION_PHILOS_MAP — axis structure', () => {
  it('TaskFraming is the only flat axis; the other four are vesicas', () => {
    for (const k of DIMENSION_KEYS) {
      const kind = ORIENTATION_PHILOS_MAP[k].axis.kind;
      if (k === 'OrientationTaskFraming') expect(kind).toBe('flat');
      else expect(kind).toBe('vesica');
    }
  });

  it('each vesica uses exactly the three schema values (permutation, no invented values)', () => {
    for (const k of DIMENSION_KEYS) {
      const axis = ORIENTATION_PHILOS_MAP[k].axis;
      if (axis.kind !== 'vesica') continue;
      const used = [axis.poleNegative, axis.relation, axis.polePositive];
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

describe('ORIENTATION_PHILOS_MAP — no mapping is hard-coded (ADR-001 guard)', () => {
  it('every Philos binding is unresolved', () => {
    for (const k of DIMENSION_KEYS) {
      expect(ORIENTATION_PHILOS_MAP[k].philos.status).toBe('unresolved');
    }
  });

  it('unresolved bindings document candidates but activate none', () => {
    for (const k of DIMENSION_KEYS) {
      const philos = ORIENTATION_PHILOS_MAP[k].philos;
      expect(philos.candidates.length).toBeGreaterThan(0);
      expect(philos.note).toContain('ADR-001');
    }
  });
});
