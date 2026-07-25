/**
 * Essence · Legacy Fingerprint
 *
 * Produces a stable, deterministic fingerprint for a legacy import candidate.
 * Two imports of identical content to the same node from the same source file
 * produce the same fingerprint — enabling idempotent re-imports.
 *
 * Pure function — no I/O, no side effects.
 */

export interface FingerprintInput {
  nodeId: string;
  content: string;
  sourceFile: string;
}

/**
 * Stable, deterministic fingerprint for a (sourceFile, nodeId, content) triplet.
 * Uses djb2 — no crypto dependency, no browser or Node.js APIs.
 */
export function computeLegacyFingerprint(input: FingerprintInput): string {
  const raw = `${input.sourceFile}::${input.nodeId}::${input.content}`;
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = (((hash << 5) + hash) ^ raw.charCodeAt(i)) >>> 0;
  }
  return `fp_${hash.toString(16).padStart(8, '0')}`;
}
