/**
 * Philos Canon — CanonEventStore: the Observation → store-append edge.
 *
 * Second, and deliberately separate, integration edge approved after the
 * read-only audit that preceded this pass. Read-only findings that drove
 * this design (cited by file:line, re-verified this pass):
 *
 *   1. **The existing store** is `PhilosEventStore` (`../eventStore.ts`),
 *      with `InMemoryPhilosEventStore` and `FileSystemPhilosEventStore`
 *      (`../../philos-event-store.ts`) implementations.
 *   2. **Append API**: `PhilosEventStore.append(events): Promise<PhilosEvent[]>`,
 *      throwing `AppendRejectedError`, gated by the pure `checkAppend(stored,
 *      incoming)` (`eventStore.ts:73`).
 *   3. **Persistence format**: JSONL — one `JSON.stringify(event) + "\n"`
 *      per line, written via `appendFileSync` (`philos-event-store.ts:99`,
 *      a single, non-torn syscall), at `<dataDir>/philos-events.jsonl`.
 *   4. **Identity/idempotency**: `event_id` is the identity key.
 *      `checkAppend` **rejects** ("event_id_already_stored") a resubmitted
 *      id rather than silently ignoring or overwriting it — "a correction
 *      is a new event, never an edit" (`eventStore.ts:18-19`). It also
 *      rejects a duplicate id *within* one append batch.
 *   5. **Projection consumers**: `projectValueGroup`, `projectDynamics`,
 *      `projectGlobeGraph` — all pure folds over the `PhilosEvent[]`
 *      `loadPhilosEvents()` returns. None of them is touched, imported, or
 *      exercised by this file (see `__tests__/canonEventStore.test.ts`'s
 *      `NO_PROJECTION_SIDE_EFFECT`/`NO_DYNAMICS_SIDE_EFFECT`).
 *   6. **Collision check, read-only, confirmed real**: appending a
 *      `CanonEvent` into the SAME `PhilosEventStore`/`philos-events.jsonl`
 *      would require either (a) inventing fake values for `PhilosEvent`
 *      fields `CanonEvent` doesn't have (`entity_type`, `event_type`,
 *      `actor_id`, `visibility`, …) — semantic corruption of exactly the
 *      kind this pass forbids — or (b) widening `PhilosEvent`/`EventType`
 *      to accommodate it, which **is** "silently redefining the existing
 *      live event schema," explicitly forbidden. **Conclusion: a real,
 *      avoidable collision, not a hypothetical one.**
 *
 * **The resulting design**: a store with the SAME architectural
 * DISCIPLINE (append-only; reject-not-silently-ignore duplicate ids;
 * pure `checkX` gate separate from the store class; JSONL persistence
 * option) applied to `CanonEvent` (`./canonEvent.ts`) — in a **separate
 * file** (`canon-events.jsonl`, never `philos-events.jsonl`) and **separate
 * in-memory state**. This proves the integration PATTERN is sound and
 * reusable without ever sharing a byte of live state with the Value Group
 * log. `CanonEvent` remains structurally and physically distinguishable
 * from every `PhilosEvent` — different type, different file, different
 * store instance, different `EventType`-analog (`CanonType`, one value:
 * `"observation"`, per the prior pass's own scope).
 *
 * **Where this store diverges from `checkAppend`'s scope, and why**:
 * `checkAppend` deliberately does NOT validate a `PhilosEvent`'s full field
 * correctness — "whether an event is *meaningful*... those are command
 * concerns" (`eventStore.ts:22-26`), because the live system has a separate
 * command layer (`commands/*.ts`) that already validated before construction.
 * This store has no analogous command layer yet (canon events are
 * constructed directly by whatever calls `append`), so `checkCanonAppend`
 * **also** runs `validateCanonEvent` as a final gate before persistence —
 * a deliberate, documented widening of scope for a brand-new, unproven
 * store, not a claim that the live system's narrower choice was wrong for
 * its own context.
 *
 * No Domain/Transfer naming collision is touched or hidden here — this file
 * imports nothing from `projectDynamics.ts` or `transfer.ts`/
 * `projectValueGroup.ts`, same as `canonEvent.ts` before it.
 *
 * No projection, no Dynamics, no UI, no Merlin, no n8n, no automatic state
 * mutation, no cross-domain aggregation exists anywhere in this file.
 */
import { existsSync, mkdirSync, readFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";

import {
  type CanonEvent,
  type CanonEventError,
  validateCanonEvent,
} from "./canonEvent";
import { parseOffsetInstant } from "./observation";

export const CANON_STORE_FILENAME = "canon-events.jsonl";

/** The closed set of reasons a canon-event append is refused. */
export const CANON_APPEND_REJECTION_CODES = [
  "empty_append",
  "duplicate_canon_event_id",
  "canon_event_id_already_stored",
  "ambiguous_recorded_at",
  "invalid_canon_event",
] as const;

export type CanonAppendRejectionCode = (typeof CANON_APPEND_REJECTION_CODES)[number];

export interface CanonAppendRejection {
  code: CanonAppendRejectionCode;
  canon_event_id?: string;
  message: string;
  /** Present for `invalid_canon_event`: validateCanonEvent's own diagnostics. */
  errors?: CanonEventError[];
}

export type CanonAppendCheck =
  | { ok: true }
  | { ok: false; rejections: CanonAppendRejection[] };

/**
 * Decide whether `incoming` may be appended to `stored`. Pure and total:
 * never throws, never mutates its arguments — same contract as
 * `../eventStore.ts::checkAppend`.
 */
export function checkCanonAppend(
  stored: readonly CanonEvent[],
  incoming: readonly CanonEvent[],
): CanonAppendCheck {
  const rejections: CanonAppendRejection[] = [];

  if (incoming.length === 0) {
    return {
      ok: false,
      rejections: [{ code: "empty_append", message: "an append must carry at least one event" }],
    };
  }

  const storedIds = new Set(stored.map((e) => e?.canon_event_id));
  const seen = new Set<string>();
  for (const e of incoming) {
    const id = e?.canon_event_id;

    if (id !== undefined && storedIds.has(id)) {
      rejections.push({
        code: "canon_event_id_already_stored",
        canon_event_id: id,
        message: `${id} is already in the canon-event log; the log is append-only, so a correction is a new event`,
      });
    }
    if (id !== undefined && seen.has(id)) {
      rejections.push({
        code: "duplicate_canon_event_id",
        canon_event_id: id,
        message: `${id} appears twice in the same append`,
      });
    }
    if (id !== undefined) seen.add(id);

    if (parseOffsetInstant(e?.recorded_at) === null) {
      rejections.push({
        code: "ambiguous_recorded_at",
        canon_event_id: id,
        message: `recorded_at "${String(e?.recorded_at)}" is unparseable or lacks an explicit timezone offset`,
      });
    }

    const validation = validateCanonEvent(e);
    if (!validation.valid) {
      rejections.push({
        code: "invalid_canon_event",
        canon_event_id: id,
        message: `canon event failed structural validation`,
        errors: validation.errors,
      });
    }
  }

  return rejections.length === 0 ? { ok: true } : { ok: false, rejections };
}

/** Thrown by a store when `checkCanonAppend` refuses. Carries every reason, not the first. */
export class CanonAppendRejectedError extends Error {
  readonly rejections: readonly CanonAppendRejection[];

  constructor(rejections: readonly CanonAppendRejection[]) {
    super(`canon event append rejected: ${rejections.map((r) => r.message).join("; ")}`);
    this.name = "CanonAppendRejectedError";
    this.rejections = rejections;
  }
}

/** The canon-event log, as everything above it sees it. */
export interface CanonEventStore {
  load(): Promise<CanonEvent[]>;
  /** Appends, or throws `CanonAppendRejectedError`. Returns the events as stored. */
  append(events: readonly CanonEvent[]): Promise<CanonEvent[]>;
}

/**
 * Deterministic order: `recorded_at` ascending, tie-broken by
 * `canon_event_id` — same shape as `../events.ts::inOrder`.
 */
export function inCanonOrder(events: readonly CanonEvent[]): CanonEvent[] {
  return [...events].sort((a, b) =>
    a.recorded_at === b.recorded_at
      ? a.canon_event_id.localeCompare(b.canon_event_id)
      : a.recorded_at.localeCompare(b.recorded_at),
  );
}

/** In-memory store — mirrors `InMemoryPhilosEventStore` exactly in shape. */
export class InMemoryCanonEventStore implements CanonEventStore {
  private events: CanonEvent[];

  constructor(bootstrap: readonly CanonEvent[] = []) {
    this.events = [...bootstrap];
  }

  async load(): Promise<CanonEvent[]> {
    return inCanonOrder(this.events);
  }

  async append(incoming: readonly CanonEvent[]): Promise<CanonEvent[]> {
    const check = checkCanonAppend(this.events, incoming);
    if (!check.ok) throw new CanonAppendRejectedError(check.rejections);
    this.events = [...this.events, ...incoming];
    return [...incoming];
  }
}

/** Thrown when the canon-event log on disk cannot be read. Never swallowed
 *  — same "corruption is loud" discipline as `PhilosLogCorruptError`. */
export class CanonLogCorruptError extends Error {
  readonly line_number: number;

  constructor(lineNumber: number, filePath: string) {
    super(
      `unparseable canon event on line ${lineNumber} of ${filePath}; refusing to read a partial log`,
    );
    this.name = "CanonLogCorruptError";
    this.line_number = lineNumber;
  }
}

/**
 * Durable, file-system-backed store — mirrors `FileSystemPhilosEventStore`
 * exactly in shape, at a DIFFERENT file (`canon-events.jsonl`, never
 * `philos-events.jsonl`) so the two logs never share a byte of storage.
 * No bootstrap/seed array — canon events have no analog to
 * `VALUE_GROUP_EVENTS` yet.
 */
export class FileSystemCanonEventStore implements CanonEventStore {
  private readonly filePath: string;

  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true });
    this.filePath = join(dataDir, CANON_STORE_FILENAME);
  }

  private readStored(): CanonEvent[] {
    if (!existsSync(this.filePath)) return [];
    const lines = readFileSync(this.filePath, "utf-8").split("\n");
    const events: CanonEvent[] = [];
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        events.push(JSON.parse(trimmed) as CanonEvent);
      } catch {
        throw new CanonLogCorruptError(i + 1, this.filePath);
      }
    });
    return events;
  }

  async load(): Promise<CanonEvent[]> {
    return inCanonOrder(this.readStored());
  }

  async append(incoming: readonly CanonEvent[]): Promise<CanonEvent[]> {
    const check = checkCanonAppend(this.readStored(), incoming);
    if (!check.ok) throw new CanonAppendRejectedError(check.rejections);
    for (const e of incoming) {
      appendFileSync(this.filePath, JSON.stringify(e) + "\n", "utf-8");
    }
    return [...incoming];
  }
}
