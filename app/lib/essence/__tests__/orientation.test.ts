/**
 * Orientation dimension invariants — 5 nodes, expression layer, Adaptive stability.
 */

import { describe, it, expect } from 'vitest';
import {
  ORIENTATION_NODE_IDS,
  type OrientationDimensionKey,
  type OrientationNodeValueMap,
  type OrientationCommunicationStyle,
  type OrientationResponseDepth,
  type OrientationTaskFraming,
  type OrientationDecisionStyle,
  type OrientationTaskCadence,
} from '../orientation';
import { ESSENCE_ONTOLOGY } from '../ontology';

const EXPECTED_IDS: OrientationDimensionKey[] = [
  'OrientationCommunicationStyle',
  'OrientationResponseDepth',
  'OrientationTaskFraming',
  'OrientationDecisionStyle',
  'OrientationTaskCadence',
];

describe('orientation', () => {
  it('ORIENTATION_NODE_IDS has exactly 5 entries', () => {
    expect(ORIENTATION_NODE_IDS.size).toBe(5);
  });

  it('contains all 5 expected dimension IDs', () => {
    for (const id of EXPECTED_IDS) {
      expect(ORIENTATION_NODE_IDS.has(id), `Missing: ${id}`).toBe(true);
    }
  });

  it('all orientation node IDs are registered in ESSENCE_ONTOLOGY', () => {
    for (const id of ORIENTATION_NODE_IDS) {
      expect(ESSENCE_ONTOLOGY[id], `Not in ontology: ${id}`).toBeDefined();
    }
  });

  it('all orientation nodes have layer === expression', () => {
    for (const id of ORIENTATION_NODE_IDS) {
      expect(ESSENCE_ONTOLOGY[id].layer, `${id}.layer`).toBe('expression');
    }
  });

  it('all orientation nodes have stabilityClass === Adaptive', () => {
    for (const id of ORIENTATION_NODE_IDS) {
      expect(ESSENCE_ONTOLOGY[id].stabilityClass, `${id}.stabilityClass`).toBe('Adaptive');
    }
  });

  it('all orientation nodes have status === stable', () => {
    for (const id of ORIENTATION_NODE_IDS) {
      expect(ESSENCE_ONTOLOGY[id].status, `${id}.status`).toBe('stable');
    }
  });

  it('none of the orientation nodes require user confirmation', () => {
    for (const id of ORIENTATION_NODE_IDS) {
      expect(
        ESSENCE_ONTOLOGY[id].confidenceRules.requiresUserConfirmation,
        `${id}.confidenceRules.requiresUserConfirmation`,
      ).toBe(false);
    }
  });

  it('all orientation nodes have writeThreshold === single_source', () => {
    for (const id of ORIENTATION_NODE_IDS) {
      expect(
        ESSENCE_ONTOLOGY[id].confidenceRules.writeThreshold,
        `${id}.confidenceRules.writeThreshold`,
      ).toBe('single_source');
    }
  });

  it('OrientationNodeValueMap allows valid values (compile-time type check)', () => {
    // This test verifies that the union types are correct at runtime via
    // representative value assertions. TypeScript enforces the full constraint.
    const cs: OrientationCommunicationStyle = 'direct';
    const rd: OrientationResponseDepth = 'brief';
    const tf: OrientationTaskFraming = 'action_first';
    const ds: OrientationDecisionStyle = 'decisive';
    const tc: OrientationTaskCadence = 'single_step';

    const sample: OrientationNodeValueMap = {
      OrientationCommunicationStyle: cs,
      OrientationResponseDepth: rd,
      OrientationTaskFraming: tf,
      OrientationDecisionStyle: ds,
      OrientationTaskCadence: tc,
    };

    expect(sample.OrientationCommunicationStyle).toBe('direct');
    expect(sample.OrientationResponseDepth).toBe('brief');
    expect(sample.OrientationTaskFraming).toBe('action_first');
    expect(sample.OrientationDecisionStyle).toBe('decisive');
    expect(sample.OrientationTaskCadence).toBe('single_step');
  });
});
