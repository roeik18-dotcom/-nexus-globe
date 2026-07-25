/**
 * Essence · Interpretation Utilities
 *
 * Shared helpers for locating interpretations by ID.
 * Extracted here to break the read-service ↔ proposal-service coupling.
 */

import type { EssenceLayer } from './ontology';
import type { EssenceProfile, Interpretation } from './schema';

const LAYERS: EssenceLayer[] = ['core', 'aspirations', 'expression', 'identity'];

/** Locate an interpretation by ID across all layers. Returns null if not found. */
export function findInterpretation(profile: EssenceProfile, id: string): Interpretation | null {
  for (const layer of LAYERS) {
    const layerData = profile[layer] as Record<string, Interpretation[]>;
    for (const interpretations of Object.values(layerData)) {
      const found = interpretations.find(i => i.id === id);
      if (found) return found;
    }
  }
  return null;
}
