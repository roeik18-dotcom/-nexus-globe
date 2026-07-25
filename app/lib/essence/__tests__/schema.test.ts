/**
 * Schema invariants — types, factory, and profile structure.
 */

import { describe, it, expect } from 'vitest';
import { createEmptyEssenceProfile } from '../schema';

describe('schema', () => {
  describe('createEmptyEssenceProfile', () => {
    it('creates a profile with the correct profileId', () => {
      const p = createEmptyEssenceProfile('user-1');
      expect(p.profileId).toBe('user-1');
    });

    it('schema version is the literal "1"', () => {
      const p = createEmptyEssenceProfile('user-1');
      expect(p.schemaVersion).toBe('1');
    });

    it('all four layers are empty objects', () => {
      const p = createEmptyEssenceProfile('user-1');
      expect(p.core).toEqual({});
      expect(p.aspirations).toEqual({});
      expect(p.expression).toEqual({});
      expect(p.identity).toEqual({});
    });

    it('state has all five scope buckets as empty arrays', () => {
      const p = createEmptyEssenceProfile('user-1');
      expect(p.state.momentary).toEqual([]);
      expect(p.state.session).toEqual([]);
      expect(p.state.daily).toEqual([]);
      expect(p.state.short_term).toEqual([]);
      expect(p.state.open_ended).toEqual([]);
    });

    it('observations, conflicts, and evolution are empty arrays', () => {
      const p = createEmptyEssenceProfile('user-1');
      expect(p.observations).toEqual([]);
      expect(p.conflicts).toEqual([]);
      expect(p.evolution).toEqual([]);
    });

    it('createdAt and updatedAt are ISO 8601 strings', () => {
      const p = createEmptyEssenceProfile('user-1');
      expect(() => new Date(p.createdAt)).not.toThrow();
      expect(new Date(p.createdAt).toISOString()).toBe(p.createdAt);
    });

    it('two profiles for different IDs are independent', () => {
      const a = createEmptyEssenceProfile('a');
      const b = createEmptyEssenceProfile('b');
      a.core['Values'] = [];
      expect(b.core['Values']).toBeUndefined();
    });
  });
});
