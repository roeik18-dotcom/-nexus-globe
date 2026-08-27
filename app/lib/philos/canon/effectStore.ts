/**
 * Philos Canon — EffectStore: real persistence for `Effect` (canon §17,
 * `./effect.ts`). Stage of the real Action/Effect/Learning lifecycle holding
 * both EXPECTED EFFECT (`effect.claimed_outcome`) and OBSERVED EFFECT
 * (`effect.verified_outcome`) — the same one record, on the same one field
 * distinction `effect.ts` already established (`claimed_outcome` ≠
 * `verified_outcome`, never merged).
 *
 * Mirrors `needStore.ts`/`actionStore.ts` exactly in shape and discipline —
 * own file (`effects.jsonl`), own store class, own append-rejection codes, a
 * pure `checkX` gate separate from the store class, JSONL persistence,
 * append-only (recording a NEW `verified_outcome` for the same Effect —
 * i.e. evidence arriving later — is a NEW record referencing the same
 * `action_ref`, never an in-place edit of a prior claimed-only record; this
 * is exactly "NO VERIFIED EFFECT != NO EFFECT" made concrete: the
 * claimed-only record stays real and on the log, a later verified record is
 * additional evidence, not a correction that erases it).
 *
 * `effect.effect_id` is the real identity — no new id scheme, same reasoning
 * already given for Need/Action.
 *
 * **This store does not check that `effect.action_ref` names a real, stored
 * Action.** That referential-integrity rule belongs to the orchestrator
 * (`actionLifecycle.ts::recordEffect`), which has both stores in scope — the
 * same "gate, don't invent a cross-store dependency inside a single-domain
 * store" discipline `verticalSlice.ts` already applies to
 * `effect.action_ref === transfer.action_id`. A store, on its own, cannot
 * know what exists in a different store without a parameter that would
 * break the exact mirrored shape every other file in this directory uses —
 * so it doesn't try; it validates only what `validateEffect` already checks
 * plus append-only identity, same scope `needStore.ts`/`actionStore.ts` keep.
 */
import { existsSync, mkdirSync, readFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";

import { type Effect, type EffectError, validateEffect } from "./effect";
import { parseOffsetInstant } from "./observation";
import { isRecordOrigin, type RecordOrigin } from "../recordOrigin";

export const EFFECT_STORE_FILENAME = "effects.jsonl";

/** Wraps the real, unmodified `Effect` type. `recorded_at` is when this
 *  record was appended — distinct from `Effect.time`. */
/** Absent or unrecognised origin is UNKNOWN — never optimistically REAL. */
export function effectOriginOf(record: Pick<EffectRecord, "record_origin"> | undefined | null): RecordOrigin {
  return isRecordOrigin(record?.record_origin) ? record.record_origin : "UNKNOWN";
}

/** The one admissibility test. A projection must ask THIS, not read prose. */
export function isEffectAdmissible(record: Pick<EffectRecord, "record_origin"> | undefined | null): boolean {
  return effectOriginOf(record) === "REAL";
}

export interface EffectRecord {
  effect: Effect;
  recorded_at: string;
  /**
   * WHERE THIS RECORD CAME FROM — the record-level origin, exactly as
   * `CanonEvent` already carries it.
   *
   * `effect.provenance` is a HUMAN SENTENCE explaining why the effect happened
   * ("self-initiated via Marketplace following a permitted Match…"). Thirteen
   * projections were comparing that prose to the string "REAL" and, finding it
   * unequal, rendering a genuine record as UNKNOWN. The two questions are
   * different: `provenance` is the person's explanation and belongs to them;
   * this field is the system's statement about the writer that produced the
   * record, and no free text may ever stand in for it.
   *
   * OPTIONAL, AND ABSENT MEANS UNKNOWN. Stored records predating this contract
   * are not migrated or rewritten — they simply have no origin, which is the
   * honest answer for them. Read it through `effectOriginOf()`, never directly.
   */
  record_origin?: RecordOrigin;
}

export const EFFECT_APPEND_REJECTION_CODES = [
  "empty_append",
  "duplicate_effect_id",
  "effect_id_already_stored",
  "ambiguous_recorded_at",
  "invalid_effect",
] as const;

export type EffectAppendRejectionCode = (typeof EFFECT_APPEND_REJECTION_CODES)[number];

export interface EffectAppendRejection {
  code: EffectAppendRejectionCode;
  effect_id?: string;
  message: string;
  errors?: EffectError[];
}

export type EffectAppendCheck = { ok: true } | { ok: false; rejections: EffectAppendRejection[] };

/** Pure and total: never throws, never mutates its arguments. */
export function checkEffectAppend(
  stored: readonly EffectRecord[],
  incoming: readonly EffectRecord[],
): EffectAppendCheck {
  const rejections: EffectAppendRejection[] = [];

  if (incoming.length === 0) {
    return { ok: false, rejections: [{ code: "empty_append", message: "an append must carry at least one Effect record" }] };
  }

  const storedIds = new Set(stored.map((r) => r?.effect?.effect_id));
  const seen = new Set<string>();
  for (const r of incoming) {
    const id = r?.effect?.effect_id;

    if (id !== undefined && storedIds.has(id)) {
      rejections.push({
        code: "effect_id_already_stored",
        effect_id: id,
        message: `${id} is already in the effect log; the log is append-only — new evidence about the same effect_id (e.g. a later verified_outcome) is a NEW record, not an edit`,
      });
    }
    if (id !== undefined && seen.has(id)) {
      rejections.push({ code: "duplicate_effect_id", effect_id: id, message: `${id} appears twice in the same append` });
    }
    if (id !== undefined) seen.add(id);

    if (parseOffsetInstant(r?.recorded_at) === null) {
      rejections.push({
        code: "ambiguous_recorded_at",
        effect_id: id,
        message: `recorded_at "${String(r?.recorded_at)}" is unparseable or lacks an explicit timezone offset`,
      });
    }

    const validation = validateEffect(r?.effect as Effect);
    if (!validation.valid) {
      rejections.push({ code: "invalid_effect", effect_id: id, message: "Effect failed structural validation", errors: validation.errors });
    }
  }

  return rejections.length === 0 ? { ok: true } : { ok: false, rejections };
}

export class EffectAppendRejectedError extends Error {
  readonly rejections: readonly EffectAppendRejection[];
  constructor(rejections: readonly EffectAppendRejection[]) {
    super(`Effect append rejected: ${rejections.map((r) => r.message).join("; ")}`);
    this.name = "EffectAppendRejectedError";
    this.rejections = rejections;
  }
}

export interface EffectStore {
  load(): Promise<EffectRecord[]>;
  append(records: readonly EffectRecord[]): Promise<EffectRecord[]>;
}

/** Deterministic order: `recorded_at` ascending, tie-broken by `effect_id`. */
export function inEffectOrder(records: readonly EffectRecord[]): EffectRecord[] {
  return [...records].sort((a, b) =>
    a.recorded_at === b.recorded_at ? a.effect.effect_id.localeCompare(b.effect.effect_id) : a.recorded_at.localeCompare(b.recorded_at),
  );
}

export class InMemoryEffectStore implements EffectStore {
  private records: EffectRecord[];
  constructor(bootstrap: readonly EffectRecord[] = []) {
    this.records = [...bootstrap];
  }
  async load(): Promise<EffectRecord[]> {
    return inEffectOrder(this.records);
  }
  async append(incoming: readonly EffectRecord[]): Promise<EffectRecord[]> {
    const check = checkEffectAppend(this.records, incoming);
    if (!check.ok) throw new EffectAppendRejectedError(check.rejections);
    this.records = [...this.records, ...incoming];
    return [...incoming];
  }
}

export class EffectLogCorruptError extends Error {
  readonly line_number: number;
  constructor(lineNumber: number, filePath: string) {
    super(`unparseable Effect record on line ${lineNumber} of ${filePath}; refusing to read a partial log`);
    this.name = "EffectLogCorruptError";
    this.line_number = lineNumber;
  }
}

/** Durable, file-system-backed store — mirrors `FileSystemNeedStore`/
 *  `FileSystemActionStore` exactly, at a DIFFERENT file (`effects.jsonl`). */
export class FileSystemEffectStore implements EffectStore {
  private readonly filePath: string;
  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true });
    this.filePath = join(dataDir, EFFECT_STORE_FILENAME);
  }

  private readStored(): EffectRecord[] {
    if (!existsSync(this.filePath)) return [];
    const lines = readFileSync(this.filePath, "utf-8").split("\n");
    const records: EffectRecord[] = [];
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        records.push(JSON.parse(trimmed) as EffectRecord);
      } catch {
        throw new EffectLogCorruptError(i + 1, this.filePath);
      }
    });
    return records;
  }

  async load(): Promise<EffectRecord[]> {
    return inEffectOrder(this.readStored());
  }

  async append(incoming: readonly EffectRecord[]): Promise<EffectRecord[]> {
    const check = checkEffectAppend(this.readStored(), incoming);
    if (!check.ok) throw new EffectAppendRejectedError(check.rejections);
    for (const r of incoming) {
      appendFileSync(this.filePath, JSON.stringify(r) + "\n", "utf-8");
    }
    return [...incoming];
  }
}
