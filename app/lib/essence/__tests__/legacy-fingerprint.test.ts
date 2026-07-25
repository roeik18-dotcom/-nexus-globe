/**
 * Legacy fingerprint — determinism and uniqueness.
 */

import { describe, it, expect } from 'vitest';
import { computeLegacyFingerprint } from '../legacy-fingerprint';

describe('computeLegacyFingerprint', () => {
  it('returns a string starting with "fp_"', () => {
    const fp = computeLegacyFingerprint({
      nodeId: 'Values',
      content: 'truth as non-negotiable',
      sourceFile: 'jarvis.json',
    });
    expect(fp).toMatch(/^fp_[0-9a-f]{8}$/);
  });

  it('is deterministic — same input always produces same output', () => {
    const input = { nodeId: 'Values', content: 'integrity', sourceFile: 'profile.json' };
    expect(computeLegacyFingerprint(input)).toBe(computeLegacyFingerprint(input));
  });

  it('different nodeId → different fingerprint', () => {
    const base = { content: 'hello', sourceFile: 'x.json' };
    expect(computeLegacyFingerprint({ ...base, nodeId: 'Values' }))
      .not.toBe(computeLegacyFingerprint({ ...base, nodeId: 'Beliefs' }));
  });

  it('different content → different fingerprint', () => {
    const base = { nodeId: 'Values', sourceFile: 'x.json' };
    expect(computeLegacyFingerprint({ ...base, content: 'a' }))
      .not.toBe(computeLegacyFingerprint({ ...base, content: 'b' }));
  });

  it('different sourceFile → different fingerprint', () => {
    const base = { nodeId: 'Values', content: 'same' };
    expect(computeLegacyFingerprint({ ...base, sourceFile: 'file-a.json' }))
      .not.toBe(computeLegacyFingerprint({ ...base, sourceFile: 'file-b.json' }));
  });
});
