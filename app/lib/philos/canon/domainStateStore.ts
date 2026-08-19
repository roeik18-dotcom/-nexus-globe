/**
 * Philos Canon — DomainStateStore: real persistence for `DomainState`
 * (`valueDomain/valueDomainConfig.ts`).
 *
 * State-fusion backbone pass (recovery board / product-decision "unblock
 * path B"). This is the ONE canonical, persisted, subject-specific
 * DomainState store the task asked for — serving BOTH Human Config state
 * and Value Domain state through the exact same real `DomainState` shape
 * `valueDomainConfig.ts` already defines (extended, this same pass, with
 * `domain_id`/`confidence` — see that file's own header). No second
 * parallel state schema is created: "Human Config state" and "Value
 * Domain state" are the SAME `DomainState` record, distinguished only by
 * which real `domain_id` it names (e.g. `"human_temperament"` vs
 * `"music"`), never by a different type.
 *
 * **Append-only history, by design, not merely by convention.** Unlike
 * `NeedStore` (where a second record for the same `need_id` is REJECTED —
 * a Need has one identity, status changes are a deliberately deferred
 * future slice), a `DomainState` reading is inherently a TIME SERIES: the
 * same (subject, domain_id, parameter_id) legitimately gets a new record
 * every time a real observation/derivation happens, and that is the whole
 * point — "previous state / current state / delta" (the task's own
 * requirement) falls directly out of querying this store chronologically,
 * with NO separate snapshot object needed. Each record gets its own
 * minted `state_id` (never re-derived from parameter_id, since multiple
 * real readings for the same parameter are expected) so a single reading
 * has a stable identity for reload/read-back verification, mirroring how
 * `CanonEvent` mints `canon_event_id` for `Observation` (which likewise
 * has no id of its own).
 *
 * Same file-per-concept discipline `needStore.ts`'s own header documents:
 * own file (`domain-states.jsonl`), own store class, own append-rejection
 * codes, append-only, `checkX` gate separate from the store class,
 * mirroring `NeedStore`'s exact architecture — not a second `canon_type`
 * bolted onto `CanonEventStore`, and not folded into `NeedStore` either
 * (a DomainState is not a Need).
 */
import { existsSync, mkdirSync, readFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";

import type { DomainState, ValueDomainProvenance } from "../valueDomain/valueDomainConfig";
import { parseOffsetInstant } from "./observation";

export const DOMAIN_STATE_STORE_FILENAME = "domain-states.jsonl";

export interface DomainStateRecord {
  state_id: string;
  state: DomainState;
  recorded_at: string;
}

export const DOMAIN_STATE_APPEND_REJECTION_CODES = [
  "empty_append",
  "duplicate_state_id",
  "state_id_already_stored",
  "ambiguous_recorded_at",
  "invalid_domain_state",
] as const;

export type DomainStateAppendRejectionCode = (typeof DOMAIN_STATE_APPEND_REJECTION_CODES)[number];

export interface DomainStateAppendRejection {
  code: DomainStateAppendRejectionCode;
  state_id?: string;
  message: string;
}

export type DomainStateAppendCheck = { ok: true } | { ok: false; rejections: DomainStateAppendRejection[] };

const VALID_PROVENANCE: ValueDomainProvenance[] = ["REAL", "DEMO"];

/** Minimal structural validation, mirroring `validateNeed`'s own
 *  discipline — no field is optional-by-accident; `evidence` is the one
 *  real optional field (matches `DomainState`'s own type). */
function validateDomainState(s: DomainState): string[] {
  const errors: string[] = [];
  if (!s?.domain_id) errors.push("domain_id is required");
  if (!s?.parameter_id) errors.push("parameter_id is required");
  if (!s?.subject) errors.push("subject is required");
  if (typeof s?.level !== "number" || !Number.isFinite(s.level)) errors.push("level must be a finite number");
  if (typeof s?.confidence !== "number" || s.confidence < 0 || s.confidence > 1) errors.push("confidence must be a number between 0 and 1");
  if (parseOffsetInstant(s?.observed_at) === null) errors.push("observed_at is unparseable or lacks an explicit timezone offset");
  if (!s?.provenance || !VALID_PROVENANCE.includes(s.provenance)) errors.push("provenance must be REAL or DEMO");
  return errors;
}

/** Pure and total: never throws, never mutates its arguments — same
 *  contract as `checkNeedAppend`. */
export function checkDomainStateAppend(
  stored: readonly DomainStateRecord[],
  incoming: readonly DomainStateRecord[],
): DomainStateAppendCheck {
  const rejections: DomainStateAppendRejection[] = [];

  if (incoming.length === 0) {
    return { ok: false, rejections: [{ code: "empty_append", message: "an append must carry at least one DomainState record" }] };
  }

  const storedIds = new Set(stored.map((r) => r?.state_id));
  const seen = new Set<string>();
  for (const r of incoming) {
    const id = r?.state_id;

    if (id !== undefined && storedIds.has(id)) {
      rejections.push({ code: "state_id_already_stored", state_id: id, message: `${id} is already in the domain-state log; the log is append-only, so a correction is a new record, not an edit` });
    }
    if (id !== undefined && seen.has(id)) {
      rejections.push({ code: "duplicate_state_id", state_id: id, message: `${id} appears twice in the same append` });
    }
    if (id !== undefined) seen.add(id);

    if (parseOffsetInstant(r?.recorded_at) === null) {
      rejections.push({ code: "ambiguous_recorded_at", state_id: id, message: `recorded_at "${String(r?.recorded_at)}" is unparseable or lacks an explicit timezone offset` });
    }

    const stateErrors = validateDomainState(r?.state as DomainState);
    if (stateErrors.length > 0) {
      rejections.push({ code: "invalid_domain_state", state_id: id, message: `DomainState failed structural validation: ${stateErrors.join("; ")}` });
    }
  }

  return rejections.length === 0 ? { ok: true } : { ok: false, rejections };
}

export class DomainStateAppendRejectedError extends Error {
  readonly rejections: readonly DomainStateAppendRejection[];
  constructor(rejections: readonly DomainStateAppendRejection[]) {
    super(`DomainState append rejected: ${rejections.map((r) => r.message).join("; ")}`);
    this.name = "DomainStateAppendRejectedError";
    this.rejections = rejections;
  }
}

export interface DomainStateStore {
  load(): Promise<DomainStateRecord[]>;
  append(records: readonly DomainStateRecord[]): Promise<DomainStateRecord[]>;
}

/** Deterministic order: `observed_at` ascending, tie-broken by `state_id`
 *  — chronological, matching every other real "history" query in this
 *  codebase (`inNeedOrder`, `inCanonOrder`). */
export function inDomainStateOrder(records: readonly DomainStateRecord[]): DomainStateRecord[] {
  return [...records].sort((a, b) =>
    a.state.observed_at === b.state.observed_at ? a.state_id.localeCompare(b.state_id) : a.state.observed_at.localeCompare(b.state.observed_at),
  );
}

export class InMemoryDomainStateStore implements DomainStateStore {
  private records: DomainStateRecord[];
  constructor(bootstrap: readonly DomainStateRecord[] = []) {
    this.records = [...bootstrap];
  }
  async load(): Promise<DomainStateRecord[]> {
    return inDomainStateOrder(this.records);
  }
  async append(incoming: readonly DomainStateRecord[]): Promise<DomainStateRecord[]> {
    const check = checkDomainStateAppend(this.records, incoming);
    if (!check.ok) throw new DomainStateAppendRejectedError(check.rejections);
    this.records = [...this.records, ...incoming];
    return [...incoming];
  }
}

export class DomainStateLogCorruptError extends Error {
  readonly line_number: number;
  constructor(lineNumber: number, filePath: string) {
    super(`unparseable DomainState record on line ${lineNumber} of ${filePath}; refusing to read a partial log`);
    this.name = "DomainStateLogCorruptError";
    this.line_number = lineNumber;
  }
}

/** Durable, file-system-backed store — mirrors `FileSystemNeedStore`
 *  exactly in shape, at its own file (`domain-states.jsonl`), so this log
 *  never shares a byte of storage with `needs.jsonl`/`canon-events.jsonl`/
 *  any other real store. */
export class FileSystemDomainStateStore implements DomainStateStore {
  private readonly filePath: string;
  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true });
    this.filePath = join(dataDir, DOMAIN_STATE_STORE_FILENAME);
  }

  private readStored(): DomainStateRecord[] {
    if (!existsSync(this.filePath)) return [];
    const lines = readFileSync(this.filePath, "utf-8").split("\n");
    const records: DomainStateRecord[] = [];
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        records.push(JSON.parse(trimmed) as DomainStateRecord);
      } catch {
        throw new DomainStateLogCorruptError(i + 1, this.filePath);
      }
    });
    return records;
  }

  async load(): Promise<DomainStateRecord[]> {
    return inDomainStateOrder(this.readStored());
  }

  async append(incoming: readonly DomainStateRecord[]): Promise<DomainStateRecord[]> {
    const check = checkDomainStateAppend(this.readStored(), incoming);
    if (!check.ok) throw new DomainStateAppendRejectedError(check.rejections);
    for (const r of incoming) {
      appendFileSync(this.filePath, JSON.stringify(r) + "\n", "utf-8");
    }
    return [...incoming];
  }
}
