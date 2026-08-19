/**
 * The append boundary — the one place an event may enter the Philos log.
 *
 * PHILOS-SYSTEM-BLUEPRINT §11 makes the event log the single source of truth,
 * and everything downstream of it — four projections, three screens — was built
 * as a pure fold. What was missing is the other half: until now the log was a
 * `const` in `valueGroupLog.ts`, so nothing a user did could ever be recorded.
 * The only "action" in the product appended to React state and vanished on
 * refresh. This module is the writer that closes that loop.
 *
 * DOMAIN LAYER — pure. No `node:fs`, no `next/*`, no clock read, no id source of
 * its own. The durable implementation lives in `app/lib/philos-event-store.ts`,
 * outside this directory, exactly as `essence-timeline-fs-repository.ts` sits
 * outside `app/lib/essence/`. Time and identity arrive through `Clock` and
 * `IdGenerator` so every test is deterministic without freezing a global.
 *
 * The store is APPEND-ONLY and the rule has teeth: `checkAppend` refuses an
 * event whose id is already stored rather than overwriting it. A correction is
 * a new event, never an edit — the same discipline `caused_by` is documented
 * with in `events.ts`.
 *
 * What this module deliberately does NOT do: decide whether an event is
 * *meaningful*. Whether a person may join a group, whether a group exists, what
 * the event's causal parents are — those are command concerns
 * (`commands/joinGroup.ts`). This layer checks only that the log stays
 * structurally sound: unique ids, orderable timestamps, valid causality.
 */

import type { PhilosEvent } from "./events";
import { inOrder } from "./events";
import {
  hasUnambiguousTimestamp,
  validateCausality,
  type CausalityDiagnostic,
} from "./eventCausality";

/** The closed set of reasons an append is refused. */
export const APPEND_REJECTION_CODES = [
  "empty_append",
  "duplicate_event_id",
  "event_id_already_stored",
  "ambiguous_timestamp",
  "causality_invalid",
] as const;

export type AppendRejectionCode = (typeof APPEND_REJECTION_CODES)[number];

export interface AppendRejection {
  code: AppendRejectionCode;
  /** The offending event, when the rejection concerns one. */
  event_id?: string;
  message: string;
  /** Present for `causality_invalid`: the validator's own error diagnostics. */
  diagnostics?: CausalityDiagnostic[];
}

export type AppendCheck =
  | { ok: true }
  | { ok: false; rejections: AppendRejection[] };

/**
 * Decide whether `incoming` may be appended to `stored`.
 *
 * Causality is validated in **strict** mode over the union, not over `incoming`
 * alone: an event's declared parents will normally be events already in the log,
 * and lenient mode would downgrade a genuinely dangling parent to a warning. At
 * the write boundary the log IS closed — every parent must resolve — so a
 * `caused_by` pointing nowhere is refused here rather than becoming an
 * unresolved claim every reader has to render forever.
 *
 * Pure and total: never throws, never mutates its arguments.
 */
export function checkAppend(
  stored: readonly PhilosEvent[],
  incoming: readonly PhilosEvent[],
): AppendCheck {
  const rejections: AppendRejection[] = [];

  if (incoming.length === 0) {
    return {
      ok: false,
      rejections: [
        {
          code: "empty_append",
          message: "an append must carry at least one event",
        },
      ],
    };
  }

  const storedIds = new Set(stored.map((e) => e.event_id));
  const seen = new Set<string>();
  for (const e of incoming) {
    if (storedIds.has(e.event_id)) {
      rejections.push({
        code: "event_id_already_stored",
        event_id: e.event_id,
        message: `${e.event_id} is already in the log; the log is append-only, so a correction is a new event`,
      });
    }
    if (seen.has(e.event_id)) {
      rejections.push({
        code: "duplicate_event_id",
        event_id: e.event_id,
        message: `${e.event_id} appears twice in the same append`,
      });
    }
    seen.add(e.event_id);

    if (!hasUnambiguousTimestamp(e.timestamp)) {
      rejections.push({
        code: "ambiguous_timestamp",
        event_id: e.event_id,
        message: `timestamp "${String(e.timestamp)}" is unparseable or lacks an explicit timezone offset`,
      });
    }
  }

  const report = validateCausality([...stored, ...incoming], "strict");
  if (!report.ok) {
    rejections.push({
      code: "causality_invalid",
      message: `causal declaration is invalid: ${report.errors.map((d) => d.message).join("; ")}`,
      diagnostics: report.errors,
    });
  }

  return rejections.length === 0 ? { ok: true } : { ok: false, rejections };
}

/** Thrown by a store when `checkAppend` refuses. Carries every reason, not the first. */
export class AppendRejectedError extends Error {
  readonly rejections: readonly AppendRejection[];

  constructor(rejections: readonly AppendRejection[]) {
    super(`event append rejected: ${rejections.map((r) => r.message).join("; ")}`);
    this.name = "AppendRejectedError";
    this.rejections = rejections;
  }
}

/**
 * The log, as everything above it sees it.
 *
 * `load` returns the full log in canonical order (`inOrder`), so a caller never
 * has to know whether an event came from the bootstrap seed or from disk.
 */
export interface PhilosEventStore {
  load(): Promise<PhilosEvent[]>;
  /** Appends, or throws `AppendRejectedError`. Returns the events as stored. */
  append(events: readonly PhilosEvent[]): Promise<PhilosEvent[]>;
}

/** The current instant, as an ISO-8601 string carrying an explicit offset. */
export interface Clock {
  now(): string;
}

/** Source of event ids. Injected so tests never depend on wall-clock or randomness. */
export interface IdGenerator {
  next(prefix: string): string;
}

/** `toISOString()` always carries the `Z` offset, which is what the validator requires. */
export const systemClock: Clock = {
  now: () => new Date().toISOString(),
};

/**
 * The calendar date a screen means by "today", read from the same clock that
 * stamps events.
 *
 * Both sides must come from one source. The daily feed buckets an event by the
 * date in its own timestamp, so a "today" derived from a different clock — or a
 * different timezone — would let a user record an action and then not find it
 * under today, with nothing on screen able to explain the gap.
 */
export const todayIn = (clock: Clock): string => clock.now().slice(0, 10);

/**
 * Ids that sort in creation order.
 *
 * `inOrder` breaks timestamp ties with `event_id.localeCompare`, and a command
 * routinely emits several events at the SAME instant (a registration and the
 * membership it enables). If ids sorted arbitrarily the projection could read
 * the membership before the registration that names the person. So the counter
 * is zero-padded to a fixed width: lexicographic order then matches numeric
 * order, and same-instant events fold in the order they were minted.
 */
export function createIdGenerator(startAt = 0): IdGenerator {
  let n = startAt;
  const base = Date.now().toString(36);
  return {
    next: (prefix: string) => {
      n += 1;
      return `${prefix}_${base}_${String(n).padStart(6, "0")}`;
    },
  };
}

/**
 * Deterministic generator for tests: `ev_000001`, `ev_000002`, … Same padding
 * rule, so the ordering guarantee under test is the production one.
 */
export function fixedIdGenerator(startAt = 0): IdGenerator {
  let n = startAt;
  return {
    next: (prefix: string) => {
      n += 1;
      return `${prefix}_${String(n).padStart(6, "0")}`;
    },
  };
}

/** A fixed clock for tests. Reads the same instant every call, by design. */
export function fixedClock(at: string): Clock {
  return { now: () => at };
}

/**
 * In-memory store. Used by tests and by any caller that wants the append rules
 * without the disk. Durability is the file-system store's job, not this one's.
 */
export class InMemoryPhilosEventStore implements PhilosEventStore {
  private events: PhilosEvent[];

  constructor(bootstrap: readonly PhilosEvent[] = []) {
    this.events = [...bootstrap];
  }

  async load(): Promise<PhilosEvent[]> {
    return inOrder(this.events);
  }

  async append(incoming: readonly PhilosEvent[]): Promise<PhilosEvent[]> {
    const check = checkAppend(this.events, incoming);
    if (!check.ok) throw new AppendRejectedError(check.rejections);
    this.events = [...this.events, ...incoming];
    return [...incoming];
  }
}
