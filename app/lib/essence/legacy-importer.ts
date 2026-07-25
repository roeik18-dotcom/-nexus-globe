/**
 * Essence · Legacy Importer
 *
 * Scans legacy source fields and produces LegacyImportCandidate[].
 * Has NO write access to EssenceRepository — that authority belongs to
 * EssenceProposalService alone.
 *
 * Import ledger state machine:
 *   scanned → proposal_created → confirmed
 *                              ↘ rejected
 *                              ↘ failed
 *           ↘ skipped
 *
 * 'already_imported' is only returned when the ledger state is 'confirmed'.
 * Entries in 'rejected' or 'failed' are eligible for retry on the next scan.
 */

import type { EssenceLayer } from './ontology';
import type { AgentName } from './access';
import { computeLegacyFingerprint } from './legacy-fingerprint';

export type ImportLedgerState =
  | 'scanned'
  | 'proposal_created'
  | 'confirmed'
  | 'rejected'
  | 'failed'
  | 'skipped';

export interface ImportLedgerEntry {
  fingerprint: string;
  nodeId: string;
  state: ImportLedgerState;
  scannedAt: string;
  proposalId?: string;
  updatedAt?: string;
  reason?: string;
}

/** A candidate ready to be submitted to EssenceProposalService. */
export interface LegacyImportCandidate {
  fingerprint: string;
  nodeId: string;
  layer: EssenceLayer;
  content: string;
  sourceFile: string;
  proposedBy: AgentName;
  rationale: string;
}

export interface LegacyImportScanResult {
  candidates: LegacyImportCandidate[];
  skipped: Array<{ fingerprint: string; nodeId: string; reason: string }>;
}

export interface LegacySourceField {
  nodeId: string;
  layer: EssenceLayer;
  content: string;
  rationale: string;
}

export interface LegacyImportSource {
  sourceFile: string;
  fields: LegacySourceField[];
}

export class LegacyImporter {
  private readonly ledger = new Map<string, ImportLedgerEntry>();

  scan(source: LegacyImportSource, proposedBy: AgentName): LegacyImportScanResult {
    const candidates: LegacyImportCandidate[] = [];
    const skipped: Array<{ fingerprint: string; nodeId: string; reason: string }> = [];
    const now = new Date().toISOString();

    for (const field of source.fields) {
      if (!field.content || field.content.trim() === '') continue;

      const fingerprint = computeLegacyFingerprint({
        nodeId: field.nodeId,
        content: field.content,
        sourceFile: source.sourceFile,
      });

      const existing = this.ledger.get(fingerprint);
      if (existing?.state === 'confirmed') {
        skipped.push({ fingerprint, nodeId: field.nodeId, reason: 'already_imported' });
        continue;
      }

      this.ledger.set(fingerprint, {
        fingerprint,
        nodeId: field.nodeId,
        state: 'scanned',
        scannedAt: now,
      });

      candidates.push({
        fingerprint,
        nodeId: field.nodeId,
        layer: field.layer,
        content: field.content,
        sourceFile: source.sourceFile,
        proposedBy,
        rationale: field.rationale,
      });
    }

    return { candidates, skipped };
  }

  markProposalCreated(fingerprint: string, proposalId: string): void {
    const entry = this.ledger.get(fingerprint);
    if (!entry) throw new Error(`No ledger entry for fingerprint: ${fingerprint}`);
    this.ledger.set(fingerprint, {
      ...entry,
      state: 'proposal_created',
      proposalId,
      updatedAt: new Date().toISOString(),
    });
  }

  markConfirmed(fingerprint: string): void {
    const entry = this.ledger.get(fingerprint);
    if (!entry) throw new Error(`No ledger entry for fingerprint: ${fingerprint}`);
    this.ledger.set(fingerprint, {
      ...entry,
      state: 'confirmed',
      updatedAt: new Date().toISOString(),
    });
  }

  markRejected(fingerprint: string, reason: string): void {
    const entry = this.ledger.get(fingerprint);
    if (!entry) throw new Error(`No ledger entry for fingerprint: ${fingerprint}`);
    this.ledger.set(fingerprint, {
      ...entry,
      state: 'rejected',
      reason,
      updatedAt: new Date().toISOString(),
    });
  }

  markFailed(fingerprint: string, reason: string): void {
    const entry = this.ledger.get(fingerprint);
    if (!entry) throw new Error(`No ledger entry for fingerprint: ${fingerprint}`);
    this.ledger.set(fingerprint, {
      ...entry,
      state: 'failed',
      reason,
      updatedAt: new Date().toISOString(),
    });
  }

  getEntry(fingerprint: string): ImportLedgerEntry | null {
    return this.ledger.get(fingerprint) ?? null;
  }

  getLedgerSnapshot(): ImportLedgerEntry[] {
    return Array.from(this.ledger.values());
  }
}
