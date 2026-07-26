/**
 * Ontology invariants — 23 nodes, lowercase layers, layer-level ESSENCE_FLOW.
 */

import { describe, it, expect } from 'vitest';
import {
  ESSENCE_ONTOLOGY,
  ESSENCE_FLOW,
  type EssenceLayer,
} from '../ontology';

const VALID_LAYERS: EssenceLayer[] = ['core', 'aspirations', 'expression', 'identity'];

const EXPECTED_NODE_IDS = [
  // Core (8)
  'Values', 'Beliefs', 'Worldview', 'Motivations', 'Needs',
  'Psychology', 'CognitivePatterns', 'IntrinsicConstraints',
  // Aspirations (5)
  'Aspirations_Becoming', 'Aspirations_LifeDirections', 'Aspirations_DesiredConditions',
  'Aspirations_Contribution', 'Aspirations_Legacy',
  // Expression (6)
  'Aesthetics', 'CreativeDNA', 'Principles', 'Communication', 'Style', 'Preferences',
  // Identity (4)
  'Roles', 'PublicPersona', 'ProfessionalIdentity', 'PersonalIdentity',
];

describe('ontology', () => {
  it('has exactly 28 nodes', () => {
    expect(Object.keys(ESSENCE_ONTOLOGY)).toHaveLength(28);
  });

  it('contains all expected node IDs', () => {
    for (const id of EXPECTED_NODE_IDS) {
      expect(ESSENCE_ONTOLOGY[id], `Missing node: ${id}`).toBeDefined();
    }
  });

  it('all node layer literals are lowercase', () => {
    for (const [id, node] of Object.entries(ESSENCE_ONTOLOGY)) {
      expect(VALID_LAYERS, `Node ${id} has invalid layer: ${node.layer}`).toContain(node.layer);
    }
  });

  it('node counts per layer are correct', () => {
    const byLayer = Object.values(ESSENCE_ONTOLOGY).reduce<Record<string, number>>(
      (acc, n) => { acc[n.layer] = (acc[n.layer] ?? 0) + 1; return acc; },
      {}
    );
    expect(byLayer['core']).toBe(8);
    expect(byLayer['aspirations']).toBe(5);
    expect(byLayer['expression']).toBe(11);
    expect(byLayer['identity']).toBe(4);
  });

  it('ESSENCE_FLOW is a layer-level graph (not node IDs)', () => {
    for (const [fromLayer, toLayerList] of Object.entries(ESSENCE_FLOW)) {
      expect(VALID_LAYERS, `ESSENCE_FLOW key '${fromLayer}' is not a valid layer`).toContain(fromLayer);
      for (const toLayer of toLayerList) {
        expect(VALID_LAYERS, `ESSENCE_FLOW value '${toLayer}' is not a valid layer`).toContain(toLayer);
        // Ensure it references layers, not node IDs
        expect(ESSENCE_ONTOLOGY[toLayer], `ESSENCE_FLOW incorrectly references node ID '${toLayer}' as a layer`).toBeUndefined();
      }
    }
  });

  it('ESSENCE_FLOW has no cycles', () => {
    const visited = new Set<string>();
    function hasCycle(layer: string, path: string[]): boolean {
      if (path.includes(layer)) return true;
      const next = (ESSENCE_FLOW as Record<string, string[]>)[layer] ?? [];
      for (const n of next) {
        if (hasCycle(n, [...path, layer])) return true;
      }
      return false;
    }
    for (const layer of VALID_LAYERS) {
      expect(hasCycle(layer, []), `Cycle detected starting from layer ${layer}`).toBe(false);
    }
  });

  it('all nodes have required confidenceRules fields', () => {
    const validThresholds = ['user_confirmed', 'multi_source', 'single_source'];
    for (const [id, node] of Object.entries(ESSENCE_ONTOLOGY)) {
      expect(validThresholds, `${id}.confidenceRules.writeThreshold invalid`).toContain(node.confidenceRules.writeThreshold);
      expect(typeof node.confidenceRules.requiresUserConfirmation, `${id}.confidenceRules.requiresUserConfirmation not boolean`).toBe('boolean');
    }
  });

  it('requiresUserConfirmation is true only for sensitive nodes', () => {
    const mustConfirm = Object.entries(ESSENCE_ONTOLOGY)
      .filter(([, n]) => n.confidenceRules.requiresUserConfirmation)
      .map(([id]) => id)
      .sort();
    // These nodes must require user confirmation
    const expected = ['Values', 'Needs', 'Psychology', 'IntrinsicConstraints', 'Aspirations_Legacy'].sort();
    expect(mustConfirm).toEqual(expected);
  });
});
