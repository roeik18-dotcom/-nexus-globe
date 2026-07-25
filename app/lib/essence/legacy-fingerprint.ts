/**
 * Essence · Legacy Fingerprint
 *
 * Produces a stable, deterministic fingerprint for a legacy import candidate.
 * Two imports of identical content to the same node from the same source file
 * produce the same fingerprint — enabling idempotent re-imports.
 *
 * Pure function — no I/O, no side effects.
 *
 * PROVISIONAL — format includes a version prefix (currently 'v1').
 * Do not treat the fingerprint string as a frozen contract: migrationVersion
 * will increment if the hash algorithm or input encoding changes.
 */

export interface FingerprintInput {
  nodeId: string;
  content: string;
  sourceFile: string;
}

/**
 * Current fingerprint migration version.
 * Increment when the hash algorithm or input encoding changes.
 */
export const FINGERPRINT_MIGRATION_VERSION = 'v1' as const;

/**
 * Stable, deterministic fingerprint for a (sourceFile, nodeId, content) triplet.
 * Uses djb2 — no crypto dependency, no browser or Node.js APIs.
 * Format: fp_v1_XXXXXXXX (8 hex digits, version-prefixed).
 */
export function computeLegacyFingerprint(input: FingerprintInput): string {
  const raw = `${input.sourceFile}::${input.nodeId}::${input.content}`;
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = (((hash << 5) + hash) ^ raw.charCodeAt(i)) >>> 0;
  }
  return `fp_${FINGERPRINT_MIGRATION_VERSION}_${hash.toString(16).padStart(8, '0')}`;
}
