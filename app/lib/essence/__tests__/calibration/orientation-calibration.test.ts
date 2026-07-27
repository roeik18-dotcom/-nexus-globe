/**
 * M0-9C — CI Calibration Tests
 *
 * Structural and architectural assertions for the orientation calibration corpus
 * and the RuleBasedOrientationProvider. Runs in CI without LLM API access.
 *
 * Does NOT perform TP/FP measurement — that is orientation-baseline.run.ts.
 *
 * Test blocks:
 *   1. Corpus schema validity
 *   2. Entry ID uniqueness and format
 *   3. pairId referential integrity
 *   4. Dimension coverage (§2.7)
 *   5. set field validity (§2.5)
 *   6. expectedSignals / forbiddenSignals field validity
 *   7. Multi-signal invariant (§4.6)
 *   8. Rule Provider corpus behavior (§4.1 provenance, §4.5 weight range)
 *   9. No content logging (§ content-logging policy)
 *  10. Rule Provider determinism (§4.2)
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import {
  CORPUS,
  MEASUREMENT_CORPUS,
  EVALUATION_CORPUS,
  HEBREW_CORPUS,
} from './corpus/orientation-calibration';
import type { CorpusEntry } from './corpus/orientation-calibration';
import { ORIENTATION_SCHEMA } from '../../orientation';
import type { OrientationDimensionKey } from '../../orientation';
import { RuleBasedOrientationProvider } from '../../orientation-rule-provider';
import { createEmptyEssenceProfile } from '../../schema';
import type { EssenceProfile } from '../../schema';
import type { OrientationInferenceInput } from '../../orientation-inference';

// ── Shared fixtures ────────────────────────────────────────────────────────────

const FIXED_CLOCK = { now: () => 0 };

function makeInput(entry: CorpusEntry): OrientationInferenceInput {
  return {
    sessionId:           'calibration',
    profileId:           'calibration',
    sourceObservationId: entry.entryId,
    exchange:            entry.exchange,
  };
}

const SHARED_PROFILE = createEmptyEssenceProfile('calibration') as Readonly<EssenceProfile>;

const DIMENSIONS = Object.keys(ORIENTATION_SCHEMA) as OrientationDimensionKey[];

// ── Block 1: Corpus schema validity ───────────────────────────────────────────

describe('1 · corpus schema validity', () => {
  it.each(CORPUS)('$entryId has all required fields', (entry) => {
    expect(entry.entryId).toBeTruthy();
    expect(entry.corpusVersion).toBeTruthy();
    expect(entry.exchange.userMessage).toBeTruthy();
    expect(typeof entry.exchange.assistantResponse).toBe('string');
    expect(['he', 'en']).toContain(entry.language);
    expect(['measurement', 'evaluation']).toContain(entry.set);
    expect(Array.isArray(entry.expectedSignals)).toBe(true);
    expect(Array.isArray(entry.forbiddenSignals)).toBe(true);
  });
});

// ── Block 2: Entry ID uniqueness and format ────────────────────────────────────

describe('2 · entry ID format and uniqueness', () => {
  it('all entryIds match OD-\\d{3} format', () => {
    for (const entry of CORPUS) {
      expect(entry.entryId).toMatch(/^OD-\d{3}$/);
    }
  });

  it('no duplicate entryIds', () => {
    const ids = CORPUS.map(e => e.entryId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ── Block 3: pairId referential integrity ─────────────────────────────────────

describe('3 · pairId referential integrity', () => {
  it('only en entries carry pairId', () => {
    for (const entry of CORPUS) {
      if (entry.pairId !== undefined) {
        expect(entry.language).toBe('en');
      }
    }
  });

  it('pairId references a valid he entryId', () => {
    const heIds = new Set(CORPUS.filter(e => e.language === 'he').map(e => e.entryId));
    for (const entry of CORPUS) {
      if (entry.pairId !== undefined) {
        expect(heIds.has(entry.pairId)).toBe(true);
      }
    }
  });

  it('no self-referencing pairIds', () => {
    for (const entry of CORPUS) {
      if (entry.pairId !== undefined) {
        expect(entry.pairId).not.toBe(entry.entryId);
      }
    }
  });

  it('pairId entries share the same dimension and category as their Hebrew source', () => {
    const byId = new Map(CORPUS.map(e => [e.entryId, e]));
    for (const entry of CORPUS) {
      if (entry.pairId === undefined) continue;
      const source = byId.get(entry.pairId);
      expect(source).toBeDefined();
      expect(entry.dimension).toBe(source!.dimension);
      expect(entry.category).toBe(source!.category);
    }
  });
});

// ── Block 4: Dimension coverage (§2.7) ───────────────────────────────────────

describe('4 · dimension coverage', () => {
  const active = HEBREW_CORPUS.filter(e => !e.deprecated);

  it.each(DIMENSIONS)('%s: at least one explicit (positive) entry in Hebrew corpus', (dim) => {
    const found = active.filter(e => e.dimension === dim && e.category === 'explicit');
    expect(found.length).toBeGreaterThanOrEqual(1);
  });

  it.each(DIMENSIONS)('%s: at least one negative entry in Hebrew corpus', (dim) => {
    const found = active.filter(e => e.dimension === dim && e.category === 'negative');
    expect(found.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Block 5: set field validity (§2.5) ────────────────────────────────────────

describe('5 · set field validity', () => {
  it('every entry carries an explicit set value', () => {
    for (const entry of CORPUS) {
      expect(['measurement', 'evaluation']).toContain(entry.set);
    }
  });

  it('MEASUREMENT_CORPUS contains only measurement entries', () => {
    for (const entry of MEASUREMENT_CORPUS) {
      expect(entry.set).toBe('measurement');
    }
  });

  it('EVALUATION_CORPUS contains only evaluation entries', () => {
    for (const entry of EVALUATION_CORPUS) {
      expect(entry.set).toBe('evaluation');
    }
  });

  it('MEASUREMENT_CORPUS and EVALUATION_CORPUS are disjoint', () => {
    const measurementIds = new Set(MEASUREMENT_CORPUS.map(e => e.entryId));
    for (const entry of EVALUATION_CORPUS) {
      expect(measurementIds.has(entry.entryId)).toBe(false);
    }
  });
});

// ── Block 6: expectedSignals / forbiddenSignals field validity ─────────────────

describe('6 · signal field validity', () => {
  it.each(CORPUS)('$entryId: expectedSignals reference valid candidateValues', (entry) => {
    const allowed = ORIENTATION_SCHEMA[entry.dimension] as readonly string[];
    for (const sig of entry.expectedSignals) {
      expect(allowed).toContain(sig.candidateValue);
    }
  });

  it.each(CORPUS)('$entryId: expectedSignal minWeights are in (0, 1]', (entry) => {
    for (const sig of entry.expectedSignals) {
      expect(sig.minWeight).toBeGreaterThan(0);
      expect(sig.minWeight).toBeLessThanOrEqual(1);
    }
  });

  it.each(CORPUS)('$entryId: forbiddenSignals reference valid candidateValues', (entry) => {
    const allowed = ORIENTATION_SCHEMA[entry.dimension] as readonly string[];
    for (const val of entry.forbiddenSignals) {
      expect(allowed).toContain(val);
    }
  });

  it.each(CORPUS)('$entryId: no duplicate expectedSignal candidateValues', (entry) => {
    const values = entry.expectedSignals.map(s => s.candidateValue);
    expect(new Set(values).size).toBe(values.length);
  });

  it.each(CORPUS)('$entryId: no duplicate forbiddenSignals', (entry) => {
    expect(new Set(entry.forbiddenSignals).size).toBe(entry.forbiddenSignals.length);
  });

  it.each(CORPUS)('$entryId: expectedSignals and forbiddenSignals do not overlap', (entry) => {
    const expectedValues = new Set(entry.expectedSignals.map(s => s.candidateValue));
    for (const forbidden of entry.forbiddenSignals) {
      expect(expectedValues.has(forbidden)).toBe(false);
    }
  });
});

// ── Block 7: Multi-signal invariant (§4.6) ────────────────────────────────────

describe('7 · multi-signal invariant', () => {
  it('a corpus entry may carry more than one expectedSignal for the same dimension (§4.6)', () => {
    // The spec explicitly permits multiple signals per dimension per observation.
    // This structural entry verifies no max-length-1 constraint exists.
    const multiSignalEntry: CorpusEntry = {
      entryId:          'OD-TEST',
      corpusVersion:    '1.0.0',
      dimension:        'OrientationResponseDepth',
      category:         'ambiguous',
      set:              'evaluation',
      language:         'he',
      exchange: {
        userMessage:       'תסביר בפירוט אבל בקצרה.',
        assistantResponse: 'אנסה.',
      },
      expectedSignals:  [
        { candidateValue: 'brief',       minWeight: 0.7 },
        { candidateValue: 'explanatory', minWeight: 0.7 },
      ],
      forbiddenSignals: [],
    };

    expect(multiSignalEntry.expectedSignals).toHaveLength(2);
    const values = multiSignalEntry.expectedSignals.map(s => s.candidateValue);
    expect(values).toContain('brief');
    expect(values).toContain('explanatory');
  });

  it('Rule Provider is not asserted to emit at most one signal per dimension (§4.6)', async () => {
    // Sending a message that triggers two dimension keys; Provider may emit both — that is correct.
    const provider = new RuleBasedOrientationProvider('merlin', FIXED_CLOCK);
    const input: OrientationInferenceInput = {
      sessionId:           'calibration',
      profileId:           'calibration',
      sourceObservationId: 'multi-signal-test',
      exchange: {
        userMessage:       'תסביר בקצרה שלב אחר שלב.',
        assistantResponse: 'בשמחה.',
      },
    };
    const signals = await provider.extractSignals(input, SHARED_PROFILE);
    // Must not throw; multiple signals per dimension are permitted
    expect(Array.isArray(signals)).toBe(true);
  });
});

// ── Block 8: Rule Provider corpus behavior ────────────────────────────────────

describe('8 · Rule Provider behavior on corpus', () => {
  let provider: RuleBasedOrientationProvider;

  beforeAll(() => {
    provider = new RuleBasedOrientationProvider('merlin', FIXED_CLOCK);
  });

  it.each(MEASUREMENT_CORPUS)(
    '$entryId: all emitted signal weights are in (0, 1]',
    async (entry) => {
      const signals = await provider.extractSignals(makeInput(entry), SHARED_PROFILE);
      for (const sig of signals) {
        expect(sig.signalWeight).toBeGreaterThan(0);
        expect(sig.signalWeight).toBeLessThanOrEqual(1);
      }
    },
  );

  it.each(MEASUREMENT_CORPUS)(
    '$entryId: no duplicate (dimensionKey, candidateValue) pairs emitted',
    async (entry) => {
      const signals = await provider.extractSignals(makeInput(entry), SHARED_PROFILE);
      const keys = signals.map(s => JSON.stringify([s.dimensionKey, s.candidateValue]));
      expect(new Set(keys).size).toBe(keys.length);
    },
  );

  it.each(MEASUREMENT_CORPUS.filter(e => e.expectedSignals.length > 0))(
    '$entryId: all expectedSignals are detected for the entry dimension',
    async (entry) => {
      const signals = await provider.extractSignals(makeInput(entry), SHARED_PROFILE);
      const detected = new Set(
        signals.filter(s => s.dimensionKey === entry.dimension).map(s => s.candidateValue),
      );
      for (const expected of entry.expectedSignals) {
        expect(detected.has(expected.candidateValue)).toBe(true);
      }
    },
  );

  it.each(MEASUREMENT_CORPUS.filter(e => e.forbiddenSignals.length > 0))(
    '$entryId: no forbiddenSignals are emitted for the entry dimension',
    async (entry) => {
      const signals = await provider.extractSignals(makeInput(entry), SHARED_PROFILE);
      const detected = new Set(
        signals.filter(s => s.dimensionKey === entry.dimension).map(s => s.candidateValue),
      );
      for (const forbidden of entry.forbiddenSignals) {
        expect(detected.has(forbidden)).toBe(false);
      }
    },
  );

  // Provenance invariant (§4.1): adversarial entries must produce no signals
  it.each(MEASUREMENT_CORPUS.filter(e => e.category === 'adversarial'))(
    '$entryId (adversarial): emits no signals (§4.1)',
    async (entry) => {
      const signals = await provider.extractSignals(makeInput(entry), SHARED_PROFILE);
      expect(signals).toHaveLength(0);
    },
  );

  // inferredBy format (§4.7)
  it.each(MEASUREMENT_CORPUS.filter(e => e.expectedSignals.length > 0))(
    '$entryId: inferredBy matches required format (§4.7)',
    async (entry) => {
      const signals = await provider.extractSignals(makeInput(entry), SHARED_PROFILE);
      for (const sig of signals) {
        expect(sig.inferredBy).toMatch(/^[a-z]+\/[a-z-]+@\d+$/);
      }
    },
  );
});

// ── Block 9: No content logging ───────────────────────────────────────────────

describe('9 · no content logging', () => {
  it('Rule Provider does not call any console method across all corpus entries', async () => {
    const methods = ['log', 'info', 'warn', 'error', 'debug'] as const;
    const spies = methods.map(m => vi.spyOn(console, m).mockImplementation(() => {}));

    try {
      const provider = new RuleBasedOrientationProvider('merlin', FIXED_CLOCK);
      for (const entry of CORPUS) {
        await provider.extractSignals(makeInput(entry), SHARED_PROFILE);
      }
      for (const spy of spies) {
        expect(spy).not.toHaveBeenCalled();
      }
    } finally {
      for (const spy of spies) {
        spy.mockRestore();
      }
    }
  });
});

// ── Block 10: Rule Provider determinism (§4.2) ────────────────────────────────

describe('10 · Rule Provider determinism', () => {
  it('identical candidateValues, weights, and inferredBy across three calls on each corpus entry', async () => {
    const provider = new RuleBasedOrientationProvider('merlin', FIXED_CLOCK);

    for (const entry of CORPUS) {
      const input = makeInput(entry);
      const [run1, run2, run3] = await Promise.all([
        provider.extractSignals(input, SHARED_PROFILE),
        provider.extractSignals(input, SHARED_PROFILE),
        provider.extractSignals(input, SHARED_PROFILE),
      ]);

      const key = (signals: typeof run1) =>
        signals.map(s => [s.candidateValue, s.signalWeight, s.inferredBy]);

      expect(key(run2)).toEqual(key(run1));
      expect(key(run3)).toEqual(key(run1));
    }
  });
});
