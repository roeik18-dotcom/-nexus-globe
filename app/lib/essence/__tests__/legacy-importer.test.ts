/**
 * Legacy importer — scan, state machine, idempotency.
 */

import { describe, it, expect } from 'vitest';
import { LegacyImporter, type LegacyImportSource } from '../legacy-importer';

const BASE_SOURCE: LegacyImportSource = {
  sourceFile: 'jarvis.json',
  fields: [
    {
      nodeId: 'PersonalIdentity',
      layer: 'identity',
      content: 'Roi Katz',
      rationale: 'owner field in jarvis.json',
    },
    {
      nodeId: 'Communication',
      layer: 'expression',
      content: 'Hebrew',
      rationale: 'preferences.language field',
    },
  ],
};

describe('LegacyImporter', () => {
  it('scan returns one candidate per non-empty field', () => {
    const importer = new LegacyImporter();
    const result = importer.scan(BASE_SOURCE, 'philos');
    expect(result.candidates).toHaveLength(2);
    expect(result.skipped).toHaveLength(0);
  });

  it('scan skips empty content fields', () => {
    const importer = new LegacyImporter();
    const source: LegacyImportSource = {
      sourceFile: 'test.json',
      fields: [
        { nodeId: 'Values', layer: 'core', content: '', rationale: 'empty' },
        { nodeId: 'Values', layer: 'core', content: '   ', rationale: 'whitespace' },
        { nodeId: 'Values', layer: 'core', content: 'non-empty', rationale: 'ok' },
      ],
    };
    const result = importer.scan(source, 'philos');
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].content).toBe('non-empty');
  });

  it('scan after confirm marks confirmed fingerprints as already_imported', () => {
    const importer = new LegacyImporter();
    const result1 = importer.scan(BASE_SOURCE, 'philos');
    const fp = result1.candidates[0].fingerprint;

    importer.markProposalCreated(fp, 'proposal-001');
    importer.markConfirmed(fp);

    const result2 = importer.scan(BASE_SOURCE, 'philos');
    const skippedFps = result2.skipped.map(s => s.fingerprint);
    expect(skippedFps).toContain(fp);

    const skipped = result2.skipped.find(s => s.fingerprint === fp);
    expect(skipped?.reason).toBe('already_imported');
  });

  it('rejected entries are eligible for retry on re-scan', () => {
    const importer = new LegacyImporter();
    const result1 = importer.scan(BASE_SOURCE, 'philos');
    const fp = result1.candidates[0].fingerprint;

    importer.markProposalCreated(fp, 'proposal-001');
    importer.markRejected(fp, 'test rejection');

    const result2 = importer.scan(BASE_SOURCE, 'philos');
    const retried = result2.candidates.some(c => c.fingerprint === fp);
    expect(retried).toBe(true);
  });

  it('failed entries are eligible for retry on re-scan', () => {
    const importer = new LegacyImporter();
    const result1 = importer.scan(BASE_SOURCE, 'philos');
    const fp = result1.candidates[0].fingerprint;

    importer.markFailed(fp, 'network error');

    const result2 = importer.scan(BASE_SOURCE, 'philos');
    const retried = result2.candidates.some(c => c.fingerprint === fp);
    expect(retried).toBe(true);
  });

  it('ledger state transitions: scanned → proposal_created → confirmed', () => {
    const importer = new LegacyImporter();
    const result = importer.scan(BASE_SOURCE, 'philos');
    const fp = result.candidates[0].fingerprint;

    expect(importer.getEntry(fp)?.state).toBe('scanned');
    importer.markProposalCreated(fp, 'p1');
    expect(importer.getEntry(fp)?.state).toBe('proposal_created');
    importer.markConfirmed(fp);
    expect(importer.getEntry(fp)?.state).toBe('confirmed');
  });

  it('getLedgerSnapshot returns all ledger entries', () => {
    const importer = new LegacyImporter();
    importer.scan(BASE_SOURCE, 'philos');
    expect(importer.getLedgerSnapshot()).toHaveLength(2);
  });

  it('markConfirmed throws if fingerprint not in ledger', () => {
    const importer = new LegacyImporter();
    expect(() => importer.markConfirmed('fp_unknown')).toThrow();
  });
});
