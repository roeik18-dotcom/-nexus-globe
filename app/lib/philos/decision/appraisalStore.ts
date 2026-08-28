/**
 * Philos — persistence for the appraisal layer.
 *
 * Five logs, one shared append discipline (`appendOnlyStore.ts`), same as the
 * decision logs. Separate files per record type for the same reason: they
 * have different lifetimes and different read patterns, and interleaving them
 * would make "every conflict on this case" a scan rather than a read.
 *
 * These are HYPOTHESIS-LAYER records (see `gap.ts`), stored beside the canon
 * data rather than inside `canon/`. They reference canon and the existing
 * value-declaration store; they never restate either.
 */
import { join } from "node:path";

import {
  type AppendOnlyStore,
  FileSystemAppendOnlyStore,
  InMemoryAppendOnlyStore,
  type RecordSpec,
} from "./appendOnlyStore";
import { type Appraisal, type Gap, validateAppraisal, validateGap } from "./gap";
import {
  type ValueConflict,
  type ValueImpact,
  type ValueTradeoff,
  validateValueConflict,
  validateValueImpact,
  validateValueTradeoff,
} from "./valueMechanism";

export const GAP_STORE_FILENAME = "gaps.jsonl";
export const APPRAISAL_STORE_FILENAME = "appraisals.jsonl";
export const VALUE_CONFLICT_STORE_FILENAME = "value-conflicts.jsonl";
export const VALUE_TRADEOFF_STORE_FILENAME = "value-tradeoffs.jsonl";
export const VALUE_IMPACT_STORE_FILENAME = "value-impacts.jsonl";

export interface GapRecord { gap: Gap; recorded_at: string }
export interface AppraisalRecord { appraisal: Appraisal; recorded_at: string }
export interface ValueConflictRecord { conflict: ValueConflict; recorded_at: string }
export interface ValueTradeoffRecord { tradeoff: ValueTradeoff; recorded_at: string }
export interface ValueImpactRecord { impact: ValueImpact; recorded_at: string }

export const GAP_SPEC: RecordSpec<GapRecord> = {
  label: "Gap",
  idOf: (r) => r?.gap?.gap_id,
  recordedAtOf: (r) => r?.recorded_at,
  validate: (r) => validateGap(r?.gap as Gap),
};
export const APPRAISAL_SPEC: RecordSpec<AppraisalRecord> = {
  label: "Appraisal",
  idOf: (r) => r?.appraisal?.appraisal_id,
  recordedAtOf: (r) => r?.recorded_at,
  validate: (r) => validateAppraisal(r?.appraisal as Appraisal),
};
export const VALUE_CONFLICT_SPEC: RecordSpec<ValueConflictRecord> = {
  label: "ValueConflict",
  idOf: (r) => r?.conflict?.conflict_id,
  recordedAtOf: (r) => r?.recorded_at,
  validate: (r) => validateValueConflict(r?.conflict as ValueConflict),
};
export const VALUE_TRADEOFF_SPEC: RecordSpec<ValueTradeoffRecord> = {
  label: "ValueTradeoff",
  idOf: (r) => r?.tradeoff?.tradeoff_id,
  recordedAtOf: (r) => r?.recorded_at,
  validate: (r) => validateValueTradeoff(r?.tradeoff as ValueTradeoff),
};
export const VALUE_IMPACT_SPEC: RecordSpec<ValueImpactRecord> = {
  label: "ValueImpact",
  idOf: (r) => r?.impact?.impact_id,
  recordedAtOf: (r) => r?.recorded_at,
  validate: (r) => validateValueImpact(r?.impact as ValueImpact),
};

function dataDir(): string {
  return process.env.CANON_DATA_DIR ?? join(process.cwd(), ".philos-canon-data");
}

/** One slot per store, so tests can inject and production memoises. */
function makeAccessor<T>(spec: RecordSpec<T>, filename: string) {
  let store: AppendOnlyStore<T> | null = null;
  return {
    get(): AppendOnlyStore<T> {
      if (store === null) store = new FileSystemAppendOnlyStore(spec, dataDir(), filename);
      return store;
    },
    set(next: AppendOnlyStore<T> | null): void {
      store = next;
    },
    memory(bootstrap: readonly T[] = []): AppendOnlyStore<T> {
      return new InMemoryAppendOnlyStore(spec, bootstrap);
    },
  };
}

const gaps = makeAccessor(GAP_SPEC, GAP_STORE_FILENAME);
const appraisals = makeAccessor(APPRAISAL_SPEC, APPRAISAL_STORE_FILENAME);
const conflicts = makeAccessor(VALUE_CONFLICT_SPEC, VALUE_CONFLICT_STORE_FILENAME);
const tradeoffs = makeAccessor(VALUE_TRADEOFF_SPEC, VALUE_TRADEOFF_STORE_FILENAME);
const impacts = makeAccessor(VALUE_IMPACT_SPEC, VALUE_IMPACT_STORE_FILENAME);

export const gapStore = () => gaps.get();
export const appraisalStore = () => appraisals.get();
export const valueConflictStore = () => conflicts.get();
export const valueTradeoffStore = () => tradeoffs.get();
export const valueImpactStore = () => impacts.get();

/** Test helpers only — never call from production code. */
export const _setGapStore = (s: AppendOnlyStore<GapRecord> | null) => gaps.set(s);
export const _setAppraisalStore = (s: AppendOnlyStore<AppraisalRecord> | null) => appraisals.set(s);
export const _setValueConflictStore = (s: AppendOnlyStore<ValueConflictRecord> | null) => conflicts.set(s);
export const _setValueTradeoffStore = (s: AppendOnlyStore<ValueTradeoffRecord> | null) => tradeoffs.set(s);
export const _setValueImpactStore = (s: AppendOnlyStore<ValueImpactRecord> | null) => impacts.set(s);

export const inMemoryGapStore = (b: readonly GapRecord[] = []) => gaps.memory(b);
export const inMemoryAppraisalStore = (b: readonly AppraisalRecord[] = []) => appraisals.memory(b);
export const inMemoryValueConflictStore = (b: readonly ValueConflictRecord[] = []) => conflicts.memory(b);
export const inMemoryValueTradeoffStore = (b: readonly ValueTradeoffRecord[] = []) => tradeoffs.memory(b);
export const inMemoryValueImpactStore = (b: readonly ValueImpactRecord[] = []) => impacts.memory(b);

export const loadGaps = () => gapStore().load();
export const loadAppraisals = () => appraisalStore().load();
export const loadValueConflicts = () => valueConflictStore().load();
export const loadValueTradeoffs = () => valueTradeoffStore().load();
export const loadValueImpacts = () => valueImpactStore().load();
