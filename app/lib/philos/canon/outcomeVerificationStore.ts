/**
 * VERIFICATIONS LIVE IN THEIR OWN APPEND-ONLY STORE.
 *
 * An Effect is written once and never rewritten — `effectStore` refuses a
 * second record for the same `effect_id`, which is what makes a reported
 * outcome a fixed record rather than something that can be edited into
 * agreement later. A verification therefore cannot be patched into the Effect
 * it verifies; it is a SEPARATE act, by a DIFFERENT person, at a LATER time,
 * and it gets a separate record that points back.
 *
 * That separation is not a workaround for the append-only rule. It is the
 * honest shape: the claim and the confirmation are two events, and collapsing
 * them into one row is exactly what let a single person be both.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { OutcomeVerification } from "./outcomeVerification";

export const VERIFICATION_STORE_FILENAME = "outcome-verifications.jsonl";

export interface VerificationRecord {
  /** This record's own id — what a Learning cites as
   *  `outcome_verification_ref`, so the citation points at a real record
   *  rather than a string assembled from the Effect's id. */
  verification_id: string;
  /** The Effect this verifies. One verification per Effect is enforced above. */
  effect_id: string;
  recorded_at: string;
  verification: OutcomeVerification;
  /** REAL only ever set by the authenticated writer. */
  record_origin?: "REAL";
}

export interface VerificationStore {
  load(): Promise<VerificationRecord[]>;
  append(records: readonly VerificationRecord[]): Promise<VerificationRecord[]>;
}

export class FileSystemVerificationStore implements VerificationStore {
  private readonly filePath: string;
  constructor(dataDir: string) { this.filePath = join(dataDir, VERIFICATION_STORE_FILENAME); }

  async load(): Promise<VerificationRecord[]> {
    if (!existsSync(this.filePath)) return [];
    const out: VerificationRecord[] = [];
    for (const line of readFileSync(this.filePath, "utf8").split("\n")) {
      const t = line.trim();
      if (!t) continue;
      /* A malformed line is skipped, never half-applied — the same discipline
         `valuePackage` uses, for the same reason: a partial record is worse
         than a missing one. */
      try { out.push(JSON.parse(t) as VerificationRecord); } catch { /* skip */ }
    }
    return out;
  }

  async append(records: readonly VerificationRecord[]): Promise<VerificationRecord[]> {
    if (records.length === 0) return [];
    mkdirSync(dirname(this.filePath), { recursive: true });
    for (const r of records) appendFileSync(this.filePath, JSON.stringify(r) + "\n", "utf8");
    return [...records];
  }
}

/** In-memory twin for tests — same contract, no filesystem. Mirrors the
 *  `InMemory*Store` pattern every other store in this directory provides. */
export class InMemoryVerificationStore implements VerificationStore {
  private readonly records: VerificationRecord[] = [];
  async load(): Promise<VerificationRecord[]> { return [...this.records]; }
  async append(records: readonly VerificationRecord[]): Promise<VerificationRecord[]> {
    this.records.push(...records);
    return [...records];
  }
}
