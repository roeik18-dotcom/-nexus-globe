/**
 * Philos — persistence for Decisions and Decision Reviews.
 *
 * Two logs, two files, one shared append discipline (`appendOnlyStore.ts`).
 * Separate files because the two records have genuinely different lifetimes:
 * a Decision is written once and never again, while reviews accumulate
 * against it over time, and interleaving them in one log would make "every
 * decision I have not yet reviewed" a scan-and-filter rather than a read.
 *
 * **`recorded_at` vs the record's own time.** Both wrappers carry a
 * `recorded_at` that is when the SYSTEM stored it, kept separate from
 * `decided_at` / `reviewed_at`, which are when the thing HAPPENED according
 * to the person. They differ whenever someone writes up yesterday's
 * decision, and collapsing them would silently rewrite history to the moment
 * of typing. Same reasoning as `ActionRecord.recorded_at`.
 *
 * **A review of a decision that does not exist is still stored.** The store
 * does not check `decision_ref` against the decision log. Referential
 * integrity across two append-only logs cannot be enforced at write time
 * without making one log's writer depend on the other's state, and the
 * projection already treats an unmatched review as simply not linked. A
 * dangling reference is visible rather than rejected.
 */
import { join } from "node:path";

import {
  type AppendOnlyStore,
  FileSystemAppendOnlyStore,
  InMemoryAppendOnlyStore,
  type RecordSpec,
} from "./appendOnlyStore";
import { type Decision, validateDecision } from "./decision";
import { type DecisionReview, validateDecisionReview } from "./decisionReview";

export const DECISION_STORE_FILENAME = "decisions.jsonl";
export const DECISION_REVIEW_STORE_FILENAME = "decision-reviews.jsonl";

export interface DecisionRecord {
  decision: Decision;
  recorded_at: string;
}

export interface DecisionReviewRecord {
  review: DecisionReview;
  recorded_at: string;
}

export const DECISION_SPEC: RecordSpec<DecisionRecord> = {
  label: "Decision",
  idOf: (r) => r?.decision?.decision_id,
  recordedAtOf: (r) => r?.recorded_at,
  validate: (r) => validateDecision(r?.decision as Decision),
};

export const DECISION_REVIEW_SPEC: RecordSpec<DecisionReviewRecord> = {
  label: "DecisionReview",
  idOf: (r) => r?.review?.review_id,
  recordedAtOf: (r) => r?.recorded_at,
  validate: (r) => validateDecisionReview(r?.review as DecisionReview),
};

export type DecisionStore = AppendOnlyStore<DecisionRecord>;
export type DecisionReviewStore = AppendOnlyStore<DecisionReviewRecord>;

export function inMemoryDecisionStore(bootstrap: readonly DecisionRecord[] = []): DecisionStore {
  return new InMemoryAppendOnlyStore(DECISION_SPEC, bootstrap);
}

export function inMemoryDecisionReviewStore(
  bootstrap: readonly DecisionReviewRecord[] = [],
): DecisionReviewStore {
  return new InMemoryAppendOnlyStore(DECISION_REVIEW_SPEC, bootstrap);
}

function dataDir(): string {
  return process.env.CANON_DATA_DIR ?? join(process.cwd(), ".philos-canon-data");
}

let _decisionStore: DecisionStore | null = null;
let _decisionReviewStore: DecisionReviewStore | null = null;

export function decisionStore(): DecisionStore {
  if (_decisionStore === null) {
    _decisionStore = new FileSystemAppendOnlyStore(
      DECISION_SPEC,
      dataDir(),
      DECISION_STORE_FILENAME,
    );
  }
  return _decisionStore;
}

export function decisionReviewStore(): DecisionReviewStore {
  if (_decisionReviewStore === null) {
    _decisionReviewStore = new FileSystemAppendOnlyStore(
      DECISION_REVIEW_SPEC,
      dataDir(),
      DECISION_REVIEW_STORE_FILENAME,
    );
  }
  return _decisionReviewStore;
}

/** Test helpers only — never call from production code. */
export function _setDecisionStore(store: DecisionStore | null): void {
  _decisionStore = store;
}
export function _setDecisionReviewStore(store: DecisionReviewStore | null): void {
  _decisionReviewStore = store;
}

export async function loadDecisions(): Promise<DecisionRecord[]> {
  return decisionStore().load();
}

export async function loadDecisionReviews(): Promise<DecisionReviewRecord[]> {
  return decisionReviewStore().load();
}

/**
 * Every decision belonging to one subject. Explicit field match only — a
 * decision is never attributed to a person by proximity or by which session
 * happened to read it.
 */
export async function loadDecisionsForSubject(subject: string): Promise<DecisionRecord[]> {
  const all = await loadDecisions();
  return all.filter((r) => r.decision.subject === subject);
}
